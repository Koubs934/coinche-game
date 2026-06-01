// Tests for lobby seating: new joiners/bots must fill FREE seats on the underfull
// team (never 3v1), and "move to other team" is a real seat relocation so team
// stays derived from position (team0 = seats 0,2; team1 = 1,3).

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rm = require('../../roomManager.js');

function sid() { return `socket-${Math.random().toString(36).slice(2, 10)}`; }

// Map team → set of seats occupied by that team's players.
function seatsByTeam(room) {
  const t = { 0: [], 1: [] };
  for (const p of room.players) t[p.position % 2].push(p.position);
  return { team0: t[0].sort(), team1: t[1].sort() };
}

// Invariants every seated room must hold.
function expectValidSeating(room) {
  const positions = room.players.map(p => p.position);
  expect(new Set(positions).size).toBe(positions.length); // unique seats — no collisions
  for (const p of room.players) {
    expect(p.position).toBeGreaterThanOrEqual(0);
    expect(p.position).toBeLessThan(4);
    expect(p.team).toBe(p.position % 2); // team strictly derived from seat
  }
}

beforeEach(() => {
  rm._resetForTests();
});

describe('lobby seating — fillWithBots respects manual moves', () => {
  it('(a) one team manually at 2, other empty → adding 2 bots seats them on the empty team (2v2, not 3v1)', () => {
    // Repro of the bug: move both humans into the same team, then add 2 bots.
    const room = rm.createRoom({ userId: 'ak7', username: 'AK7', socketId: sid() }); // seat0 (t0)
    rm.joinRoom(room.code, { userId: 'aktest', username: 'AK Test', socketId: sid() }); // seat1 (t1)
    // Move both into team1 (Équipe 2): AK Test is already there; AK7 relocates to seat3.
    rm.assignTeam(room.code, 'ak7', 'ak7', 1);
    const afterMove = seatsByTeam(room);
    expect(afterMove.team1.length).toBe(2); // both humans on team1
    expect(afterMove.team0.length).toBe(0); // team0 empty

    rm.fillWithBots(room.code, 'ak7');

    expectValidSeating(room);
    expect(room.players).toHaveLength(4);
    const t = seatsByTeam(room);
    expect(t.team0).toEqual([0, 2]); // bots filled the empty team
    expect(t.team1).toEqual([1, 3]); // humans
    // The two bots are the ones on team0.
    const botTeam0 = room.players.filter(p => p.isBot).every(p => p.position % 2 === 0);
    expect(botTeam0).toBe(true);
    // Balanced enough to start.
    expect(rm.startGame(room.code, 'ak7').error).toBeUndefined();
  });

  it('fillWithBots from a fresh 1-human room yields 2v2', () => {
    const room = rm.createRoom({ userId: 'ak7', username: 'AK7', socketId: sid() });
    rm.fillWithBots(room.code, 'ak7');
    expectValidSeating(room);
    const t = seatsByTeam(room);
    expect(t.team0).toEqual([0, 2]);
    expect(t.team1).toEqual([1, 3]);
  });
});

describe('lobby seating — human join lands on the underfull team', () => {
  it('(b) with one open seat on the underfull team, a joining human takes it', () => {
    const room = rm.createRoom({ userId: 'ak7', username: 'AK7', socketId: sid() }); // seat0 (t0)
    rm.joinRoom(room.code, { userId: 'p2', username: 'P2', socketId: sid() });        // seat1 (t1)
    // Move P2 to team0 so team0 has 2 (seats 0,2) and team1 is empty (underfull).
    rm.assignTeam(room.code, 'ak7', 'p2', 0); // P2 → seat2 (t0)
    expect(seatsByTeam(room)).toEqual({ team0: [0, 2], team1: [] });

    const res = rm.joinRoom(room.code, { userId: 'p3', username: 'P3', socketId: sid() });
    expect(res.error).toBeUndefined();
    const p3 = room.players.find(p => p.userId === 'p3');
    expect(p3.position % 2).toBe(1);  // landed on the underfull team1
    expect([1, 3]).toContain(p3.position);
    expectValidSeating(room);
  });

  it('balances 1→2→3→4 joiners to 2v2', () => {
    const room = rm.createRoom({ userId: 'a', username: 'A', socketId: sid() });
    rm.joinRoom(room.code, { userId: 'b', username: 'B', socketId: sid() });
    rm.joinRoom(room.code, { userId: 'c', username: 'C', socketId: sid() });
    rm.joinRoom(room.code, { userId: 'd', username: 'D', socketId: sid() });
    expectValidSeating(room);
    const t = seatsByTeam(room);
    expect(t.team0.length).toBe(2);
    expect(t.team1.length).toBe(2);
  });
});

describe('lobby seating — assignTeam relocates seats, never 3v1', () => {
  it('move relocates the player into a free seat of the target team', () => {
    const room = rm.createRoom({ userId: 'a', username: 'A', socketId: sid() }); // seat0 (t0)
    rm.joinRoom(room.code, { userId: 'b', username: 'B', socketId: sid() });      // seat1 (t1)
    const a = room.players.find(p => p.userId === 'a');
    rm.assignTeam(room.code, 'a', 'a', 1); // A → team1
    expect(a.position % 2).toBe(1);
    expect(a.team).toBe(1);
    expectValidSeating(room);
  });

  it('move to a full team is unavailable (prevents 3v1)', () => {
    // 2v2 full room: every team has 2 seats taken, so no cross-team move is possible.
    const room = rm.createRoom({ userId: 'a', username: 'A', socketId: sid() });
    rm.joinRoom(room.code, { userId: 'b', username: 'B', socketId: sid() });
    rm.joinRoom(room.code, { userId: 'c', username: 'C', socketId: sid() });
    rm.joinRoom(room.code, { userId: 'd', username: 'D', socketId: sid() }); // 2v2
    // Pick a team0 player and try to move them to team1 (full) → error, no change.
    const t0player = room.players.find(p => p.position % 2 === 0);
    const before = t0player.position;
    const res = rm.assignTeam(room.code, 'a', t0player.userId, 1);
    expect(res.error).toBe('That team has no free seat');
    expect(t0player.position).toBe(before);
    expectValidSeating(room);
  });

  it('moving a player already on the target team is a no-op', () => {
    const room = rm.createRoom({ userId: 'a', username: 'A', socketId: sid() }); // seat0 (t0)
    const a = room.players.find(p => p.userId === 'a');
    const res = rm.assignTeam(room.code, 'a', 'a', 0);
    expect(res.error).toBeUndefined();
    expect(a.position).toBe(0);
  });
});
