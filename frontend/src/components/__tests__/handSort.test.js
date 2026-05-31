import { describe, it, expect } from 'vitest';
import { sortHand, deriveHandOrder, cardKey } from '../gameBoardHelpers';

// Helper: true when every suit forms a single contiguous block (i.e. grouped).
function isGroupedBySuit(hand) {
  const seen = new Set();
  let prev = null;
  for (const c of hand) {
    if (c.suit !== prev) {
      if (seen.has(c.suit)) return false; // suit reappears after a gap
      seen.add(c.suit);
      prev = c.suit;
    }
  }
  return true;
}

const keys = (hand) => hand.map(cardKey);

// A hand spanning all four suits, in raw (ungrouped) deal order.
// 9♦ 10♠ K♣ 7♣ 9♠ 10♦ Q♣ 10♥ J♥ K♥ (♥ chosen so trump-left is observable)
const DEAL_ORDER = [
  { suit: 'D', value: '9' },
  { suit: 'S', value: '10' },
  { suit: 'C', value: 'K' },
  { suit: 'C', value: '7' },
  { suit: 'S', value: '9' },
  { suit: 'D', value: '10' },
  { suit: 'C', value: 'Q' },
  { suit: 'H', value: '10' },
  { suit: 'H', value: 'J' },
  { suit: 'H', value: 'K' },
];

const auto = (trump, sacha) =>
  deriveHandOrder({ hand: DEAL_ORDER, trump, sacha, orderSource: 'auto', manualOrder: null });

describe('AUTO during bidding (trump null) — colour-alternation, both modes', () => {
  it('groups by suit even before trump is chosen', () => {
    expect(isGroupedBySuit(DEAL_ORDER)).toBe(false);     // sanity: input ungrouped
    expect(isGroupedBySuit(auto(null, false))).toBe(true);
    expect(isGroupedBySuit(auto(null, true))).toBe(true);
  });

  it('OFF and Sacha are identical when there is no trump to place', () => {
    // With trump null neither mode forces a suit left, so both are pure
    // colour-alternation — exactly the same order.
    expect(keys(auto(null, false))).toEqual(keys(auto(null, true)));
  });
});

describe('AUTO re-sorts when trump is chosen (OFF → trump on the left)', () => {
  it('places the trump suit leftmost in OFF mode', () => {
    const sorted = auto('H', false);
    expect(sorted[0].suit).toBe('H');
    expect(isGroupedBySuit(sorted)).toBe(true);
  });

  it('choosing trump changes the order vs the no-trump (bidding) order', () => {
    // Reactive re-sort: trump null → trump 'H' must move hearts to the left.
    expect(keys(auto('H', false))).not.toEqual(keys(auto(null, false)));
  });
});

describe('AUTO re-sorts when Mode Sacha is toggled (OFF ↔ ON)', () => {
  it('OFF (trump-left) and Sacha (pure alternation) differ once a trump exists', () => {
    // This is the reported bug: toggling Sacha must visibly re-sort. With a trump
    // set, OFF forces it left while Sacha does not — so the orders differ.
    expect(keys(auto('H', false))).not.toEqual(keys(auto('H', true)));
  });

  it('Sacha never forces the trump leftmost', () => {
    // Trump ♥ would be leftmost in OFF; in Sacha it lands by colour alternation.
    expect(auto('H', true)[0].suit).not.toBe('H');
  });
});

describe('MANUAL is frozen — never auto-recomputes', () => {
  const manualOrder = keys(DEAL_ORDER); // freeze to raw deal order

  it('returns the player arrangement regardless of trump or Sacha', () => {
    const m1 = deriveHandOrder({ hand: DEAL_ORDER, trump: 'H', sacha: false, orderSource: 'manual', manualOrder });
    const m2 = deriveHandOrder({ hand: DEAL_ORDER, trump: 'S', sacha: true,  orderSource: 'manual', manualOrder });
    expect(keys(m1)).toEqual(manualOrder); // unchanged by trump
    expect(keys(m2)).toEqual(manualOrder); // unchanged by trump + Sacha
  });

  it('applies an in-flight drag preview without committing it', () => {
    const preview = deriveHandOrder({
      hand: DEAL_ORDER, trump: null, sacha: false, orderSource: 'manual', manualOrder,
      dragVisual: { fromIdx: 0, toIdx: 2 },
    });
    expect(preview).toHaveLength(DEAL_ORDER.length);
    expect(keys(preview)).not.toEqual(manualOrder); // moved
  });
});

describe('new deal resets MANUAL → AUTO', () => {
  it('once orderSource is auto, the frozen manualOrder is ignored and the hand re-sorts', () => {
    const manualOrder = keys(DEAL_ORDER);
    // Same hand + leftover keys, but orderSource flipped back to auto (the per-deal
    // reset): the manual arrangement is discarded and the hand auto-sorts.
    const reset = deriveHandOrder({ hand: DEAL_ORDER, trump: null, sacha: false, orderSource: 'auto', manualOrder });
    expect(keys(reset)).toEqual(keys(sortHand(DEAL_ORDER, null, false)));
    expect(keys(reset)).not.toEqual(manualOrder);
  });
});
