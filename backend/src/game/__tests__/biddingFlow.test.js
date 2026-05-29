// Room-level tests for the post-coinche / surcoinche bidding flow.
// Drives roomManager primitives directly (no sockets, no bot scheduler) so
// every seat's action is controlled explicitly.
//
// New convention under test:
//   - After a coinche, only the CONTRACTING team is prompted (each of its two
//     players, in turn) for Surcoinche / Pass. The coinching team is skipped.
//   - A surcoinche closes bidding immediately (→ PLAYING).
//   - Both contracting players passing closes bidding at ×2 (coinched, not surcoinched).

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rm = require('../../roomManager.js');

function uniqSocketId() { return `socket-${Math.random().toString(36).slice(2, 10)}`; }

// 4-player room (human creator at seat 0 + 3 bots), driven through shuffle+cut
// into a fresh BIDDING round. Dealer is 0, so biddingTurn opens on seat 1.
function newRoomInBidding(creatorUserId) {
  const room = rm.createRoom({ userId: creatorUserId, username: 'AK7', socketId: uniqSocketId() });
  rm.fillWithBots(room.code, creatorUserId);
  const startRes = rm.startGame(room.code, creatorUserId);
  if (startRes.error) throw new Error(startRes.error);
  rm.shuffleDeck(room.code, room.players[0].userId);  // dealer (seat 0) shuffles
  rm.doCutDeck(room.code, room.players[3].userId, 5); // seat-to-left cuts
  return room;
}

const team = pos => pos % 2;

describe('post-coinche bidding flow', () => {
  // Shared opening: seat 1 (team 1) bids 80♥, then seat 2 (team 0) coinches.
  // Contracting team = team 1 (seats 1, 3). Coincher = seat 2; its partner = seat 0.
  function openAndCoinche(creatorId) {
    const room = newRoomInBidding(creatorId);
    const p = room.players;
    expect(room.game.dealer).toBe(0);
    expect(room.game.biddingTurn).toBe(1);

    expect(rm.placeBid(room.code, p[1].userId, 80, 'H').error).toBeUndefined();
    expect(room.game.currentBid.team).toBe(1);
    expect(room.game.biddingTurn).toBe(2);

    expect(rm.coinche(room.code, p[2].userId).error).toBeUndefined();
    return room;
  }

  it('after a coinche, the turn goes to a contracting-team player (not the coincher\'s partner)', () => {
    const room = openAndCoinche('creator-coinche-turn');
    const bt = room.game.biddingTurn;
    expect(room.game.currentBid.coinched).toBe(true);
    expect(team(bt)).toBe(room.game.currentBid.team); // contracting team (team 1)
    expect(bt).toBe(3);     // the contracting player other than the original bidder
    expect(bt).not.toBe(0); // NOT the coincher's (seat 2) partner
    expect(room.game.phase).toBe('BIDDING');
  });

  it('a surcoinche closes bidding immediately (→ PLAYING)', () => {
    const room = openAndCoinche('creator-surcoinche-close');
    const p = room.players;
    // biddingTurn is 3 (contracting player). Seat 3 surcoinches.
    expect(rm.surcoinche(room.code, p[3].userId).error).toBeUndefined();
    expect(room.game.phase).toBe('PLAYING');
    expect(room.game.currentBid.coinched).toBe(true);
    expect(room.game.currentBid.surcoinched).toBe(true);
    expect(room.game.trumpSuit).toBe('H');
  });

  it('both contracting players passing closes bidding at ×2 (coinched, not surcoinched)', () => {
    const room = openAndCoinche('creator-pass-pass');
    const p = room.players;

    // First contracting player (seat 3) declines.
    expect(rm.passBid(room.code, p[3].userId).error).toBeUndefined();
    expect(room.game.phase).toBe('BIDDING');            // still open — one more contracting player
    expect(room.game.biddingTurn).toBe(1);              // the other contracting player

    // Second contracting player (seat 1) declines → close.
    expect(rm.passBid(room.code, p[1].userId).error).toBeUndefined();
    expect(room.game.phase).toBe('PLAYING');
    expect(room.game.currentBid.coinched).toBe(true);
    expect(room.game.currentBid.surcoinched).toBe(false);
  });

  it('the coinching team is never given a turn in the surcoinche window', () => {
    const room = openAndCoinche('creator-skip-coinchers');
    const p = room.players;
    const contractTeam = room.game.currentBid.team;

    const turns = [room.game.biddingTurn]; // turn handed out right after the coinche
    rm.passBid(room.code, p[room.game.biddingTurn].userId); // seat 3 passes
    if (room.game.phase === 'BIDDING') turns.push(room.game.biddingTurn); // next window turn

    // Every turn offered during the window belongs to the contracting team.
    for (const turn of turns) {
      expect(team(turn)).toBe(contractTeam);
    }
    // Specifically, neither the coincher (seat 2) nor its partner (seat 0) is ever prompted.
    expect(turns).not.toContain(0);
    expect(turns).not.toContain(2);
  });
});
