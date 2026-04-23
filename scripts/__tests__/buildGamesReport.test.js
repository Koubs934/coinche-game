#!/usr/bin/env node
// Plain-Node test (no vitest dependency) for the pure bits of
// build-games-report.js: code generation, collision handling, and a
// smoke-test of the HTML template against a synthesized GameRecord.
//
// Run:
//   node scripts/__tests__/buildGamesReport.test.js
// Exit 0 on pass, 1 on any failure (with a dump of the assertion).

const assert = require('assert');
const {
  codeFor,
  buildPlayerCodeMap,
  renderHTML,
} = require('../build-games-report.js');

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (err) { failed++; console.error(`  FAIL ${name}`); console.error('       ' + err.message); }
}

// ── codeFor ────────────────────────────────────────────────────────────────
test('codeFor: AK7 preserves letters + digit', () => {
  assert.strictEqual(codeFor('AK7'), 'AK7');
});
test('codeFor: Rod_le_thug → first letter run (3 chars)', () => {
  assert.strictEqual(codeFor('Rod_le_thug'), 'Rod');
});
test('codeFor: Jejemoumou06 → truncate at 3, no digit needed', () => {
  assert.strictEqual(codeFor('Jejemoumou06'), 'Jej');
});
test('codeFor: Bot → just Bot', () => {
  assert.strictEqual(codeFor('Bot'), 'Bot');
});
test('codeFor: empty string falls back to ???', () => {
  assert.strictEqual(codeFor(''), '???');
});
test('codeFor: digits-only falls back to ???', () => {
  assert.strictEqual(codeFor('42'), '???');
});
test('codeFor: Al → 2 chars, no digit to append', () => {
  assert.strictEqual(codeFor('Al'), 'Al');
});
test('codeFor: Al2 → Al + 2', () => {
  assert.strictEqual(codeFor('Al2'), 'Al2');
});

// ── buildPlayerCodeMap: collision disambiguation ───────────────────────────
test('buildPlayerCodeMap: collides on "Jej" → Jej, Jej2', () => {
  const games = [{
    players: [
      { seat: 0, userId: 'u-a', username: 'Jejemoumou06' },
      { seat: 1, userId: 'u-b', username: 'Jejeremy' },
      { seat: 2, userId: 'u-c', username: 'Rod_le_thug' },
      { seat: 3, userId: 'u-d', username: 'Bot' },
    ],
  }];
  const { codes } = buildPlayerCodeMap(games);
  // u-a and u-b both want "Jej". Sort order of userIds ("u-a" < "u-b") gives
  // u-a the base code, u-b the disambiguator.
  assert.strictEqual(codes['u-a'], 'Jej');
  assert.strictEqual(codes['u-b'], 'Jej2');
  assert.strictEqual(codes['u-c'], 'Rod');
  assert.strictEqual(codes['u-d'], 'Bot');
});

// ── renderHTML: empty state ────────────────────────────────────────────────
test('renderHTML: empty games → shows "No games found" message', () => {
  const html = renderHTML({ games: [], codes: {}, usernames: {}, skipped: [] });
  assert.ok(html.includes('No games found'), 'expected empty-state copy');
  assert.ok(html.includes('scripts/sync-games.js'), 'expected sync command hint');
});

