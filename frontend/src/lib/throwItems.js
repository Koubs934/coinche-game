// Throw projectiles catalog. Each item has its OWN impact: a distinct splat
// (colour/shape + an emoji) AND a distinct target-avatar reaction. The `id` set
// must match the server's allowed set (roomManager.THROW_ITEMS).
//
// impact:   which splat visual to render at the target ('splat' | 'peel' | 'bonk')
// splat:    modifier class for the splat colour/shape (CSS .throw-splat-<splat>)
// burst:    a small emoji shown on impact (cream drip, stars, crack…)
// reaction: how the target avatar reacts (CSS class: shake | slip | wobble | recoil)

export const THROW_ITEMS = [
  { id: 'tomato', emoji: '🍅', impact: 'splat', splat: 'tomato', burst: '',   reaction: 'shake'  },
  { id: 'egg',    emoji: '🥚', impact: 'splat', splat: 'egg',    burst: '🍳', reaction: 'shake'  },
  { id: 'banana', emoji: '🍌', impact: 'peel',  splat: 'banana', burst: '🍌', reaction: 'slip'   },
  { id: 'pie',    emoji: '🥧', impact: 'splat', splat: 'cream',  burst: '',   reaction: 'wobble' },
  { id: 'shoe',   emoji: '👟', impact: 'bonk',  splat: 'stars',  burst: '💫', reaction: 'recoil' },
  { id: 'poop',   emoji: '💩', impact: 'splat', splat: 'poop',   burst: '',   reaction: 'shake'  },
];

export const THROW_ITEM_IDS = THROW_ITEMS.map(i => i.id);

export function itemById(id) {
  return THROW_ITEMS.find(i => i.id === id) || null;
}

// Timings (ms) — kept short + self-cleaning. Total ≈ flight + impact.
export const THROW_FLIGHT_MS = 700;
export const THROW_IMPACT_MS = 800;
export const THROW_TOTAL_MS  = THROW_FLIGHT_MS + THROW_IMPACT_MS;
