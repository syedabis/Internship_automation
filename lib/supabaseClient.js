import { createClient } from '@supabase/supabase-js';

// Server-side only — this uses the Secret key (full read/write, bypasses Row
// Level Security), never the Publishable key, and must never be imported from
// client components or middleware.js (Edge runtime). Mirrors how
// lib/googleAuth.js centralizes the Google auth client.
let client = null;

export function getSupabaseClient() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured.');
  }

  client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
