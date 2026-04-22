// End-to-end tests for the Game Review flow. Uses roomManager primitives
// to drive a full round without spinning up sockets, then verifies the
// resulting GameRecord (plus the in-memory error-annotation surface).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH_DIR = path.join(__dirname, 'tmp-games-flow');
process.env.GAMES_DATA_DIR = SCRATCH_DIR;

const require = createRequire(import.meta.url);
const rm = require('../../roomManager.js');
const gameRecordStorage = require('../gameRecordStorage.js');
const { getValidCards } = require('../rules.js');

// ── Helpers ──────────────────────────────────────────────────────────────

function uniqSocketId() { return `socket-${Math.random().toString(36).slice(2, 10)}`; }

// Set up a 4-player room with human creator + 3 bots. Drive it through
// shuffle+cut so `room.game` is a fresh dealt round in BIDDING phase.
function newRoomInBidding(creatorUserId = 'creator-1') {
  const room = rm.createRoom({ userId: creatorUserId, username: 'AK7', socketId: uniqSocketId() });
  rm.fillWithBots(room.code, creatorUserId);
  const startRes = rm.startGame(room.code, creatorUserId);
  if (startRes.error) throw new Error(startRes.error);
  // Shuffle + cut so dealing actually happens
  rm.shuffleDeck(room.code, room.players[0].userId);  // dealer shuffles
  rm.doCutDeck(room.code, room.players[3].userId, 5); // player-to-left cuts
  return room;
}

// Given the room is in BIDDING with dealer=0, drive bidding: position 1
// bids 80H, then the other three pass. Round enters PLAYING.
function completeBidding(room) {
  const p = room.players;
  const bidRes = rm.placeBid(room.code, p[1].userId, 80, 'H');
  if (bidRes.error) throw new Error(`placeBid failed: ${bidRes.error}`);
  for (const seat of [2, 3, 0]) {
    const res = rm.passBid(room.code, p[seat].userId);
    if (res.error) throw new Error(`passBid failed: ${res.error}`);
  }
  if (room.game.phase !== 'PLAYING') {
    throw new Error(`expected PLAYING after bidding, got ${room.game.phase}`);
  }
}

