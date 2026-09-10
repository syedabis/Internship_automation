// Activity logging helper (Console fallback, Supabase removed)

export async function logActivity(action, details = '', actorEmail = null) {
  console.log(`[ACTIVITY LOG] ${action} | Details: ${details} | User: ${actorEmail || 'system'}`);
}

export async function getRecentActivity(limit = 500) {
  return [];
}
