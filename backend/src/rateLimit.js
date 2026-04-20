// Simple sliding-window rate limiter keyed by socket + event.
// In-memory only — resets on server restart. Sufficient to block spam and
// accidental client bugs; not a DDoS defense (that belongs in front of us).

const buckets = new Map(); // key -> { windowStart, count }

/**
 * Returns true if the action is allowed, false if it should be dropped.
 * @param {string} key  unique per socket+event (e.g. `${socket.id}:playCard`)
 * @param {number} max  maximum events allowed in the window
 * @param {number} windowMs  window size in ms
 */
function allow(key, max, windowMs) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return true;
  }
  bucket.count++;
  return bucket.count <= max;
}

/** Release the socket's buckets on disconnect so the map doesn't grow. */
function clearSocket(socketId) {
  for (const key of buckets.keys()) {
    if (key.startsWith(`${socketId}:`)) buckets.delete(key);
  }
}

module.exports = { allow, clearSocket };
