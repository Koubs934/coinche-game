import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useLang } from '../context/LanguageContext';
import { useModeSacha } from '../context/ModeSachaContext';
import BiddingPanel from './BiddingPanel';
import RoundSummary from './RoundSummary';
import {
  SUIT_SYM,
  buildPerPlayerHistory,
  bestSuitForHand,
  sortHand, winDir, cardKey, applyManualOrder, reorderArr,
  displayName,
} from './gameBoardHelpers';
import {
  CardFace, TrickDisplay, BidStack,
  ContractBadge, CoincheBadge, PlayerSeat, CutPicker,
  BelotePrompt, PauseBanner,
} from './gameBoardParts';
import GameErrorTagOverlay from '../game/GameErrorTagOverlay';
import Avatar from './Avatar';

// ─── Fanned-arc hand tuning ────────────────────────────────────────────────
const HAND_ARCH = 2.2;   // px per off² — vertical arch depth (middle highest)
const HAND_ROT  = 5;     // deg per step — fan tilt
const HAND_LIFT = 24;    // px a hovered/pressed card rises
// Coinche deals 8 cards. The arc's horizontal step is derived for a FULL hand so
// a full hand fills the width (unchanged), and as cards are played the remaining
// cards keep that same tight overlap — a smaller fan CENTERED in the middle rather
// than stretching to refill the width. (The fan is symmetric around left:50%, so
// any card count is naturally centered; only the step is held fixed.)
const FULL_HAND = 8;
// Gap left between the floated arc hand and the top edge of whatever sits
// beneath it during bidding (collapsed bar / open sheet) so full card bodies
// always clear it. The hand is lifted by (measured bar|sheet height + this gap).
const HAND_SHEET_GAP = 12;

// Horizontal step between card centres, derived from the measured container so
// every card always fits. Edge cards are the most rotated, and rotation swings
// their corners outward (their axis-aligned box is wider than the card), so the
// budget reserves that overhang — otherwise the fan spills past the viewport.
function arcXStep(box, n) {
  if (n <= 1 || !box.w) return 0;
  const mid = (n - 1) / 2;
  const phi = (mid * HAND_ROT) * Math.PI / 180;
  const halfExtent = (box.cardW / 2) * Math.cos(phi) + box.cardH * Math.sin(phi);
  const span = Math.max(0, box.w - 2 * halfExtent);
  return span / (n - 1);
}

// ─── Collapsible bid sheet ──────────────────────────────────────────────────
// On short viewports the bid controls live in a bottom sheet that can collapse
// so the full table + arc hand show. Tall viewports keep it permanently open
// (handled in CSS) and these gestures are no-ops there.
// NOTE: keep this threshold in sync with the `@media (max-height: …)` block that
// styles .bid-sheet / .bid-bar in App.css.
const SHORT_VIEWPORT_QUERY = '(max-height: 820px)';
const DEFAULT_BID_SHEET_OPEN = true;   // flip to false to default-collapse on your turn
const SHEET_SWIPE_CLOSE_PX = 45;       // downward swipe distance that collapses the sheet

function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

// ─── Main GameBoard ────────────────────────────────────────────────────────