// ── renderHTML: full synthetic GameRecord ──────────────────────────────────
function makeGame() {
  return {
    schemaVersion: 1,
    gameId: 'test-uuid-abc',
    roomCreatorUserId: 'u-ak7',
    roomCreatorUsername: 'AK7',
    createdAt:   '2026-04-22T12:00:00.000Z',
    completedAt: '2026-04-22T12:15:00.000Z',
    players: [
      { seat: 0, userId: 'u-ak7', username: 'AK7' },
      { seat: 1, userId: 'u-rod', username: 'Rod_le_thug' },
      { seat: 2, userId: 'u-jej', username: 'Jejemoumou06' },
      { seat: 3, userId: 'u-bot', username: 'Bot' },
    ],
    teams: [
      { teamId: 0, seats: [0, 2] },
      { teamId: 1, seats: [1, 3] },
    ],
    deal: { hands: { 0: [], 1: [], 2: [], 3: [] }, dealer: 0 },
    bidding: {
      rounds: [
        { seat: 1, action: { type: 'bid',  value: 100, suit: 'H' } },
        { seat: 2, action: { type: 'pass' } },
        { seat: 3, action: { type: 'pass' } },
        { seat: 0, action: { type: 'pass' } },
      ],
      winner: { seat: 1, value: 100, suit: 'H', team: 1 },
      coinche: null,
    },
    play: {
      tricks: [
        {
          trickIndex: 0,
          leadSeat: 1,
          cards: [
            { seat: 1, card: '9H',  playedAt: '2026-04-22T12:01:00Z' },
            { seat: 2, card: '8H',  playedAt: '2026-04-22T12:01:03Z' },
            { seat: 3, card: 'QH',  playedAt: '2026-04-22T12:01:06Z' },
            { seat: 0, card: 'AH',  playedAt: '2026-04-22T12:01:09Z' },
          ],
          winnerSeat: 0,
        },
      ],
      belote: { declaredBy: null, trickIndex: null, rebeloteAt: null },
    },
    outcome: {
      team0Score: 92, team1Score: 70,
      team0CumulativeScore: 92, team1CumulativeScore: 70,
      winningTeam: 0,
    },
    errorAnnotations: [
      {
        annotationId: 'ann-1',
        cardRef: { trickIndex: 0, seat: 1, card: '9H' },
        note:    'Wasted the 9 of trump too early.',
        createdAt: '2026-04-22T12:02:00Z',
        createdByUserId: 'u-ak7',
      },
    ],
  };
}

test('renderHTML: player codes legend includes all four players', () => {
  const games = [makeGame()];
  const { codes, usernames } = buildPlayerCodeMap(games);
  const html = renderHTML({ games, codes, usernames, skipped: [] });
  for (const uid of Object.keys(codes)) {
    assert.ok(html.includes(codes[uid]), `expected code ${codes[uid]} in HTML`);
    assert.ok(html.includes(usernames[uid]), `expected username ${usernames[uid]} in HTML`);
  }
});

test('renderHTML: contract rendered as 100♥ by T2', () => {
  const games = [makeGame()];
  const { codes, usernames } = buildPlayerCodeMap(games);
  const html = renderHTML({ games, codes, usernames, skipped: [] });
  assert.ok(html.includes('100'), 'expected contract value 100');
  assert.ok(html.includes('♥'),   'expected hearts symbol');
  assert.ok(html.includes('T2'),  'expected team tag T2');
});

test('renderHTML: annotation note quoted verbatim + card reference rendered', () => {
  const games = [makeGame()];
  const { codes, usernames } = buildPlayerCodeMap(games);
  const html = renderHTML({ games, codes, usernames, skipped: [] });
  assert.ok(html.includes('Wasted the 9 of trump too early.'), 'expected annotation note in HTML');
  assert.ok(html.includes('Trick 1'), 'expected 1-based trick index in annotation caption');
});

test('renderHTML: winning team score bolded, losing team plain', () => {
  const games = [makeGame()]; // team 0 won with 92
  const { codes, usernames } = buildPlayerCodeMap(games);
  const html = renderHTML({ games, codes, usernames, skipped: [] });
  // Team 0 (92) should appear inside a <b>...92... wrapper inside the table
  // row. A loose substring check is enough here.
  assert.ok(/<b>\s*92\s*<\/b>\s*\/\s*70/.test(html), 'expected winning score to be bolded');
});

test('renderHTML: skipped record count surfaced in footer', () => {
  const games = [makeGame()];
  const { codes, usernames } = buildPlayerCodeMap(games);
  const html = renderHTML({ games, codes, usernames, skipped: [{ file: 'x', reason: 'y' }] });
  assert.ok(html.includes('Skipped 1 malformed record'), 'expected skipped count in footer');
});

test('renderHTML: escapes HTML in usernames safely', () => {
  const games = [{
    ...makeGame(),
    players: [
      { seat: 0, userId: 'u-evil', username: '<img src=x onerror=alert(1)>' },
      { seat: 1, userId: 'u-rod', username: 'Rod_le_thug' },
      { seat: 2, userId: 'u-jej', username: 'Jejemoumou06' },
      { seat: 3, userId: 'u-bot', username: 'Bot' },
    ],
  }];
  const { codes, usernames } = buildPlayerCodeMap(games);
  const html = renderHTML({ games, codes, usernames, skipped: [] });
  assert.ok(!html.includes('<img src=x'), 'raw username tag must not appear unescaped');
  assert.ok(html.includes('&lt;img src=x'), 'username should be HTML-escaped');
});

// ── Summary ────────────────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log(`\nall tests passed`);
