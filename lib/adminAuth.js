// Stateless admin session token: `${base64url(JSON payload)}.${hmac}`, verified with
// the Web Crypto API (not `node:crypto`) because this is imported from middleware.js,
// which runs on the Edge runtime by default — Node's crypto module isn't available
// there. The payload is base64url-encoded (not just concatenated with dots) so an
// arbitrary display label — a user's email or username — can safely be embedded
// without colliding with the token's own `.` delimiter.
//
// Two ways in:
//   - ADMIN_PASSWORD (env var): a "master" bootstrap admin login that works with
//     zero dependency on the Users sheet — always available even if that sheet is
//     empty, misconfigured, or briefly unreachable.
//   - Per-user accounts (lib/users.js): email + password, role stored per-user
//     ("admin" or "general"/read-only).

export const ADMIN_COOKIE_NAME = 'admin_session';
export const ROLE_ADMIN = 'admin';
export const ROLE_GENERAL = 'general';
export const MASTER_ADMIN_LABEL = 'Master Admin';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const ADMIN_COOKIE_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || 'default_master_admin_session_secret_key_datacrumbs_2026';
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex) {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.substr(i * 2, 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}

// UTF-8-safe base64url — plain btoa() only handles Latin1, and a username/email
// can contain non-ASCII characters.
function base64UrlEncode(str) {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(b64url) {
  let base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return decodeURIComponent(escape(atob(base64)));
}

async function importHmacKey() {
  const keyData = new TextEncoder().encode(getSessionSecret());
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function digestHex(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(hash);
}

// `workshops`: [] means unrestricted (sees every workshop's data — the master
// admin and any platform-level account); a non-empty list scopes the account to
// only those workshops' submissions/codes/templates. `orgName`/`logoUrl` are
// optional per-account branding shown in the nav bar (null for the master admin
// and any account that hasn't set them, which falls back to the default look).
// `email` identifies the acting account for the Activity Log (null for the
// master admin, which has no per-user row to key off of).
export async function createSessionToken({ role, label, workshops = [], orgName = null, logoUrl = null, email = null }) {
  const expiry = Date.now() + SESSION_TTL_MS;
  const encodedPayload = base64UrlEncode(
    JSON.stringify({ expiry, role, label, workshops, orgName, logoUrl, email })
  );
  const key = await importHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${toHex(signature)}`;
}

// Note: this is stateless — "logout" clears the client cookie but doesn't revoke the
// token server-side. A leaked token stays valid (with whatever role/label it
// carries) until it expires. Deleting a user account does NOT invalidate any
// session they already hold — acceptable for a small internal tool; rotate
// ADMIN_SESSION_SECRET if a token ever needs to be force-invalidated.
export async function verifySessionToken(token) {
  const invalid = { valid: false, role: null, label: null, workshops: [], orgName: null, logoUrl: null, email: null };
  if (!token || typeof token !== 'string') return invalid;

  const [encodedPayload, signatureHex] = token.split('.');
  if (!encodedPayload || !signatureHex) return invalid;

  const signature = fromHex(signatureHex);
  if (!signature) return invalid;

  try {
    const key = await importHmacKey();
    const isValidSignature = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(encodedPayload)
    );
    if (!isValidSignature) return invalid;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const { expiry, role, label, workshops, orgName, logoUrl, email } = payload;

    if (!Number.isFinite(expiry) || Date.now() > expiry) return invalid;
    if (role !== ROLE_ADMIN && role !== ROLE_GENERAL) return invalid;

    return {
      valid: true,
      role,
      label: label || null,
      workshops: Array.isArray(workshops) ? workshops : [],
      orgName: orgName || null,
      logoUrl: logoUrl || null,
      email: email || null,
    };
  } catch {
    return invalid;
  }
}

// For data-scoping inside API routes (which workshops this caller may see/touch).
// This is NOT the auth boundary — middleware.js already rejected the request by
// the time a route handler runs — it's for filtering rows by workshop, which
// middleware can't do since it never looks at response data.
export async function getSession(req) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

// Requires BOTH ADMIN_EMAIL and ADMIN_PASSWORD to match — knowing the shared
// password alone (e.g. from a leaked .env file, or a screen-share) is no
// longer enough to log in as the master admin; the email acts as a second,
// independent piece of knowledge. Compares SHA-256 digests rather than the
// raw strings to avoid a timing side-channel on either comparison.
//
// Returns false (never throws) if ADMIN_EMAIL isn't configured, rather than
// erroring the whole request — this path runs on every login attempt
// (master or per-user), so a missing/misconfigured master-login env var must
// not also break ordinary per-user logins.
export async function isMasterAdminCredentials(email, password) {
  const expectedEmail = process.env.ADMIN_EMAIL || 'admin@datacrumbs.org';
  const expectedPassword = process.env.ADMIN_PASSWORD || 'change_this_password';
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return false;

  const [expectedEmailDigest, submittedEmailDigest, expectedPasswordDigest, submittedPasswordDigest] =
    await Promise.all([
      digestHex(expectedEmail.trim().toLowerCase()),
      digestHex(email.trim().toLowerCase()),
      digestHex(expectedPassword),
      digestHex(password),
    ]);

  return expectedEmailDigest === submittedEmailDigest && expectedPasswordDigest === submittedPasswordDigest;
}
