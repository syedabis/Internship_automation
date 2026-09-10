export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { ROLE_ADMIN, ROLE_GENERAL, getSession } from '@/lib/adminAuth';
import { createUser, listUsers } from '@/lib/users';
import { logActivity } from '@/lib/activityLog';

export async function GET() {
  try {
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Failed to list users:', error);
    return NextResponse.json({ error: error.message || 'Failed to list users.' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { email, username, role, password, workshops, orgName, logoUrl } = await req.json();

    if (role !== ROLE_ADMIN && role !== ROLE_GENERAL) {
      return NextResponse.json({ error: 'role must be "admin" or "general".' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const user = await createUser({ email, username, role, password, workshops, orgName, logoUrl });
    const scopeNote = user.workshops?.length ? ` scoped to ${user.workshops.join(', ')}` : ' (unrestricted)';
    const session = await getSession(req);
    await logActivity('Created user', `${user.email} as ${user.role}${scopeNote}`, session.email);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Failed to create user:', error);
    const status = error.message?.includes('already exists') ? 409 : 400;
    return NextResponse.json({ error: error.message || 'Failed to create user.' }, { status });
  }
}
