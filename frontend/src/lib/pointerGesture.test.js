import { describe, it, expect, vi } from 'vitest';
import { createPointerGesture } from './pointerGesture';

// Deterministic, injectable timer so the long-press threshold is controllable
// without real time: scheduled callbacks fire only when flush() is called.
function fakeTimers() {
  const timers = new Map();
  let next = 0;
  return {
    setTimer: (fn) => {
      const id = ++next;
      timers.set(id, fn);
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    flush: () => {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
    pending: () => timers.size,
  };
}

// Synthetic pointer event — only the fields the recognizer reads.
const ev = (over = {}) => ({
  pointerId: 1,
  button: 0,
  clientX: 0,
  clientY: 0,
  preventDefault: () => {},
  ...over,
});

// Spy-bag of every callback the recognizer can fire, plus a recognizer wired to
// the fake timers. opts overrides config (dragMode, tolerances…).
function harness(opts = {}) {
  const cb = {
    onPressStart: vi.fn((ctx) => ctx.data ?? undefined),
    onLongPress: vi.fn(),
    onLongPressCancel: vi.fn(),
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDragEnd: vi.fn(),
    onTap: vi.fn(),
    onCancel: vi.fn(),
  };
  const timers = fakeTimers();
  const g = createPointerGesture({
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    ...cb,
    ...opts,
  });
  return { g, cb, timers };
}

describe('longPress mode — tap (quick release)', () => {
  it('a press then release with no hold and no move is a TAP, not a drag', () => {
    const { g, cb } = harness();
    g.down(ev());
    g.up(ev());
    expect(cb.onTap).toHaveBeenCalledTimes(1);
    expect(cb.onLongPress).not.toHaveBeenCalled();
    expect(cb.onDragStart).not.toHaveBeenCalled();
    expect(cb.onDragEnd).not.toHaveBeenCalled();
  });

  it('clears the pending long-press timer on release (no leaked timer)', () => {
    const { g, timers } = harness();
    g.down(ev());
    expect(timers.pending()).toBe(1);
    g.up(ev());
    expect(timers.pending()).toBe(0);
  });
});

describe('longPress mode — hold becomes a drag', () => {
  it('reaching the hold threshold fires onLongPress then onDragStart', () => {
    const { g, cb, timers } = harness();
    g.down(ev());
    timers.flush(); // long-press timer fires
    expect(cb.onLongPress).toHaveBeenCalledTimes(1);
    expect(cb.onDragStart).toHaveBeenCalledTimes(1);
    expect(g.isDragging()).toBe(true);
  });

  it('moves after the hold drive onDragMove with correct deltas, release ends', () => {
    const { g, cb, timers } = harness();
    g.down(ev({ clientX: 100, clientY: 100 }));
    timers.flush();
    g.move(ev({ clientX: 130, clientY: 90 }));
    expect(cb.onDragMove).toHaveBeenCalledTimes(1);
    const ctx = cb.onDragMove.mock.calls[0][0];
    expect(ctx.x).toBe(130);
    expect(ctx.dx).toBe(30);
    expect(ctx.dy).toBe(-10);
    g.up(ev({ clientX: 130, clientY: 90 }));
    expect(cb.onDragEnd).toHaveBeenCalledTimes(1);
    expect(cb.onTap).not.toHaveBeenCalled();
    expect(g.isActive()).toBe(false);
  });

  it('a hold with no movement still becomes a drag (not a tap)', () => {
    const { g, cb, timers } = harness();
    g.down(ev());
    timers.flush();
    g.up(ev());
    expect(cb.onDragEnd).toHaveBeenCalledTimes(1);
    expect(cb.onTap).not.toHaveBeenCalled();
  });
});

describe('longPress mode — movement threshold', () => {
  it('moving past the tolerance BEFORE the hold abandons the press (no tap, no drag)', () => {
    const { g, cb, timers } = harness({ moveTolerance: 8 });
    g.down(ev({ clientX: 0, clientY: 0 }));
    g.move(ev({ clientX: 20, clientY: 0 })); // 20 > 8
    expect(cb.onLongPressCancel).toHaveBeenCalledTimes(1);
    expect(timers.pending()).toBe(0); // long-press timer was cancelled
    timers.flush(); // nothing left to fire
    expect(cb.onDragStart).not.toHaveBeenCalled();
    g.up(ev({ clientX: 20, clientY: 0 }));
    expect(cb.onTap).not.toHaveBeenCalled(); // moved → not a tap
  });

  it('a small jitter within tolerance keeps the long-press armed', () => {
    const { g, cb, timers } = harness({ moveTolerance: 8 });
    g.down(ev({ clientX: 0, clientY: 0 }));
    g.move(ev({ clientX: 5, clientY: -3 })); // within 8px
    expect(cb.onLongPressCancel).not.toHaveBeenCalled();
    expect(timers.pending()).toBe(1);
    timers.flush();
    expect(cb.onDragStart).toHaveBeenCalledTimes(1);
  });
});

describe('immediate mode — drag begins on pointerdown', () => {
  it('fires onDragStart synchronously, never a long-press or tap', () => {
    const { g, cb, timers } = harness({ dragMode: 'immediate' });
    g.down(ev({ clientX: 10, clientY: 10 }));
    expect(cb.onDragStart).toHaveBeenCalledTimes(1);
    expect(cb.onLongPress).not.toHaveBeenCalled();
    expect(timers.pending()).toBe(0); // no hold timer in immediate mode
    g.move(ev({ clientX: 40, clientY: 12 }));
    expect(cb.onDragMove).toHaveBeenCalledTimes(1);
    g.up(ev({ clientX: 40, clientY: 12 }));
    expect(cb.onDragEnd).toHaveBeenCalledTimes(1);
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('calls preventDefault on pointerdown when configured', () => {
    const { g } = harness({ dragMode: 'immediate', preventDefault: true });
    const pd = vi.fn();
    g.down(ev({ preventDefault: pd }));
    expect(pd).toHaveBeenCalledTimes(1);
  });
});

describe('guards and lifecycle', () => {
  it('ignores non-primary pointers (right/middle mouse button)', () => {
    const { g, cb } = harness();
    const started = g.down(ev({ button: 2 }));
    expect(started).toBe(false);
    expect(cb.onPressStart).not.toHaveBeenCalled();
    expect(g.isActive()).toBe(false);
  });

  it('onPressStart returning false vetoes the gesture (e.g. press missed a card)', () => {
    const { g, cb, timers } = harness({ onPressStart: () => false });
    const started = g.down(ev());
    expect(started).toBe(false);
    expect(g.isActive()).toBe(false);
    expect(timers.pending()).toBe(0);
  });

  it('threads onPressStart data through to later callbacks', () => {
    const { g, cb, timers } = harness({ onPressStart: () => ({ idx: 3 }) });
    g.down(ev());
    timers.flush();
    expect(cb.onDragStart.mock.calls[0][0].data).toEqual({ idx: 3 });
  });

  it('pointercancel during a drag fires onCancel, not onDragEnd', () => {
    const { g, cb, timers } = harness();
    g.down(ev());
    timers.flush();
    g.cancel(ev());
    expect(cb.onCancel).toHaveBeenCalledTimes(1);
    expect(cb.onDragEnd).not.toHaveBeenCalled();
    expect(g.isActive()).toBe(false);
  });

  it('ignores a second concurrent pointer (multitouch) mid-gesture', () => {
    const { g, cb } = harness();
    g.down(ev({ pointerId: 1 }));
    const second = g.down(ev({ pointerId: 2 }));
    expect(second).toBe(false);
    expect(cb.onPressStart).toHaveBeenCalledTimes(1);
  });

  it('reset() drops an in-flight gesture and its pending timer silently', () => {
    const { g, cb, timers } = harness();
    g.down(ev());
    expect(timers.pending()).toBe(1);
    g.reset();
    expect(timers.pending()).toBe(0);
    expect(g.isActive()).toBe(false);
    expect(cb.onCancel).not.toHaveBeenCalled();
  });
});
