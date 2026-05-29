// Unit tests for roomManager.throwItem — the "throw stuff at a player" gesture.
// Drives the validator directly (no sockets): a seated player produces a throw
// payload with from/to/item; non-seated/bot/spoofed senders and bad items are
// rejected; the per-sender cooldown throttles rapid throws.

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rm = require('../../roomManager.js');

function sid() { return `socket-${Math.random().toString(36).slice(2, 10)}`; }

// A room with a human creator + 3 bots (creator at seat 0; bots at 1,2,3).
function botRoom(creator = 'human-1') {
  const room = rm.createRoom({ userId: creator, username: 'AK7', socketId: sid() });
  rm.fillWithBots(room.code, creator);
  return room;
}

beforeEach(() => {
  rm._resetForTests();
});

describe('throwItem — happy path', () => {
  it('a seated player throwing at another seat yields from/to/item', () => {
    const room = botRoom();
    const me = room.players.find(p => p.userId === 'human-1');
    const target = room.players.find(p => p.position !== me.position); // a bot seat
    const res = rm.throwItem(room.code, 'human-1', target.position, 'tomato');
    expect(res.error).toBeUndefined();
    expect(res.throw).toEqual({ fromPosition: me.position, toPosition: target.position, item: 'tomato' });
  });

  it('throwing at a bot seat is allowed (bots are valid targets)', () => {
    const room = botRoom();
    const bot = room.players.find(p => p.isBot);
    expect(rm.throwItem(room.code, 'human-1', bot.position, 'pie').error).toBeUndefined();
  });
});

describe('throwItem — rejections', () => {
  it('rejects an unknown room', () => {
    expect(rm.throwItem('ZZZZZZ', 'human-1', 1, 'egg').error).toBeTruthy();
  });

  it('rejects a non-seated / spoofed sender', () => {
    const room = botRoom();
    expect(rm.throwItem(room.code, 'not-in-room', 1, 'egg').error).toBeTruthy();
  });

  it('rejects a bot as sender (bots never throw)', () => {
    const room = botRoom();
    const bot = room.players.find(p => p.isBot);
    expect(rm.throwItem(room.code, bot.userId, 0, 'egg').error).toBeTruthy();
  });

  it('rejects an item not in the allowed set', () => {
    const room = botRoom();
    expect(rm.throwItem(room.code, 'human-1', 1, 'grenade').error).toBeTruthy();
    expect(rm.throwItem(room.code, 'human-1', 1, '').error).toBeTruthy();
  });

  it('rejects self-throw and out-of-range / empty target seats', () => {
    const room = botRoom();
    const me = room.players.find(p => p.userId === 'human-1');
    expect(rm.throwItem(room.code, 'human-1', me.position, 'egg').error).toBe('Cannot throw at yourself');
    expect(rm.throwItem(room.code, 'human-1', 9, 'egg').error).toBeTruthy();      // out of range
    expect(rm.throwItem(room.code, 'human-1', 1.5, 'egg').error).toBeTruthy();    // non-integer
  });
});

describe('throwItem — cooldown', () => {
  it('throttles a second throw fired within the cooldown window, allows it after', () => {
    const room = botRoom();
    const target = room.players.find(p => p.position !== 0).position;
    expect(rm.throwItem(room.code, 'human-1', target, 'shoe', 1000).error).toBeUndefined();
    // 500ms later → still within the ~1s cooldown → dropped
    expect(rm.throwItem(room.code, 'human-1', target, 'shoe', 1500).error).toBe('Too fast');
    // 1100ms after the first → allowed again
    expect(rm.throwItem(room.code, 'human-1', target, 'shoe', 2100).error).toBeUndefined();
  });

  it('cooldown is per-sender (a different player is unaffected)', () => {
    const room = rm.createRoom({ userId: 'a', username: 'A', socketId: sid() });
    rm.joinRoom(room.code, { userId: 'b', username: 'B', socketId: sid() });
    const posA = room.players.find(p => p.userId === 'a').position;
    const posB = room.players.find(p => p.userId === 'b').position;
    expect(rm.throwItem(room.code, 'a', posB, 'banana', 1000).error).toBeUndefined();
    // B throws at the same instant — different sender, not throttled.
    expect(rm.throwItem(room.code, 'b', posA, 'banana', 1000).error).toBeUndefined();
  });
});
