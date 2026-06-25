// Room-level tests for two features:
//   1. Unlimited cross-partie undo (creator, any turn) — scores + deck restored,
//      continuous timeline across round boundaries, no depth cap, no turn gate.
//   2. The 4-passes hard-lock into shuffle/cut — atomic close, no extra-pass
//      window, deck integrity, and the undo interplay with that transition.
//
// Drives roomManager primitives directly (no sockets, no bot scheduler) so every
// seat's action is explicit and deterministic.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rm = require('../../roomManager.js');

function uniqSocketId() { return `socket-${Math.random().toString(36).slice(2, 10)}`; }

// 4-player room (human creator at seat 0 + 3 bots), driven through shuffle+cut
// into a fresh BIDDING round. Dealer is 0, so biddingTurn opens on seat 1.
// (Identical setup to biddingFlow.test.js.)
function newRoomInBidding(creatorUserId) {
  const room = rm.createRoom({ userId: creatorUserId, username: 'AK7', socketId: uniqSocketId() });
  rm.fillWithBots(room.code, creatorUserId);
  const startRes = rm.startGame(room.code, creatorUserId);
  if (startRes.error) throw new Error(startRes.error);
  rm.shuffleDeck(room.code, room.players[0].userId);  // dealer (seat 0) shuffles
  rm.doCutDeck(room.code, room.players[3].userId, 5); // seat-to-left cuts
  return room;
}

// Open the auction with seat 1 bidding 80, then seats 2/3/0 pass → PLAYING.
function bidAndStartPlaying(room) {
  const p = room.players;
  expect(rm.placeBid(room.code, p[1].userId, 80, 'H').error).toBeUndefined();
  expect(rm.passBid(room.code, p[2].userId).error).toBeUndefined();
  expect(rm.passBid(room.code, p[3].userId).error).toBeUndefined();
  expect(rm.passBid(room.code, p[0].userId).error).toBeUndefined();
  expect(room.game.phase).toBe('PLAYING');
}

// Play exactly one legal card for whoever is on turn. declareBelote:false means
// the engine never returns the belote prompt (it's only raised for a non-boolean),
// so a single call always resolves to a played card.
function playOneCard(room) {
  const pos = room.game.currentPlayer;
  const player = room.players.find(pp => pp.position === pos);
  for (const card of [...room.game.hands[pos]]) {
    const res = rm.playCard(room.code, player.userId, card, false);
    if (!res.error) return;
  }
  throw new Error(`no legal card at position ${pos}`);
}

function playWholeRound(room) {
  let guard = 0;
  while (room.game && room.game.phase === 'PLAYING' && guard++ < 200) playOneCard(room);
}

const deckKeys = deck => deck.map(c => `${c.value}${c.suit}`);
function expect32Unique(deck) {
  expect(deck.length).toBe(32);
  expect(new Set(deckKeys(deck)).size).toBe(32);
}

describe('unlimited undo', () => {
  it('undoing the last card un-scores it: scores revert, deck stays 32 unique, phase back to PLAYING, GAME_OVER cleared', () => {
    const room = newRoomInBidding('creator-unscore');
    room.targetScore = 1; // any non-zero round score ends the game → exercises GAME_OVER clearing
    bidAndStartPlaying(room);

    // Play to the 32nd card (7 tricks complete + 3 cards into the 8th).
    let guard = 0;
    while (room.game.tricks.length * 4 + room.game.currentTrick.length < 31 && guard++ < 200) {
      playOneCard(room);
    }
    expect(room.game.tricks.length).toBe(7);
    expect(room.game.currentTrick.length).toBe(3);

    const scoresBeforeFinish = [...room.scores]; // still [0,0] — scoring happens at round end
    expect(scoresBeforeFinish).toEqual([0, 0]);

    // Last card finishes the round and (targetScore=1) ends the game.
    playOneCard(room);
    expect(room.phase).toBe('GAME_OVER');
    expect(room.scores).not.toEqual([0, 0]);

    const undo = rm.undoLastAction(room.code, 'creator-unscore');
    expect(undo.error).toBeUndefined();

    expect(room.phase).toBe('PLAYING');           // GAME_OVER undone
    expect(room.game.phase).toBe('PLAYING');
    expect(room.scores).toEqual(scoresBeforeFinish); // un-scored, back to pre-round
    expect(room.game.tricks.length).toBe(7);      // last trick is in-progress again
    expect(room.game.currentTrick.length).toBe(3);
    expect32Unique(room.deck);                    // reverted to the pre-rebuild deck
  });

  it('undo traverses a round boundary: from round N first bid back to round N-1 ROUND_OVER, hands/tricks intact', () => {
    const room = newRoomInBidding('creator-cross');
    const p = room.players;

    // ── Round N-1: full round → ROUND_OVER ──
    bidAndStartPlaying(room);
    playWholeRound(room);
    expect(room.phase).toBe('ROUND_OVER');
    const prevDealer = room.game.dealer;            // 0
    const prevScores = [...room.scores];
    expect(room.game.tricks.length).toBe(8);

    // ── Confirm → shuffle → cut → deal round N ──
    const conf = rm.confirmNextRound(room.code, p[0].userId); // only human present
    expect(conf.started).toBe(true);
    expect(room.phase).toBe('SHUFFLE');
    expect(rm.shuffleDeck(room.code, p[room.shuffleDealer].userId).error).toBeUndefined();
    expect(rm.doCutDeck(room.code, p[room.cutPlayer].userId, 9).error).toBeUndefined();
    expect(room.phase).toBe('PLAYING');
    expect(room.game.phase).toBe('BIDDING');
    expect(room.game.dealer).toBe((prevDealer + 1) % 4); // round N, new dealer

    // ── Round N first bid, then undo repeatedly back across the boundary ──
    expect(rm.placeBid(room.code, p[room.game.biddingTurn].userId, 80, 'S').error).toBeUndefined();
    let guard = 0;
    while (room.phase !== 'ROUND_OVER' && guard++ < 30) {
      expect(rm.undoLastAction(room.code, p[0].userId).error).toBeUndefined();
    }
    expect(room.phase).toBe('ROUND_OVER');          // landed back in the previous round
    expect(room.game.phase).toBe('ROUND_OVER');
    expect(room.game.dealer).toBe(prevDealer);      // it's round N-1's game
    expect(room.game.tricks.length).toBe(8);        // its tricks intact
    expect(room.scores).toEqual(prevScores);        // its scores intact
  });

  it('no depth cap: more than 10 undoable actions all remain undoable', () => {
    const room = newRoomInBidding('creator-nocap'); // 2 snapshots so far (shuffle + cut)
    bidAndStartPlaying(room);                        // +4 (bid + 3 passes) = 6
    for (let i = 0; i < 12; i++) playOneCard(room);  // +12 = 18 (3 complete tricks, still PLAYING)

    expect(room.phase).toBe('PLAYING');
    expect(room.history.length).toBe(18);
    expect(room.history.length).toBeGreaterThan(10); // the old HISTORY_LIMIT would have dropped 8

    // Every one is undoable: canUndo stays true and the count decrements by 1 each time.
    let count = room.history.length;
    while (count > 0) {
      expect(rm.publicRoom(room).canUndo).toBe(true);
      expect(rm.undoLastAction(room.code, 'creator-nocap').error).toBeUndefined();
      count--;
      expect(room.history.length).toBe(count);
    }
    expect(rm.publicRoom(room).canUndo).toBe(false);
  });

  it('creator can undo on another player\'s turn; non-creator cannot undo (turn-independent, creator-only)', () => {
    const room = newRoomInBidding('creator-turn');
    const p = room.players;

    expect(rm.placeBid(room.code, p[1].userId, 90, 'D').error).toBeUndefined();
    // Turn is now seat 2 — never the creator (seat 0) — yet undo is offered + works.
    expect(room.game.biddingTurn).toBe(2);
    expect(rm.publicRoom(room).canUndo).toBe(true);

    // A non-creator (seat 1) is refused regardless of state — WHO can undo is unchanged.
    expect(rm.undoLastAction(room.code, p[1].userId).error).toBeTruthy();
    // The creator undoes even though it is not their turn.
    expect(rm.undoLastAction(room.code, 'creator-turn').error).toBeUndefined();
    expect(room.game.currentBid).toBeNull(); // the bid was rolled back
  });
});

