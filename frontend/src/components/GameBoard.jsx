import { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LanguageContext';
import BiddingPanel from './BiddingPanel';
import RoundSummary from './RoundSummary';
import AdminPanel from './AdminPanel';

// ─── Card point tables (mirrors backend — used for live scoring) ───────────
const TRUMP_PTS     = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };
const NON_TRUMP_PTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };
const SUIT_SYM      = { S: '♠', H: '♥', D: '♦', C: '♣' };

// ─── Bid action helpers ────────────────────────────────────────────────────

function formatBidAction(action, t) {
  if (!action) return null;
  if (action.type === 'pass') return t.pass;
  if (action.type === 'bid')
    return action.value === 'capot' ? t.capot : `${action.value} ${SUIT_SYM[action.suit]}`;
  if (action.type === 'coinche') return t.coinche;
  if (action.type === 'surcoinche') return t.surcoinche;
  return null;
}

function bidChipClass(action) {
  if (!action) return '';
  return { pass: 'chip-pass', bid: 'chip-bid', coinche: 'chip-coinche', surcoinche: 'chip-surc' }[action.type] || '';
}

// Build per-player history { 0:[], 1:[], 2:[], 3:[] } from flat biddingHistory
function buildPerPlayerHistory(history) {
  const r = { 0: [], 1: [], 2: [], 3: [] };
  if (!history) return r;
  for (const entry of history) r[entry.position].push(entry);
  return r;
}

function cardPts(card, trump) {
  return ((card.suit === trump) ? TRUMP_PTS : NON_TRUMP_PTS)[card.value] || 0;
}

function computeLivePoints(tricks, trump) {
  const pts = [0, 0];
  if (!tricks?.length || !trump) return pts;
  for (const trick of tricks) {
    const team = trick.winner % 2;
    for (const { card } of trick.cards) pts[team] += cardPts(card, trump);
  }
  return pts;
}

// ─── Hand sorting ──────────────────────────────────────────────────────────
const TRUMP_ORDER     = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const NON_TRUMP_ORDER = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];
const SUIT_COLOR      = { S: 'B', C: 'B', H: 'R', D: 'R' };
// Canonical tie-break order: S < H < D < C (lowest index = preferred)
const CANONICAL_SUITS = ['S', 'H', 'D', 'C'];

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  return arr.flatMap((s, i) =>
    permutations(arr.filter((_, j) => j !== i)).map(p => [s, ...p])
  );
}

// Pick the non-trump suit order that minimises same-colour adjacencies.
// leftColor: colour of the suit group immediately to the left (trump, if present).
// Ties broken by canonical suit order for stability.
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

