import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { THROW_ITEMS } from '../lib/throwItems';
import { useTapLongPressDrag } from '../lib/useTapLongPressDrag';

// Throw item tray + drag-and-drop targeting. Opened by the header throw button;
// stays open (throw several) until dismissed by an outside tap or the button.
// Drag an item → a ghost follows the pointer → on release we hit-test the seat
// drop zones ([data-throw-target] in GameBoard) and, over a valid OTHER seat,
// fire onThrow(targetPosition, itemId). Works the SAME for mouse, touch and pen:
// the drag rides the shared useTapLongPressDrag hook in 'immediate' mode (drag
// begins on pointerdown), which captures the pointer on the pressed item so the
// ghost keeps tracking anywhere on screen — no bespoke window listeners. The tray
// + ghost are interactive; the flying animation (ThrowLayer) stays
// pointer-events:none and is untouched here.
//
// Dismissal uses a document pointerdown listener (NOT a blocking backdrop) so
// tapping a card both closes the tray AND still plays the card.
export default function ThrowTray({ open, onClose, onThrow, myPosition }) {
  const [drag, setDrag] = useState(null); // { item, x, y } while dragging
  const [pos, setPos]   = useState(null); // { right, bottom } anchored to the button
  const hoverRef = useRef(null); // currently-highlighted seat element
  const pendingItemRef = useRef(null); // item of the pressed tray button (set on pointerdown)

  // Anchor the tray just above the throw button (bottom band), opening UPWARD,
  // so the whole table stays visible. Measured from the live button rect so it
  // tracks layout / viewport; re-measured on resize. Fixed positioning.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const btn = document.querySelector('.btn-throw');
      if (!btn) { setPos(null); return; }
      const r = btn.getBoundingClientRect();
      setPos({
        right:  Math.max(8, Math.round(window.innerWidth - r.right)),
        bottom: Math.round(window.innerHeight - r.top + 8), // 8px above the button
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  // Outside-tap dismiss without blocking gameplay. Ignore taps on the tray
  // itself and on the header throw button (which toggles open separately).
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (e.target.closest?.('.throw-tray') || e.target.closest?.('.btn-throw')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, onClose]);

  function clearHover() {
    if (hoverRef.current) { hoverRef.current.classList.remove('throw-drop-hover'); hoverRef.current = null; }
  }

  function seatAt(x, y, validateTarget) {
    const el = document.elementFromPoint(x, y);
    const seat = el && el.closest ? el.closest('[data-throw-target]') : null;
    if (!seat) return null;
    const target = Number(seat.getAttribute('data-throw-target'));
    if (!Number.isInteger(target) || target === myPosition) return validateTarget ? null : { seat, target };
    return { seat, target };
  }

  // One shared gesture for every tray item. 'immediate' → the drag starts on
  // pointerdown; the hook captures the pointer on the pressed button so moves and
  // the release land here even over a seat far across the table.
  const dragHandlers = useTapLongPressDrag({
    dragMode: 'immediate',
    preventDefault: true, // suppress text selection / touch scroll during the drag
    onPressStart: () => pendingItemRef.current, // item stashed by the button's onPointerDown
    onDragStart: (ctx) => {
      if (!ctx.data) return;
      setDrag({ item: ctx.data, x: ctx.startX, y: ctx.startY });
    },
    onDragMove: (ctx) => {
      setDrag(d => (d ? { ...d, x: ctx.x, y: ctx.y } : d));
      const hit = seatAt(ctx.x, ctx.y, true); // valid (non-self) target only
      if (hoverRef.current && (!hit || hit.seat !== hoverRef.current)) clearHover();
      if (hit && hit.seat !== hoverRef.current) { hit.seat.classList.add('throw-drop-hover'); hoverRef.current = hit.seat; }
    },
    onDragEnd: (ctx) => {
      const item = ctx.data;
      setDrag(null);
      clearHover();
      if (!item) return;
      const hit = seatAt(ctx.x, ctx.y, true);
      if (hit) onThrow(hit.target, item.id); // valid drop → throw; tray stays open
    },
    onCancel: () => { setDrag(null); clearHover(); },
  });

  // Clear any leftover seat highlight if unmounted mid-drag (the hook itself
  // drops the in-flight gesture + releases capture on unmount).
  useEffect(() => () => clearHover(), []);

  if (!open) return null;

  return (
    <>
      <div
        className="throw-tray"
        role="group"
        style={pos ? { right: `${pos.right}px`, bottom: `${pos.bottom}px` } : undefined}
      >
        {THROW_ITEMS.map(it => (
          <button
            key={it.id}
            type="button"
            className={`throw-tray-item${drag?.item.id === it.id ? ' dragging' : ''}`}
            title={it.id}
            onPointerDown={(e) => { pendingItemRef.current = it; dragHandlers.onPointerDown(e); }}
            onPointerMove={dragHandlers.onPointerMove}
            onPointerUp={dragHandlers.onPointerUp}
            onPointerCancel={dragHandlers.onPointerCancel}
          >
            {it.emoji}
          </button>
        ))}
      </div>
      {drag && (
        <div className="throw-ghost" style={{ left: `${drag.x}px`, top: `${drag.y}px` }}>
          {drag.item.emoji}
        </div>
      )}
    </>
  );
}
