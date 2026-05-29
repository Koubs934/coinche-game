// ─── Online presence tracking ────────────────────────────────────────────────
//
// Tracks which users currently have a live socket, so the lobby can show
// "Amis en ligne". A user may have several tabs open → we keep a SET of socket
// ids per user and only consider them offline once the LAST socket is gone.
//
// To avoid flicker during brief reconnects (refresh, network blip), a user who
// loses their last socket is kept "online" for a short grace period; if no new
// socket arrives in that window they transition to offline.
//
// Status (resolved together with roomManager seating, injected by the caller so
// this module stays dependency-free + unit-testable):
//   offline  — no live socket
//   in-game  — online AND seated in a room
//   online   — online, not seated
//
// `onChange` fires ONLY on real visible transitions — a user's FIRST socket
// connecting, or their LAST socket going offline after the grace window. It does
// NOT fire for additional tabs opening/closing while already online, nor for
// room enter/leave (the server emits the presence ping for those separately,
// since seating lives in roomManager, not here).

const DEFAULT_GRACE_MS = 5000;

let graceMs = DEFAULT_GRACE_MS;
let onChange = () => {};

const userSockets = new Map(); // userId -> Set<socketId>
const graceTimers = new Map(); // userId -> timeout id (pending offline)

function configure({ graceMs: g, onChange: cb } = {}) {
  if (typeof g === 'number') graceMs = g;
  if (typeof cb === 'function') onChange = cb;
}

// Register a socket for a user. Returns true if this was a real offline→online
// transition (the user had no prior presence at all), false if they were already
// online (another tab, or still within the grace window).
function connect(userId, socketId) {
  if (!userId || !socketId) return false;
  // Cancel any pending offline grace — they're back.
  const pending = graceTimers.get(userId);
  if (pending) { clearTimeout(pending); graceTimers.delete(userId); }

  const wasPresent = userSockets.has(userId); // online OR mid-grace
  let set = userSockets.get(userId);
  if (!set) { set = new Set(); userSockets.set(userId, set); }
  set.add(socketId);

  if (!wasPresent) { onChange(); return true; }
  return false;
}

// Unregister a socket. If it was the user's last socket, start the grace timer;
// the offline transition (and onChange) only fires if no socket returns in time.
function disconnect(userId, socketId) {
  if (!userId || !socketId) return;
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size > 0) return; // still online via another tab

  // Last socket gone — defer going offline by the grace window.
  const timer = setTimeout(() => {
    graceTimers.delete(userId);
    const current = userSockets.get(userId);
    if (!current || current.size === 0) {
      userSockets.delete(userId);
      onChange();
    }
  }, graceMs);
  // Don't keep the event loop alive just for a presence timer.
  if (typeof timer.unref === 'function') timer.unref();
  graceTimers.set(userId, timer);
}

// Online if they have a live socket OR are within the grace window (entry still
// present, treated as online to avoid flicker).
function isOnline(userId) {
  return userSockets.has(userId);
}

// Resolve a single user's status. `seated` is whether roomManager has them in a
// room — passed in by the caller to keep this module dependency-free.
function statusFor(userId, seated) {
  if (!isOnline(userId)) return 'offline';
  return seated ? 'in-game' : 'online';
}

// Build { userId: 'online'|'in-game' } for every currently-online user. Users
// not present in the map are offline. `isSeated(userId)` is supplied by caller.
function buildPresenceMap(isSeated) {
  const map = {};
  for (const userId of userSockets.keys()) {
    map[userId] = isSeated && isSeated(userId) ? 'in-game' : 'online';
  }
  return map;
}

function onlineUserIds() {
  return [...userSockets.keys()];
}

// Test-only: wipe all state + timers back to defaults.
function _reset() {
  for (const t of graceTimers.values()) clearTimeout(t);
  userSockets.clear();
  graceTimers.clear();
  graceMs = DEFAULT_GRACE_MS;
  onChange = () => {};
}

module.exports = {
  configure,
  connect,
  disconnect,
  isOnline,
  statusFor,
  buildPresenceMap,
  onlineUserIds,
  _reset,
  DEFAULT_GRACE_MS,
};
