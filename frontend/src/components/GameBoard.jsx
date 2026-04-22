import { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LanguageContext';
import BiddingPanel from './BiddingPanel';
import RoundSummary from './RoundSummary';
import AdminPanel from './AdminPanel';
import {
  SUIT_SYM,
  buildPerPlayerHistory,
  computeLivePoints, bestSuitForHand,
  sortHand, winDir, cardKey, applyManualOrder, reorderArr,
  displayName,
} from './gameBoardHelpers';
import {
  CardFace, TrickDisplay, BidStack,
  ContractBadge, CoincheBadge, PlayerSeat, CutPicker,
  BelotePrompt, PauseBanner,
} from './gameBoardParts';
import GameErrorTagOverlay from '../game/GameErrorTagOverlay';

// ─── Main GameBoard ────────────────────────────────────────────────────────

export default function GameBoard({ socket, roomCode, room, game, myPosition, trainingMode }) {
  // trainingMode, when provided, is { runId } — gates the handful of behaviors
  // that differ from normal-game (action emits, abandon confirm, hidden UI
  // that doesn't apply: undo, admin panel, pending joins).
  const { t } = useLang();

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
  const dragRef          = useRef(null);   // active drag { fromIdx, toIdx }
  const longPressRef     = useRef(null);   // long-press timer
  const startXYRef       = useRef(null);   // pointer position at pointerdown
  const wasDragRef       = useRef(false);  // suppress click after drag completes
  const handElRef        = useRef(null);   // ref on .my-hand div
  const prevDealerMRef      = useRef(game.dealer); // for detecting new round
  const prevRoomPhaseRef    = useRef(room.phase);  // for CUT→PLAYING deal animation
  const prevBeloteRef       = useRef({ declared: game.beloteInfo?.declared ?? null, rebeloteDone: game.beloteInfo?.rebeloteDone ?? false });
  const prevSCActionRef     = useRef(room.lastShuffleCutAction ?? null); // for shuffle/cut feedback

  // ── Derived ────────────────────────────────────────────────────────────────
  const { players, scores, targetScore, paused, shuffleDealer, cutPlayer, lastShuffleCutAction, lastShuffleCutActorPos } = room;
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
  const displayHand  = sortMode !== 'manual'
    ? sortHand(myHand, sortMode)
    : dragVisual
      ? reorderArr(manualHand, dragVisual.fromIdx, dragVisual.toIdx)
      : manualHand;
  const livePoints   = computeLivePoints(tricks, trumpSuit);
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
  useEffect(() => {
    const prev = prevBeloteRef.current;
    const declared     = beloteInfo?.declared     ?? null;
    const rebeloteDone = beloteInfo?.rebeloteDone ?? false;
    if (!prev.declared && declared === 'yes') {
      setBeloteAnnounce('belote');
      timerRef.current.push(setTimeout(() => setBeloteAnnounce(null), 2500));
    }
    if (!prev.rebeloteDone && rebeloteDone) {
      setBeloteAnnounce('rebelote');
      timerRef.current.push(setTimeout(() => setBeloteAnnounce(null), 2500));
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

  // ── Sort mode cycle ────────────────────────────────────────────────────────
  function cycleSortMode() {
    const cycle = trumpSuit
      ? [trumpSuit, 'manual']
      : ['S', 'H', 'D', 'C', 'manual'];
    setSortMode(prev => {
      // When turning sort back ON from manual (no trump yet), jump to the
      // best candidate suit rather than defaulting to the hardcoded 'S'.
      if (prev === 'manual' && !trumpSuit) return bestSuitForHand(myHand);
      const idx = cycle.indexOf(prev);
      return cycle[idx === -1 ? 0 : (idx + 1) % cycle.length];
    });
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
    if (sortMode !== 'manual') return;
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
        {!trainingMode && showAdminPanel && isCreator && (
          <AdminPanel
            players={players} creatorId={room.creatorId} myUserId={myPlayer?.userId}
            phase={room.phase}
            onRemove={removePlayer} onClose={() => setShowAdminPanel(false)}
          />
        )}
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
            {myPlayer?.isBot ? '🤖' : (displayName(myPlayer, t)[0]?.toUpperCase() || '?')}
          </div>
          <span className="self-name">{displayName(myPlayer, t)}</span>
          {isBidding && perPlayerHistory[myPosition]?.length > 0 && (
            <BidStack history={perPlayerHistory[myPosition]} t={t} />
          )}
        </div>

        {/* Bidding controls — shown at the bottom during my bid turn */}
        {phase === 'BIDDING' && isMyBidTurn && (
          <BiddingPanel
            socket={socket} roomCode={roomCode}
            game={game} myPosition={myPosition} myTeam={myTeam}
            sortMode={sortMode}
            trainingMode={trainingMode}
          />
        )}

        {/* Shuffle controls */}
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

        {/* Cut controls */}
        {room.phase === 'CUT' && isMyCutTurn && (
          <div className="deal-controls">
            <CutPicker
              onCut={n => socket.emit('cutDeck', { code: roomCode, n })}
              onSkip={() => socket.emit('skipCut', { code: roomCode })}
              t={t}
            />
          </div>
        )}

        {/* Toolbar row: sort toggle + undo + admin manage + leave */}
        <div className="hand-toolbar">
          {!isShuffleCut && (
            <button
              className={`btn-sort${sortMode !== 'manual' ? ' sort-on' : ''}${sortMode === 'H' || sortMode === 'D' ? ' sort-red' : ''}`}
              onClick={cycleSortMode}
              title={t.sortHand}
            >
              {sortMode === 'manual'
                ? `⇅ ${t.sortManual}`
                : `${SUIT_SYM[sortMode]} ${t.sortHand}`}
            </button>
          )}
          {!trainingMode && isCreator && (phase === 'BIDDING' || phase === 'PLAYING') && (
            <button
              className="btn-undo"
              onClick={() => socket.emit('undoLastAction', { code: roomCode })}
              disabled={!room.canUndo}
              title={t.undoAction}
            >
              ↩ {t.undoAction}
            </button>
          )}
          {!trainingMode && isCreator && (
            <button className="btn-manage" onClick={() => setShowAdminPanel(true)} title={t.managePlayersTitle}>
              ⚙ {t.managePlayers}
            </button>
          )}
          {/* Game Review: only rendered for the room creator in live games. */}
          {!trainingMode && isCreator && phase === 'PLAYING' && (
            <button
              className="btn-tag-play-error"
              onClick={() => setTagErrorOpen(true)}
              title={t.button.tagPlayError}
            >
              ⚠ {t.button.tagPlayError}
            </button>
          )}
          <button className="btn-leave" onClick={leaveTable}>
            {trainingMode ? t.training.abandonLabel : t.leaveTable}
          </button>
        </div>

        <div
          className={`my-hand${sortMode === 'manual' ? ' my-hand-manual' : ''}`}
          ref={handElRef}
          onPointerDown={handleHandPointerDown}
          onPointerMove={handleHandPointerMove}
          onPointerUp={handleHandPointerUp}
          onPointerCancel={handleHandPointerCancel}
        >
          {animatedHand.map(card => (
            <CardFace
              key={cardKey(card)}
              card={card}
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
              isDragging={dragVisual != null && cardKey(card) === cardKey(manualHand[dragVisual.fromIdx])}
            />
          ))}
          {myHand.length === 0 && phase === 'PLAYING' && !dealAnimCounts && (
            <span className="muted">—</span>
          )}
        </div>
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
