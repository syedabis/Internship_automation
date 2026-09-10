export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/adminAuth';
import { deleteUserByEmail, resetUserPassword, updateUserBranding } from '@/lib/users';
import { logActivity } from '@/lib/activityLog';

export async function DELETE(req, { params }) {
  try {
    const { email } = await params;
    const decodedEmail = decodeURIComponent(email || '');
    if (!decodedEmail) {
      return NextResponse.json({ error: 'email is required.' }, { status: 400 });
    }

    await deleteUserByEmail(decodedEmail);
    const session = await getSession(req);
    await logActivity('Deleted user', decodedEmail, session.email);

    return NextResponse.json({ result: 'success' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    const status = error.message === 'User not found.' ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to delete user.' }, { status });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { email } = await params;
    const decodedEmail = decodeURIComponent(email || '');
    if (!decodedEmail) {
      return NextResponse.json({ error: 'email is required.' }, { status: 400 });
    }

    const body = await req.json();
    const session = await getSession(req);

    // Two independent things can be patched here: a password reset, or a
    // branding update (org name / logo). A request carries exactly one —
    // distinguished by which keys are present.
    if (body.orgName !== undefined || body.logoUrl !== undefined) {
      const user = await updateUserBranding(decodedEmail, { orgName: body.orgName, logoUrl: body.logoUrl });
      await logActivity('Updated branding', `${decodedEmail} -> ${user.orgName || '(default)'}`, session.email);
      return NextResponse.json({ user });
    }

    const { password } = body;
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    await resetUserPassword(decodedEmail, password);
    await logActivity('Reset password', decodedEmail, session.email);

    return NextResponse.json({ result: 'success' });
  } catch (error) {
    console.error('Failed to update user:', error);
    const status = error.message === 'User not found.' ? 404 : 400;
    return NextResponse.json({ error: error.message || 'Failed to update user.' }, { status });
  }
}
