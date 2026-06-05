// Input-agnostic gesture recognizer for Pointer Events (mouse, touch, pen all
// drive the SAME path). This is the framework-free core: a tiny state machine
// fed pointerdown/move/up/cancel events that emits semantic callbacks — tap,
// long-press, drag-start/move/end, cancel. The React wiring (pointer capture,
// handler props) lives in useTapLongPressDrag.js; keeping the machine pure makes
// the tap-vs-long-press-vs-drag thresholds unit-testable without a DOM.
//
// Two drag grammars, selected by `dragMode`:
//   'longPress'  — press and HOLD still for `longPressMs` to enter drag mode;
//                  a quick release is a tap, and moving past `moveTolerance`
//                  before the timer fires abandons the press (no tap, no drag).
//                  Used by the hand: tap a card = play, hold = drag-to-reorder.
//   'immediate'  — the drag begins on pointerdown. Used by the throw tray:
//                  press an item and drag it onto a seat.
//
// Every callback receives one mutable `ctx` describing the gesture:
//   pointerId, startX/startY, x/y (latest), dx/dy (delta from start),
//   event (the latest native/synthetic pointer event), data (whatever
//   onPressStart returned — e.g. a card index or throw item), and the
//   booleans dragging / longPressed / moved.

export function createPointerGesture(opts = {}) {
  const {
    longPressMs = 250,
    moveTolerance = 8,
    dragMode = 'longPress', // 'longPress' | 'immediate'
    primaryOnly = true, // ignore non-primary pointers (right/middle mouse button)
    preventDefault = false, // call e.preventDefault() on pointerdown (immediate drags)
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
    onPressStart, // (ctx) => data | false   (return false to veto the gesture)
    onLongPress, // (ctx) => void           (the hold threshold was reached)
    onLongPressCancel, // (ctx) => void      (a pending long-press was abandoned by movement)
    onDragStart, // (ctx) => void           (drag begins: immediate down, or long-press fire)
    onDragMove, // (ctx) => void
    onDragEnd, // (ctx) => void              (release while dragging)
    onTap, // (ctx) => void                  (quick release, no drag, no move)
    onCancel, // (ctx) => void               (pointercancel / teardown)
  } = opts;

  let active = null; // the in-flight gesture ctx, or null when idle

  function beginDrag(ctx) {
    ctx.dragging = true;
    if (onDragStart) onDragStart(ctx);
  }

  function down(e) {
    if (active) return false; // single pointer at a time; ignore extra fingers
    if (primaryOnly && e.button != null && e.button !== 0) return false;
    const ctx = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      dx: 0,
      dy: 0,
      event: e,
      data: undefined,
      dragging: false,
      longPressed: false,
      moved: false,
      timer: null,
    };
    active = ctx;
    if (onPressStart) {
      const r = onPressStart(ctx);
      if (r === false) {
        active = null; // consumer vetoed (e.g. press did not land on a card)
        return false;
      }
      ctx.data = r;
    }
    if (preventDefault && e.preventDefault) e.preventDefault();
    if (dragMode === 'immediate') {
      beginDrag(ctx);
    } else {
      ctx.timer = setTimer(() => {
        if (active !== ctx) return; // gesture ended before the hold completed
        ctx.timer = null;
        ctx.longPressed = true;
        if (onLongPress) onLongPress(ctx);
        beginDrag(ctx);
      }, longPressMs);
    }
    return true;
  }

  function move(e) {
    const ctx = active;
    if (!ctx || e.pointerId !== ctx.pointerId) return;
    ctx.x = e.clientX;
    ctx.y = e.clientY;
    ctx.dx = e.clientX - ctx.startX;
    ctx.dy = e.clientY - ctx.startY;
    ctx.event = e;
    if (ctx.dragging) {
      if (onDragMove) onDragMove(ctx);
      return;
    }
    // Pending long-press: moving past the tolerance abandons it (this was a
    // scroll/slide, not a hold) — no tap, no drag will follow.
    if (
      ctx.timer != null &&
      (Math.abs(ctx.dx) > moveTolerance || Math.abs(ctx.dy) > moveTolerance)
    ) {
      clearTimer(ctx.timer);
      ctx.timer = null;
      ctx.moved = true;
      if (onLongPressCancel) onLongPressCancel(ctx);
    }
  }

  function up(e) {
    const ctx = active;
    if (!ctx || e.pointerId !== ctx.pointerId) return;
    if (ctx.timer != null) {
      clearTimer(ctx.timer);
      ctx.timer = null;
    }
    ctx.event = e;
    active = null;
    if (ctx.dragging) {
      if (onDragEnd) onDragEnd(ctx);
      return;
    }
    // Not dragging: a tap iff the pointer never wandered past the tolerance.
    if (!ctx.moved && onTap) onTap(ctx);
  }

  function cancel(e) {
    const ctx = active;
    if (!ctx) return;
    if (e && e.pointerId != null && e.pointerId !== ctx.pointerId) return;
    if (ctx.timer != null) {
      clearTimer(ctx.timer);
      ctx.timer = null;
    }
    active = null;
    if (onCancel) onCancel(ctx);
  }

  // Tear down any in-flight gesture without firing semantic callbacks (used on
  // unmount). Clears a pending long-press timer so it can't fire after teardown.
  function reset() {
    if (active && active.timer != null) clearTimer(active.timer);
    active = null;
  }

  return {
    down,
    move,
    up,
    cancel,
    reset,
    isActive: () => !!active,
    isDragging: () => !!(active && active.dragging),
  };
}
