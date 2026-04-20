// Redis-backed write-through persistence for room state.
//
// Design: the in-memory `rooms` Map in roomManager.js stays authoritative.
// Every mutation broadcasts, and broadcasting also fires a save to Redis.
// On startup, server.js loads all rooms from Redis and hydrates the Map.
//
// Failure mode: if Redis is unavailable (no REDIS_URL set, connection drops),
// we log once and continue in-memory-only. The game keeps working; we just
// lose the restart-survivability benefit.
//
// Key layout:
//   coinche:room:{CODE}  →  JSON of the full room object (TTL 24h)
//
// TTL: 24h rolling (refreshed on every save) so abandoned games expire and
// Redis doesn't grow unbounded.

const KEY_PREFIX = 'coinche:room:';
const TTL_SECONDS = 60 * 60 * 24;

let client = null;
let connected = false;
let loggedError = false;

async function connect() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[persistence] REDIS_URL not set — running in-memory only (state lost on restart)');
    return false;
  }

  try {
    // Lazy-require so the package is optional: no REDIS_URL → no connection → no require.
    const { createClient } = require('redis');
    client = createClient({ url });
    client.on('error', (err) => {
      if (!loggedError) {
        console.error('[persistence] redis error:', err.message);
        loggedError = true;
      }
      connected = false;
    });
    client.on('ready', () => {
      loggedError = false;
      connected = true;
    });
    await client.connect();
    connected = true;
    console.log('[persistence] connected to Redis');
    return true;
  } catch (err) {
    console.error('[persistence] failed to connect to Redis:', err.message);
    console.warn('[persistence] continuing in-memory only');
    client = null;
    connected = false;
    return false;
  }
}

// On hydration, drop transient fields that won't survive a restart:
//   - socketIds are all stale (no client is connected to the old server yet)
//   - pendingJoins carry stale socketIds too; safer to clear
//   - in-game rooms need paused=true so the reconnect flow wakes the room up
function sanitizeForHydration(room) {
  for (const p of room.players) {
    p.socketId = null;
    p.connected = false;
  }
  room.pendingJoins = [];
  if (['PLAYING', 'ROUND_OVER', 'SHUFFLE', 'CUT'].includes(room.phase)) {
    room.paused = true;
  }
  return room;
}

async function loadAllRooms() {
  if (!connected) return [];
  try {
    const keys = [];
    for await (const key of client.scanIterator({ MATCH: `${KEY_PREFIX}*`, COUNT: 100 })) {
      keys.push(key);
    }
    if (keys.length === 0) return [];
    const raws = await client.mGet(keys);
    const rooms = [];
    for (const raw of raws) {
      if (!raw) continue;
      try {
        rooms.push(sanitizeForHydration(JSON.parse(raw)));
      } catch (err) {
        console.error('[persistence] corrupt room payload:', err.message);
      }
    }
    console.log(`[persistence] hydrated ${rooms.length} room(s) from Redis`);
    return rooms;
  } catch (err) {
    console.error('[persistence] loadAllRooms failed:', err.message);
    return [];
  }
}

// Fire-and-forget: don't block the hot path on Redis. Errors log once.
function saveRoom(room) {
  if (!connected || !room) return;
  const key = KEY_PREFIX + room.code;
  const payload = JSON.stringify(room);
  client.set(key, payload, { EX: TTL_SECONDS }).catch((err) => {
    if (!loggedError) {
      console.error('[persistence] saveRoom failed:', err.message);
      loggedError = true;
    }
  });
}

function deleteRoom(code) {
  if (!connected) return;
  client.del(KEY_PREFIX + code).catch((err) => {
    if (!loggedError) {
      console.error('[persistence] deleteRoom failed:', err.message);
      loggedError = true;
    }
  });
}

module.exports = { connect, loadAllRooms, saveRoom, deleteRoom };
