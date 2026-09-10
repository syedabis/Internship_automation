export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getAuthClient, SHEETS_SCOPE } from '@/lib/googleAuth';
import { getSession } from '@/lib/adminAuth';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || process.env.INTERNSHIP_SPREADSHEET_ID || '1ppO4jhKzp3FyFTrft9LCakmnDxAw9oYX52tVI_NKdKw';
const SUBMISSIONS_SHEET_NAME = 'Sheet1';

export async function GET(req) {
  try {
    if (!SPREADSHEET_ID) {
      return NextResponse.json({ error: 'Submissions data is not available right now.' }, { status: 500 });
    }

    const auth = getAuthClient([SHEETS_SCOPE]);
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle[SUBMISSIONS_SHEET_NAME];
    if (!sheet) {
      return NextResponse.json({ error: `Sheet "${SUBMISSIONS_SHEET_NAME}" not found.` }, { status: 404 });
    }

    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();

    let submissions = rows.map((row) => ({
      ...row.toObject(),
      rowNumber: row.rowNumber,
    }));

    // A workshop-scoped account (workshops.length > 0) only ever sees its own
    // society's rows — enforced here, not just hidden in the UI, so the API
    // itself never leaks other tenants' data even to a direct request.
    const session = await getSession(req);
    if (session.workshops.length > 0) {
      const workshopKey = sheet.headerValues.find((h) => h.toLowerCase() === 'workshop');
      submissions = workshopKey
        ? submissions.filter((row) => session.workshops.includes(row[workshopKey]))
        : [];
    }

    return NextResponse.json({ submissions, headers: sheet.headerValues });
  } catch (error) {
    console.error('Failed to load submissions:', error);
    return NextResponse.json({ error: error.message || 'Failed to load submissions.' }, { status: 500 });
  }
}
