export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getAuthClient, SHEETS_SCOPE } from '@/lib/googleAuth';
import { getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/activityLog';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const CODES_SHEET_NAME = 'Sheet2';

// Sheet2's header casing isn't guaranteed (existing routes already tolerate this —
// see app/api/submit/route.js's getVerificationData), so resolve the actual "code",
// "workshop", and "filename" header names case-insensitively instead of assuming
// exact casing. "filename" ties a code+workshop pair to the exact Drive template
// file it unlocks — it's how the admin panel matches templates to codes.
export async function getCodesSheet(auth) {
  if (!SPREADSHEET_ID) {
    throw new Error('Codes data is not available right now.');
  }

  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();

  const sheet = doc.sheetsByTitle[CODES_SHEET_NAME];
  if (!sheet) {
    throw new Error('Codes data is not available right now.');
  }

  await sheet.loadHeaderRow();
  const codeKey = sheet.headerValues.find((h) => h.toLowerCase() === 'code');
  const workshopKey = sheet.headerValues.find((h) => h.toLowerCase() === 'workshop');
  const filenameKey = sheet.headerValues.find((h) => h.toLowerCase() === 'filename');

  if (!codeKey || !workshopKey) {
    throw new Error('Codes data is not set up correctly — contact support.');
  }

  return { sheet, codeKey, workshopKey, filenameKey };
}

export async function GET(req) {
  try {
    const auth = getAuthClient([SHEETS_SCOPE]);
    const { sheet, codeKey, workshopKey, filenameKey } = await getCodesSheet(auth);

    const rows = await sheet.getRows();
    let codes = rows.map((row) => ({
      rowNumber: row.rowNumber,
      code: row.get(codeKey) || '',
      workshop: row.get(workshopKey) || '',
      filename: filenameKey ? row.get(filenameKey) || '' : '',
    }));

    // A workshop-scoped admin (a society managing only their own workshop) only
    // sees/manages their own codes — enforced here, not just hidden in the UI.
    const session = await getSession(req);
    if (session.workshops.length > 0) {
      codes = codes.filter((c) => session.workshops.includes(c.workshop));
    }

    return NextResponse.json({ codes });
  } catch (error) {
    console.error('Failed to load codes:', error);
    return NextResponse.json({ error: error.message || 'Failed to load codes.' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { code, workshop, filename } = await req.json();
    const trimmedCode = (code || '').toString().trim();
    const trimmedWorkshop = (workshop || '').toString().trim();
    const trimmedFilename = (filename || '').toString().trim();

    if (!trimmedCode || !trimmedWorkshop) {
      return NextResponse.json({ error: 'Code and workshop are both required.' }, { status: 400 });
    }

    const session = await getSession(req);
    if (session.workshops.length > 0 && !session.workshops.includes(trimmedWorkshop)) {
      return NextResponse.json({ error: 'You can only add codes for your assigned workshop(s).' }, { status: 403 });
    }

    const auth = getAuthClient([SHEETS_SCOPE]);
    const { sheet, codeKey, workshopKey, filenameKey } = await getCodesSheet(auth);

    const existingRows = await sheet.getRows();
    const isDuplicate = existingRows.some(
      (row) => row.get(codeKey) === trimmedCode && row.get(workshopKey) === trimmedWorkshop
    );
    if (isDuplicate) {
      return NextResponse.json({ error: 'This code already exists for this workshop.' }, { status: 409 });
    }

    const newRow = await sheet.addRow({
      [codeKey]: trimmedCode,
      [workshopKey]: trimmedWorkshop,
      ...(filenameKey ? { [filenameKey]: trimmedFilename } : {}),
    });

    await logActivity('Added code', `"${trimmedCode}" for "${trimmedWorkshop}"`, session.email);

    return NextResponse.json(
      {
        code: {
          rowNumber: newRow.rowNumber,
          code: trimmedCode,
          workshop: trimmedWorkshop,
          filename: trimmedFilename,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to add code:', error);
    return NextResponse.json({ error: error.message || 'Failed to add code.' }, { status: 500 });
  }
}
