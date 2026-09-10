import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

const clientCache = new Map();

export function getAuthClient(scopes) {
  const cacheKey = [...scopes].sort().join(',');
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }

  let email = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // Fallback to local JSON credentials if env vars are missing
  if (!email || !key) {
    const possibleFiles = ['credentials.json', 'ultimate-flame-345714-81ce47e7321b.json'];
    for (const file of possibleFiles) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        try {
          const creds = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (creds.client_email && creds.private_key) {
            email = creds.client_email;
            key = creds.private_key;
            break;
          }
        } catch (e) {
          console.warn(`Failed reading ${file}:`, e.message);
        }
      }
    }
  }

  if (!email || !key) {
    throw new Error('Missing Google API credentials (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY).');
  }

  const client = new JWT({ email, key, scopes });
  clientCache.set(cacheKey, client);
  return client;
}
