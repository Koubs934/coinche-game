// Unit tests for roomManager.listJoinableRooms — the data behind the home
// screen's "Parties en cours" list. Drives roomManager primitives directly
// (no sockets) and asserts the JOIN/REJOIN tagging + the no-spectator filter.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rm = require('../../roomManager.js');

function uniqSocketId() { return `socket-${Math.random().toString(36).slice(2, 10)}`; }

describe('lobby — listJoinableRooms', () => {
  it('a fresh 1-player room is JOINable by a stranger (free seats)', () => {
    const room = rm.createRoom({ userId: 'host-1', username: 'AK7', socketId: uniqSocketId() });
    const list = rm.listJoinableRooms('stranger');
    const entry = list.find(r => r.code === room.code);
    expect(entry).toBeTruthy();
    expect(entry.playerCount).toBe(1);
    expect(entry.maxPlayers).toBe(4);
    expect(entry.mode).toBe('coinche');
    expect(entry.canJoin).toBe(true);
    expect(entry.canRejoin).toBe(false);
    expect(entry.players.map(p => p.username)).toContain('AK7');
  });

  it('a member sees the room as REJOIN (not JOIN)', () => {
    const room = rm.createRoom({ userId: 'host-2', username: 'AK7', socketId: uniqSocketId() });
    const entry = rm.listJoinableRooms('host-2').find(r => r.code === room.code);
    expect(entry.canRejoin).toBe(true);
    expect(entry.canJoin).toBe(false);
  });

  it('hides a full room from a non-member, but a member still sees it (REJOIN)', () => {
    const room = rm.createRoom({ userId: 'host-3', username: 'AK7', socketId: uniqSocketId() });
    rm.fillWithBots(room.code, 'host-3'); // now 4 seats (host + 3 bots)
    expect(room.players).toHaveLength(4);

    // Stranger: full + not a member → omitted.
    expect(rm.listJoinableRooms('stranger').some(r => r.code === room.code)).toBe(false);
    // Host: full but a member → present, REJOIN.
    const mine = rm.listJoinableRooms('host-3').find(r => r.code === room.code);
    expect(mine).toBeTruthy();
    expect(mine.canRejoin).toBe(true);
    expect(mine.canJoin).toBe(false);
  });

  it('bots count toward the seat total but are flagged isBot', () => {
    const room = rm.createRoom({ userId: 'host-4', username: 'AK7', socketId: uniqSocketId() });
    rm.fillWithBots(room.code, 'host-4');
    const entry = rm.listJoinableRooms('host-4').find(r => r.code === room.code);
    expect(entry.playerCount).toBe(4);
    expect(entry.players.filter(p => p.isBot)).toHaveLength(3);
  });

  it('rooms the user is a member of sort ahead of others', () => {
    const mine    = rm.createRoom({ userId: 'sorter', username: 'AK7', socketId: uniqSocketId() });
    rm.createRoom({ userId: 'someone-else', username: 'Bob', socketId: uniqSocketId() });
    const list = rm.listJoinableRooms('sorter').filter(r => r.canRejoin || r.canJoin);
    const idxMine = list.findIndex(r => r.code === mine.code);
    expect(idxMine).toBe(0); // the user's own room floats to the top
  });
});
