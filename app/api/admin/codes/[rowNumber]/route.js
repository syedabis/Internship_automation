export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAuthClient, SHEETS_SCOPE } from '@/lib/googleAuth';
import { getCodesSheet } from '../route';
import { getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/activityLog';

export async function DELETE(req, { params }) {
  try {
    const { rowNumber } = await params;
    const targetRow = Number(rowNumber);
    if (!Number.isInteger(targetRow)) {
      return NextResponse.json({ error: 'A valid rowNumber is required.' }, { status: 400 });
    }

    const auth = getAuthClient([SHEETS_SCOPE]);
    const { sheet, codeKey, workshopKey } = await getCodesSheet(auth);

    const rows = await sheet.getRows();
    const row = rows.find((r) => r.rowNumber === targetRow);
    if (!row) {
      return NextResponse.json({ error: `Row ${targetRow} not found.` }, { status: 404 });
    }

    const rowWorkshop = row.get(workshopKey) || '';
    const session = await getSession(req);
    if (session.workshops.length > 0 && !session.workshops.includes(rowWorkshop)) {
      return NextResponse.json({ error: 'This code is outside your assigned workshops.' }, { status: 403 });
    }

    const detail = `"${row.get(codeKey) || ''}" for "${rowWorkshop}"`;
    await row.delete();
    await logActivity('Deleted code', detail, session.email);

    return NextResponse.json({ result: 'success' });
  } catch (error) {
    console.error('Failed to delete code:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete code.' }, { status: 500 });
  }
}
