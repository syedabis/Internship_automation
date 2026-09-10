export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_MAX_AGE_SECONDS,
  ADMIN_COOKIE_NAME,
  MASTER_ADMIN_LABEL,
  ROLE_ADMIN,
  createSessionToken,
  isMasterAdminCredentials,
} from '@/lib/adminAuth';
import { verifyUserCredentials } from '@/lib/users';
import { logActivity } from '@/lib/activityLog';

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    let role;
    let label;
    let workshops = [];
    let orgName = null;
    let logoUrl = null;
    // Identifies the account for the Activity Log's per-user filtering — the
    // master admin has no per-user row, so it stays null there (and always
    // sees the full log regardless, per the "unrestricted admin" rule below).
    let actorEmail = null;

    if (await isMasterAdminCredentials(email, password)) {
      // Master fallback — works even if the Users sheet is empty/unreachable, so
      // this check never depends on it. Requires both ADMIN_EMAIL and
      // ADMIN_PASSWORD to match, not password alone. Always unrestricted
      // (workshops: []).
      role = ROLE_ADMIN;
      label = MASTER_ADMIN_LABEL;
    } else {
      const user = await verifyUserCredentials(email, password);
      if (!user) {
        return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
      }
      role = user.role;
      label = user.username || user.email;
      workshops = user.workshops || [];
      orgName = user.orgName || null;
      logoUrl = user.logoUrl || null;
      actorEmail = user.email;
    }

    const scopeNote = workshops.length ? ` [${workshops.join(', ')}]` : '';
    await logActivity('Logged in', `${label} (${role})${scopeNote}`, actorEmail);

    const token = await createSessionToken({ role, label, workshops, orgName, logoUrl, email: actorEmail });
    const response = NextResponse.json({ result: 'success', role, label, workshops, orgName, logoUrl });
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error('Admin login failed:', error);
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
