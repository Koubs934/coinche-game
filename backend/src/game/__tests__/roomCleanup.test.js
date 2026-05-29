// Unit tests for abandoned/dead-room cleanup in roomManager: immediate delete
// when no human members, grace-arm-then-delete when members are all
// disconnected, grace cancellation on reconnect, alive rooms never deleted, and
// the periodic sweep clearing stale human-less rooms.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rm = require('../../roomManager.js');

function uniqSocketId() { return `socket-${Math.random().toString(36).slice(2, 10)}`; }

// Mark a player disconnected without going through socket plumbing.
function disconnectPlayer(room, userId) {
  const p = room.players.find(pl => pl.userId === userId);
  if (p) p.connected = false;
}

beforeEach(() => {
  rm._resetForTests();
});

afterEach(() => {
  vi.useRealTimers();
  rm._resetForTests();
});

describe('room cleanup — evaluateRoomForCleanup', () => {
  it('deletes a room with 0 human members immediately (bots only)', () => {
    const onRoomDeleted = vi.fn();
    rm.configureCleanup({ onRoomDeleted });
    const room = rm.createRoom({ userId: 'host', username: 'AK7', socketId: uniqSocketId() });
    rm.fillWithBots(room.code, 'host');
    // Simulate the human leaving an in-game room: splice them out, leaving 3 bots.
    room.players = room.players.filter(p => p.isBot);

    const res = rm.evaluateRoomForCleanup(room.code);
    expect(res.deleted).toBe(true);
    expect(rm.getRoom(room.code)).toBeNull();
    expect(onRoomDeleted).toHaveBeenCalledWith(room.code);
  });

  it('arms a grace timer when members exist but none are connected, then deletes after grace', () => {
    vi.useFakeTimers();
    const onRoomDeleted = vi.fn();
    rm.configureCleanup({ graceMs: 1000, onRoomDeleted });
    const room = rm.createRoom({ userId: 'host', username: 'AK7', socketId: uniqSocketId() });
    disconnectPlayer(room, 'host');

    const res = rm.evaluateRoomForCleanup(room.code);
    expect(res.armed).toBe(true);
    expect(rm.getRoom(room.code)).not.toBeNull(); // still alive during grace

    vi.advanceTimersByTime(1000);
    expect(rm.getRoom(room.code)).toBeNull();      // deleted after grace
    expect(onRoomDeleted).toHaveBeenCalledWith(room.code);
  });

  it('cancels the grace timer when a human reconnects within the window', () => {
    vi.useFakeTimers();
    const onRoomDeleted = vi.fn();
    rm.configureCleanup({ graceMs: 1000, onRoomDeleted });
    const room = rm.createRoom({ userId: 'host', username: 'AK7', socketId: uniqSocketId() });
    disconnectPlayer(room, 'host');
    rm.evaluateRoomForCleanup(room.code); // arm

    vi.advanceTimersByTime(500);
    rm.handleReconnect(uniqSocketId(), room.code, 'host'); // human back → cancels timer

    vi.advanceTimersByTime(1000); // original grace window would have elapsed
    expect(rm.getRoom(room.code)).not.toBeNull();
    expect(onRoomDeleted).not.toHaveBeenCalled();
  });

  it('never deletes a room with at least one connected human', () => {
    vi.useFakeTimers();
    const onRoomDeleted = vi.fn();
    rm.configureCleanup({ graceMs: 1000, onRoomDeleted });
    const room = rm.createRoom({ userId: 'host', username: 'AK7', socketId: uniqSocketId() });
    // host is connected by default
    const res = rm.evaluateRoomForCleanup(room.code);
    expect(res.alive).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(rm.getRoom(room.code)).not.toBeNull();
    expect(onRoomDeleted).not.toHaveBeenCalled();
  });
});

describe('room cleanup — sweepDeadRooms', () => {
  it('removes a stale human-less (all-disconnected) room whose grace has elapsed', () => {
    const onRoomDeleted = vi.fn();
    rm.configureCleanup({ graceMs: 1000, onRoomDeleted });
    const room = rm.createRoom({ userId: 'host', username: 'AK7', socketId: uniqSocketId() });
    disconnectPlayer(room, 'host');
    // Pretend the last human was seen well before the grace window (no timer armed,
    // e.g. hydrated on restart) and sweep at "now".
    room.lastHumanSeenAt = 10_000;

    const removed = rm.sweepDeadRooms(20_000); // 10s elapsed >> 1s grace
    expect(removed).toContain(room.code);
    expect(rm.getRoom(room.code)).toBeNull();
    expect(onRoomDeleted).toHaveBeenCalledWith(room.code);
  });

  it('keeps a room that still has a connected human and refreshes its anchor', () => {
    rm.configureCleanup({ graceMs: 1000 });
    const room = rm.createRoom({ userId: 'host', username: 'AK7', socketId: uniqSocketId() });
    room.lastHumanSeenAt = 0; // ancient, but host is connected

    const removed = rm.sweepDeadRooms(100_000);
    expect(removed).not.toContain(room.code);
    expect(rm.getRoom(room.code)).not.toBeNull();
    expect(room.lastHumanSeenAt).toBe(100_000); // anchor refreshed
  });

  it('does not delete a disconnected room still within its grace window', () => {
    rm.configureCleanup({ graceMs: 5000 });
    const room = rm.createRoom({ userId: 'host', username: 'AK7', socketId: uniqSocketId() });
    disconnectPlayer(room, 'host');
    room.lastHumanSeenAt = 18_000;

    const removed = rm.sweepDeadRooms(20_000); // only 2s elapsed < 5s grace
    expect(removed).not.toContain(room.code);
    expect(rm.getRoom(room.code)).not.toBeNull();
  });
});
