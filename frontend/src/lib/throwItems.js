// Throw projectiles catalog. Each item has its OWN impact: a distinct splat
// (colour/shape + emoji + optional drip/particles) AND a distinct target-avatar
// reaction. The `id` set MUST match the server's allowed set
// (roomManager.THROW_ITEMS).
//
// Fields:
//   emoji     the projectile
//   splat     splat colour/shape variant (CSS .throw-splat-<splat>)
//   color     base colour (hex, no '#') for particle droplets + drips
//   burst     small emoji shown on impact (crack, stars, splash…)
//   reaction  target-avatar reaction (CSS .react-<reaction>):
//             shake | slip | wobble | recoil | sour | knock | slap
//   messy     true → a drip/stain slides down the avatar and fades
//   stun      true → a brief 😵 "stunned" overlay on impact (heavy/bonk items)

export const THROW_ITEMS = [
  { id: 'tomato',     emoji: '🍅', splat: 'tomato',     color: 'd83a2e', burst: '',   reaction: 'shake',  messy: true,  stun: false },
  { id: 'egg',        emoji: '🥚', splat: 'egg',        color: 'f3c64a', burst: '🍳', reaction: 'shake',  messy: true,  stun: false },
  { id: 'banana',     emoji: '🍌', splat: 'banana',     color: 'f4d03f', burst: '🍌', reaction: 'slip',   messy: false, stun: false },
  { id: 'pie',        emoji: '🥧', splat: 'cream',      color: 'f3ead0', burst: '',   reaction: 'wobble', messy: true,  stun: false },
  { id: 'shoe',       emoji: '👟', splat: 'stars',      color: 'cccccc', burst: '💫', reaction: 'recoil', messy: false, stun: true  },
  { id: 'poop',       emoji: '💩', splat: 'poop',       color: '7a4a22', burst: '',   reaction: 'shake',  messy: true,  stun: false },
  { id: 'lemon',      emoji: '🍋', splat: 'lemon',      color: 'ffe24a', burst: '💦', reaction: 'sour',   messy: true,  stun: false },
  { id: 'watermelon', emoji: '🍉', splat: 'watermelon', color: 'ff5566', burst: '💦', reaction: 'recoil', messy: true,  stun: true  },
  { id: 'apple',      emoji: '🍎', splat: 'stars',      color: 'e23b3b', burst: '💥', reaction: 'knock',  messy: false, stun: true  },
  { id: 'orange',     emoji: '🍊', splat: 'orange',     color: 'ff9f1c', burst: '💦', reaction: 'shake',  messy: true,  stun: false },
  { id: 'fish',       emoji: '🐟', splat: 'fish',       color: '8fd3ff', burst: '💦', reaction: 'slap',   messy: true,  stun: false },
  { id: 'baguette',   emoji: '🥖', splat: 'stars',      color: 'd8a24a', burst: '✨', reaction: 'recoil', messy: false, stun: true  },
];

export const THROW_ITEM_IDS = THROW_ITEMS.map(i => i.id);

export function itemById(id) {
  return THROW_ITEMS.find(i => i.id === id) || null;
}

// Timings (ms) — snappier toss, punchy impact, splat lingers then fades.
export const THROW_FLIGHT_MS = 480;  // snappy ease-out toss
export const THROW_IMPACT_MS = 1100; // splat pop → linger → fade
export const THROW_TOTAL_MS  = THROW_FLIGHT_MS + THROW_IMPACT_MS;
