import { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LanguageContext';
import BiddingPanel from './BiddingPanel';
import RoundSummary from './RoundSummary';

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

// Build non-trump suit order that alternates colors (R,B,R or B,R,B).
// With no trump, returns the one perfect 4-suit alternating sequence S,H,C,D (B,R,B,R).
function buildNonTrumpOrder(trump) {
  if (!trump) return ['S', 'H', 'C', 'D']; // B R B R — perfect alternation
  const all = ['S', 'H', 'D', 'C'];
  const others = all.filter(s => s !== trump);
  const trumpColor = SUIT_COLOR[trump];
  const diff = others.filter(s => SUIT_COLOR[s] !== trumpColor); // 2 suits
  const same = others.filter(s => SUIT_COLOR[s] === trumpColor); // 1 suit
  // Sandwich: diff[0], same[0], diff[1] → always alternates (R,B,R or B,R,B)
  return [diff[0], same[0], diff[1]];
}

function sortHand(hand, trump) {
  if (!hand?.length) return hand || [];
  const nonTrumpOrder = buildNonTrumpOrder(trump);
  return [...hand].sort((a, b) => {
    const aT = a.suit === trump, bT = b.suit === trump;
    if (aT && !bT) return -1;
    if (!aT && bT) return  1;
    if (aT)  return TRUMP_ORDER.indexOf(a.value) - TRUMP_ORDER.indexOf(b.value);
    const sd = nonTrumpOrder.indexOf(a.suit) - nonTrumpOrder.indexOf(b.suit);
    return sd !== 0 ? sd : NON_TRUMP_ORDER.indexOf(a.value) - NON_TRUMP_ORDER.indexOf(b.value);
  });
}

// Direction the trick slides toward the winner (relative to viewer at bottom)
function winDir(winnerPos, myPos) {
  return ['bottom', 'right', 'top', 'left'][((winnerPos - myPos) + 4) % 4];
}

// ─── Card primitives ───────────────────────────────────────────────────────

function CardFace({ card, onClick, highlight, disabled }) {
  const isRed = card.suit === 'H' || card.suit === 'D';
  return (
    <button
      className={`card card-face${isRed ? ' red' : ''}${highlight ? ' valid' : ''}${disabled ? ' card-disabled' : ''}`}
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

// ─── Player seat (opponent, face-down) ────────────────────────────────────

function PlayerSeat({ player, handCount, isActive, isDimmed, direction, bidAction }) {
  const { t } = useLang();
  const label = formatBidAction(bidAction, t);
  return (
    <div className={[
      'player-seat',
      `player-${direction}`,
      isActive  ? 'active-player' : '',
      isDimmed  ? 'seat-dimmed'   : '',
    ].filter(Boolean).join(' ')}>
      <div className="player-name">
        {player?.isBot ? '🤖 ' : ''}{player?.username || '?'}
        {!player?.connected && <span className="dc-indicator"> ⚠</span>}
        {isActive && <span className="turn-dot"> ●</span>}
      </div>
      {label && (
        <div className={`bid-action-chip ${bidChipClass(bidAction)}`}>{label}</div>
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
  // trickOverlay = { cards, winnerPos, animate } | null
  const [trickOverlay, setTrickOverlay]   = useState(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const prevTricksLenRef = useRef(0);
  const prevDealerRef    = useRef(null);
  const prevTrumpRef     = useRef(null);
  const timerRef         = useRef([]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const { players, scores, targetScore, paused } = room;
  const {
    phase, currentTrick, currentPlayer, biddingTurn,
    trumpSuit, currentBid, hands, handCounts, beloteInfo, tricks,
  } = game;

  const myHand       = hands[myPosition] || [];
  const myTeam       = players.find(p => p.position === myPosition)?.team ?? 0;
  const isMyCardTurn = phase === 'PLAYING' && currentPlayer === myPosition;
  const isMyBidTurn  = phase === 'BIDDING' && biddingTurn  === myPosition;
  const isMyTurn     = isMyCardTurn || isMyBidTurn;

  const displayHand  = sortActive ? sortHand(myHand, trumpSuit) : myHand;
  const livePoints   = computeLivePoints(tricks, trumpSuit);
  const lastDoneTrick = tricks?.length > 0 ? tricks[tricks.length - 1] : null;

  // For active/dim states on opponent seats
  const isActiveTurnPhase = phase === 'BIDDING' || phase === 'PLAYING';
  const activeTurnPos     = phase === 'BIDDING' ? biddingTurn : currentPlayer;

  function seatData(offset) {
    const pos    = (myPosition + offset + 4) % 4;
    const player = players.find(p => p.position === pos);
    return {
      player,
      handCount: handCounts[pos],
      isActive:  isActiveTurnPhase && pos === activeTurnPos,
      isDimmed:  isActiveTurnPhase && pos !== activeTurnPos,
      bidAction: phase === 'BIDDING' ? (game.biddingActions?.[pos] ?? null) : null,
    };
  }

  function leaveTable() {
    if (phase === 'BIDDING' || phase === 'PLAYING') {
      if (!window.confirm(t.leaveConfirm)) return;
    }
    socket.emit('leaveRoom', { code: roomCode });
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  function playCard(card) {
    socket.emit('playCard', { code: roomCode, card });
  }

  // ── Round summary (early exit) ─────────────────────────────────────────────
  if (room.phase === 'ROUND_OVER' || room.phase === 'GAME_OVER') {
    return (
      <>
        {paused && <PauseBanner players={players} t={t} />}
        <RoundSummary socket={socket} roomCode={roomCode} room={room} game={game} />
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
      {paused && <PauseBanner players={players} t={t} />}

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
        <PlayerSeat {...seatData(2)} direction="top" />
      </div>

      {/* ── Middle row ─────────────────────────────────────────────────────── */}
      <div className="board-middle">

        <div className="board-left">
          <PlayerSeat {...seatData(3)} direction="left" />
        </div>

        <div className="board-center">
          {/* Contract / trump badge */}
          {currentBid && (
            <div className="contract-badge">
              {currentBid.value === 'capot' ? t.capot : currentBid.value}
              {' '}{t.suitSymbol[currentBid.suit]}
              {currentBid.surcoinched && ' ×4'}
              {currentBid.coinched && !currentBid.surcoinched && ' ×2'}
            </div>
          )}

          {phase === 'BIDDING' && (
            <div className="bidding-area">
              <BiddingPanel
                socket={socket} roomCode={roomCode}
                game={game} myPosition={myPosition} myTeam={myTeam}
              />
              <div className="bidding-turn-info">
                {isMyBidTurn
                  ? <strong className="your-turn">{t.yourTurn}</strong>
                  : <span>{t.waitingFor(players.find(p => p.position === biddingTurn)?.username || '?')}</span>
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

              {/* Last trick button */}
              {tricks?.length > 0 && (
                <button className="btn-last-trick" onClick={() => setShowLastTrick(true)}>
                  ↩ {t.lastTrick}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="board-right">
          <PlayerSeat {...seatData(1)} direction="right" />
        </div>
      </div>

      {/* ── My hand ────────────────────────────────────────────────────────── */}
      <div className={`board-hand${isMyTurn ? ' hand-my-turn' : ''}`}>

        {/* "Your turn" pulse banner */}
        {isMyTurn && (
          <div className="your-turn-banner">{t.yourTurn} ●</div>
        )}

        {/* Toolbar row: sort toggle + self bid status + leave */}
        <div className="hand-toolbar">
          <button
            className={`btn-sort${sortActive ? ' sort-on' : ''}`}
            onClick={() => setSortActive(v => !v)}
            title={t.sortHand}
          >
            {sortActive ? '♠♥♦♣' : '⇅'} {t.sortHand}
          </button>
          {phase === 'BIDDING' && (() => {
            const selfAction = game.biddingActions?.[myPosition];
            const label = formatBidAction(selfAction, t);
            return label ? (
              <span className={`bid-action-chip ${bidChipClass(selfAction)}`}>{label}</span>
            ) : null;
          })()}
          <button className="btn-leave" onClick={leaveTable}>{t.leaveTable}</button>
        </div>

        <div className="my-hand">
          {displayHand.map(card => (
            <CardFace
              key={`${card.suit}${card.value}`}
              card={card}
              onClick={() => isMyCardTurn && playCard(card)}
              highlight={isMyCardTurn}
              disabled={!isMyCardTurn}
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
