// Pure helpers and constants for GameBoard — no React, no state.
// Kept separate so GameBoard.jsx stays focused on state + JSX.

// ─── Card point tables (mirrors backend — used for live scoring) ───────────
export const TRUMP_PTS     = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };
export const NON_TRUMP_PTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };
export const SUIT_SYM      = { S: '♠', H: '♥', D: '♦', C: '♣' };

// ─── Bid action helpers ────────────────────────────────────────────────────

export function formatBidAction(action, t) {
  if (!action) return null;
  if (action.type === 'pass') return t.pass;
  if (action.type === 'bid')
    return action.value === 'capot' ? t.capot : `${action.value} ${SUIT_SYM[action.suit]}`;
  if (action.type === 'coinche') return t.coinche;
  if (action.type === 'surcoinche') return t.surcoinche;
  return null;
}

export function bidChipClass(action) {
  if (!action) return '';
  return { pass: 'chip-pass', bid: 'chip-bid', coinche: 'chip-coinche', surcoinche: 'chip-surc' }[action.type] || '';
}

export function buildPerPlayerHistory(history) {
  const r = { 0: [], 1: [], 2: [], 3: [] };
  if (!history) return r;
  for (const entry of history) r[entry.position].push(entry);
  return r;
}

export function cardPts(card, trump) {
  return ((card.suit === trump) ? TRUMP_PTS : NON_TRUMP_PTS)[card.value] || 0;
}

export function computeLivePoints(tricks, trump) {
  const pts = [0, 0];
  if (!tricks?.length || !trump) return pts;
  for (const trick of tricks) {
    const team = trick.winner % 2;
    for (const { card } of trick.cards) pts[team] += cardPts(card, trump);
  }
  return pts;
}

// Return the suit with the highest trump potential in the hand.
// Tie-break 1: more cards in the suit. Tie-break 2: canonical order S→H→D→C.
export function bestSuitForHand(hand) {
  if (!hand?.length) return 'S';
  let best = 'S', bestScore = -1, bestCount = -1;
  for (const suit of ['S', 'H', 'D', 'C']) {
    const score = hand.reduce((s, c) => c.suit === suit ? s + (TRUMP_PTS[c.value] ?? 0) : s, 0);
    const count = hand.filter(c => c.suit === suit).length;
    if (score > bestScore || (score === bestScore && count > bestCount)) {
      bestScore = score; bestCount = count; best = suit;
    }
  }
  return best;
}

// ─── Hand sorting ──────────────────────────────────────────────────────────
const TRUMP_ORDER     = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const NON_TRUMP_ORDER = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];
const SUIT_COLOR      = { S: 'B', C: 'B', H: 'R', D: 'R' };
const CANONICAL_SUITS = ['S', 'H', 'D', 'C'];

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  return arr.flatMap((s, i) =>
    permutations(arr.filter((_, j) => j !== i)).map(p => [s, ...p])
  );
}

function bestNonTrumpOrder(suits, leftColor) {
  if (suits.length <= 1) return [...suits];
  let bestPerm = null, bestScore = Infinity, bestKey = Infinity;
  for (const perm of permutations(suits)) {
    let score = 0;
    if (leftColor && SUIT_COLOR[perm[0]] === leftColor) score++;
    for (let i = 0; i < perm.length - 1; i++) {
      if (SUIT_COLOR[perm[i]] === SUIT_COLOR[perm[i + 1]]) score++;
    }
    const key = perm.reduce((n, s) => n * 4 + CANONICAL_SUITS.indexOf(s), 0);
    if (score < bestScore || (score === bestScore && key < bestKey)) {
      bestPerm = perm; bestScore = score; bestKey = key;
    }
  }
  return bestPerm;
}

export function sortHand(hand, trump) {
  if (!hand?.length) return hand || [];
  const presentSuits  = [...new Set(hand.map(c => c.suit))];
  const trumpInHand   = trump && presentSuits.includes(trump);
  const nonTrumpSuits = presentSuits.filter(s => s !== trump);
  const leftColor     = trumpInHand ? SUIT_COLOR[trump] : null;
  const suitOrder     = [
    ...(trumpInHand ? [trump] : []),
    ...bestNonTrumpOrder(nonTrumpSuits, leftColor),
  ];
  return [...hand].sort((a, b) => {
    const ai = suitOrder.indexOf(a.suit), bi = suitOrder.indexOf(b.suit);
    if (ai !== bi) return ai - bi;
    const order = a.suit === trump ? TRUMP_ORDER : NON_TRUMP_ORDER;
    return order.indexOf(a.value) - order.indexOf(b.value);
  });
}

// Direction the trick slides toward the winner (relative to viewer at bottom)
export function winDir(winnerPos, myPos) {
  return ['bottom', 'right', 'top', 'left'][((winnerPos - myPos) + 4) % 4];
}

// ─── Manual order helpers ──────────────────────────────────────────────────

export function cardKey(c) { return `${c.suit}${c.value}`; }

export function applyManualOrder(hand, orderKeys) {
  if (!orderKeys) return hand;
  const map = Object.fromEntries(hand.map(c => [cardKey(c), c]));
  const sorted = orderKeys.filter(k => k in map).map(k => map[k]);
  const unseen = hand.filter(c => !orderKeys.includes(cardKey(c)));
  return [...sorted, ...unseen];
}

export function reorderArr(arr, from, to) {
  const a = [...arr];
  const [item] = a.splice(from, 1);
  a.splice(to, 0, item);
  return a;
}