export default function GameBoard({ socket, roomCode, room, game, myPosition, trainingMode, throwOpen, onToggleThrow }) {
  // trainingMode, when provided, is { runId } — gates the handful of behaviors
  // that differ from normal-game (action emits, abandon confirm, hidden UI
  // that doesn't apply: undo, admin panel, pending joins).
  const { t } = useLang();
  // Mode Sacha is a global preference (read-only here in training; toggled from the
  // Réglages overlay during normal play). Both GameBoard instances honor it live.
  const { modeSacha } = useModeSacha();

  // ── State ──────────────────────────────────────────────────────────────────
  // sortMode: 'S'|'H'|'D'|'C' = sort as if that suit were trump; 'manual' = drag order
  const [sortMode, setSortMode] = useState(() => {
    try {
      const saved = localStorage.getItem(`coinche-sortmode-${roomCode}`);
      if (saved === 'manual') return 'manual';
    } catch {}
    if (game.trumpSuit) return game.trumpSuit;
    const hand = game.hands?.[myPosition] || [];
    return bestSuitForHand(hand);
  });
  const [showLastTrick, setShowLastTrick] = useState(false);
  // trickOverlay = { cards, winnerPos, animate } | null
  const [trickOverlay, setTrickOverlay] = useState(null);
  // manualOrderKeys: card-key array defining manual hand order; null = server order
  const [manualOrderKeys, setManualOrderKeys] = useState(() => {
    try {
      const s = localStorage.getItem(`coinche-hand-${roomCode}-${game.dealer}`);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  // dragVisual: { fromIdx, toIdx } live during a drag gesture
  const [dragVisual, setDragVisual] = useState(null);
  // dragX: live pointer clientX while dragging, so the dragged card follows the finger
  const [dragX, setDragX] = useState(null);
  // handBox: measured arc metrics — w = inner width, cardW/cardH = scaled card size
  const [handBox, setHandBox] = useState({ w: 0, cardW: 0, cardH: 0 });
  // liftIdx: index of the card currently lifted (hover/press) — straightens + rises
  const [liftIdx, setLiftIdx] = useState(null);
  // sheetOpen: bid bottom-sheet state (only meaningful on short viewports; tall
  // screens keep the sheet open via CSS regardless of this value)
  const [sheetOpen, setSheetOpen] = useState(DEFAULT_BID_SHEET_OPEN);
  // sheetMetrics: measured heights of the collapsed bar / open sheet, used to
  // float the arc hand just above whichever is showing (pure offset — the felt
  // never resizes). Each kept whenever its element is rendered with height.
  const [sheetMetrics, setSheetMetrics] = useState({ barH: 0, sheetH: 0 });
  // dealAnimCounts: [c0,c1,c2,c3] while the 3-2-3 deal plays out; null = show all
  const [dealAnimCounts, setDealAnimCounts] = useState(null);
  // beloteDecisionCard: card waiting for belote/non choice; null when not prompting
  const [beloteDecisionCard, setBeloteDecisionCard] = useState(null);
  // beloteAnnounce: 'belote' | 'rebelote' | null — table message after declaration
  const [beloteAnnounce, setBeloteAnnounce] = useState(null);
  // shuffleCutMsg: { text, positive } shown on table after a shuffle/cut action; null when hidden
  const [shuffleCutMsg, setShuffleCutMsg] = useState(null);
  // tagErrorOpen: whether the room-creator Game Review overlay is visible.
  // V1 pause semantics are frontend-only — backend keeps accepting plays from
  // everyone else while this is up.
  const [tagErrorOpen, setTagErrorOpen] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const prevTricksLenRef = useRef(0);
  const prevDealerRef    = useRef(null);
  const prevTrumpRef     = useRef(null);
  const timerRef         = useRef([]);
  // Dedicated ref for the belote/rebelote announce banner timer. Kept separate
  // from timerRef (used by trick-completion) because trick-completion clears
  // all timers in its ref every time a trick ends, which would prematurely
  // cancel the belote banner timer.
  const beloteTimerRef   = useRef(null);
  const dragRef          = useRef(null);   // active drag { fromIdx, toIdx }
  const longPressRef     = useRef(null);   // long-press timer
  const startXYRef       = useRef(null);   // pointer position at pointerdown
  const wasDragRef       = useRef(false);  // suppress click after drag completes
  const handElRef        = useRef(null);   // ref on .my-hand div
  const rulerRef         = useRef(null);   // hidden element whose width = scaled card width
  const handBoxRef       = useRef({ w: 0, cardW: 0, cardH: 0 }); // mirror of handBox for pointer handlers
  const dragRectRef      = useRef(null);   // .my-hand client rect captured at drag start
  const sheetSwipeYRef   = useRef(null);   // pointer Y at sheet pointerdown (swipe-to-collapse)
  const bidBarRef        = useRef(null);   // collapsed highest-bid bar (its height = collapsed hand lift)
  const bidSheetRef      = useRef(null);   // open bid sheet (its height = open hand lift)
  const prevDealerMRef      = useRef(game.dealer); // for detecting new round
  const prevRoomPhaseRef    = useRef(room.phase);  // for CUT→PLAYING deal animation
  const prevBeloteRef       = useRef({ declared: game.beloteInfo?.declared ?? null, rebeloteDone: game.beloteInfo?.rebeloteDone ?? false });
  const prevSCActionRef     = useRef(room.lastShuffleCutAction ?? null); // for shuffle/cut feedback

  // ── Derived ────────────────────────────────────────────────────────────────
  const { players, scores, paused, shuffleDealer, cutPlayer, lastShuffleCutAction, lastShuffleCutActorPos } = room;
  const {
    phase, currentTrick, currentPlayer, biddingTurn,
    trumpSuit, currentBid, hands, handCounts, beloteInfo, tricks,
  } = game;

  const myHand       = hands[myPosition] || [];
  // Partner peek (server-gated to two specific users; only ever set in THEIR payload).
  const peekHand     = game.peekHand || null;
  const myPlayer     = players.find(p => p.position === myPosition);
  const myTeam       = myPlayer?.team ?? 0;
  const isMyCardTurn = phase === 'PLAYING' && currentPlayer === myPosition;
  const isMyBidTurn  = phase === 'BIDDING' && biddingTurn  === myPosition;
  const isMyTurn     = isMyCardTurn || isMyBidTurn;
  // Computed here (above every early return) because the sheet-measuring
  // useLayoutEffect below depends on it; the hook must run on every render to
  // keep the hook count stable across phases (Rules of Hooks).
  const bidSheetActive = phase === 'BIDDING' && isMyBidTurn;

  const isShortViewport = useMediaQuery(SHORT_VIEWPORT_QUERY);

  const manualHand   = applyManualOrder(myHand, manualOrderKeys);
  const displayHand  = sortMode !== 'manual'
    ? sortHand(myHand, sortMode, modeSacha)
    : dragVisual
      ? reorderArr(manualHand, dragVisual.fromIdx, dragVisual.toIdx)
      : manualHand;
  const lastDoneTrick  = tricks?.length > 0 ? tricks[tricks.length - 1] : null;
  const animatedHand   = dealAnimCounts != null
    ? displayHand.slice(0, dealAnimCounts[myPosition])
    : displayHand;

  // For active/dim states on opponent seats
  const isActiveTurnPhase = phase === 'BIDDING' || phase === 'PLAYING';
  const activeTurnPos     = phase === 'BIDDING' ? biddingTurn : currentPlayer;

  const perPlayerHistory = phase === 'BIDDING'
    ? buildPerPlayerHistory(game.biddingHistory)
    : { 0: [], 1: [], 2: [], 3: [] };

  const isBidding   = phase === 'BIDDING';
  // After bidding, currentBid is the winning contract (server field: currentBid.playerIndex = winner).
  const contractData = !isBidding && currentBid != null ? currentBid : null;
  const contractBy   = contractData?.playerIndex ?? null;

  // Derive who actually called Coinche / Surcoinche from the bidding history
  const biddingHistory = game.biddingHistory || [];
  const coincheBy    = contractData ? ([...biddingHistory].reverse().find(e => e.type === 'coinche')?.position   ?? null) : null;
  const surcoincheBy = contractData ? ([...biddingHistory].reverse().find(e => e.type === 'surcoinche')?.position ?? null) : null;

  // ── Shuffle / Cut derived ──────────────────────────────────────────────────
  const isShuffleCut    = room.phase === 'SHUFFLE' || room.phase === 'CUT';
  const isMyShuffleTurn = room.phase === 'SHUFFLE' && shuffleDealer === myPosition;
  const isMyCutTurn     = room.phase === 'CUT'     && cutPlayer     === myPosition;
  const scActorPos  = room.phase === 'SHUFFLE' ? shuffleDealer : cutPlayer;
  const scActorName = scActorPos != null
    ? (players.find(p => p.position === scActorPos)?.username || '?')
    : '?';

  function seatData(offset) {
    const pos    = (myPosition + offset + 4) % 4;
    const player = players.find(p => p.position === pos);
    return {
      player,
      handCount: dealAnimCounts ? dealAnimCounts[pos] : handCounts[pos],
      isActive:  isActiveTurnPhase && pos === activeTurnPos,
      isDimmed:  isActiveTurnPhase && pos !== activeTurnPos,
    };
  }

  const isCreator = room.creatorId === myPlayer?.userId;

  // Throw button — lives in the bottom band (right of the avatar/name), opening
  // the App-level tray upward. In-game only (hidden in training). The same
  // element is reused on the round-summary screen. Only one return path renders
  // per pass, so sharing the variable across both branches is safe.
  const throwButton = (!trainingMode && typeof onToggleThrow === 'function') ? (
    <button
      type="button"
      className={`btn-throw${throwOpen ? ' active' : ''}`}
      onClick={onToggleThrow}
      title={t.throw.aim}
      aria-label={t.throw.aim}
      aria-pressed={!!throwOpen}
    >
      🍋
    </button>
  ) : null;

  function leaveTable() {
    if (trainingMode) {
      if (!window.confirm(t.training.abandonConfirm)) return;
      socket.emit('abandonTrainingScenario', { runId: trainingMode.runId });
      return;
    }
    if (!window.confirm(t.leaveConfirmGame)) return;
    socket.emit('leaveRoom', { code: roomCode });
  }

  function removePlayer(targetUserId) {
    socket.emit('removePlayer', { code: roomCode, targetUserId });
  }

  // ── Effect: trick completion — show 1.5 s then animate ────────────────────
  useEffect(() => {
    if (!game || game.phase !== 'PLAYING') return;

    // New round resets tracking
    if (game.dealer !== prevDealerRef.current) {
      prevDealerRef.current    = game.dealer;
      prevTricksLenRef.current = 0;
      setTrickOverlay(null);
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
      return;
    }

    const newLen = game.tricks?.length ?? 0;
    if (newLen > prevTricksLenRef.current && newLen > 0) {
      prevTricksLenRef.current = newLen;
      const last = game.tricks[newLen - 1];

      // CAUTION: this clears all timers in timerRef, which is shared by the
      // trick-completion effect. Do NOT push timers from other effects (e.g. belote
      // announce) into this ref — use a dedicated ref instead, otherwise the
      // banner's auto-clear timer gets cancelled prematurely on the next trick.
      timerRef.current.forEach(clearTimeout);
      setTrickOverlay({ cards: last.cards, winnerPos: last.winner, animate: false });

      const t1 = setTimeout(() =>
        setTrickOverlay(prev => prev ? { ...prev, animate: true } : null), 1500);
      const t2 = setTimeout(() =>
        setTrickOverlay(null), 1920);

      timerRef.current = [t1, t2];
    }
  }, [game?.tricks?.length, game?.dealer, game?.phase]);

  // Cleanup on unmount
  useEffect(() => () => timerRef.current.forEach(clearTimeout), []);
  useEffect(() => () => { if (beloteTimerRef.current) clearTimeout(beloteTimerRef.current); }, []);

  // ── Effect: persist sortMode preference across rounds ─────────────────────
  useEffect(() => {
    try { localStorage.setItem(`coinche-sortmode-${roomCode}`, sortMode); } catch {}
  }, [sortMode]);

  // ── Effect: when trump is revealed, switch to it (unless in manual) ────────
  useEffect(() => {
    if (trumpSuit && trumpSuit !== prevTrumpRef.current) {
      prevTrumpRef.current = trumpSuit;
      setSortMode(prev => prev === 'manual' ? 'manual' : trumpSuit);
    }
    if (!trumpSuit) prevTrumpRef.current = null;
  }, [trumpSuit]);

  // ── Effect: reset on new round; carry forward manual preference ───────────
  useEffect(() => {
    if (game.dealer !== prevDealerMRef.current) {
      prevDealerMRef.current = game.dealer;
      setManualOrderKeys(null);
      // sortMode still holds previous round's value here
      setSortMode(prev => prev === 'manual' ? 'manual' : bestSuitForHand(myHand));
    }
  }, [game.dealer]);

  // ── Effect: 3-2-3 deal animation when CUT → PLAYING ────────────────────────
  useEffect(() => {
    if (prevRoomPhaseRef.current === 'CUT' && room.phase === 'PLAYING') {
      setDealAnimCounts([0, 0, 0, 0]);
      const t1 = setTimeout(() => setDealAnimCounts([3, 3, 3, 3]), 400);
      const t2 = setTimeout(() => setDealAnimCounts([5, 5, 5, 5]), 800);
      const t3 = setTimeout(() => setDealAnimCounts(null), 1200);
      timerRef.current.push(t1, t2, t3);
    }
    prevRoomPhaseRef.current = room.phase;
  }, [room.phase]);

  // ── Effect: show Belote / Rebelote announce banner ────────────────────────
  // Uses its OWN beloteTimerRef (not the shared timerRef) so the trick-completion
  // effect's clearTimeout sweep can't cancel the banner's auto-clear timer.
  // Also reconciles state when beloteInfo resets at round start (Option B
  // defense-in-depth): if some future code re-clobbers the timer, the banner
  // will still clear on the next round transition.
  useEffect(() => {
    const prev = prevBeloteRef.current;
    const declared     = beloteInfo?.declared     ?? null;
    const rebeloteDone = beloteInfo?.rebeloteDone ?? false;

    function scheduleClear() {
      if (beloteTimerRef.current) clearTimeout(beloteTimerRef.current);
      beloteTimerRef.current = setTimeout(() => {
        setBeloteAnnounce(null);
        beloteTimerRef.current = null;
      }, 2500);
    }

    if (!prev.declared && declared === 'yes') {
      setBeloteAnnounce('belote');
      scheduleClear();
    }
    if (!prev.rebeloteDone && rebeloteDone) {
      setBeloteAnnounce('rebelote');
      scheduleClear();
    }

    // Reconcile: if beloteInfo has been reset (new round started), force the
    // banner state back to null and cancel any in-flight timer.
    if (declared === null && !rebeloteDone) {
      if (beloteTimerRef.current) {
        clearTimeout(beloteTimerRef.current);
        beloteTimerRef.current = null;
      }
      setBeloteAnnounce(null);
    }

    prevBeloteRef.current = { declared, rebeloteDone };
  }, [beloteInfo?.declared, beloteInfo?.rebeloteDone]);

  // ── Effect: show shuffle/cut action feedback to all players ──────────────
  useEffect(() => {
    if (lastShuffleCutAction && lastShuffleCutAction !== prevSCActionRef.current) {
      const META = {
        shuffled:    { key: 'deckShuffled',    positive: true  },
        notShuffled: { key: 'deckNotShuffled', positive: false },
        cut:         { key: 'deckCut',         positive: true  },
        notCut:      { key: 'deckNotCut',      positive: false },
      };
      const meta = META[lastShuffleCutAction];
      if (meta) {
        setShuffleCutMsg({ actorPos: lastShuffleCutActorPos, positive: meta.positive, key: meta.key });
        timerRef.current.push(setTimeout(() => setShuffleCutMsg(null), 3500));
      }
    }
    prevSCActionRef.current = lastShuffleCutAction ?? null;
  }, [lastShuffleCutAction]);

  // ── Effect: measure the hand container + scaled card width for the arc ─────
  // The arc derives its per-card x-step from the live container width, so all
  // cards always fit regardless of viewport or Mode Delfino scale. A hidden
  // ruler element carries the scaled card width (calc(--card-w * scale)); a
  // ResizeObserver on both the container and the ruler recomputes on viewport
  // resize AND on Delfino size change without GameBoard knowing about Delfino.
  useLayoutEffect(() => {
    const el = handElRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      const w = el.clientWidth - padL - padR;
      const rr = rulerRef.current ? rulerRef.current.getBoundingClientRect() : null;
      const cardW = rr ? rr.width : 0;
      const cardH = rr ? rr.height : 0;
      const next = { w, cardW, cardH };
      handBoxRef.current = next;
      setHandBox(prev => (prev.w === next.w && prev.cardW === next.cardW && prev.cardH === next.cardH ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (rulerRef.current) ro.observe(rulerRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [animatedHand.length]);

  // ── Effect: default the bid sheet open each time it becomes my bid turn ────
  useEffect(() => {
    if (isMyBidTurn) setSheetOpen(DEFAULT_BID_SHEET_OPEN);
  }, [isMyBidTurn]);

  // Measure the collapsed bar / open sheet so the hand can float just above the
  // one that's showing. offsetHeight ignores the slide transform, so the sheet
  // is measurable even while translated off-screen; the bar is display:none when
  // the sheet is open, so we keep the last non-zero reading for each.
  // NOTE: must sit ABOVE the ROUND_OVER/GAME_OVER early return so the hook count
  // stays stable across phases — the no-op guard lives inside the effect body.
  useLayoutEffect(() => {
    if (!(bidSheetActive && isShortViewport)) return;
    const measure = () => {
      const barH   = bidBarRef.current   ? bidBarRef.current.offsetHeight   : 0;
      const sheetH = bidSheetRef.current ? bidSheetRef.current.offsetHeight : 0;
      setSheetMetrics(prev => {
        const next = { barH: barH || prev.barH, sheetH: sheetH || prev.sheetH };
        return (next.barH === prev.barH && next.sheetH === prev.sheetH) ? prev : next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (bidBarRef.current)   ro.observe(bidBarRef.current);
    if (bidSheetRef.current) ro.observe(bidSheetRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [bidSheetActive, isShortViewport, sheetOpen]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function playCard(card, declareBelote = false) {
    if (trainingMode) {
      socket.emit('submitTrainingAction', {
        runId: trainingMode.runId,
        action: { type: 'play-card', card, declareBelote },
      });
      return;
    }
    socket.emit('playCard', { code: roomCode, card, declareBelote });
  }

  // True when tapping this card should trigger the Belote prompt
  function needsBelotePrompt(card) {
    if (!trumpSuit || !isMyCardTurn) return false;
    if (card.suit !== trumpSuit) return false;
    if (card.value !== 'K' && card.value !== 'Q') return false;
    if (beloteInfo?.declared !== null) return false; // already decided
    const otherValue = card.value === 'K' ? 'Q' : 'K';
    return myHand.some(c => c.suit === trumpSuit && c.value === otherValue);
  }

  // ── Manual drag-to-reorder ────────────────────────────────────────────────
  const lsKey = `coinche-hand-${roomCode}-${game.dealer}`;

  function saveManualOrder(keys) {
    setManualOrderKeys(keys);
    try { localStorage.setItem(lsKey, JSON.stringify(keys)); } catch {}
  }

  // Map a pointer X to a slot index in the arc, derived from the same geometry
  // the cards are laid out with (centre ± off*xStep). Pure math, so it stays
  // correct even while the rest of the hand re-arcs around the dragged card.
  function getDropIdx(clientX) {
    const el = handElRef.current;
    if (!el) return 0;
    const n = animatedHand.length;
    if (n <= 1) return 0;
    const box = handBoxRef.current;
    // Same FIXED full-hand step the cards are laid out with (arcStyle uses it too).
    // The fan stays centered on the container midpoint for any n, so mapping is
    // centre ± (i - mid)*step — no extra centering offset to subtract.
    const xStep = arcXStep(box, Math.max(n, FULL_HAND));
    if (!xStep) return 0;
    const rect = dragRectRef.current || el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const centerX = rect.left + padL + box.w / 2;
    const mid = (n - 1) / 2;
    const slot = Math.round((clientX - centerX) / xStep + mid);
    return Math.max(0, Math.min(n - 1, slot));
  }

  // Which card index does this pointer event sit on? With overlap, the topmost
  // (right-most, highest z) card is the natural hit — .contains(target) resolves
  // it correctly because the browser already hit-tested by paint order.
  function cardIdxFromEvent(e) {
    const els = Array.from(handElRef.current.querySelectorAll('.card-face'));
    return els.findIndex(el => el === e.target || el.contains(e.target));
  }

  function handleHandPointerDown(e) {
    const idx = cardIdxFromEvent(e);
    // Press feedback: lift the touched playable card (also covers touch, which
    // has no hover).
    if (idx !== -1 && isMyCardTurn) setLiftIdx(idx);
    if (idx === -1) return;
    dragRectRef.current = handElRef.current.getBoundingClientRect();
    try { handElRef.current.setPointerCapture(e.pointerId); } catch {}
    startXYRef.current = { x: e.clientX, y: e.clientY };
    longPressRef.current = setTimeout(() => {
      // There is no Trier button anymore, so a long-press-drag is the only way
      // into manual mode. Seed the manual order from the CURRENT sorted display
      // so the hand doesn't jump and the drag indices (computed against the shown
      // cards) stay valid.
      if (sortMode !== 'manual') {
        saveManualOrder(displayHand.map(cardKey));
        setSortMode('manual');
      }
      dragRef.current = { fromIdx: idx, toIdx: idx };
      setLiftIdx(null);
      setDragVisual({ fromIdx: idx, toIdx: idx });
      setDragX(e.clientX);
    }, 250);
  }

  function handleHandPointerMove(e) {
    if (dragRef.current) {
      setDragX(e.clientX);
      const to = getDropIdx(e.clientX);
      if (to !== dragRef.current.toIdx) {
        dragRef.current.toIdx = to;
        setDragVisual({ fromIdx: dragRef.current.fromIdx, toIdx: to });
      }
      return;
    }
    // Cancel long-press if finger moved too much
    if (longPressRef.current && startXYRef.current) {
      if (Math.abs(e.clientX - startXYRef.current.x) > 8 ||
          Math.abs(e.clientY - startXYRef.current.y) > 8) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
        setLiftIdx(null);
      }
    }
  }

  function handleHandPointerUp() {
    clearTimeout(longPressRef.current);
    longPressRef.current = null;
    setLiftIdx(null);
    const dr = dragRef.current;
    dragRef.current = null;
    setDragVisual(null);
    setDragX(null);
    if (!dr) return;
    wasDragRef.current = true;
    if (dr.fromIdx !== dr.toIdx) {
      saveManualOrder(reorderArr(manualHand, dr.fromIdx, dr.toIdx).map(cardKey));
    }
  }

  function handleHandPointerCancel() {
    clearTimeout(longPressRef.current);
    longPressRef.current = null;
    setLiftIdx(null);
    dragRef.current = null;
    setDragVisual(null);
    setDragX(null);
  }

  // ── Bid sheet open/collapse ────────────────────────────────────────────────
  // Only act on short viewports; on tall screens the handle/bar are hidden and
  // the sheet is permanently open via CSS.
  function openBidSheet()     { if (isShortViewport) setSheetOpen(true); }
  function collapseBidSheet() { if (isShortViewport) setSheetOpen(false); }
  function handleSheetPointerDown(e) { sheetSwipeYRef.current = e.clientY; }
  function handleSheetPointerUp(e) {
    const startY = sheetSwipeYRef.current;
    sheetSwipeYRef.current = null;
    if (startY == null) return;
    if (e.clientY - startY > SHEET_SWIPE_CLOSE_PX) collapseBidSheet();
  }

  // ── Round summary (early exit) ─────────────────────────────────────────────
  if (room.phase === 'ROUND_OVER' || room.phase === 'GAME_OVER') {
    return (
      <>
        {paused && <PauseBanner players={players} t={t} />}
        {!trainingMode && room.pendingJoins?.length > 0 && (
          <div className="pending-joins-panel">
            {isCreator ? (
              <>
                <span className="pjp-label">{t.pendingJoinsLabel}</span>
                {room.pendingJoins.map(({ userId, username }) => (
                  <div key={userId} className="pjp-request">
                    <span className="pjp-name">{username}</span>
                    <button
                      className="btn-small btn-accept"
                      onClick={() => socket.emit('acceptJoin', { code: roomCode, targetUserId: userId })}
                    >
                      {t.acceptJoin}
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <span className="pjp-label">{t.pendingJoinsWaiting}</span>
            )}
          </div>
        )}
        <RoundSummary socket={socket} roomCode={roomCode} room={room} game={game} myPosition={myPosition} />
        {/* Throw stays reachable on the summary screen (bottom-right). */}
        {throwButton && <div className="throw-summary-bar">{throwButton}</div>}
      </>
    );
  }

  // What to show in the center trick area
  const shownCards   = trickOverlay ? trickOverlay.cards  : currentTrick;
  const flyDir       = trickOverlay?.animate ? winDir(trickOverlay.winnerPos, myPosition) : null;
  const overlayWinner = trickOverlay?.winnerPos;
  const trickWinName  = trickOverlay
    ? players.find(p => p.position === trickOverlay.winnerPos)?.username
    : null;

  // ── Fanned-arc hand geometry ───────────────────────────────────────────────
  // x is derived from the measured width so all cards always fit (bigger cards
  // just overlap more). y is a parabola (middle highest = arch); rotation fans
  // the cards. The lifted/dragged card straightens, rises and sits on top.
  const handN   = animatedHand.length;
  const handMid = (handN - 1) / 2;
  // Fixed step from a full hand (not handN) → fewer cards bunch centered, same
  // overlap, instead of spreading to refill the width.
  const handXStep = arcXStep(handBox, Math.max(handN, FULL_HAND));

  function arcStyle(i) {
    const off = i - handMid;
    const x = off * handXStep;
    // Hand cards stay flat and uniform in the arc — no hover/press enlarge or
    // rise (removed). The actively-dragged card still detaches via draggedStyle()
    // for manual reorder; liftIdx is retained for that handler path but no longer
    // changes the resting card's transform.
    const y = off * off * HAND_ARCH;
    return {
      transform: `translate(calc(-50% + ${x}px), ${y.toFixed(2)}px) rotate(${(off * HAND_ROT).toFixed(2)}deg)`,
      zIndex: i,
    };
  }

  // The dragged card detaches and follows the pointer (straight, lifted, on top)
  // while the rest of the hand re-arcs around the opening slot.
  function draggedStyle() {
    const rect = dragRectRef.current;
    if (!rect || dragX == null) return null;
    const x = dragX - (rect.left + rect.width / 2);
    return {
      transform: `translate(calc(-50% + ${x}px), ${-HAND_LIFT - 8}px) rotate(0deg) scale(1.08)`,
      zIndex: 1000,
    };
  }

  // ── Bid sheet derived values ───────────────────────────────────────────────
  // bidSheetActive is computed above (before the early return); the measuring
  // useLayoutEffect was moved up there too (Rules of Hooks).
  const highBidder = currentBid != null
    ? players.find(p => p.position === currentBid.playerIndex)
    : null;

  // Resting offset for the arc hand during bidding on short viewports: float
  // above the open sheet's top edge, or above the collapsed bar's top edge.
  // Tall viewports + the playing phase keep the hand at its baseline (0).
  const handLift = (bidSheetActive && isShortViewport)
    ? (sheetOpen ? sheetMetrics.sheetH : sheetMetrics.barH) + HAND_SHEET_GAP
    : 0;

  // Toolbar (undo / tag-error / leave). Lives inside the bid sheet during my bid
  // turn, and in normal hand flow otherwise. `compact` renders each button as an
  // icon over a tiny caption (bidding-phase presentation, inside the sheet); the
  // full variant keeps the inline "icon label" used in normal flow. The sort
  // (Trier) button was removed — auto-sort + Mode Sacha cover arrangement, and a
  // long-press-drag on the hand enters manual mode. During bidding, Annuler is
  // relocated into BiddingPanel's suit row, so undo here is PLAYING-only.
  const buildToolbar = (compact) => {
    const lbl = (icon, caption) => compact
      ? (<><span className="ti-icon">{icon}</span><span className="ti-cap">{caption}</span></>)
      : (<>{icon} {caption}</>);
    return (
      <div className={`hand-toolbar${compact ? ' hand-toolbar-icons' : ''}`}>
        {!trainingMode && isCreator && phase === 'PLAYING' && (
          <button
            className="btn-undo"
            onClick={() => socket.emit('undoLastAction', { code: roomCode })}
            disabled={!room.canUndo}
            title={t.undoAction}
          >
            {lbl('↩', t.undoAction)}
          </button>
        )}
        {/* Game Review: only rendered for the room creator in live games. */}
        {!trainingMode && isCreator && phase === 'PLAYING' && (
          <button
            className="btn-tag-play-error"
            onClick={() => setTagErrorOpen(true)}
            title={t.button.tagPlayError}
          >
            {lbl('⚠', t.button.tagPlayError)}
          </button>
        )}
        {/* Manage / Leave for normal play now live in the Réglages overlay (Header gear).
            In training there is no Header/Settings, so keep the abandon button here. */}
        {trainingMode && (
          <button className="btn-leave" onClick={leaveTable} title={t.training.abandonLabel}>
            {compact ? lbl('⎋', t.training.abandonLabel) : t.training.abandonLabel}
          </button>
        )}
      </div>
    );
  };
  // Compact icon-over-caption toolbar in BIDDING and PLAYING (the two phases that
  // share the in-felt presentation); the full-label variant stays for SHUFFLE/CUT
  // and other-players'-turn bidding. buildToolbar already includes the 5th
  // (PLAYING-only, creator-only) "Erreur de jeu" button when phase === 'PLAYING'.
  const handToolbar = buildToolbar(phase === 'PLAYING');
  const bidToolbar  = buildToolbar(true);

  return (
    <div className="game-board">
      {paused && <PauseBanner players={players} t={t} />}

      {/* ── Pending join requests ───────────────────────────────────────────── */}
      {room.pendingJoins?.length > 0 && (
        <div className="pending-joins-panel">
          {isCreator ? (
            <>
              <span className="pjp-label">{t.pendingJoinsLabel}</span>
              {room.pendingJoins.map(({ userId, username }) => (
                <div key={userId} className="pjp-request">
                  <span className="pjp-name">{username}</span>
                  <button
                    className="btn-small btn-accept"
                    onClick={() => socket.emit('acceptJoin', { code: roomCode, targetUserId: userId })}
                  >
                    {t.acceptJoin}
                  </button>
                </div>
              ))}
            </>
          ) : (
            <span className="pjp-label">{t.pendingJoinsWaiting}</span>
          )}
        </div>
      )}

      {/* ── Last trick viewer modal ─────────────────────────────────────── */}
      {showLastTrick && lastDoneTrick && (
        <div className="last-trick-overlay" onClick={() => setShowLastTrick(false)}>
          <div className="last-trick-panel" onClick={e => e.stopPropagation()}>
            <div className="last-trick-header">
              <span className="last-trick-title">{t.lastTrick}</span>
              <button className="btn-close" onClick={() => setShowLastTrick(false)}>✕</button>
            </div>
            <TrickDisplay
              cards={lastDoneTrick.cards}
              myPosition={myPosition}
              players={players}
              winnerPos={lastDoneTrick.winner}
            />
            <p className="last-trick-winner-label">
              {players.find(p => p.position === lastDoneTrick.winner)?.username}{' '}
              {t.wonTrick}
            </p>
          </div>
        </div>
      )}

      {/* ── Score bars ─────────────────────────────────────────────────────── */}
      <div className="score-bars">
        <div className="total-score-bar">
          <span className="tsb-item team0-col">{myTeam === 0 ? t.us : t.them}: <strong>{scores[0]}</strong></span>
          <span className="tsb-item team1-col">{myTeam === 1 ? t.us : t.them}: <strong>{scores[1]}</strong></span>
        </div>
      </div>

      {/* ── Middle row (felt) ─────────────────────────────────────────────── */}
      <div className="board-middle">

        {/* Top seat (partner) — compact cluster anchored at the felt's top edge
            (was a full-width band above the felt that clipped the top trick card).
            Mirrors the left/right seats which sit at the felt's side edges. */}
        <div className="board-top">
          {contractData && contractBy === (myPosition + 2) % 4 && (
            <ContractBadge contract={contractData} t={t} />
          )}
          {surcoincheBy === (myPosition + 2) % 4 && <CoincheBadge type="surcoinche" t={t} />}
          {coincheBy    === (myPosition + 2) % 4 && surcoincheBy !== (myPosition + 2) % 4 && <CoincheBadge type="coinche" t={t} />}
          {/* Seat + peek strip stacked vertically: name/avatar on top, the revealed
              hand directly BELOW it (badges remain beside this column). */}
          <div className="top-seat-stack" data-throw-target={(myPosition + 2) % 4}>
            <PlayerSeat
              {...seatData(2)}
              direction="top"
              isCreator={isCreator}
              onRemove={removePlayer}
              bidHistory={isBidding ? perPlayerHistory[(myPosition + 2) % 4] : null}
            />
            {/* Partner peek — compact face-up row of the partner's cards, directly
                below their name/avatar. Only ever rendered for the two gated users
                (peekHand is present only in their server payload). */}
            {peekHand && peekHand.length > 0 && (
              <div className="peek-hand" aria-label="partner peek">
                {sortHand(peekHand, trumpSuit, modeSacha).map((c, i) => (
                  <span
                    key={`${c.suit}${c.value}-${i}`}
                    className={`peek-card${c.suit === 'H' || c.suit === 'D' ? ' red' : ''}`}
                  >
                    {c.value}{SUIT_SYM[c.suit]}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="board-left" data-throw-target={(myPosition + 3) % 4}>
          {contractData && contractBy === (myPosition + 3) % 4 && (
            <ContractBadge contract={contractData} t={t} />
          )}
          {surcoincheBy === (myPosition + 3) % 4 && <CoincheBadge type="surcoinche" t={t} />}
          {coincheBy    === (myPosition + 3) % 4 && surcoincheBy !== (myPosition + 3) % 4 && <CoincheBadge type="coinche" t={t} />}
          <PlayerSeat
            {...seatData(3)}
            direction="left"
            isCreator={isCreator}
            onRemove={removePlayer}
            bidHistory={isBidding ? perPlayerHistory[(myPosition + 3) % 4] : null}
          />
        </div>

        <div className="board-center">
          {/* Bidding center — focal bid + turn + history */}
          {phase === 'BIDDING' && (
            <div className="bid-center">
              {/* Focal element: current highest bid */}
              <div className="bid-focal">
                {currentBid ? (
                  <>
                    <span className="bid-focal-value">
                      {currentBid.value === 'capot' ? t.capot : currentBid.value}
                    </span>
                    {currentBid.suit && (
                      <span className={`bid-focal-suit${currentBid.suit === 'H' || currentBid.suit === 'D' ? ' red' : ''}`}>
                        {t.suitSymbol[currentBid.suit]}
                      </span>
                    )}
                    {currentBid.surcoinched && <span className="bid-focal-mod sur">{t.surcoinched}</span>}
                    {currentBid.coinched && !currentBid.surcoinched && <span className="bid-focal-mod coin">{t.coinched}</span>}
                  </>
                ) : (
                  <span className="bid-focal-empty">{t.biddingPhase}</span>
                )}
              </div>

              {/* Whose turn */}
              <div className={`bid-whose-turn${isMyBidTurn ? ' mine' : ''}`}>
                {isMyBidTurn
                  ? `▶ ${t.yourTurn}`
                  : `▶ ${players.find(p => p.position === biddingTurn)?.username || '?'}`
                }
              </div>

            </div>
          )}

          {phase === 'PLAYING' && (
            <div className="play-center">
              <TrickDisplay
                cards={shownCards}
                myPosition={myPosition}
                players={players}
                animDir={flyDir}
                winnerPos={overlayWinner}
              />

              {/* Trick overlay label */}
              {trickOverlay && !trickOverlay.animate && trickWinName && (
                <div className="trick-result-label">
                  {trickWinName} ✓
                </div>
              )}

              {/* Normal turn label (only when no overlay) */}
              {!trickOverlay && !isMyCardTurn && (
                <div className="play-turn-info">
                  {t.waitingFor(players.find(p => p.position === currentPlayer)?.username || '?')}
                </div>
              )}

              {/* Last trick inline widget */}
              {tricks?.length > 0 && lastDoneTrick && (
                <div className="last-trick-widget" onClick={() => setShowLastTrick(true)}>
                  <span className="ltw-label">{t.lastTrick}:</span>
                  {lastDoneTrick.cards.map(({ card }) => (
                    <span
                      key={`${card.suit}${card.value}`}
                      className={`ltw-card${card.suit === 'H' || card.suit === 'D' ? ' red' : ''}`}
                    >
                      {card.value}{SUIT_SYM[card.suit]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Belote / Rebelote announce banner */}
          {beloteAnnounce && (
            <div className={`belote-announce ba-${beloteAnnounce}`}>
              {beloteAnnounce === 'belote' ? t.belote : t.rebelote} !
            </div>
          )}

          {/* Shuffle / Cut action feedback — shown to all players */}
          {shuffleCutMsg && (() => {
            const actorName = shuffleCutMsg.actorPos != null
              ? (players.find(p => p.position === shuffleCutMsg.actorPos)?.username || '?')
              : '?';
            return (
              <div className={`scc-announce${shuffleCutMsg.positive ? ' scc-yes' : ' scc-no'}`}>
                {t[shuffleCutMsg.key](actorName)}
              </div>
            );
          })()}

          {/* Shuffle / Cut status — only shown to the active player */}
          {(isMyShuffleTurn || isMyCutTurn) && (
            <div className="scc-status">
              {isMyShuffleTurn ? t.yourTurnShuffle : t.yourTurnCut}
            </div>
          )}
        </div>

        <div className="board-right" data-throw-target={(myPosition + 1) % 4}>
          {contractData && contractBy === (myPosition + 1) % 4 && (
            <ContractBadge contract={contractData} t={t} />
          )}
          {surcoincheBy === (myPosition + 1) % 4 && <CoincheBadge type="surcoinche" t={t} />}
          {coincheBy    === (myPosition + 1) % 4 && surcoincheBy !== (myPosition + 1) % 4 && <CoincheBadge type="coinche" t={t} />}
          <PlayerSeat
            {...seatData(1)}
            direction="right"
            isCreator={isCreator}
            onRemove={removePlayer}
            bidHistory={isBidding ? perPlayerHistory[(myPosition + 1) % 4] : null}
          />
        </div>
      </div>

      {/* ── My hand ────────────────────────────────────────────────────────── */}
      <div className={`board-hand${isMyTurn ? ' hand-my-turn' : ''}${bidSheetActive ? ' has-bid-sheet' : ''}${bidSheetActive && !sheetOpen ? ' sheet-collapsed' : ''}`}>

        {/* "Your turn" pulse banner */}
        {isMyTurn && (
          <div className="your-turn-banner">{t.yourTurn} ●</div>
        )}

        {/* Contract badge above self player bar when self won the auction */}
        {contractData && contractBy === myPosition && (
          <ContractBadge contract={contractData} t={t} />
        )}
        {surcoincheBy === myPosition && <CoincheBadge type="surcoinche" t={t} />}
        {coincheBy    === myPosition && surcoincheBy !== myPosition && <CoincheBadge type="coinche" t={t} />}

        {/* Self player bar: avatar + name + bid status */}
        <div className="self-player-bar">
          <Avatar
            config={myPlayer?.avatarConfig}
            isBot={myPlayer?.isBot}
            botSeed={myPlayer?.username ?? myPlayer?.position}
            initial={displayName(myPlayer, t)[0]?.toUpperCase() || '?'}
            variant="head"
            circleClassName={`player-avatar team${myTeam}-avatar`}
          />
          <span className="self-name">{displayName(myPlayer, t)}</span>
          {isBidding && perPlayerHistory[myPosition]?.length > 0 && (
            <BidStack history={perPlayerHistory[myPosition]} t={t} />
          )}
          {/* Throw button — right-aligned, opposite the avatar/name, above the hand. */}
          {throwButton}
        </div>

        {/* Bid sheet (my bid turn): collapsible bottom sheet on short viewports,
            permanently open on tall (CSS-gated). Holds the bid controls + the
            toolbar; opaque so taps can't fall through to the felt. */}
        {bidSheetActive && (
          <>
            {/* Light scrim behind the open sheet (short screens; CSS-gated) */}
            {sheetOpen && <div className="bid-scrim" aria-hidden="true" />}
            {/* Collapsed-state affordance — slim highest-bid bar (short screens) */}
            <button
              type="button"
              ref={bidBarRef}
              className={`bid-bar${sheetOpen ? ' bid-bar-hidden' : ''}`}
              onClick={openBidSheet}
            >
              <span className="bid-bar-label">{t.highestBid}</span>
              <span className="bid-bar-value">
                {currentBid ? (
                  <>
                    {currentBid.value === 'capot' ? t.capot : currentBid.value}
                    {currentBid.suit && (
                      <span className={`bid-bar-suit${currentBid.suit === 'H' || currentBid.suit === 'D' ? ' red' : ''}`}>
                        {t.suitSymbol[currentBid.suit]}
                      </span>
                    )}
                    {highBidder && <span className="bid-bar-bidder"> · {displayName(highBidder, t)}</span>}
                  </>
                ) : (
                  <span className="bid-bar-empty">{t.biddingPhase}</span>
                )}
              </span>
              <span className="bid-bar-cta">{t.bidSheetCta} ▲</span>
            </button>

            <div
              ref={bidSheetRef}
              className={`bid-sheet${sheetOpen ? ' open' : ' collapsed'}`}
              onPointerDown={handleSheetPointerDown}
              onPointerUp={handleSheetPointerUp}
            >
              <button
                type="button"
                className="bid-sheet-handle"
                onClick={collapseBidSheet}
                aria-label={t.biddingPhase}
              />
              <BiddingPanel
                socket={socket} roomCode={roomCode}
                game={game} myPosition={myPosition} myTeam={myTeam}
                sortMode={sortMode}
                trainingMode={trainingMode}
                isCreator={isCreator}
                canUndo={room.canUndo}
              />
              {/* In normal play the bid toolbar is now empty (Trier removed, Annuler
                  moved into the suit row) — don't render an empty bar. Training has no
                  Header/Settings, so keep it there for the abandon button. */}
              {trainingMode && bidToolbar}
            </div>
          </>
        )}

        {/* Shuffle / cut controls + toolbar — normal flow when not bidding */}
        {!bidSheetActive && (
          <>
            {room.phase === 'SHUFFLE' && isMyShuffleTurn && (
              <div className="deal-controls">
                <button className="scp-btn scp-btn-pri" onClick={() => socket.emit('shuffleDeck', { code: roomCode })}>
                  {t.shuffle}
                </button>
                <button className="scp-btn scp-btn-sec" onClick={() => socket.emit('skipShuffle', { code: roomCode })}>
                  {t.noShuffle}
                </button>
              </div>
            )}
            {room.phase === 'CUT' && isMyCutTurn && (
              <div className="deal-controls">
                <CutPicker
                  onCut={n => socket.emit('cutDeck', { code: roomCode, n })}
                  onSkip={() => socket.emit('skipCut', { code: roomCode })}
                  t={t}
                />
              </div>
            )}
          </>
        )}

        <div
          className={`my-hand${sortMode === 'manual' ? ' my-hand-manual' : ''}`}
          ref={handElRef}
          style={handLift ? { transform: `translateY(${-handLift}px)` } : undefined}
          onPointerDown={handleHandPointerDown}
          onPointerMove={handleHandPointerMove}
          onPointerUp={handleHandPointerUp}
          onPointerCancel={handleHandPointerCancel}
        >
          {/* Hidden ruler: width tracks the scaled card width so the measure
              effect can read it (and react to Mode Delfino changes). */}
          <span className="hand-ruler" ref={rulerRef} aria-hidden="true" />
          {animatedHand.map((card, i) => {
            const isDraggedCard = dragVisual != null && cardKey(card) === cardKey(manualHand[dragVisual.fromIdx]);
            const isLifted = liftIdx === i && isMyCardTurn;
            const style = isDraggedCard ? (draggedStyle() || arcStyle(i)) : arcStyle(i);
            return (
              <CardFace
                key={cardKey(card)}
                card={card}
                style={style}
                onMouseEnter={() => { if (isMyCardTurn && !dragRef.current) setLiftIdx(i); }}
                onMouseLeave={() => { if (!dragRef.current) setLiftIdx(prev => (prev === i ? null : prev)); }}
                onClick={() => {
                  if (wasDragRef.current) { wasDragRef.current = false; return; }
                  if (!isMyCardTurn) return;
                  if (needsBelotePrompt(card)) {
                    setBeloteDecisionCard(card);
                  } else {
                    playCard(card);
                  }
                }}
                highlight={isMyCardTurn}
                disabled={!isMyCardTurn}
                isDragging={isDraggedCard}
                lifted={isLifted}
              />
            );
          })}
          {myHand.length === 0 && phase === 'PLAYING' && !dealAnimCounts && (
            <span className="muted">—</span>
          )}
        </div>

        {/* Toolbar — single bottom row below the hand (not bidding; bidding's
            toolbar lives inside the sheet). Frees the band that used to sit
            between the header and the cards. */}
        {!bidSheetActive && handToolbar}
      </div>

      {/* ── Belote decision prompt ───────────────────────────────────────────── */}
      {beloteDecisionCard && (
        <BelotePrompt
          card={beloteDecisionCard}
          t={t}
          onYes={() => { playCard(beloteDecisionCard, true);  setBeloteDecisionCard(null); }}
          onNo ={() => { playCard(beloteDecisionCard, false); setBeloteDecisionCard(null); }}
        />
      )}

      {/* ── Game Review: creator-only error-tagging overlay ────────────────── */}
      {tagErrorOpen && isCreator && game?.gameId && (
        <GameErrorTagOverlay
          game={game}
          players={players}
          existingAnnotations={game.errorAnnotations || []}
          onSubmit={({ cardRef, note }) => {
            socket.emit('createGameErrorAnnotation', {
              gameId: game.gameId,
              cardRef,
              note,
            });
            setTagErrorOpen(false);
          }}
          onCancel={() => setTagErrorOpen(false)}
        />
      )}
    </div>
  );
}
