import { useMemo, useRef, useEffect } from 'react';
import { createPointerGesture } from './pointerGesture';

// React wiring around the pure createPointerGesture recognizer. Returns the four
// pointer handler props ({ onPointerDown, onPointerMove, onPointerUp,
// onPointerCancel }) to spread on the interactive element, and transparently
// acquires POINTER CAPTURE when a drag begins so moves keep tracking even when
// the cursor/finger leaves the element — one path for mouse, touch and pen.
//
// Because Pointer Events fire uniformly across input types, any feature built on
// this hook is mouse + touch by default. See pointerGesture.js for the gesture
// grammar (`dragMode: 'longPress' | 'immediate'`).
//
// Callbacks are read through a ref, so passing fresh closures every render
// (the normal React way) never re-creates the recognizer and never goes stale.
//
// `captureTarget(ctx)` lets the caller name the element to capture on. The hand
// must capture on its container (.my-hand) and ONLY once the long-press drag
// begins — capturing earlier retargets the synthesized click and swallows the
// card's onClick on desktop. By the time the long-press fires, the original
// pointerdown event's `currentTarget` is already null (React clears it after
// dispatch), which is exactly why a ref-based getter is needed rather than
// reading it off the event. Immediate-mode drags (the throw tray) capture
// synchronously on pointerdown, so they can fall back to `event.currentTarget`.
export function useTapLongPressDrag(options = {}) {
  const optsRef = useRef(options);
  optsRef.current = options;

  const gesture = useMemo(
    () =>
      createPointerGesture({
        longPressMs: options.longPressMs,
        moveTolerance: options.moveTolerance,
        dragMode: options.dragMode,
        primaryOnly: options.primaryOnly,
        preventDefault: options.preventDefault,
        onPressStart: (ctx) => optsRef.current.onPressStart?.(ctx),
        onLongPress: (ctx) => optsRef.current.onLongPress?.(ctx),
        onLongPressCancel: (ctx) => optsRef.current.onLongPressCancel?.(ctx),
        onDragStart: (ctx) => {
          const o = optsRef.current;
          const el = o.captureTarget ? o.captureTarget(ctx) : ctx.event?.currentTarget;
          if (el && el.setPointerCapture) {
            try {
              el.setPointerCapture(ctx.pointerId);
              ctx._capEl = el;
            } catch {
              /* element gone / capture unsupported — drag still works in-bounds */
            }
          }
          o.onDragStart?.(ctx);
        },
        onDragMove: (ctx) => optsRef.current.onDragMove?.(ctx),
        onDragEnd: (ctx) => {
          releaseCapture(ctx);
          optsRef.current.onDragEnd?.(ctx);
        },
        onTap: (ctx) => optsRef.current.onTap?.(ctx),
        onCancel: (ctx) => {
          releaseCapture(ctx);
          optsRef.current.onCancel?.(ctx);
        },
      }),
    // Created once. Config primitives (longPressMs, moveTolerance, dragMode…)
    // are static per call site; live callbacks are read via optsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Cancel any in-flight gesture (and its pending long-press timer) on unmount.
  useEffect(() => () => gesture.reset(), [gesture]);

  return {
    onPointerDown: (e) => gesture.down(e),
    onPointerMove: (e) => gesture.move(e),
    onPointerUp: (e) => gesture.up(e),
    onPointerCancel: (e) => gesture.cancel(e),
  };
}

function releaseCapture(ctx) {
  const el = ctx._capEl;
  if (el && el.releasePointerCapture) {
    try {
      el.releasePointerCapture(ctx.pointerId);
    } catch {
      /* already released (the browser auto-releases on pointerup) */
    }
  }
}
