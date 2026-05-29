import { useEffect, useRef, useState } from 'react';
import { THROW_ITEMS } from '../lib/throwItems';

// Throw item tray + drag-and-drop targeting. Opened by the header throw button;
// stays open (throw several) until dismissed by an outside tap or the button.
// Drag an item → a ghost follows the finger → on release we hit-test the seat
// drop zones ([data-throw-target] in GameBoard) and, over a valid OTHER seat,
// fire onThrow(targetPosition, itemId). The tray + ghost are interactive; the
// flying animation (ThrowLayer) stays pointer-events:none and is untouched here.
//
// Dismissal uses a document pointerdown listener (NOT a blocking backdrop) so
// tapping a card both closes the tray AND still plays the card.
export default function ThrowTray({ open, onClose, onThrow, myPosition }) {
  const [drag, setDrag] = useState(null); // { item, x, y } while dragging
  const dragRef  = useRef(null);
  const hoverRef = useRef(null); // currently-highlighted seat element

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

  function onMove(e) {
    if (!dragRef.current) return;
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
    setDrag(d => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const hit = seatAt(e.clientX, e.clientY, true); // valid (non-self) target only
    if (hoverRef.current && (!hit || hit.seat !== hoverRef.current)) clearHover();
    if (hit && hit.seat !== hoverRef.current) { hit.seat.classList.add('throw-drop-hover'); hoverRef.current = hit.seat; }
  }

  function endDrag(e) {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    clearHover();
    if (!d) return;
    const hit = seatAt(e.clientX, e.clientY, true);
    if (hit) onThrow(hit.target, d.item.id); // valid drop → throw; tray stays open
  }

  function startDrag(e, item) {
    if (e.button != null && e.button !== 0) return; // primary pointer only
    e.preventDefault();
    dragRef.current = { item, x: e.clientX, y: e.clientY };
    setDrag({ item, x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }

  // Clean up listeners/hover if unmounted mid-drag.
  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    clearHover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  return (
    <>
      <div className="throw-tray" role="group">
        {THROW_ITEMS.map(it => (
          <button
            key={it.id}
            type="button"
            className={`throw-tray-item${drag?.item.id === it.id ? ' dragging' : ''}`}
            title={it.id}
            onPointerDown={(e) => startDrag(e, it)}
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