function sortHand(hand, trump) {
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
function winDir(winnerPos, myPos) {
  return ['bottom', 'right', 'top', 'left'][((winnerPos - myPos) + 4) % 4];
}

// ─── Manual order helpers ──────────────────────────────────────────────────

function cardKey(c) { return `${c.suit}${c.value}`; }

function applyManualOrder(hand, orderKeys) {
  if (!orderKeys) return hand;
  const map = Object.fromEntries(hand.map(c => [cardKey(c), c]));
  const sorted = orderKeys.filter(k => k in map).map(k => map[k]);
  const unseen = hand.filter(c => !orderKeys.includes(cardKey(c)));
  return [...sorted, ...unseen];
}

function reorderArr(arr, from, to) {
  const a = [...arr];
  const [item] = a.splice(from, 1);
  a.splice(to, 0, item);
  return a;
}

// ─── Card primitives ───────────────────────────────────────────────────────

function CardFace({ card, onClick, highlight, disabled, isDragging }) {
  const isRed = card.suit === 'H' || card.suit === 'D';
  return (
    <button
      className={`card card-face${isRed ? ' red' : ''}${highlight ? ' valid' : ''}${disabled ? ' card-disabled' : ''}${isDragging ? ' card-dragging' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="card-value">{card.value}</span>
      <span className="card-suit">{SUIT_SYM[card.suit]}</span>
    </button>
  );
}

function CardBack({ small }) {
  return <div className={`card card-back${small ? ' card-small' : ''}`}>🂠</div>;
}

// ─── Trick display (used both in-play and in last-trick panel) ─────────────

function TrickDisplay({ cards, myPosition, players, animDir, winnerPos }) {
  function getArea(pos) {
    return ['bottom', 'right', 'top', 'left'][((pos - myPosition) + 4) % 4];
  }
  return (
    <div className={`trick-display${animDir ? ` trick-fly-${animDir}` : ''}`}>
      {['top', 'left', 'right', 'bottom'].map(area => {
        const played = cards.find(({ playerIndex }) => getArea(playerIndex) === area);
        const player = played ? players.find(p => p.position === played.playerIndex) : null;
        const isRed  = played && (played.card.suit === 'H' || played.card.suit === 'D');
        const won    = played && winnerPos !== undefined && played.playerIndex === winnerPos;
        return (
          <div key={area} className={`trick-slot trick-${area}`}>
            {played ? (
              <div className={`trick-card${isRed ? ' red' : ''}${won ? ' trick-winner-card' : ''}`}>
                <span className="card-value">{played.card.value}</span>
                <span className="card-suit">{SUIT_SYM[played.card.suit]}</span>
                <span className="trick-player-name">{player?.username}</span>
              </div>
            ) : (
              <div className="trick-empty" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Per-player bid stack (bidding phase) ─────────────────────────────────

function BidStack({ history, t }) {
  if (!history?.length) return null;
  const items = [...history].reverse(); // latest first
  return (
    <div className="bid-stack">
      {items.map((action, i) => {
        const isLatest = i === 0;
        const isRed = action.suit === 'H' || action.suit === 'D';
        const label =
          action.type === 'pass'         ? t.pass
          : action.type === 'coinche'    ? t.coinche
          : action.type === 'surcoinche' ? t.surcoinche
          : action.value === 'capot'     ? t.capot
          : `${action.value}${SUIT_SYM[action.suit]}`;
        return (
          <span
            key={i}
            className={[
              'bsi',
              isLatest ? 'bsi-current' : 'bsi-older',
              `bsi-${action.type}`,
              isLatest && isRed ? 'bsi-red' : '',
            ].filter(Boolean).join(' ')}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

// ─── Contract badge shown in front of the winning player after auction ───────

function ContractBadge({ contract, t }) {
  const isRed = contract.suit === 'H' || contract.suit === 'D';
  const value = contract.value === 'capot' ? t.capot : contract.value;
  const suit  = t.suitSymbol?.[contract.suit] ?? SUIT_SYM[contract.suit];
  return (
    <div className="seat-contract-badge">
      <span className={`scb-value${isRed ? ' red' : ''}`}>{value} {suit}</span>
    </div>
  );
}

// Small badge shown above the player who called Coinche or Surcoinche
function CoincheBadge({ type, t }) {
  return (
    <div className={`seat-coinche-badge scbt-${type}`}>
      <span>{type === 'surcoinche' ? t.surcoinched : t.coinched}</span>
    </div>
  );
}

// ─── Player seat (opponent, face-down) ────────────────────────────────────

function PlayerSeat({ player, handCount, isActive, isDimmed, direction, isCreator, onRemove }) {
  const { t } = useLang();
  const initial = player?.isBot ? '🤖' : (player?.username?.[0]?.toUpperCase() || '?');
  return (
    <div className={[
      'player-seat',
      `player-${direction}`,
      isActive  ? 'active-player' : '',
      isDimmed  ? 'seat-dimmed'   : '',
    ].filter(Boolean).join(' ')}>
      <div className={`player-avatar team${player?.team ?? 0}-avatar`}>
        {initial}
      </div>
      <div className="player-name">
        {player?.username || '?'}
        {!player?.connected && <span className="dc-indicator"> ⚠</span>}
        {isActive && <span className="turn-dot"> ●</span>}
      </div>
      {isCreator && player && !player.connected && !player.isBot && (
        <button
          className="btn-remove-player"
          onClick={() => {
            if (window.confirm(t.removeConfirm(player.username))) onRemove(player.userId);
          }}
          title={t.removePlayer}
        >✕</button>
      )}
      <div className="face-down-cards">
        {Array.from({ length: handCount || 0 }).map((_, i) => (
          <CardBack key={i} small />
        ))}
      </div>
    </div>
  );
}

// ─── Main GameBoard ────────────────────────────────────────────────────────

export default function GameBoard({ socket, roomCode, room, game, myPosition }) {
  const { t } = useLang();

  // ── State ──────────────────────────────────────────────────────────────────
  const [sortActive, setSortActive] = useState(false);
  const [showLastTrick, setShowLastTrick] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
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

  // ── Refs ───────────────────────────────────────────────────────────────────
  const prevTricksLenRef = useRef(0);
  const prevDealerRef    = useRef(null);
  const prevTrumpRef     = useRef(null);
  const timerRef         = useRef([]);
  const dragRef          = useRef(null);   // active drag { fromIdx, toIdx }
  const longPressRef     = useRef(null);   // long-press timer
  const startXYRef       = useRef(null);   // pointer position at pointerdown
  const wasDragRef       = useRef(false);  // suppress click after drag completes
  const handElRef        = useRef(null);   // ref on .my-hand div
  const prevDealerMRef   = useRef(game.dealer); // for detecting new round

  // ── Derived ────────────────────────────────────────────────────────────────
  const { players, scores, targetScore, paused } = room;
  const {
    phase, currentTrick, currentPlayer, biddingTurn,
    trumpSuit, currentBid, hands, handCounts, beloteInfo, tricks,
  } = game;

  const myHand       = hands[myPosition] || [];
  const myPlayer     = players.find(p => p.position === myPosition);
  const myTeam       = myPlayer?.team ?? 0;
  const isMyCardTurn = phase === 'PLAYING' && currentPlayer === myPosition;
  const isMyBidTurn  = phase === 'BIDDING' && biddingTurn  === myPosition;
  const isMyTurn     = isMyCardTurn || isMyBidTurn;

  const manualHand   = applyManualOrder(myHand, manualOrderKeys);
  const displayHand  = sortActive
    ? sortHand(myHand, trumpSuit)
    : dragVisual
      ? reorderArr(manualHand, dragVisual.fromIdx, dragVisual.toIdx)
      : manualHand;
  const livePoints   = computeLivePoints(tricks, trumpSuit);
  const lastDoneTrick = tricks?.length > 0 ? tricks[tricks.length - 1] : null;

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

  function seatData(offset) {
    const pos    = (myPosition + offset + 4) % 4;
    const player = players.find(p => p.position === pos);
    return {
      player,
      handCount: handCounts[pos],
      isActive:  isActiveTurnPhase && pos === activeTurnPos,
      isDimmed:  isActiveTurnPhase && pos !== activeTurnPos,
    };
  }

  const isCreator = room.creatorId === myPlayer?.userId;

  function leaveTable() {
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

  // ── Effect: auto-sort when trump is first revealed ─────────────────────────
  useEffect(() => {
    if (trumpSuit && trumpSuit !== prevTrumpRef.current) {
      prevTrumpRef.current = trumpSuit;
      setSortActive(true);
    }
    if (!trumpSuit) prevTrumpRef.current = null;
  }, [trumpSuit]);

  // ── Effect: reset manual order on new round ───────────────────────────────
  useEffect(() => {
    if (game.dealer !== prevDealerMRef.current) {
      prevDealerMRef.current = game.dealer;
      setManualOrderKeys(null);
      setSortActive(false);
    }
  }, [game.dealer]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function playCard(card) {
    socket.emit('playCard', { code: roomCode, card });
  }

  // ── Manual drag-to-reorder ────────────────────────────────────────────────
  const lsKey = `coinche-hand-${roomCode}-${game.dealer}`;

  function saveManualOrder(keys) {
    setManualOrderKeys(keys);
    try { localStorage.setItem(lsKey, JSON.stringify(keys)); } catch {}
  }

  function getDropIdx(clientX) {
    if (!handElRef.current) return 0;
    const els = handElRef.current.querySelectorAll('.card-face');
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) return i;
    }
    return Math.max(0, els.length - 1);
  }

  function handleHandPointerDown(e) {
    if (sortActive) return;
    const els = Array.from(handElRef.current.querySelectorAll('.card-face'));
    const idx = els.findIndex(el => el.contains(e.target));
    if (idx === -1) return;
    handElRef.current.setPointerCapture(e.pointerId);
    startXYRef.current = { x: e.clientX, y: e.clientY };
    longPressRef.current = setTimeout(() => {
      dragRef.current = { fromIdx: idx, toIdx: idx };
      setDragVisual({ fromIdx: idx, toIdx: idx });
    }, 250);
  }

  function handleHandPointerMove(e) {
    if (dragRef.current) {
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
      }
    }
  }

  function handleHandPointerUp(e) {
    clearTimeout(longPressRef.current);
    longPressRef.current = null;
    const dr = dragRef.current;
    dragRef.current = null;
    setDragVisual(null);
    if (!dr) return;
    wasDragRef.current = true;
    if (dr.fromIdx !== dr.toIdx) {
      saveManualOrder(reorderArr(manualHand, dr.fromIdx, dr.toIdx).map(cardKey));
    }
  }

  function handleHandPointerCancel() {
    clearTimeout(longPressRef.current);
    longPressRef.current = null;
    dragRef.current = null;
    setDragVisual(null);
  }

  // ── Round summary (early exit) ─────────────────────────────────────────────
  if (room.phase === 'ROUND_OVER' || room.phase === 'GAME_OVER') {
    return (
      <>
        {showAdminPanel && isCreator && (
          <AdminPanel
            players={players} creatorId={room.creatorId} myUserId={myPlayer?.userId}
            phase={room.phase}
            onRemove={removePlayer} onClose={() => setShowAdminPanel(false)}
          />
        )}
        {paused && <PauseBanner players={players} t={t} />}
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
        <RoundSummary socket={socket} roomCode={roomCode} room={room} game={game} myPosition={myPosition} />
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

  return (
    <div className="game-board">
      {showAdminPanel && isCreator && (
        <AdminPanel
          players={players} creatorId={room.creatorId} myUserId={myPlayer?.userId}
          phase={room.phase}
          onRemove={removePlayer} onClose={() => setShowAdminPanel(false)}
        />
      )}
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
          <span className="tsb-item team0-col">{t.team1}: <strong>{scores[0]}</strong></span>
          <span className="tsb-target">/ {targetScore}</span>
          <span className="tsb-item team1-col">{t.team2}: <strong>{scores[1]}</strong></span>
        </div>
        {phase === 'PLAYING' && tricks?.length > 0 && (
          <div className="live-score-bar">
            <span className="lsb-label">{t.liveRound}:</span>
            <span className="team0-col"><strong>{livePoints[0]}</strong></span>
            <span className="lsb-sep">–</span>
            <span className="team1-col"><strong>{livePoints[1]}</strong></span>
          </div>
        )}
      </div>

      {/* ── Top seat (partner) ─────────────────────────────────────────────── */}
      <div className="board-top">
        {contractData && contractBy === (myPosition + 2) % 4 && (
          <ContractBadge contract={contractData} t={t} />
        )}
        {surcoincheBy === (myPosition + 2) % 4 && <CoincheBadge type="surcoinche" t={t} />}
        {coincheBy    === (myPosition + 2) % 4 && surcoincheBy !== (myPosition + 2) % 4 && <CoincheBadge type="coinche" t={t} />}
        <PlayerSeat {...seatData(2)} direction="top" isCreator={isCreator} onRemove={removePlayer} />
      </div>

      {/* ── Middle row ─────────────────────────────────────────────────────── */}
      <div className="board-middle">

        <div className="board-left">
          {contractData && contractBy === (myPosition + 3) % 4 && (
            <ContractBadge contract={contractData} t={t} />
          )}
          {surcoincheBy === (myPosition + 3) % 4 && <CoincheBadge type="surcoinche" t={t} />}
          {coincheBy    === (myPosition + 3) % 4 && surcoincheBy !== (myPosition + 3) % 4 && <CoincheBadge type="coinche" t={t} />}
          <PlayerSeat {...seatData(3)} direction="left" isCreator={isCreator} onRemove={removePlayer} />
        </div>

        <div className="board-center">
          {/* ── Table-positioned bid chips — float on table in front of each opponent ── */}
          {isBidding && perPlayerHistory[(myPosition + 2) % 4]?.length > 0 && (
            <div className="table-bid tbid-top">
              <BidStack history={perPlayerHistory[(myPosition + 2) % 4]} t={t} />
            </div>
          )}
          {isBidding && perPlayerHistory[(myPosition + 3) % 4]?.length > 0 && (
            <div className="table-bid tbid-left">
              <BidStack history={perPlayerHistory[(myPosition + 3) % 4]} t={t} />
            </div>
          )}
          {isBidding && perPlayerHistory[(myPosition + 1) % 4]?.length > 0 && (
            <div className="table-bid tbid-right">
              <BidStack history={perPlayerHistory[(myPosition + 1) % 4]} t={t} />
            </div>
          )}

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
        </div>

        <div className="board-right">
          {contractData && contractBy === (myPosition + 1) % 4 && (
            <ContractBadge contract={contractData} t={t} />
          )}
          {surcoincheBy === (myPosition + 1) % 4 && <CoincheBadge type="surcoinche" t={t} />}
          {coincheBy    === (myPosition + 1) % 4 && surcoincheBy !== (myPosition + 1) % 4 && <CoincheBadge type="coinche" t={t} />}
          <PlayerSeat {...seatData(1)} direction="right" isCreator={isCreator} onRemove={removePlayer} />
        </div>
      </div>

      {/* ── My hand ────────────────────────────────────────────────────────── */}
      <div className={`board-hand${isMyTurn ? ' hand-my-turn' : ''}`}>

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
          <div className={`player-avatar team${myTeam}-avatar`}>
            {myPlayer?.isBot ? '🤖' : (myPlayer?.username?.[0]?.toUpperCase() || '?')}
          </div>
          <span className="self-name">{myPlayer?.username || '?'}</span>
          {isBidding && perPlayerHistory[myPosition]?.length > 0 && (
            <BidStack history={perPlayerHistory[myPosition]} t={t} />
          )}
        </div>

        {/* Bidding controls — shown at the bottom during my bid turn */}
        {phase === 'BIDDING' && isMyBidTurn && (
          <BiddingPanel
            socket={socket} roomCode={roomCode}
            game={game} myPosition={myPosition} myTeam={myTeam}
          />
        )}

        {/* Toolbar row: sort toggle + admin manage + leave */}
        <div className="hand-toolbar">
          <button
            className={`btn-sort${sortActive ? ' sort-on' : ''}`}
            onClick={() => setSortActive(v => !v)}
            title={t.sortHand}
          >
            {sortActive ? '♠♥♦♣' : '⇅'} {t.sortHand}
          </button>
          {isCreator && (
            <button className="btn-manage" onClick={() => setShowAdminPanel(true)} title={t.managePlayersTitle}>
              ⚙ {t.managePlayers}
            </button>
          )}
          <button className="btn-leave" onClick={leaveTable}>{t.leaveTable}</button>
        </div>

        <div
          className={`my-hand${!sortActive ? ' my-hand-manual' : ''}`}
          ref={handElRef}
          onPointerDown={handleHandPointerDown}
          onPointerMove={handleHandPointerMove}
          onPointerUp={handleHandPointerUp}
          onPointerCancel={handleHandPointerCancel}
        >
          {displayHand.map(card => (
            <CardFace
              key={cardKey(card)}
              card={card}
              onClick={() => {
                if (wasDragRef.current) { wasDragRef.current = false; return; }
                if (isMyCardTurn) playCard(card);
              }}
              highlight={isMyCardTurn}
              disabled={!isMyCardTurn}
              isDragging={dragVisual != null && cardKey(card) === cardKey(manualHand[dragVisual.fromIdx])}
            />
          ))}
          {myHand.length === 0 && phase === 'PLAYING' && (
            <span className="muted">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PauseBanner({ players, t }) {
  const dced = players.filter(p => !p.connected).map(p => p.username).join(', ');
  return (
    <div className="pause-banner">
      {dced ? t.playerDisconnected(dced) : t.gamePaused}
    </div>
  );
}
