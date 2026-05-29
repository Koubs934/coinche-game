import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { itemById, THROW_FLIGHT_MS, THROW_IMPACT_MS } from '../lib/throwItems';

// Animated "throw stuff at a player" overlay. Mirrors the chat-bubble layer:
// absolute inset:0 inside .app, POINTER-EVENTS:NONE so it never intercepts card
// or seat taps. Each active throw flies in an arc from the thrower's seat to the
// target's seat (viewer-relative, same mapping as ChatBubbles), then splats with
// an item-specific impact + makes the target avatar react. All transient.
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
  // Arc height scales with distance, clamped, and always lifts upward.
  const arc = Math.min(180, Math.max(70, Math.hypot(dx, dy) * 0.45));

  // Best-effort: make the REAL target avatar react when the projectile lands.
  useEffect(() => {
    const sel = SLOT_SELECTOR[toSlot];
    const el = sel ? document.querySelector(sel) : null;
    if (!el) return;
    const cls = `react-${item.reaction}`;
    const t1 = setTimeout(() => el.classList.add(cls), THROW_FLIGHT_MS);
    const t2 = setTimeout(() => el.classList.remove(cls), THROW_FLIGHT_MS + THROW_IMPACT_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); el.classList.remove(cls); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flyStyle = {
    left: `${fx}px`,
    top: `${fy}px`,
    '--dx': `${dx}px`,
    '--dy': `${dy}px`,
    '--arc': `${arc}px`,
    '--flight': `${THROW_FLIGHT_MS}ms`,
  };
  const impactStyle = {
    left: `${tx}px`,
    top: `${ty}px`,
    '--flight': `${THROW_FLIGHT_MS}ms`,
    '--impact': `${THROW_IMPACT_MS}ms`,
  };

  return (
    <>
      <div className="throw-fly" style={flyStyle}>
        <div className="throw-fly-lift">
          <div className="throw-fly-spin">{item.emoji}</div>
        </div>
      </div>
      <div className={`throw-impact throw-impact-${item.impact}`} style={impactStyle}>
        <span className={`throw-splat throw-splat-${item.splat}`} />
        {item.burst && <span className="throw-burst">{item.burst}</span>}
        <span className="throw-impact-emoji">{item.emoji}</span>
      </div>
    </>
  );
}
