// Unit tests for the online-presence module: status resolution (online,
// in-game, offline), multi-socket staying online, and last-socket-offline
// (after the grace window), plus the offline→online transition signal.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const presence = require('../../presence.js');

beforeEach(() => {
  presence._reset();
});

describe('presence — status resolution', () => {
  it('a user with no socket is offline', () => {
    expect(presence.isOnline('u1')).toBe(false);
    expect(presence.statusFor('u1', false)).toBe('offline');
    expect(presence.statusFor('u1', true)).toBe('offline'); // seating is irrelevant when offline
  });

  it('a connected user not seated is online', () => {
    presence.connect('u1', 's1');
    expect(presence.isOnline('u1')).toBe(true);
    expect(presence.statusFor('u1', false)).toBe('online');
  });

  it('a connected user who is seated is in-game', () => {
    presence.connect('u1', 's1');
    expect(presence.statusFor('u1', true)).toBe('in-game');
  });
});

describe('presence — multi-socket', () => {
  it('stays online while at least one tab remains; offline only when the last closes', () => {
    vi.useFakeTimers();
    try {
      presence.configure({ graceMs: 5000 });
      presence.connect('u1', 's1');
      presence.connect('u1', 's2');
      expect(presence.isOnline('u1')).toBe(true);

      presence.disconnect('u1', 's1');         // one tab gone
      expect(presence.isOnline('u1')).toBe(true); // still online via s2 — no grace started

      presence.disconnect('u1', 's2');         // last tab gone → grace begins
      expect(presence.isOnline('u1')).toBe(true); // still "online" during grace (anti-flicker)

      vi.advanceTimersByTime(5000);
      expect(presence.isOnline('u1')).toBe(false); // offline after grace
    } finally {
      vi.useRealTimers();
    }
  });

  it('reconnecting within the grace window cancels going offline', () => {
    vi.useFakeTimers();
    try {
      presence.configure({ graceMs: 5000 });
      presence.connect('u1', 's1');
      presence.disconnect('u1', 's1');           // grace begins
      vi.advanceTimersByTime(3000);
      presence.connect('u1', 's2');              // back before grace elapsed
      vi.advanceTimersByTime(5000);              // original grace would have fired here
      expect(presence.isOnline('u1')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('presence — transition signal (onChange)', () => {
  it('fires on first socket online and last socket offline, but NOT for extra tabs', () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      presence.configure({ graceMs: 1000, onChange });

      expect(presence.connect('u1', 's1')).toBe(true);  // offline → online (real transition)
      expect(onChange).toHaveBeenCalledTimes(1);

      expect(presence.connect('u1', 's2')).toBe(false); // extra tab — not a transition
      expect(onChange).toHaveBeenCalledTimes(1);

      presence.disconnect('u1', 's1');                  // still online via s2
      expect(onChange).toHaveBeenCalledTimes(1);

      presence.disconnect('u1', 's2');                  // last socket → grace
      expect(onChange).toHaveBeenCalledTimes(1);        // not yet — grace pending
      vi.advanceTimersByTime(1000);
      expect(onChange).toHaveBeenCalledTimes(2);        // offline transition fired
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('presence — buildPresenceMap', () => {
  it('maps online users to online/in-game via the seating resolver', () => {
    presence.connect('u1', 's1'); // not seated
    presence.connect('u2', 's2'); // seated
    const seated = (id) => id === 'u2';
    const map = presence.buildPresenceMap(seated);
    expect(map).toEqual({ u1: 'online', u2: 'in-game' });
    expect(presence.onlineUserIds().sort()).toEqual(['u1', 'u2']);
  });
});
