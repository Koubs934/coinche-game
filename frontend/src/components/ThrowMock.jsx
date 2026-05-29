import { useRef, useState } from 'react';
import ThrowTray from './ThrowTray';
import ThrowLayer from './ThrowLayer';
import { THROW_ITEMS, THROW_TOTAL_MS } from '../lib/throwItems';

// Dev-only (?mock=throw) faux board to self-eval the throw UI placement without
// auth: three opponent seats + a centre trick stay visible while the bottom-band
// throw button (right of the avatar/name) opens the tray UPWARD; dragging an item
// onto a seat fires the real animation. Below it, a frozen preview of every
// item's impact. Not shipped in any real flow.
export default function ThrowMock() {
  const [open, setOpen] = useState(false);
  const [throws, setThrows] = useState([]);
  const idRef = useRef(0);

  function onThrow(targetPosition, item) {
    const id = ++idRef.current;
    setThrows(list => [...list, { id, fromPosition: 0, toPosition: targetPosition, item }]);
    setTimeout(() => setThrows(list => list.filter(x => x.id !== id)), THROW_TOTAL_MS + 100);
  }

  const seat = (cls, pos, label) => (
    <div className={cls} data-throw-target={pos} style={seatBox(cls)}>
      <div className="player-avatar team0-avatar avatar" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center' }}>{label}</div>
    </div>
  );

  return (
    <div className="app" data-hand-size="M">
      <div className="game-board" style={{ position: 'relative', flex: 1 }}>
        {seat('board-top', 2, 'P2')}
        {seat('board-left', 3, 'P3')}
        {seat('board-right', 1, 'P1')}
        <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--muted)' }}>trick</div>

        {/* Bottom band: [avatar · AK7] left … [🍅] right, above the faux hand */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <div className="self-player-bar">
            <div className="player-avatar team0-avatar avatar" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center' }}>A</div>
            <span className="self-name">AK7</span>
            <button
              type="button"
              className={`btn-throw${open ? ' active' : ''}`}
              onClick={() => setOpen(o => !o)}
              title="Throw"
            >🍅</button>
          </div>
          <div className="my-hand" style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: 8 }}>
            {['🂡', '🂢', '🂣', '🂤', '🂥'].map((c, i) => (
              <span key={i} style={{ width: 38, height: 56, background: '#fffef8', borderRadius: 5, display: 'grid', placeItems: 'center', color: '#111' }}>{c}</span>
            ))}
          </div>
        </div>

        <ThrowLayer throws={throws} myPosition={0} />
        <ThrowTray open={open} onClose={() => setOpen(false)} onThrow={onThrow} myPosition={0} />
      </div>

      {/* Frozen impact preview */}
      <div className="throw-mock" style={{ flexShrink: 0 }}>
        <p className="throw-mock-label">Impacts</p>
        <div className="throw-mock-impacts">
          {THROW_ITEMS.map(it => (
            <div key={it.id} className="throw-mock-cell">
              <div className={`throw-impact throw-impact-frozen throw-impact-${it.splat}`} style={{ '--pcol': `#${it.color}` }}>
                <span className={`throw-splat throw-splat-${it.splat}`} />
                {it.burst && <span className="throw-burst">{it.burst}</span>}
                <span className="throw-impact-emoji">{it.emoji}</span>
                {it.messy && <span className="throw-drip" />}
                {it.stun && <span className="throw-stunned">😵</span>}
              </div>
              <span className="throw-mock-name">{it.id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Rough seat placement for the faux board.
function seatBox(cls) {
  if (cls === 'board-top')   return { position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)' };
  if (cls === 'board-left')  return { position: 'absolute', top: '40%', left: 10 };
  if (cls === 'board-right') return { position: 'absolute', top: '40%', right: 10 };
  return {};
}
