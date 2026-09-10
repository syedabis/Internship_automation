export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getAuthClient, SHEETS_SCOPE } from '@/lib/googleAuth';
import { getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/activityLog';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SUBMISSIONS_SHEET_NAME = 'Sheet1';
// Sheet1 already tracks send-state under a "Certificate" column (values like "sent")
// in the live sheet; also accept "Status" in case a differently-provisioned sheet
// uses that name instead. Whichever one already exists in the header row wins.
const STATUS_COLUMN_CANDIDATES = ['certificate', 'status'];

// Requires one of these headers to already exist in Sheet1 (it's part of the
// production sheet already) rather than creating it on demand here. The external
// Apps Script's doPost also touches Sheet1's header row dynamically per-submission,
// so mutating headers from this route too would open a needless race — reading/
// writing an existing column has no such risk since doPost never rewrites existing
// rows.
export async function POST(req) {
  try {
    if (!SPREADSHEET_ID) {
      return NextResponse.json({ error: 'Submissions data is not available right now.' }, { status: 500 });
    }

    const { rowNumber, status } = await req.json();
    if (!Number.isInteger(rowNumber) || typeof status !== 'string' || !status) {
      return NextResponse.json({ error: 'rowNumber and status are required.' }, { status: 400 });
    }

    const auth = getAuthClient([SHEETS_SCOPE]);
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle[SUBMISSIONS_SHEET_NAME];
    if (!sheet) {
      return NextResponse.json({ error: 'Submissions data is not available right now.' }, { status: 404 });
    }

    await sheet.loadHeaderRow();
    const statusColumn = sheet.headerValues.find((h) => STATUS_COLUMN_CANDIDATES.includes(h.toLowerCase()));
    if (!statusColumn) {
      return NextResponse.json(
        { error: 'Submissions data isn’t set up to track send status yet — contact support to enable it.' },
        { status: 400 }
      );
    }

    const rows = await sheet.getRows();
    const row = rows.find((r) => r.rowNumber === rowNumber);
    if (!row) {
      return NextResponse.json({ error: `Row ${rowNumber} not found.` }, { status: 404 });
    }

    // A workshop-scoped account may only touch rows for its own workshop(s) —
    // without this, a scoped account could bypass the UI's filtering by simply
    // calling this endpoint with another society's rowNumber.
    const session = await getSession(req);
    if (session.workshops.length > 0) {
      const workshopKey = sheet.headerValues.find((h) => h.toLowerCase() === 'workshop');
      const rowWorkshop = workshopKey ? row.get(workshopKey) : null;
      if (!rowWorkshop || !session.workshops.includes(rowWorkshop)) {
        return NextResponse.json({ error: 'This submission is outside your assigned workshops.' }, { status: 403 });
      }
    }

    row.set(statusColumn, status);
    await row.save();

    const name = row.get('Name') || row.get('Email') || `row ${rowNumber}`;
    await logActivity(`Marked submission as ${status}`, name, session.email);

    return NextResponse.json({ result: 'success' });
  } catch (error) {
    console.error('Failed to update submission status:', error);
    return NextResponse.json({ error: 'Failed to update submission status.' }, { status: 500 });
  }
}
