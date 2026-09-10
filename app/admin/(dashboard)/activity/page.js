'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { INK, STATUS, SURFACE } from '../../_components/theme';
import { useAdminRole } from '../../_components/RoleContext';

// Base path — must match `basePath` in next.config.mjs; fetch() does not auto-apply it.
const BASE_PATH = '/certificate';

const ACTION_COLORS = {
  'logged in': '#3987e5',
  'marked submission as sent': '#0ca30c',
  'marked submission as failed': '#d03b3b',
  'added code': '#0ca30c',
  'deleted code': '#d03b3b',
  'uploaded template': '#0ca30c',
  'deleted template': '#d03b3b',
};

function actionColor(action) {
  return ACTION_COLORS[action.toLowerCase()] || INK.muted;
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AdminActivityPage() {
  const { role, workshops } = useAdminRole();
  // Matches the server-side rule in app/api/admin/activity/route.js: only a
  // fully unrestricted admin sees every account's activity — everyone else
  // is already looking at just their own.
  const seesEveryAccount = role === 'admin' && (workshops || []).length === 0;
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const response = await fetch(`${BASE_PATH}/api/admin/activity`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to load activity log.');
        setActivity(result.activity || []);
      } catch (error) {
        setLoadError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activity;
    return activity.filter((entry) =>
      [entry.action, entry.details].some((v) => String(v || '').toLowerCase().includes(term))
    );
  }, [activity, search]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: INK.primary }}>
        System Activity Log
      </h1>
      <p className="text-sm mb-6" style={{ color: INK.secondary }}>
        A history of logins, code and template changes, and certificates marked as sent.{' '}
        {seesEveryAccount ? 'Showing activity for every account.' : 'Showing activity for your account only.'}
      </p>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" style={{ color: INK.muted }}>
          {isLoading ? 'Loading…' : `${filtered.length} of ${activity.length} events`}
        </p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action or details…"
          className="w-full sm:w-64 h-10 rounded-lg text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)]"
          style={{ background: SURFACE.card, borderColor: SURFACE.border }}
        />
      </div>

      {loadError && (
        <div
          className="mb-4 rounded-lg border px-4 py-3 text-sm"
          style={{ background: 'rgba(208,59,59,0.1)', borderColor: 'rgba(208,59,59,0.3)', color: STATUS.critical }}
        >
          {loadError}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border" style={{ background: SURFACE.card, borderColor: SURFACE.border }}>
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b text-left text-xs font-semibold uppercase tracking-wide"
              style={{ borderColor: SURFACE.border, color: INK.muted, background: SURFACE.cardAlt }}
            >
              <th className="whitespace-nowrap px-4 py-3">When</th>
              <th className="whitespace-nowrap px-4 py-3">Action</th>
              <th className="whitespace-nowrap px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center" style={{ color: INK.muted }}>
                  Loading activity…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center" style={{ color: INK.muted }}>
                  No activity yet.
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <tr key={entry.rowNumber} className="border-b last:border-0" style={{ borderColor: SURFACE.border }}>
                  <td className="whitespace-nowrap px-4 py-3" style={{ color: INK.muted }}>
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-sm font-medium"
                      style={{ color: actionColor(entry.action) }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: actionColor(entry.action) }}
                      />
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: INK.secondary }}>
                    {entry.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
