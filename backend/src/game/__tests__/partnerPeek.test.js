// Tests for partner-peek gating. The peek pair is AK7 + faispaschier; it now
// arms ONLY when "Pacha" is also a seated player in the room. Exercised through
// the public surface: togglePartnerPeek (the authorization gate) and publicGame
// (canPeek delivered to clients).

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rm = require('../../roomManager.js');

// Resolved once from profiles (usernames AK7 / faispaschier / Pacha).
const AK7   = '7f35ed6a-8e9a-421e-8e79-1086fa663478';
const FAIS  = '507f441f-a481-4269-9d18-356b9ba76f43';
const PACHA = 'b1b3041f-48fa-4fe0-9dbe-48f334b51bce';
const GILOU = 'gilou-0000-0000-0000-000000000000';

function sid() { return `socket-${Math.random().toString(36).slice(2, 10)}`; }

beforeEach(() => {
  rm._resetForTests();
});

// Build a LOBBY room and hand-set the seating/teams (toggle doesn't need a game).
function lobbyRoom(players) {
  const room = rm.createRoom({ userId: 'seed', username: 'seed', socketId: sid() });
  room.players = players;
  room.creatorId = players[0].userId;
  return room;
}

// player factory
const P = (userId, team, position) => ({ userId, username: userId, socketId: sid(), team, position, connected: true });

describe('partner-peek — togglePartnerPeek authorization', () => {
  it('pair partnered + Pacha seated → toggle allowed', () => {
    const room = lobbyRoom([P(AK7, 0, 0), P(FAIS, 0, 2), P(PACHA, 1, 1), P(GILOU, 1, 3)]);
    const res = rm.togglePartnerPeek(room.code, AK7);
    expect(res.error).toBeUndefined();
    expect(room.partnerPeek).toBe(true);
    // either gated user can toggle
    expect(rm.togglePartnerPeek(room.code, FAIS).error).toBeUndefined();
    expect(room.partnerPeek).toBe(false);
  });

  it('pair partnered but Pacha ABSENT → not available', () => {
    const room = lobbyRoom([P(AK7, 0, 0), P(FAIS, 0, 2), P(GILOU, 1, 1), P('rando', 1, 3)]);
    expect(rm.togglePartnerPeek(room.code, AK7).error).toBe('Partner peek not available');
    expect(room.partnerPeek).toBeFalsy();
  });

  it('pair present + Pacha seated but NOT partnered (different teams) → not available', () => {
    const room = lobbyRoom([P(AK7, 0, 0), P(FAIS, 1, 1), P(PACHA, 1, 3), P(GILOU, 0, 2)]);
    expect(rm.togglePartnerPeek(room.code, AK7).error).toBe('Partner peek not available');
    expect(room.partnerPeek).toBeFalsy();
  });

  it('non-pair user can never toggle (even Pacha)', () => {
    const room = lobbyRoom([P(AK7, 0, 0), P(FAIS, 0, 2), P(PACHA, 1, 1), P(GILOU, 1, 3)]);
    expect(rm.togglePartnerPeek(room.code, PACHA).error).toBe('Not allowed');
    expect(rm.togglePartnerPeek(room.code, GILOU).error).toBe('Not allowed');
    expect(room.partnerPeek).toBeFalsy();
  });
});

describe('partner-peek — canPeek in publicGame', () => {
  // Drive a real round into BIDDING with the given fourth player, AK7+FAIS partnered.
  function startedRoom(fourthId) {
    const room = rm.createRoom({ userId: AK7, username: 'AK7', socketId: sid() });
    rm.joinRoom(room.code, { userId: FAIS,     username: 'faispaschier', socketId: sid() });
    rm.joinRoom(room.code, { userId: fourthId, username: 'four',         socketId: sid() });
    rm.joinRoom(room.code, { userId: GILOU,    username: 'Gilou',        socketId: sid() });
    // AK7 (creator) makes FAIS a partner (team 0); others team 1.
    rm.assignTeam(room.code, AK7, FAIS, 0);
    rm.assignTeam(room.code, AK7, fourthId, 1);
    rm.assignTeam(room.code, AK7, GILOU, 1);
    rm.startGame(room.code, AK7);
    // SHUFFLE → CUT → PLAYING(BIDDING)
    rm.skipShuffle(room.code, room.players.find(p => p.position === room.shuffleDealer).userId);
    rm.skipCut(room.code, room.players.find(p => p.position === room.cutPlayer).userId);
    return room;
  }

  it('eligible (Pacha is the fourth) → AK7 sees canPeek true; non-gated player sees false', () => {
    const room = startedRoom(PACHA);
    const ak7Pos = room.players.find(p => p.userId === AK7).position;
    const gilouPos = room.players.find(p => p.userId === GILOU).position;
    expect(rm.publicGame(room, ak7Pos).canPeek).toBe(true);
    expect(rm.publicGame(room, gilouPos).canPeek).toBe(false); // opponents never get peek fields
  });

  it('Pacha absent → AK7 sees canPeek false even though the pair is partnered', () => {
    const room = startedRoom('someone-else-not-pacha');
    const ak7Pos = room.players.find(p => p.userId === AK7).position;
    expect(rm.publicGame(room, ak7Pos).canPeek).toBe(false);
  });
});
