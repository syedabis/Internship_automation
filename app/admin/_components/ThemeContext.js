'use client';

import { createContext, useContext, useState } from 'react';

// Matches THEME_COOKIE_NAME in app/admin/layout.js — duplicated rather than
// imported since that file is a Server Component and this one is a client
// module; keeping the string in both is simpler than sharing a constant
// across the server/client boundary for one literal.
const THEME_COOKIE_NAME = 'admin_theme';

const ThemeContext = createContext({ isDark: true, toggleTheme: () => {} });

// `initialIsDark` comes from app/admin/layout.js, which already decided the
// theme server-side (from the `admin_theme` cookie) to pick the shell's
// initial `dark` class — passing it in here means this component's first
// render always matches that decision, so there's no hydration flash.
export function ThemeProvider({ initialIsDark, children }) {
  const [isDark, setIsDark] = useState(initialIsDark);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      // Every admin color is a CSS var scoped by the `.dark` class (see
      // globals.css + _components/theme.js), so flipping this one class
      // repaints the whole panel — no per-component re-render needed.
      const shell = document.getElementById('admin-shell');
      if (shell) {
        shell.classList.toggle('dark', next);
        shell.style.colorScheme = next ? 'dark' : 'light';
      }
      // Not httpOnly — a UI preference, not a secret. Read server-side by
      // app/admin/layout.js on the next request to keep the initial paint
      // in sync with what the user last chose.
      document.cookie = `${THEME_COOKIE_NAME}=${next ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  };

  return <ThemeContext.Provider value={{ isDark, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useAdminTheme() {
  return useContext(ThemeContext);
}
