import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, ROLE_ADMIN, verifySessionToken } from '@/lib/adminAuth';

// Paths (basePath-relative — Next applies `basePath` automatically) that must stay
// reachable without a session, otherwise nobody could ever log in.
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/login']);

// Everything else under /admin is reachable by both roles. Templates and codes
// are now viewable read-only by the "general" role too (so a scoped society
// account can at least see which certificate design/code is active for their
// workshop) — only the *mutating* requests (upload/delete/add) stay
// admin-only, which is why this checks the method, not just the path. Marking
// a submission sent and all of Users management stay fully admin-only.
function isAdminOnly(pathname, method) {
  if (pathname === '/admin/users' || pathname.startsWith('/api/admin/users')) {
    return true;
  }
  if (pathname === '/api/admin/submissions/status') {
    return true;
  }
  if (pathname.startsWith('/api/admin/templates') || pathname.startsWith('/api/admin/codes')) {
    return method !== 'GET';
  }
  // '/admin/templates' itself (the page) has no HTTP verb to distinguish —
  // it's just a read on load, so it's open to both roles.
  return false;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session.valid) {
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/admin/login';
    return NextResponse.redirect(loginUrl);
  }

  if (session.role !== ROLE_ADMIN && isAdminOnly(pathname, request.method)) {
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/admin';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
