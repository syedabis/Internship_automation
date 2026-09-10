import { JWT } from 'google-auth-library';

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

// Caches only the JWT auth client (stateless, auto-refreshing token) — never a
// GoogleSpreadsheet/doc instance, since that holds mutable row/header state that
// shouldn't be shared across concurrent requests on a warm serverless instance.
const clientCache = new Map();

export function getAuthClient(scopes) {
  const cacheKey = [...scopes].sort().join(',');
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }

  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error('Missing Google API credentials in environment variables');
  }

  const client = new JWT({ email, key, scopes });
  clientCache.set(cacheKey, client);
  return client;
}
