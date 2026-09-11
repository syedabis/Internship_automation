'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAdminRole } from './RoleContext';
import { useAdminTheme } from './ThemeContext';

// Base path — must match `basePath` in next.config.mjs. next/link and useRouter()
// apply it automatically for internal navigation, but a raw fetch() does not.
const BASE_PATH = '';

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
];

// Ink at partial opacity, without needing a light/dark class pair per usage —
// `--adm-ink-primary-rgb` itself flips between modes (globals.css), so one
// arbitrary-value class works in both themes.
const inkAlpha = (alpha) => `rgba(var(--adm-ink-primary-rgb),${alpha})`;

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, orgName, logoUrl } = useAdminRole();
  const { isDark, toggleTheme } = useAdminTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch(`${BASE_PATH}/api/admin/logout`, { method: 'POST' });
      router.replace('/admin/login');
      router.refresh();
    } catch {
      toast.error('Failed to log out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <div className="px-6 pt-4 md:px-10 lg:px-14">
        <nav
          className="relative mx-auto flex max-w-[976px] items-center justify-between rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md md:px-6"
          style={{ background: 'var(--adm-nav-bg)', borderColor: 'var(--adm-surface-border)' }}
        >
          <span
            className="flex items-center gap-2 text-sm font-bold tracking-wide"
            style={{ color: 'var(--adm-ink-primary)' }}
          >
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- external, admin-supplied URL; next/image can't optimize an arbitrary remote host without config
              <img
                src={logoUrl}
                alt=""
                className="h-6 w-6 rounded object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            {orgName || 'Cognos'}
          </span>
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 gap-5 sm:flex">
            {LINKS.filter((link) => !link.adminOnly || role === 'admin').map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium transition-colors"
                style={{ color: pathname === link.href ? 'var(--adm-ink-primary)' : inkAlpha(0.5) }}
                onMouseEnter={(e) => {
                  if (pathname !== link.href) e.currentTarget.style.color = inkAlpha(0.8);
                }}
                onMouseLeave={(e) => {
                  if (pathname !== link.href) e.currentTarget.style.color = inkAlpha(0.5);
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center transition-colors cursor-pointer"
              style={{ color: inkAlpha(0.5) }}
              onMouseEnter={(e) => (e.currentTarget.style.color = inkAlpha(0.8))}
              onMouseLeave={(e) => (e.currentTarget.style.color = inkAlpha(0.5))}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
              style={{ color: inkAlpha(0.5) }}
              onMouseEnter={(e) => (e.currentTarget.style.color = inkAlpha(0.8))}
              onMouseLeave={(e) => (e.currentTarget.style.color = inkAlpha(0.5))}
            >
              <LogOut className="h-3.5 w-3.5" />
              {loggingOut ? 'Logging out...' : 'Log out'}
            </button>
          </div>
        </nav>
      </div>
      <ToastContainer position="top-right" autoClose={4000} hideProgressBar theme={isDark ? 'dark' : 'light'} />
    </>
  );
}
