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

// ── Builder option sets ──────────────────────────────────────────────────────
// The FULL part enums react-peeps ships (mirrors react-peeps@0.1.10) — every
// option is exposed so avatars can be as varied / eccentric as the library
// allows. `body` is the flat union of all three pose families (bust + sitting +
// standing); in Open Peeps a body combines POSE + OUTFIT into one illustration
// and can't be split, so we surface them all. The three families share no keys,
// so react-peeps' lookup (BustPose[k] || SittingPose[k] || StandingPose[k])
// resolves each unambiguously, and Avatar.jsx frames each figure by measuring
// its own bounding box (poses differ wildly in size).
const BODY_BUST = ['BlazerBlackTee', 'Shirt', 'ButtonShirt', 'Dress', 'Gaming', 'Geek', 'Hoodie', 'PointingUp', 'Selena', 'Thunder', 'Turtleneck', 'ArmsCrossed', 'Coffee', 'Device', 'DotJacket', 'Explaining', 'FurJacket', 'Killer', 'Paper', 'PocketShirt', 'PoloSweater', 'ShirtCoat', 'ShirtFilled', 'SportyShirt', 'StripedShirt', 'Sweater', 'SweaterDots', 'Whatever'];
const BODY_SITTING = ['Bike', 'ClosedLegBW', 'ClosedLegWB', 'CrossedLegs', 'HandsBackBW', 'HandsBackWB', 'MediumBW', 'MediumWB', 'OneLegUpBW', 'OneLegUpWB', 'WheelChair'];
const BODY_STANDING = ['BlazerBW', 'BlazerPantsBW', 'BlazerPantsWB', 'BlazerWB', 'CrossedArmsBW', 'CrossedArmsWB', 'EasingBW', 'EasingWB', 'PointingFingerBW', 'PointingFingerWB', 'PolkaDots', 'RestingBW', 'RestingWB', 'RoboDanceBW', 'RoboDanceOutline', 'RoboDanceWB', 'ShirtBW', 'ShirtPantsBW', 'ShirtPantsWB', 'ShirtWB', 'WalkingBW', 'WalkingFilled', 'WalkingWB', 'Doc', 'DocProtectiveClothe', 'DocStethoscope'];

export const OPTIONS = {
  body: [...BODY_BUST, ...BODY_SITTING, ...BODY_STANDING],
  hair: ['Afro', 'Bald', 'BaldSides', 'BaldTop', 'Bangs', 'BangsFilled', 'Bear', 'Bun', 'BunCurly', 'Buns', 'FlatTop', 'FlatTopLong', 'HatHip', 'Long', 'LongAfro', 'LongBangs', 'LongCurly', 'Medium', 'MediumBangs', 'MediumBangsFilled', 'MediumLong', 'MediumShort', 'MediumStraight', 'Mohawk', 'MohawkDino', 'Pomp', 'ShavedRight', 'ShavedSides', 'ShavedWavy', 'Short', 'ShortCurly', 'ShortMessy', 'ShortScratch', 'ShortVolumed', 'ShortWavy', 'BantuKnots', 'Beanie', 'BunFancy', 'CornRows', 'CornRowsFilled', 'GrayBun', 'GrayMedium', 'GrayShort', 'Hijab', 'MediumShade', 'Turban', 'Twists', 'TwistsVolumed', 'DocBouffant', 'DocSurgery', 'DocShield'],
  face: ['Angry', 'Blank', 'Calm', 'Cheeky', 'Concerned', 'Contempt', 'Cute', 'Driven', 'EatingHappy', 'EyesClosed', 'OldAged', 'Serious', 'Smile', 'Solemn', 'Suspicious', 'Tired', 'VeryAngry', 'Awe', 'ConcernedFear', 'Cyclops', 'Explaining', 'Fear', 'Hectic', 'LoveGrin', 'LoveGrinTeeth', 'Monster', 'Rage', 'SmileBig', 'SmileLol', 'SmileTeeth', 'CalmNM', 'SmileNM', 'CheersNM'],
  // 'None' is the package's own sentinel — it renders nothing for that part.
  facialHair: ['None', 'Chin', 'Full', 'FullMajestic', 'FullMedium', 'Goatee', 'GoateeCircle', 'Dali', 'Handlebars', 'Imperial', 'Painters', 'PaintersFilled', 'Swashbuckler', 'MoustacheThin', 'Yosemite', 'GrayFull', 'MajesticHandlebars'],
  accessory:  ['None', 'Eyepatch', 'GlassRoundThick', 'SunglassClubmaster', 'SunglassWayfarer', 'GlassAviator', 'GlassButterfly', 'GlassButterflyOutline', 'GlassClubmaster', 'GlassRound'],
  // Colors take a hex string (with '#'); these map straight to react-peeps props.
  // strokeColor = the ink/outline (reads as skin + line tone); backgroundColor =
  // fill. Open Peeps is line-art so there's no per-part / skin colour — just
  // these two, with a wide range (incl. eccentric tones for wild characters).
  strokeColor:     ['#000000', '#1a1a1a', '#2c1b18', '#3a2a1d', '#5b3a29', '#6b4f3a', '#7a4a23', '#8d5524', '#a55728', '#c68642', '#e0ac69', '#2c3e50', '#34495e', '#5d3fd3', '#b03a2e', '#1f6f54'],
  backgroundColor: ['#ffffff', '#fde2c4', '#f4d35e', '#ffb703', '#ee964b', '#f95738', '#e63946', '#ff488e', '#c77dff', '#5199e4', '#0d3b66', '#1f6f54', '#a7ffc4', '#b1e2ff', '#c9ced6', '#2b2d42'],
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
