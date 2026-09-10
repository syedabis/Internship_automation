import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/adminAuth';
import { AdminRoleProvider } from './_components/RoleContext';
import { ThemeProvider } from './_components/ThemeContext';

// Base path — must match `basePath` in next.config.mjs; CSS url() does not auto-apply it.
const BASE_PATH = '/certificate';
// Kept in sync with the literal in _components/ThemeContext.js (see the note
// there on why it's duplicated instead of shared across the server/client
// module boundary).
const THEME_COOKIE_NAME = 'admin_theme';

export const metadata = {
  title: 'Admin — Workshop Certificates',
};

export default async function AdminRootLayout({ children }) {
  // Read here (server-side, once) so client components can render role-appropriate
  // UI (hide the Templates link/Mark-sent button for the read-only "general" role)
  // without an extra client fetch. This is a courtesy for the UI — middleware.js is
  // the actual enforcement point for every route and API call.
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  const role = session.valid ? session.role : null;
  const label = session.valid ? session.label : null;
  const workshops = session.valid ? session.workshops : [];
  const orgName = session.valid ? session.orgName : null;
  const logoUrl = session.valid ? session.logoUrl : null;

  // Theme is a plain UI preference, not auth — it lives in its own
  // non-httpOnly cookie (set client-side by the nav toggle) so this Server
  // Component can still pick the right initial class and avoid a flash of
  // the wrong theme on first paint / full navigation.
  const isDark = cookieStore.get(THEME_COOKIE_NAME)?.value !== 'light';

  return (
    <div
      id="admin-shell"
      className={isDark ? 'dark min-h-screen' : 'min-h-screen'}
      style={{ background: 'var(--adm-surface-page)', color: 'var(--adm-ink-primary)', colorScheme: isDark ? 'dark' : 'light' }}
    >
      {/* The swirl-gradient background was designed for the dark theme only —
          light mode gets the plain page surface instead of a mismatched image.
          `hidden dark:block` (not a JS conditional) so the nav's client-side
          theme toggle shows/hides it immediately, without a page reload. */}
      <div
        className="fixed inset-0 z-0 hidden bg-cover bg-center dark:block"
        style={{ backgroundImage: `url(${BASE_PATH}/admin_background.png)` }}
        aria-hidden="true"
      />
      <div className="relative z-10">
        <ThemeProvider initialIsDark={isDark}>
          <AdminRoleProvider role={role} label={label} workshops={workshops} orgName={orgName} logoUrl={logoUrl}>
            {children}
          </AdminRoleProvider>
        </ThemeProvider>
      </div>
    </div>
  );
}
