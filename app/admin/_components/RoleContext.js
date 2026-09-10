'use client';

import { createContext, useContext } from 'react';

const RoleContext = createContext({ role: null, label: null, workshops: [], orgName: null, logoUrl: null });

export function AdminRoleProvider({ role, label, workshops, orgName, logoUrl, children }) {
  return (
    <RoleContext.Provider
      value={{ role, label, workshops: workshops || [], orgName: orgName || null, logoUrl: logoUrl || null }}
    >
      {children}
    </RoleContext.Provider>
  );
}

// { role: 'admin' | 'general' | null, label: string | null, workshops: string[],
//   orgName: string | null, logoUrl: string | null }
// — label is a display identity (username, email, or "Master Admin"); workshops
// is [] for an unrestricted account (sees everything) or a list of the only
// workshops this account may see/manage. orgName/logoUrl are optional per-account
// branding for the nav bar (null falls back to the default product look). role
// and label are null only pre-login, e.g. on /admin/login.
export function useAdminRole() {
  return useContext(RoleContext);
}
