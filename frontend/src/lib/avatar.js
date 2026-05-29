// Avatar config — pure helpers around the "Open Peeps" full-body figures.
//
// Library: react-peeps (npm, MIT). Art: Open Peeps by Pablo Stanley — CC0, no
// attribution required. Figures are hand-drawn SVGs rendered deterministically
// from a stored options object (no network, no image files); the options live in
// profiles.avatar_config (jsonb, nullable).
//
// react-peeps takes string keys (e.g. hair:'Short') and looks them up in its
// part enums, so the config serializes cleanly as plain strings. Each part is a
// two-tone line drawing: `strokeColor` is the ink/outline, `backgroundColor` the
// shape fill.
//
// This module is intentionally framework-free (no React, no react-peeps import)
// so the config shape / serialization is unit-testable on its own. Avatar.jsx
// does the actual <Peep> rendering and the head/full cropping.

// ── Builder option sets (the values a user can cycle through) ────────────────
// Curated subsets of the package's part enums — kept clean and recognizable.
// `body` uses STANDING poses so the waiting-room figures read as true full-body.
export const OPTIONS = {
  body: [
    'ShirtBW', 'ShirtWB', 'ShirtPantsBW', 'ShirtPantsWB',
    'BlazerBW', 'BlazerWB', 'BlazerPantsBW', 'BlazerPantsWB',
    'CrossedArmsBW', 'CrossedArmsWB', 'EasingBW', 'EasingWB',
    'PointingFingerBW', 'RestingBW', 'RestingWB', 'WalkingBW', 'WalkingWB', 'PolkaDots',
  ],
  hair: [
    'Short', 'ShortCurly', 'ShortMessy', 'ShortWavy', 'ShortVolumed',
    'Medium', 'MediumLong', 'MediumStraight', 'Long', 'LongCurly',
    'Bun', 'Buns', 'Afro', 'Bald', 'FlatTop', 'Pomp', 'Mohawk',
    'CornRows', 'Twists', 'Hijab', 'Turban',
  ],
  face: [
    'Smile', 'SmileBig', 'SmileTeeth', 'Calm', 'Cheeky', 'Cute', 'Serious',
    'Solemn', 'Suspicious', 'Driven', 'EatingHappy', 'EyesClosed', 'LoveGrin',
    'Awe', 'Concerned', 'Tired',
  ],
  // 'None' is the package's own sentinel — it renders nothing for that part.
  facialHair: ['None', 'Chin', 'Full', 'FullMedium', 'Goatee', 'GoateeCircle', 'Handlebars', 'MoustacheThin', 'Dali', 'Imperial'],
  accessory:  ['None', 'GlassRound', 'GlassRoundThick', 'GlassAviator', 'SunglassWayfarer', 'SunglassClubmaster', 'GlassButterfly', 'GlassClubmaster', 'Eyepatch'],
  // Colors take a hex string (with '#'); these map straight to react-peeps props.
  // strokeColor = the ink/outline (reads as skin + line tone); backgroundColor = fill.
  strokeColor:     ['#1a1a1a', '#3a2a1d', '#5b3a29', '#6b4f3a', '#8d5524', '#a55728', '#c68642', '#2c3e50'],
  backgroundColor: ['#ffffff', '#f4d35e', '#ee964b', '#f95738', '#0d3b66', '#5199e4', '#a7ffc4', '#ff488e', '#b1e2ff', '#c9ced6'],
};

// The fields the builder edits, in display order. Each maps to OPTIONS above.
export const FEATURE_KEYS = ['body', 'hair', 'face', 'facialHair', 'accessory', 'strokeColor', 'backgroundColor'];

// The triad that identifies a config as a valid Open Peeps config (vs an old
// avataaars blob, which has top/eyes/mouth and none of these). Used by
// normalizeAvatarConfig to decide "render figure" vs "letter-circle fallback".
const IDENTITY_KEYS = ['body', 'hair', 'face'];

export const DEFAULT_AVATAR = {
  body:            'ShirtBW',
  hair:            'Short',
  face:            'Smile',
  facialHair:      'None',
  accessory:       'None',
  strokeColor:     '#3a2a1d',
  backgroundColor: '#ffffff',
};

// Clamp an arbitrary stored/received object to a valid config. Returns a fresh
// object, never throws. Returns `null` (→ letter-circle fallback) when the input
// isn't an object OR isn't a recognizable Open Peeps config: an old avataaars
// blob, an empty object, or one missing a valid body/hair/face all read as "no
// avatar" so existing users see the fallback until they re-save. The remaining
// fields (facialHair/accessory/colors) fall back to defaults if invalid.
export function normalizeAvatarConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return null;
  for (const key of IDENTITY_KEYS) {
    if (!OPTIONS[key].includes(cfg[key])) return null;
  }
  const out = {};
  for (const key of FEATURE_KEYS) {
    const allowed = OPTIONS[key];
    out[key] = allowed.includes(cfg[key]) ? cfg[key] : DEFAULT_AVATAR[key];
  }
  return out;
}

// Step a single feature forward/backward through its option list (cycle UI).
export function cycleFeature(cfg, key, dir = 1) {
  const list = OPTIONS[key];
  const cur = list.indexOf(cfg[key]);
  const next = (((cur === -1 ? 0 : cur) + dir) % list.length + list.length) % list.length;
  return { ...cfg, [key]: list[next] };
}

// A random valid config. `rand` is injectable for deterministic tests.
export function randomAvatarConfig(rand = Math.random) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const cfg = {};
  for (const key of FEATURE_KEYS) cfg[key] = pick(OPTIONS[key]);
  return cfg;
}

// Convert a stored config into the props object react-peeps' <Peep> expects.
// 'None' for facialHair/accessory is the package's own sentinel (renders empty),
// so it passes straight through — no special handling. Falls back to the default
// avatar for an invalid/null config so callers never crash.
export function toPeepProps(cfg) {
  const c = normalizeAvatarConfig(cfg) || DEFAULT_AVATAR;
  return {
    body:            c.body,
    hair:            c.hair,
    face:            c.face,
    facialHair:      c.facialHair,
    accessory:       c.accessory,
    strokeColor:     c.strokeColor,
    backgroundColor: c.backgroundColor,
  };
}

// ── Bot figures ──────────────────────────────────────────────────────────────
// Bots have no stored config, so we synthesize a DISTINCT but STABLE Open Peeps
// person from a seed (the bot's name or seat index). Same seed → same figure
// across renders/sessions; different seeds → visibly different people. Bots are
// normal Open Peeps figures (NOT robots) — they're marked as bots by a ring in
// Avatar.jsx, not by their appearance.
function hashSeed(seed) {
  const s = String(seed ?? 'bot');
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function botAvatarConfig(seed) {
  let h = hashSeed(seed);
  const next = () => {
    // xorshift32 step → a fresh non-negative int each call (deterministic).
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5;  h >>>= 0;
    return h;
  };
  const cfg = {};
  for (const key of FEATURE_KEYS) {
    const list = OPTIONS[key];
    cfg[key] = list[next() % list.length];
  }
  return cfg;
}
