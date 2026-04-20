// Smoke tests for the core game modules. The comprehensive assertion suite
// lives in verify.js (runs under `npm test`); this file is the Vitest entry
// and a template for incremental conversion — each rule/scoring/bot file
// should grow its own *.test.js sibling over time.

const { describe, it, expect } = require('vitest');
const { cardPoints, getTrickWinner, getValidCards } = require('../rules');
const { calculateRoundScore } = require('../scoring');
const { createDeck, shuffle, cutDeck, dealFrom } = require('../deck');
const { bestOpeningBid, getBotBidAction } = require('../botBidding');
const { getBotCardAction } = require('../botPlay');

const card = (value, suit) => ({ suit, value });

describe('deck', () => {
  it('createDeck returns 32 unique cards', () => {
    const d = createDeck();
    expect(d).toHaveLength(32);
    const ids = new Set(d.map(c => c.value + c.suit));
    expect(ids.size).toBe(32);
  });

  it('shuffle preserves all cards', () => {
    const d = createDeck();
    const s = shuffle(d);
    expect(s).toHaveLength(32);
    expect(new Set(s.map(c => c.value + c.suit)).size).toBe(32);
  });

  it('dealFrom splits into 4 hands of 8', () => {
    const hands = dealFrom(createDeck(), 0);
    expect(hands).toHaveLength(4);
    for (const h of hands) expect(h).toHaveLength(8);
  });

  it('cutDeck rotates top N to bottom', () => {
    const d = [1, 2, 3, 4, 5];
    expect(cutDeck(d, 2)).toEqual([3, 4, 5, 1, 2]);
  });
});

describe('rules', () => {
  it('trump J beats trump 9', () => {
    const trick = [
      { card: card('9', 'S'), playerIndex: 0 },
      { card: card('J', 'S'), playerIndex: 1 },
    ];
    expect(getTrickWinner(trick, 'S')).toBe(1);
  });

  it('cardPoints: trump J = 20, non-trump A = 11', () => {
    expect(cardPoints(card('J', 'S'), 'S')).toBe(20);
    expect(cardPoints(card('A', 'H'), 'S')).toBe(11);
  });

  it('leading: any card legal', () => {
    const hand = [card('7', 'S'), card('A', 'H')];
    expect(getValidCards(hand, [], 'S', 0)).toHaveLength(2);
  });
});

describe('scoring', () => {
  it('contract made: contract team gets trick points + contract value', () => {
    const tricks = Array.from({ length: 8 }, () => ({
      cards: [
        { card: card('7', 'S'), playerIndex: 0 },
        { card: card('8', 'S'), playerIndex: 1 },
        { card: card('9', 'S'), playerIndex: 2 },
        { card: card('J', 'S'), playerIndex: 3 },
      ],
      winner: 0,
    }));
    const result = calculateRoundScore({
      tricks,
      trumpSuit: 'S',
      contract: { team: 0, value: 80, coinched: false, surcoinched: false },
      beloteTeam: null,
    });
    expect(result.contractMade).toBe(true);
    expect(result.scores[0]).toBeGreaterThan(0);
  });
});

describe('bots', () => {
  it('bestOpeningBid on J+9+A trump returns maître (100+)', () => {
    const hand = [
      card('J', 'H'), card('9', 'H'), card('A', 'H'),
      card('7', 'S'), card('8', 'S'), card('9', 'D'),
      card('Q', 'C'), card('K', 'C'),
    ];
    const bid = bestOpeningBid(hand);
    expect(bid).not.toBeNull();
    expect(bid.suit).toBe('H');
    expect(bid.value).toBeGreaterThanOrEqual(100);
  });

  it('getBotBidAction: coinched → pass', () => {
    const hand = [
      card('J', 'H'), card('9', 'H'), card('A', 'H'),
      card('7', 'S'), card('8', 'S'), card('9', 'D'),
      card('Q', 'C'), card('K', 'C'),
    ];
    const game = {
      hands: [hand, [], [], []],
      currentBid: { value: 80, suit: 'D', playerIndex: 1, team: 1, coinched: true, surcoinched: false },
    };
    expect(getBotBidAction(game, 0).type).toBe('pass');
  });

  it('getBotCardAction returns a card from the hand', () => {
    const hand = [card('A', 'S'), card('7', 'H'), card('8', 'C')];
    const game = {
      hands: [hand, [], [], []],
      currentTrick: [],
      trumpSuit: 'S',
      tricks: [],
      currentBid: { value: 80, suit: 'S', playerIndex: 0, team: 0, coinched: false, surcoinched: false },
      biddingHistory: [],
      beloteInfo: { playerIndex: null, declared: null, rebeloteDone: false, complete: false },
    };
    const { card: chosen } = getBotCardAction(game, 0);
    expect(hand.some(c => c.suit === chosen.suit && c.value === chosen.value)).toBe(true);
  });
});