describe('4 passes hard-lock into shuffle/cut', () => {
  it('all four passing closes the auction atomically: SHUFFLE, dealer+1, no 5th pass, no re-deal, 32-card deck', () => {
    const room = newRoomInBidding('creator-allpass');
    const p = room.players;
    const oldDealer = room.game.dealer; // 0
    expect(room.game.biddingTurn).toBe(1);

    expect(rm.passBid(room.code, p[1].userId).error).toBeUndefined();
    expect(rm.passBid(room.code, p[2].userId).error).toBeUndefined();
    expect(rm.passBid(room.code, p[3].userId).error).toBeUndefined();
    expect(rm.passBid(room.code, p[0].userId).error).toBeUndefined(); // 4th pass = hard lock

    // Auction is closed atomically and we're in the interactive shuffle prompt.
    expect(room.phase).toBe('SHUFFLE');
    expect(room.game).toBeNull();
    expect(room.shuffleDealer).toBe((oldDealer + 1) % 4);
    expect32Unique(room.deck); // rebuilt from the 4 still-full hands, not from tricks

    // A 5th pass after the transition is REJECTED and does not re-deal.
    const fifth = rm.passBid(room.code, p[1].userId);
    expect(fifth.error).toBeTruthy();
    expect(room.phase).toBe('SHUFFLE');
    expect(room.game).toBeNull();
    expect(room.shuffleDealer).toBe((oldDealer + 1) % 4);

    // Shuffle + cut + deal → fresh round with a clean 32-card deck and fresh bidding.
    expect(rm.shuffleDeck(room.code, p[room.shuffleDealer].userId).error).toBeUndefined();
    expect(rm.doCutDeck(room.code, p[room.cutPlayer].userId, 7).error).toBeUndefined();
    expect(room.phase).toBe('PLAYING');
    expect(room.game.phase).toBe('BIDDING');
    expect(room.game.consecutivePasses).toBe(0);
    expect(room.game.currentBid).toBeNull();
    expect32Unique(room.game.hands.flat());
  });

  it('undo right after the all-pass transition returns to the pre-4th-pass BIDDING state in one step', () => {
    const room = newRoomInBidding('creator-allpass-undo');
    const p = room.players;

    rm.passBid(room.code, p[1].userId);
    rm.passBid(room.code, p[2].userId);
    rm.passBid(room.code, p[3].userId);
    rm.passBid(room.code, p[0].userId); // 4th pass → SHUFFLE, game cleared
    expect(room.phase).toBe('SHUFFLE');
    expect(room.game).toBeNull();

    expect(rm.undoLastAction(room.code, 'creator-allpass-undo').error).toBeUndefined();
    expect(room.phase).toBe('PLAYING');          // back to the live round
    expect(room.game).not.toBeNull();
    expect(room.game.phase).toBe('BIDDING');
    expect(room.game.consecutivePasses).toBe(3); // the moment before the 4th pass
    expect(room.game.currentBid).toBeNull();
  });
});
