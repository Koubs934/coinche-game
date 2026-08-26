// POST /api/auth/resolve-email — username → account email, so the FE can run
// supabase.auth.signInWithPassword with a "Nom de joueur" instead of an email.
// Known trade-off (accepted for this private app): a 200 leaks the
// username→email mapping to anyone who can reach the endpoint; the per-IP
// rate limit keeps bulk harvesting impractical.
//
// Duplicate usernames exist historically (two "AK test 2" test accounts), so
// an ambiguous name is an explicit 409 — never "pick one silently".

const express = require('express');
const defaultRateLimit = require('./rateLimit');
const supabaseAdmin = require('./services/supabaseAdmin');

const RESOLVE_MAX_PER_WINDOW = 20;
const RESOLVE_WINDOW_MS = 60_000;

/**
 * Build the auth router. Dependencies are injectable for tests:
 * - findUsersByUsername(username) → [{ id, email }]
 * - limiter — the shared sliding-window rate limiter module
 * - keyFn(req) — rate-limit bucket key (per client IP by default)
 */
function createAuthRouter({
  findUsersByUsername = supabaseAdmin.findUsersByUsername,
  limiter = defaultRateLimit,
  keyFn = (req) => `${req.ip}:resolveEmail`,
} = {}) {
  const router = express.Router();

  router.post('/api/auth/resolve-email', async (req, res) => {
    if (!limiter.allow(keyFn(req), RESOLVE_MAX_PER_WINDOW, RESOLVE_WINDOW_MS)) {
      return res.status(429).json({ error: 'too many requests', code: 'RATE_LIMITED' });
    }

    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    if (!username) {
      return res.status(400).json({ error: 'username required', code: 'USERNAME_REQUIRED' });
    }

    let matches;
    try {
      matches = await findUsersByUsername(username);
    } catch (err) {
      console.error('[auth] resolve-email lookup failed:', err.message);
      return res.status(500).json({ error: 'lookup failed', code: 'LOOKUP_FAILED' });
    }

    if (matches.length === 0) {
      return res.status(404).json({ error: 'unknown username', code: 'UNKNOWN_USERNAME' });
    }
    if (matches.length > 1) {
      return res.status(409).json({ error: 'ambiguous username', code: 'AMBIGUOUS_USERNAME' });
    }
    return res.json({ email: matches[0].email });
  });

  return router;
}

module.exports = { createAuthRouter, RESOLVE_MAX_PER_WINDOW, RESOLVE_WINDOW_MS };
