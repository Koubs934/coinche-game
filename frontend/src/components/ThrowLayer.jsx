import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { itemById, THROW_FLIGHT_MS, THROW_IMPACT_MS } from '../lib/throwItems';

// Animated "throw stuff at a player" overlay. Mirrors the chat-bubble layer:
// absolute inset:0 inside .app, POINTER-EVENTS:NONE so it never intercepts card
// or seat taps. Each active throw tosses in an arc from the thrower's seat to the
// target's seat (viewer-relative, same mapping as ChatBubbles), squashes/stretches
// + spins in flight, then PUNCHES on impact: a scale-pop splat, flying particle
// droplets, a drip/stain for messy items, an optional 😵 stun, and a springy
// reaction on the real target avatar. All transient + self-cleaning.
//
// Seat slots (viewer-relative): (pos - myPosition + 4) % 4 → 0 self/bottom,
// 1 right, 2 top, 3 left. Anchor points are fractions of the layer box.
const ANCHORS = {
  0: { fx: 0.50, fy: 0.84 }, // self / bottom (hand area)
  1: { fx: 0.86, fy: 0.42 }, // right opponent
  2: { fx: 0.50, fy: 0.16 }, // top partner
  3: { fx: 0.14, fy: 0.42 }, // left opponent
};
// Real seat-avatar selectors per slot, for the (best-effort) reaction class. On
// the round-summary screen these don't exist → the splat still plays, no react.
const SLOT_SELECTOR = {
  0: '.self-player-bar .avatar',
  1: '.board-right .avatar',
  2: '.board-top .avatar',
  3: '.board-left .avatar',
};

const PARTICLE_COUNT = 8;
const REACT_MS = 700; // springy reaction window

export default function ThrowLayer({ throws, myPosition }) {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="throw-layer" ref={ref} aria-hidden="true">
      {box.w > 0 && (throws || []).map(thr => (
        <ThrowInstance key={thr.id} thr={thr} myPosition={myPosition} box={box} />
      ))}
    </div>
  );
}

function ThrowInstance({ thr, myPosition, box }) {
  const item = itemById(thr.item);
  if (!item || myPosition == null) return null;

  const fromSlot = ((thr.fromPosition - myPosition) + 4) % 4;
  const toSlot   = ((thr.toPosition   - myPosition) + 4) % 4;
  const from = ANCHORS[fromSlot] || ANCHORS[0];
  const to   = ANCHORS[toSlot]   || ANCHORS[2];

  const fx = from.fx * box.w, fy = from.fy * box.h;
  const tx = to.fx   * box.w, ty = to.fy   * box.h;
  const dx = tx - fx, dy = ty - fy;
  // Arc height scales with distance, clamped, always lifting upward.
  const arc = Math.min(170, Math.max(64, Math.hypot(dx, dy) * 0.42));
  // Spin direction follows horizontal travel (throws to the right spin CW).
  const spin = dx >= 0 ? 540 : -540;

  // Best-effort: make the REAL target avatar react (springy) when it lands.
  useEffect(() => {
    const el = document.querySelector(SLOT_SELECTOR[toSlot] || '');
    if (!el) return;
    const cls = `react-${item.reaction}`;
    const t1 = setTimeout(() => el.classList.add(cls), THROW_FLIGHT_MS);
    const t2 = setTimeout(() => el.classList.remove(cls), THROW_FLIGHT_MS + REACT_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); el.classList.remove(cls); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flyStyle = {
    left: `${fx}px`, top: `${fy}px`,
    '--dx': `${dx}px`, '--dy': `${dy}px`,
    '--arc': `${arc}px`, '--spin': `${spin}deg`,
    '--flight': `${THROW_FLIGHT_MS}ms`,
  };
  const impactStyle = {
    left: `${tx}px`, top: `${ty}px`,
    '--flight': `${THROW_FLIGHT_MS}ms`,
    '--impact': `${THROW_IMPACT_MS}ms`,
    '--pcol': `#${item.color}`,
  };

  // Deterministic particle directions (no RNG → resume-safe, identical for all).
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const ang = (i / PARTICLE_COUNT) * Math.PI * 2 + (toSlot * 0.7);
    const dist = 38 + (i % 3) * 12;
    return { px: Math.cos(ang) * dist, py: Math.sin(ang) * dist - 8 };
  });

  return (
    <>
      <div className="throw-fly" style={flyStyle}>
        <div className="throw-fly-lift">
          <div className="throw-fly-squash">
            <div className="throw-fly-spin">{item.emoji}</div>
          </div>
        </div>
      </div>

      <div className={`throw-impact throw-impact-${item.splat}`} style={impactStyle}>
        <span className={`throw-splat throw-splat-${item.splat}`} />
        {particles.map((p, i) => (
          <span
            key={i}
            className="throw-particle"
            style={{ '--pdx': `${p.px}px`, '--pdy': `${p.py}px` }}
          />
        ))}
        {item.burst && <span className="throw-burst">{item.burst}</span>}
        <span className="throw-impact-emoji">{item.emoji}</span>
        {item.messy && <span className="throw-drip" />}
        {item.stun && <span className="throw-stunned">😵</span>}
      </div>
    </>
  );
}
