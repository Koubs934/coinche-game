// Unit tests for the per-room table chat primitives on roomManager. Drives
// addChatMessage directly (no sockets) and asserts validation, the built
// message shape, the sender's seat position, and the 50-message cap.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rm = require('../../roomManager.js');

function uniqSocketId() { return `socket-${Math.random().toString(36).slice(2, 10)}`; }

// A 4-player room: human creator + 3 bots. chatMessages starts empty.
function newRoom(creatorUserId = 'creator-1') {
  const room = rm.createRoom({ userId: creatorUserId, username: 'AK7', socketId: uniqSocketId() });
  rm.fillWithBots(room.code, creatorUserId);
  return room;
}

describe('table chat — addChatMessage', () => {
  it('fresh room starts with an empty chatMessages array', () => {
    const room = newRoom();
    expect(room.chatMessages).toEqual([]);
  });

  it('builds a message with id, sender identity, seat position, text + ts', () => {
    const room = newRoom();
    const res = rm.addChatMessage(room.code, 'creator-1', '  Bonjour !  ');
    expect(res.error).toBeUndefined();
    expect(res.message).toMatchObject({
      userId:   'creator-1',
      username: 'AK7',
      position: 0,          // creator seats at position 0
      text:     'Bonjour !', // trimmed
    });
    expect(typeof res.message.id).toBe('string');
    expect(typeof res.message.ts).toBe('number');
    expect(room.chatMessages).toHaveLength(1);
  });

  it('rejects an unknown room', () => {
    expect(rm.addChatMessage('ZZZZZZ', 'creator-1', 'hi').error).toBeTruthy();
  });

  it('rejects a non-player (and bots)', () => {
    const room = newRoom();
    expect(rm.addChatMessage(room.code, 'nobody', 'hi').error).toBeTruthy();
    const botId = room.players.find(p => p.isBot).userId;
    expect(rm.addChatMessage(room.code, botId, 'beep').error).toBeTruthy();
  });

  it('rejects empty / whitespace / non-string text', () => {
    const room = newRoom();
    expect(rm.addChatMessage(room.code, 'creator-1', '   ').error).toBeTruthy();
    expect(rm.addChatMessage(room.code, 'creator-1', '').error).toBeTruthy();
    expect(rm.addChatMessage(room.code, 'creator-1', 42).error).toBeTruthy();
    expect(room.chatMessages).toHaveLength(0);
  });

  it('caps text at 500 chars', () => {
    const room = newRoom();
    const res = rm.addChatMessage(room.code, 'creator-1', 'x'.repeat(600));
    expect(res.message.text).toHaveLength(500);
  });

  it('keeps only the last 50 messages', () => {
    const room = newRoom();
    for (let i = 0; i < 60; i++) rm.addChatMessage(room.code, 'creator-1', `m${i}`);
    expect(room.chatMessages).toHaveLength(50);
    expect(room.chatMessages[0].text).toBe('m10');
    expect(room.chatMessages[49].text).toBe('m59');
  });
});
