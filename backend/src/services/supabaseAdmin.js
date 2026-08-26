// Service-role Supabase admin lookups. The backend is otherwise Supabase-free
// (auth happens FE→Supabase directly); this module is the deliberate exception
// so /api/auth/resolve-email can map a username to its account email without
// exposing the whole user list to clients.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY at runtime (Railway
// Variables in prod, backend/.env locally). Lazy-init like ANTHROPIC_API_KEY:
// the server boots without them, the endpoint 500s on first call.

const { createClient } = require('@supabase/supabase-js');

let client = null;

function getClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

async function defaultListUsers(page, perPage) {
  const { data, error } = await getClient().auth.admin.listUsers({ page, perPage });
  if (error) throw error;
  return data?.users || [];
}

const PER_PAGE = 1000;
// Runaway guard, not a real limit — this private app has <100 accounts.
const MAX_PAGES = 10;

/**
 * All accounts whose user_metadata.username matches (case-insensitive, trimmed).
 * Accounts with no username are skipped. Returns [{ id, email }].
 * `listUsers` is injectable for tests; defaults to the GoTrue admin API.
 */
async function findUsersByUsername(username, { listUsers = defaultListUsers } = {}) {
  const want = String(username ?? '').trim().toLowerCase();
  if (!want) return [];
  const matches = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const users = await listUsers(page, PER_PAGE);
    for (const u of users) {
      const uname = String(u?.user_metadata?.username ?? '').trim().toLowerCase();
      if (uname && uname === want) matches.push({ id: u.id, email: u.email });
    }
    if (users.length < PER_PAGE) break;
  }
  return matches;
}

module.exports = { findUsersByUsername };