// Play legal cards (pick the first valid one) until the round finishes.
// Automatically decline Belote if prompted.
function playOutRound(room) {
  const p = room.players;
  let safety = 32;
  while (room.phase === 'PLAYING' && room.game && room.game.phase === 'PLAYING' && safety-- > 0) {
    const seat = room.game.currentPlayer;
    const hand = room.game.hands[seat];
    const valid = getValidCards(hand, room.game.currentTrick, room.game.trumpSuit, seat);
    if (valid.length === 0) throw new Error(`no valid cards for seat ${seat}`);
    const pick = valid[0];
    let result = rm.playCard(room.code, p[seat].userId, pick);
    if (result.error === 'beloteDecisionRequired') {
      result = rm.playCard(room.code, p[seat].userId, pick, false);
    }
    if (result.error) throw new Error(`playCard failed for seat ${seat}: ${result.error}`);
  }
  if (room.game.phase !== 'ROUND_OVER' && room.phase !== 'ROUND_OVER' && room.phase !== 'GAME_OVER') {
    throw new Error(`round did not finish; phase=${room.phase} game.phase=${room.game?.phase}`);
  }
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Game Review flow', () => {
  beforeEach(() => {
    if (fs.existsSync(SCRATCH_DIR)) fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
  });
  afterEach(() => {
    if (fs.existsSync(SCRATCH_DIR)) fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
  });

  it('auto-save: a finished round builds and writes a well-formed GameRecord', () => {
    const creatorId = 'creator-end-to-end';
    const room = newRoomInBidding(creatorId);
    const gameIdAtStart = room.game.gameId;
    expect(gameIdAtStart).toBeTruthy();
    completeBidding(room);
    playOutRound(room);
    expect(room.game.tricks).toHaveLength(8);

    const record   = rm.buildGameRecord(room);
    const filePath = gameRecordStorage.writeGameRecord(record);

    expect(record.schemaVersion).toBe(1);
    expect(record.gameId).toBe(gameIdAtStart);
    expect(record.roomCreatorUserId).toBe(creatorId);
    expect(record.roomCreatorUsername).toBe('AK7');
    expect(record.players).toHaveLength(4);
    expect(record.players.map(p => p.seat)).toEqual([0, 1, 2, 3]);
    expect(record.teams).toEqual([
      { teamId: 0, seats: [0, 2] },
      { teamId: 1, seats: [1, 3] },
    ]);
    // Each seat's initial hand has 8 cards, all stringified.
    for (const seat of [0, 1, 2, 3]) {
      const hand = record.deal.hands[String(seat)];
      expect(hand).toHaveLength(8);
      for (const c of hand) expect(typeof c).toBe('string');
    }
    expect(record.deal.dealer).toBe(0);
    // Bidding: 1 bid + 3 passes
    expect(record.bidding.rounds).toHaveLength(4);
    expect(record.bidding.rounds[0]).toEqual({ seat: 1, action: { type: 'bid', value: 80, suit: 'H' } });
    expect(record.bidding.winner).toEqual({ seat: 1, value: 80, suit: 'H', team: 1 });
    expect(record.bidding.coinche).toBeNull();
    // Play: 8 tricks, each with 4 cards, each card has seat + card + playedAt.
    expect(record.play.tricks).toHaveLength(8);
    for (const t of record.play.tricks) {
      expect(t.cards).toHaveLength(4);
      for (const c of t.cards) {
        expect(typeof c.seat).toBe('number');
        expect(typeof c.card).toBe('string');
        expect(typeof c.playedAt).toBe('string');
      }
      expect(typeof t.winnerSeat).toBe('number');
    }
    // Outcome: totals are bounded depending on whether the contract was made.
    // Failed contract (made=false) → defenders score 160 + 80 = 240.
    // Made contract → 162 total trick points + 80 announced value, with both
    // values rounded to 10 (so total lands within a tight window around 240).
    const total = record.outcome.team0Score + record.outcome.team1Score;
    expect(total).toBeGreaterThanOrEqual(230);
    expect(total).toBeLessThanOrEqual(260);
    expect([0, 1]).toContain(record.outcome.winningTeam);
    // Cumulative equals round score for a freshly started game.
    expect(record.outcome.team0CumulativeScore).toBe(record.outcome.team0Score);
    expect(record.outcome.team1CumulativeScore).toBe(record.outcome.team1Score);
    // No tags by default
    expect(record.errorAnnotations).toEqual([]);

    // File landed on disk and round-trips.
    const filename = path.basename(filePath);
    const fromDisk = gameRecordStorage.readGameRecord(creatorId, filename);
    expect(fromDisk).toEqual(record);
  });

  it('error annotations tagged during play all appear in the final GameRecord', () => {
    const creatorId = 'creator-annotations';
    const room = newRoomInBidding(creatorId);
    const gameId = room.game.gameId;
    completeBidding(room);

    // Play the first 2 tricks so there are completed tricks to tag.
    // Play 8 cards across seats until tricks.length === 2.
    while (room.game.tricks.length < 2) {
      const seat = room.game.currentPlayer;
      const hand = room.game.hands[seat];
      const valid = getValidCards(hand, room.game.currentTrick, room.game.trumpSuit, seat);
      let r = rm.playCard(room.code, room.players[seat].userId, valid[0]);
      if (r.error === 'beloteDecisionRequired') {
        r = rm.playCard(room.code, room.players[seat].userId, valid[0], false);
      }
      if (r.error) throw new Error(r.error);
    }

    // Tag two different cards from completed tricks.
    const trick0Card = room.game.tricks[0].cards[1]; // seat + card pair
    const trick1Card = room.game.tricks[1].cards[2];
    const tag1 = rm.createGameErrorAnnotation(gameId, creatorId, {
      trickIndex: 0,
      seat: trick0Card.playerIndex,
      card: trick0Card.card.value + trick0Card.card.suit,
    }, 'Should have kept this for later.');
    expect(tag1.error).toBeUndefined();
    expect(tag1.annotation.annotationId).toBeTruthy();
    expect(tag1.annotation.createdByUserId).toBe(creatorId);

    const tag2 = rm.createGameErrorAnnotation(gameId, creatorId, {
      trickIndex: 1,
      seat: trick1Card.playerIndex,
      card: trick1Card.card.value + trick1Card.card.suit,
    }, 'Better partner play was available.');
    expect(tag2.error).toBeUndefined();

    // Finish the round and build the record.
    playOutRound(room);
    const record = rm.buildGameRecord(room);
    expect(record.errorAnnotations).toHaveLength(2);
    expect(record.errorAnnotations[0].note).toBe('Should have kept this for later.');
    expect(record.errorAnnotations[1].note).toBe('Better partner play was available.');
    expect(record.errorAnnotations[0].cardRef.trickIndex).toBe(0);
    expect(record.errorAnnotations[1].cardRef.trickIndex).toBe(1);

    // Persisted content matches.
    const target   = gameRecordStorage.writeGameRecord(record);
    const filename = path.basename(target);
    const back     = gameRecordStorage.readGameRecord(creatorId, filename);
    expect(back.errorAnnotations).toEqual(record.errorAnnotations);
  });

  it('non-creator attempts to tag are rejected with FORBIDDEN_NOT_ROOM_CREATOR', () => {
    const creatorId = 'creator-forbid';
    const room = newRoomInBidding(creatorId);
    completeBidding(room);
    // Play enough to have one completed trick.
    while (room.game.tricks.length < 1) {
      const seat = room.game.currentPlayer;
      const valid = getValidCards(room.game.hands[seat], room.game.currentTrick, room.game.trumpSuit, seat);
      let r = rm.playCard(room.code, room.players[seat].userId, valid[0]);
      if (r.error === 'beloteDecisionRequired') {
        r = rm.playCard(room.code, room.players[seat].userId, valid[0], false);
      }
      if (r.error) throw new Error(r.error);
    }
    const validRef = {
      trickIndex: 0,
      seat: room.game.tricks[0].cards[0].playerIndex,
      card: room.game.tricks[0].cards[0].card.value + room.game.tricks[0].cards[0].card.suit,
    };
    const res = rm.createGameErrorAnnotation(room.game.gameId, 'some-other-user', validRef, 'nope');
    expect(res.code).toBe('FORBIDDEN_NOT_ROOM_CREATOR');
    expect(room.game.errorAnnotations).toHaveLength(0);
  });

  it('validation error codes cover every mismatch case', () => {
    const creatorId = 'creator-validation';
    const room = newRoomInBidding(creatorId);
    const gameId = room.game.gameId;
    completeBidding(room);
    // Play 1 complete trick so we have tricks[0]
    while (room.game.tricks.length < 1) {
      const seat = room.game.currentPlayer;
      const valid = getValidCards(room.game.hands[seat], room.game.currentTrick, room.game.trumpSuit, seat);
      let r = rm.playCard(room.code, room.players[seat].userId, valid[0]);
      if (r.error === 'beloteDecisionRequired') {
        r = rm.playCard(room.code, room.players[seat].userId, valid[0], false);
      }
      if (r.error) throw new Error(r.error);
    }
    const realPlay = room.game.tricks[0].cards[0];
    const realSeat = realPlay.playerIndex;
    const realCardStr = realPlay.card.value + realPlay.card.suit;

    // INVALID_CARD_REF — trickIndex out of range
    {
      const r = rm.createGameErrorAnnotation(gameId, creatorId, { trickIndex: 99, seat: realSeat, card: realCardStr }, 'x');
      expect(r.code).toBe('INVALID_CARD_REF');
    }
    // INVALID_CARD_REF — seat did not play that trick (use a seat that's
    // different from the one who played in that trick's same slot)
    {
      const otherSeat = (realSeat + 2) % 4;
      const playedBy = room.game.tricks[0].cards.map(c => c.playerIndex);
      // All 4 seats played in a completed trick, so we can't pick a seat that
      // didn't play. Force the mismatch by asking for a seat+card pair that
      // wasn't what that seat actually played.
      expect(playedBy).toContain(otherSeat);
      const otherActualCard = room.game.tricks[0].cards.find(c => c.playerIndex === otherSeat).card;
      const bogusCardStr = otherActualCard.value === '7' ? '8' + otherActualCard.suit : '7' + otherActualCard.suit;
      const r = rm.createGameErrorAnnotation(gameId, creatorId, { trickIndex: 0, seat: otherSeat, card: bogusCardStr }, 'x');
      expect(r.code).toBe('INVALID_CARD_REF');
    }
    // INVALID_CARD_REF — seat didn't play at all (current in-progress trick
    // only has 0 cards; any seat lookup fails)
    {
      // The in-progress trick is tricks[1] currently (index = tricks.length=1);
      // no one has played there yet so seat lookup fails.
      const r = rm.createGameErrorAnnotation(gameId, creatorId,
        { trickIndex: room.game.tricks.length, seat: 0, card: realCardStr }, 'x');
      expect(r.code).toBe('INVALID_CARD_REF');
    }
    // NOTE_EMPTY — whitespace-only
    {
      const r = rm.createGameErrorAnnotation(gameId, creatorId,
        { trickIndex: 0, seat: realSeat, card: realCardStr }, '   \n  ');
      expect(r.code).toBe('NOTE_EMPTY');
    }
    // NOTE_TOO_LONG
    {
      const r = rm.createGameErrorAnnotation(gameId, creatorId,
        { trickIndex: 0, seat: realSeat, card: realCardStr }, 'x'.repeat(2001));
      expect(r.code).toBe('NOTE_TOO_LONG');
    }
    // UNKNOWN_GAME
    {
      const r = rm.createGameErrorAnnotation('no-such-game', creatorId,
        { trickIndex: 0, seat: realSeat, card: realCardStr }, 'x');
      expect(r.code).toBe('UNKNOWN_GAME');
    }
  });
});
