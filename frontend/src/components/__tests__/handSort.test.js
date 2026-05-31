import { describe, it, expect } from 'vitest';
import { sortHand, autoSortModeForHand } from '../gameBoardHelpers';

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

// The hand from the bug report screenshot, in raw (ungrouped) deal order:
// 9♦ 10♠ K♣ 7♣ 9♠ 10♦ Q♣ 10♥
const DEAL_ORDER = [
  { suit: 'D', value: '9' },
  { suit: 'S', value: '10' },
  { suit: 'C', value: 'K' },
  { suit: 'C', value: '7' },
  { suit: 'S', value: '9' },
  { suit: 'D', value: '10' },
  { suit: 'C', value: 'Q' },
  { suit: 'H', value: '10' },
];

describe('hand auto-sorts during bidding (no trump yet)', () => {
  it('a freshly-dealt hand is grouped by suit even before trump is chosen', () => {
    // During bidding there is no trump; the deal picks an auto sort mode (a suit).
    const mode = autoSortModeForHand(DEAL_ORDER, null);
    const sorted = sortHand(DEAL_ORDER, mode, false);
    expect(isGroupedBySuit(DEAL_ORDER)).toBe(false); // sanity: input is ungrouped
    expect(isGroupedBySuit(sorted)).toBe(true);      // output is grouped
    expect(sorted).toHaveLength(DEAL_ORDER.length);
  });

  it('grouping also holds in Mode Sacha (colour alternation)', () => {
    const sorted = sortHand(DEAL_ORDER, autoSortModeForHand(DEAL_ORDER, null), true);
    expect(isGroupedBySuit(sorted)).toBe(true);
  });
});

describe('manual mode resets to auto on every new deal', () => {
  it('autoSortModeForHand never yields manual — so a new deal always re-sorts', () => {
    expect(autoSortModeForHand(DEAL_ORDER, null)).not.toBe('manual');
    expect(['S', 'H', 'D', 'C']).toContain(autoSortModeForHand(DEAL_ORDER, null));
  });

  it('trump takes precedence over the strongest-suit fallback once known', () => {
    expect(autoSortModeForHand(DEAL_ORDER, 'H')).toBe('H');
    expect(autoSortModeForHand(DEAL_ORDER, null)).toBe(autoSortModeForHand(DEAL_ORDER));
  });

  it('returns a usable mode even for an empty hand', () => {
    expect(['S', 'H', 'D', 'C']).toContain(autoSortModeForHand([], null));
  });
});
