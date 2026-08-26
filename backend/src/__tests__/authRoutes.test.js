import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import { createAuthRouter, RESOLVE_MAX_PER_WINDOW } from '../authRoutes.js';
import rateLimit from '../rateLimit.js';

// Boot a real express app on an ephemeral port and drive it over HTTP, so the
// JSON parsing + status codes are exactly what the FE sees.
function startApp(routerOpts, { trustProxy } = {}) {
  const app = express();
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);
  app.use(express.json());
  app.use(createAuthRouter(routerOpts));
  return new Promise(resolve => {
    const server = app.listen(0, () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function post(port, body, headers = {}) {
  return fetch(`http://127.0.0.1:${port}/api/auth/resolve-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const USERS = [
  { id: 'u1', email: 'ak7@example.com', username: 'AK7' },
  { id: 'u2', email: 'dup-a@example.com', username: 'AK test 2' },
  { id: 'u3', email: 'dup-b@example.com', username: 'AK test 2' },
];

// Same case-insensitive contract as supabaseAdmin.findUsersByUsername.
async function fakeFind(username) {
  const want = String(username).trim().toLowerCase();
  return USERS.filter(u => u.username.toLowerCase() === want)
    .map(u => ({ id: u.id, email: u.email }));
}

const openAlways = { allow: () => true };

describe('POST /api/auth/resolve-email', () => {
  let server, port;
  beforeAll(async () => {
    ({ server, port } = await startApp({ findUsersByUsername: fakeFind, limiter: openAlways }));
  });
  afterAll(() => new Promise(resolve => server.close(resolve)));

  it('resolves a known username to its email', async () => {
    const res = await post(port, { username: 'AK7' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: 'ak7@example.com' });
  });

  it('matches case-insensitively with surrounding whitespace', async () => {
    const res = await post(port, { username: '  ak7 ' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: 'ak7@example.com' });
  });

  it('404s on an unknown username (login shows "Joueur inconnu")', async () => {
    const res = await post(port, { username: 'nobody-here' });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('UNKNOWN_USERNAME');
  });

  it('409s on a duplicated username instead of picking an account', async () => {
    const res = await post(port, { username: 'ak TEST 2' });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('AMBIGUOUS_USERNAME');
  });

  it('400s when username is missing or blank', async () => {
    for (const body of [{}, { username: '' }, { username: '   ' }, { username: 42 }]) {
      const res = await post(port, body);
      expect(res.status).toBe(400);
    }
  });

  it('signup uniqueness: an existing name resolves (taken), a fresh one 404s (free)', async () => {
    // The FE signup path treats 200/409 as "name taken" and only proceeds on 404.
    expect((await post(port, { username: 'Ak7' })).status).toBe(200);
    expect((await post(port, { username: 'AK test 2' })).status).toBe(409);
    expect((await post(port, { username: 'BrandNewPlayer' })).status).toBe(404);
  });
});

describe('resolve-email failure paths', () => {
  it('500s without leaking details when the Supabase lookup throws', async () => {
    const { server, port } = await startApp({
      findUsersByUsername: async () => { throw new Error('service key missing'); },
      limiter: openAlways,
    });
    try {
      const res = await post(port, { username: 'AK7' });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.code).toBe('LOOKUP_FAILED');
      expect(JSON.stringify(body)).not.toContain('service key');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('keys the rate limit per client IP behind a trusted proxy (default keyFn)', async () => {
    // Mirrors prod: server.js sets `trust proxy 1` so req.ip is the client IP
    // Railway appends to X-Forwarded-For — each client gets its own bucket.
    const { server, port } = await startApp(
      { findUsersByUsername: fakeFind, limiter: rateLimit },
      { trustProxy: 1 },
    );
    try {
      for (let i = 0; i < RESOLVE_MAX_PER_WINDOW; i++) {
        const res = await post(port, { username: 'AK7' }, { 'X-Forwarded-For': '203.0.113.1' });
        expect(res.status).toBe(200);
      }
      const sameIp = await post(port, { username: 'AK7' }, { 'X-Forwarded-For': '203.0.113.1' });
      expect(sameIp.status).toBe(429);
      const otherIp = await post(port, { username: 'AK7' }, { 'X-Forwarded-For': '203.0.113.2' });
      expect(otherIp.status).toBe(200);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('500s LOOKUP_FAILED with default deps when the Supabase env vars are unset', async () => {
    // createAuthRouter() with NO injected deps — the real supabaseAdmin lazy-init
    // path. The console.error assertion pins WHICH failure occurred (missing env,
    // not a broken default wiring like "findUsersByUsername is not a function").
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { server, port } = await startApp();
    try {
      const res = await post(port, { username: 'AK7' });
      expect(res.status).toBe(500);
      expect((await res.json()).code).toBe('LOOKUP_FAILED');
      expect(errSpy.mock.calls.flat().join(' ')).toContain('SUPABASE_URL');
    } finally {
      errSpy.mockRestore();
      vi.unstubAllEnvs();
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('rate-limits after the per-window budget with the real limiter', async () => {
    // Real rateLimit module, pinned to a dedicated bucket so other tests /
    // callers can't consume this window's budget.
    const { server, port } = await startApp({
      findUsersByUsername: fakeFind,
      limiter: rateLimit,
      keyFn: () => 'authRoutes.test:rate-limit-bucket',
    });
    try {
      for (let i = 0; i < RESOLVE_MAX_PER_WINDOW; i++) {
        const res = await post(port, { username: 'AK7' });
        expect(res.status).toBe(200);
      }
      const blocked = await post(port, { username: 'AK7' });
      expect(blocked.status).toBe(429);
      expect((await blocked.json()).code).toBe('RATE_LIMITED');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
