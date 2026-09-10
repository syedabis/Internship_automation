export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSession, ROLE_ADMIN } from '@/lib/adminAuth';
import { getRecentActivity } from '@/lib/activityLog';

export async function GET(req) {
  try {
    let activity = await getRecentActivity();

    // Only a fully unrestricted admin (the master login, or an admin account
    // with no workshop scope) sees the whole platform's activity — everyone
    // else (any general/viewer account, or an admin scoped to specific
    // workshops) sees just their own actions, not other accounts' logins or
    // user-management events.
    const session = await getSession(req);
    const isUnrestrictedAdmin = session.role === ROLE_ADMIN && session.workshops.length === 0;
    if (!isUnrestrictedAdmin) {
      activity = activity.filter((entry) => entry.actorEmail && entry.actorEmail === session.email);
    }

    return NextResponse.json({ activity });
  } catch (error) {
    console.error('Failed to load activity log:', error);
    return NextResponse.json({ error: error.message || 'Failed to load activity log.' }, { status: 500 });
  }
}
