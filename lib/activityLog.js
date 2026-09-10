// Admin activity log, stored in Supabase (see SUPABASE_SETUP.md for the schema).

import { getSupabaseClient } from './supabaseClient';

// Best-effort — a logging failure should never break the admin action that
// triggered it, so errors are swallowed (and reported to the server console)
// rather than propagated. `actorEmail` identifies who performed the action
// (null for the master admin, which has no per-user row) — it's what lets a
// scoped account's Activity Log view be filtered down to just their own
// actions in app/api/admin/activity/route.js.
export async function logActivity(action, details = '', actorEmail = null) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('activity_log').insert({ action, details, actor_email: actorEmail });
    if (error) throw error;
  } catch (error) {
    console.error('Failed to log activity:', action, error.message);
  }
}

export async function getRecentActivity(limit = 500) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action, details, actor_email, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    rowNumber: row.id,
    timestamp: row.created_at,
    action: row.action,
    details: row.details || '',
    actorEmail: row.actor_email || null,
  }));
}
