// Small presentational sub-components used inside GameBoard. Each is a pure
// function of its props; none owns shared state. Pulled out so GameBoard.jsx
// can focus on orchestration.

import { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LanguageContext';
import { SUIT_SYM } from './gameBoardHelpers';

// ─── Card primitives ───────────────────────────────────────────────────────

export function CardFace({ card, onClick, highlight, disabled, isDragging }) {
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

export function CardBack({ small }) {
  return <div className={`card card-back${small ? ' card-small' : ''}`}>🂠</div>;
}

// ─── Trick display (used both in-play and in last-trick panel) ─────────────

export function TrickDisplay({ cards, myPosition, players, animDir, winnerPos }) {
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

export function BidStack({ history, t }) {
  if (!history?.length) return null;
  const items = [...history].reverse();
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

export function ContractBadge({ contract, t }) {
  const isRed = contract.suit === 'H' || contract.suit === 'D';
  const value = contract.value === 'capot' ? t.capot : contract.value;
  const suit  = t.suitSymbol?.[contract.suit] ?? SUIT_SYM[contract.suit];
  return (
    <div className="seat-contract-badge">
      <span className={`scb-value${isRed ? ' red' : ''}`}>{value} {suit}</span>
    </div>
  );
}

export function CoincheBadge({ type, t }) {
  return (
    <div className={`seat-coinche-badge scbt-${type}`}>
      <span>{type === 'surcoinche' ? t.surcoinched : t.coinched}</span>
    </div>
  );
}

// ─── Player seat (opponent, face-down) ────────────────────────────────────

export function PlayerSeat({ player, handCount, isActive, isDimmed, direction, isCreator, onRemove }) {
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

// ─── Cut picker (drum roulette for the cut phase) ─────────────────────────

const ITEM_H = 64; // must match .cut-drum-item height in CSS

export function CutPicker({ onCut, onSkip, t }) {
  const drumRef    = useRef(null);
  const [value, setValue] = useState(16);
  const scrollTimer = useRef(null);

  useEffect(() => {
    if (drumRef.current) drumRef.current.scrollTop = 15 * ITEM_H;
  }, []);

  function handleScroll() {
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (!drumRef.current) return;
      const idx = Math.round(drumRef.current.scrollTop / ITEM_H);
      setValue(Math.max(1, Math.min(31, idx + 1)));
    }, 80);
  }

  function handleCut() {
    let n = value;
    if (drumRef.current) {
      const idx = Math.round(drumRef.current.scrollTop / ITEM_H);
      n = Math.max(1, Math.min(31, idx + 1));
    }
    onCut(n);
  }

  return (
    <div className="scp-cut-zone">
      <p className="scp-cut-label">{t.pickCutValue}</p>
      <div className="cut-drum-wrap">
        <div className="cut-drum-overlay top" />
        <div className="cut-drum-center-bar" />
        <div className="cut-drum-overlay bot" />
        <div className="cut-drum" ref={drumRef} onScroll={handleScroll}>
          <div className="cut-drum-pad" />
          {Array.from({ length: 31 }, (_, i) => (
            <div key={i + 1} className="cut-drum-item">{i + 1}</div>
          ))}
          <div className="cut-drum-pad" />
        </div>
      </div>
      <p className="scp-cut-selected">{value}</p>
      <div className="scp-actions">
        <button className="scp-btn scp-btn-pri" onClick={handleCut}>{t.cut}</button>
        <button className="scp-btn scp-btn-sec" onClick={onSkip}>{t.noCut}</button>
      </div>
    </div>
  );
}

// ─── Belote / Rebelote declaration prompt ──────────────────────────────────

export function BelotePrompt({ card, t, onYes, onNo }) {
  return (
    <div className="belote-overlay">
      <div className="belote-prompt">
        <p className="belote-prompt-q">{t.announceBelote}</p>
        <div className="belote-prompt-card">
          <span className={card.suit === 'H' || card.suit === 'D' ? 'red' : ''}>
            {card.value}{SUIT_SYM[card.suit]}
          </span>
        </div>
        <div className="belote-prompt-btns">
          <button className="belote-btn belote-yes" onClick={onYes}>{t.belote}</button>
          <button className="belote-btn belote-no" onClick={onNo}>{t.no}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Pause banner ──────────────────────────────────────────────────────────

export function PauseBanner({ players, t }) {
  const dced = players.filter(p => !p.connected).map(p => p.username).join(', ');
  return (
    <div className="pause-banner">
      {dced ? t.playerDisconnected(dced) : t.gamePaused}
    </div>
  );
}
