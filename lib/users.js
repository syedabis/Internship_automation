// User management helper (Supabase dependency removed)

export async function listUsers() {
  return [];
}

export async function findUserByEmail(email) {
  return null;
}

export async function verifyUserCredentials(email, password) {
  return null;
}

export async function createUser() {
  throw new Error('User database is disabled.');
}

export async function updateUserBranding() {
  throw new Error('User database is disabled.');
}

export async function deleteUserByEmail() {
  return true;
}

export async function resetUserPassword() {
  return true;
}
