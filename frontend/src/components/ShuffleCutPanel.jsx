import { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';

const ITEM_H = 64;

function CutPicker({ onCut, onSkip, t }) {
  const drumRef = useRef(null);
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

function PauseBanner({ players, t }) {
  const dced = players.filter(p => !p.connected).map(p => p.username).join(', ');
  return (
    <div className="pause-banner">
      {dced ? t.playerDisconnected(dced) : t.gamePaused}
    </div>
  );
}

export default function ShuffleCutPanel({ socket, roomCode, room, myPosition }) {
  const { t } = useLang();
  const { phase, shuffleDealer, cutPlayer, players, paused } = room;
  const isMyShuffleTurn = phase === 'SHUFFLE' && shuffleDealer === myPosition;
  const isMyCutTurn = phase === 'CUT' && cutPlayer === myPosition;
  const actorPos = phase === 'SHUFFLE' ? shuffleDealer : cutPlayer;
  const actorName = actorPos != null
    ? (players.find(p => p.position === actorPos)?.username || '?')
    : '?';

  return (
    <div className="shuffle-cut-panel">
      {paused && <PauseBanner players={players} t={t} />}
      <div className="scp-phase-label">
        {isMyShuffleTurn ? t.yourTurnShuffle
          : isMyCutTurn ? t.yourTurnCut
          : phase === 'SHUFFLE' ? t.waitingShuffle(actorName)
          : t.waitingCut(actorName)}
      </div>
      {isMyShuffleTurn && (
        <div className="scp-actions">
          <button className="scp-btn scp-btn-pri" onClick={() => socket.emit('shuffleDeck', { code: roomCode })}>
            {t.shuffle}
          </button>
          <button className="scp-btn scp-btn-sec" onClick={() => socket.emit('skipShuffle', { code: roomCode })}>
            {t.noShuffle}
          </button>
        </div>
      )}
      {isMyCutTurn && (
        <CutPicker
          onCut={n => socket.emit('cutDeck', { code: roomCode, n })}
          onSkip={() => socket.emit('skipCut', { code: roomCode })}
          t={t}
        />
      )}
      {!isMyShuffleTurn && !isMyCutTurn && (
        <div className="scp-wait-indicator">
          <span className="scp-spinner-icon">↻</span>
        </div>
      )}
    </div>
  );
}
