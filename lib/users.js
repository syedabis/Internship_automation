// Per-user accounts, stored in Supabase (see SUPABASE_SETUP.md for the schema).
// Password hashing is unchanged from the previous Google-Sheets-backed version —
// node:crypto scrypt with a random salt per user, timing-safe comparison on verify.

import crypto from 'node:crypto';
import { getSupabaseClient } from './supabaseClient';

const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return { salt, hash };
}

function verifyPasswordHash(password, salt, expectedHashHex) {
  const expected = Buffer.from(expectedHashHex, 'hex');
  const actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  // Buffers must be equal length for timingSafeEqual — a mismatched length just
  // means the wrong password (or corrupt data), not a match either way.
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function normalizeEmail(email) {
  return (email || '').toString().trim().toLowerCase();
}

// http(s)-only — this ends up in an <img src>, so reject anything else
// (javascript:, data:, etc.) rather than trusting free-text input.
function normalizeLogoUrl(logoUrl) {
  const trimmed = (logoUrl || '').toString().trim();
  if (!trimmed) return null;
  if (!/^https:\/\//i.test(trimmed) && !/^http:\/\//i.test(trimmed)) {
    throw new Error('Logo URL must start with http:// or https://.');
  }
  return trimmed;
}

function normalizeOrgName(orgName) {
  const trimmed = (orgName || '').toString().trim();
  return trimmed || null;
}

export async function listUsers() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('email, username, role, workshops, org_name, logo_url, created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  // Never return password_salt/password_hash to the client.
  return (data || []).map((row) => ({
    email: row.email,
    username: row.username,
    role: row.role,
    workshops: row.workshops || [],
    orgName: row.org_name || null,
    logoUrl: row.logo_url || null,
    createdAt: row.created_at,
  }));
}

export async function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('email, username, role, workshops, org_name, logo_url, password_salt, password_hash')
    .eq('email', normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    email: data.email,
    username: data.username,
    role: data.role,
    workshops: data.workshops || [],
    orgName: data.org_name || null,
    logoUrl: data.logo_url || null,
    passwordSalt: data.password_salt,
    passwordHash: data.password_hash,
  };
}

export async function verifyUserCredentials(email, password) {
  if (!password) return null;
  const user = await findUserByEmail(email);
  if (!user || !user.passwordSalt || !user.passwordHash) return null;

  const isValid = verifyPasswordHash(password, user.passwordSalt, user.passwordHash);
  return isValid ? user : null;
}

// workshops: [] (default) means unrestricted — sees every workshop's data.
// orgName/logoUrl are optional per-account branding — shown in the nav bar in
// place of the default product name/mark, so a society's dashboard looks like
// their own portal rather than a shared admin tool.
export async function createUser({ email, username, role, password, workshops = [], orgName, logoUrl }) {
  const normalizedEmail = normalizeEmail(email);
  const trimmedUsername = (username || '').toString().trim();
  const cleanWorkshops = Array.isArray(workshops) ? workshops.filter(Boolean) : [];
  const cleanOrgName = normalizeOrgName(orgName);
  const cleanLogoUrl = normalizeLogoUrl(logoUrl);

  if (!normalizedEmail || !trimmedUsername || !role || !password) {
    throw new Error('Email, username, role, and password are all required.');
  }

  const { salt, hash } = hashPassword(password);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .insert({
      email: normalizedEmail,
      username: trimmedUsername,
      role,
      workshops: cleanWorkshops,
      org_name: cleanOrgName,
      logo_url: cleanLogoUrl,
      password_salt: salt,
      password_hash: hash,
      // Set explicitly rather than relying on the column's `default now()` —
      // if that default wasn't applied when the table was created (easy to
      // miss when creating tables by hand), this still fills the value in.
      created_at: new Date().toISOString(),
    })
    .select('email, username, role, workshops, org_name, logo_url, created_at')
    .single();

  if (error) {
    // Postgres unique_violation on the `email` column's unique constraint.
    if (error.code === '23505') {
      throw new Error('A user with this email already exists.');
    }
    throw new Error(error.message);
  }

  return {
    email: data.email,
    username: data.username,
    role: data.role,
    workshops: data.workshops || [],
    orgName: data.org_name || null,
    logoUrl: data.logo_url || null,
    createdAt: data.created_at,
  };
}

// Updates only the branding fields (org display name / logo). Passing `null`
// (or an empty string) for either clears it back to the platform default.
export async function updateUserBranding(email, { orgName, logoUrl } = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error('Email is required.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .update({ org_name: normalizeOrgName(orgName), logo_url: normalizeLogoUrl(logoUrl) })
    .eq('email', normalized)
    .select('email, username, role, workshops, org_name, logo_url, created_at')
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('User not found.');

  return {
    email: data.email,
    username: data.username,
    role: data.role,
    workshops: data.workshops || [],
    orgName: data.org_name || null,
    logoUrl: data.logo_url || null,
    createdAt: data.created_at,
  };
}

export async function deleteUserByEmail(email) {
  const normalized = normalizeEmail(email);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('users').delete().eq('email', normalized).select('email');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('User not found.');
  }
}

// Updates just the password hash in place — the account, its role, and its
// createdAt all stay intact, unlike the old delete-and-recreate workaround.
export async function resetUserPassword(email, newPassword) {
  const normalized = normalizeEmail(email);
  if (!normalized || !newPassword) {
    throw new Error('Email and new password are required.');
  }

  const { salt, hash } = hashPassword(newPassword);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .update({ password_salt: salt, password_hash: hash })
    .eq('email', normalized)
    .select('email');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('User not found.');
  }
}
