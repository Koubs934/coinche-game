import { describe, it, expect, vi } from 'vitest';
import { findUsersByUsername } from '../supabaseAdmin.js';

// The GoTrue admin API returns users with user_metadata (the JSON mirror of
// auth.users.raw_user_meta_data). listUsers is injected so no network/env is
// touched here — only the matching + pagination logic is under test.
function pageOf(users) {
  return async (page) => (page === 1 ? users : []);
}

describe('findUsersByUsername', () => {
  it('matches case-insensitively and trims both sides', async () => {
    const listUsers = pageOf([
      { id: 'u1', email: 'a@x.com', user_metadata: { username: '  AK7 ' } },
      { id: 'u2', email: 'b@x.com', user_metadata: { username: 'Caro' } },
    ]);
    expect(await findUsersByUsername('ak7', { listUsers }))
      .toEqual([{ id: 'u1', email: 'a@x.com' }]);
    expect(await findUsersByUsername('  CARO ', { listUsers }))
      .toEqual([{ id: 'u2', email: 'b@x.com' }]);
  });

  it('returns every account sharing a duplicated username', async () => {
    const listUsers = pageOf([
      { id: 'u1', email: 'dup-a@x.com', user_metadata: { username: 'AK test 2' } },
      { id: 'u2', email: 'dup-b@x.com', user_metadata: { username: 'ak TEST 2' } },
      { id: 'u3', email: 'other@x.com', user_metadata: { username: 'AK Test' } },
    ]);
    const matches = await findUsersByUsername('AK test 2', { listUsers });
    expect(matches.map(m => m.id)).toEqual(['u1', 'u2']);
  });

  it('skips accounts without a username and blank queries', async () => {
    const listUsers = pageOf([
      { id: 'u1', email: 'no-meta@x.com', user_metadata: {} },
      { id: 'u2', email: 'null-meta@x.com' },
    ]);
    expect(await findUsersByUsername('anything', { listUsers })).toEqual([]);
    expect(await findUsersByUsername('', { listUsers })).toEqual([]);
    expect(await findUsersByUsername('   ', { listUsers })).toEqual([]);
    expect(await findUsersByUsername(null, { listUsers })).toEqual([]);
  });

  it('pages past a full first page to find later matches', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({
      id: `filler-${i}`, email: `f${i}@x.com`, user_metadata: { username: `filler-${i}` },
    }));
    const pages = {
      1: fullPage,
      2: [{ id: 'late', email: 'late@x.com', user_metadata: { username: 'LatePlayer' } }],
    };
    const requested = [];
    const listUsers = async (page) => { requested.push(page); return pages[page] || []; };

    expect(await findUsersByUsername('lateplayer', { listUsers }))
      .toEqual([{ id: 'late', email: 'late@x.com' }]);
    expect(requested).toEqual([1, 2]);
  });

  it('rejects with a clear message when the env vars are unset (default listUsers)', async () => {
    // No injected listUsers — exercises the real lazy-init path, which must
    // throw before any network call. This is the documented ops failure mode
    // ("server boots without them, endpoint 500s on first call").
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    try {
      await expect(findUsersByUsername('anyone'))
        .rejects.toThrow('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('stops paging on the first short page', async () => {
    const requested = [];
    const listUsers = async (page) => {
      requested.push(page);
      return [{ id: 'u1', email: 'a@x.com', user_metadata: { username: 'AK7' } }];
    };
    await findUsersByUsername('AK7', { listUsers });
    expect(requested).toEqual([1]);
  });
});
