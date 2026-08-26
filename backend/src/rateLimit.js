// Simple sliding-window rate limiter keyed by socket + event.
// In-memory only — resets on server restart. Sufficient to block spam and
// accidental client bugs; not a DDoS defense (that belongs in front of us).

const buckets = new Map(); // key -> { windowStart, count, windowMs }

// IP-keyed buckets (authRoutes.js) have no disconnect hook, so without a
// sweep they'd accumulate one entry per client IP forever. Above this size,
// expired buckets are evicted opportunistically on the next allow() call —
// deleting an expired bucket is a no-op behaviourally (it would be reset on
// its next hit anyway).
const SWEEP_THRESHOLD = 5000;

function sweepExpired(now) {
  for (const [key, b] of buckets) {
    if (now - b.windowStart >= (b.windowMs || 60_000)) buckets.delete(key);
  }
}

/**
 * Returns true if the action is allowed, false if it should be dropped.
 * @param {string} key  unique per socket+event (e.g. `${socket.id}:playCard`)
 *                      or per client IP (`${req.ip}:resolveEmail`)
 * @param {number} max  maximum events allowed in the window
 * @param {number} windowMs  window size in ms
 */
function allow(key, max, windowMs) {
  const now = Date.now();
  if (buckets.size > SWEEP_THRESHOLD) sweepExpired(now);
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, count: 1, windowMs });
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
