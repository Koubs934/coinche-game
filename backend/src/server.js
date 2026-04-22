const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const rm = require('./roomManager');
const { scheduleBotTurns, scheduleBotConfirms, scheduleBotShuffleCut } = require('./botProcessor');
const rateLimit = require('./rateLimit');
const persistence = require('./persistence');
const gameRecordStorage = require('./game/gameRecordStorage');
const { registerTrainingHandlers, runStartupCleanup: trainingStartupCleanup } = require('./training/trainingSocket');
// Event payload contract for every socket.on / socket.emit below:
// see socketEvents.js. Update both sides (FE + BE) when changing a payload.
require('./socketEvents');

const app = express();
const httpServer = createServer(app);

// ─── CORS origins ──────────────────────────────────────────────────────────
// FRONTEND_URL is comma-separated so multiple frontends can share the backend
// without a redeploy. In prod on Railway, set to the Vercel URL (and any
// staging URLs). When adding a new frontend, update the env var and restart.
//
// Example:
//   FRONTEND_URL=http://localhost:5173,http://192.168.1.42:5173
//   FRONTEND_URL=https://coinche.vercel.app,https://coinche-staging.vercel.app
//
// Dev-only convenience: when NODE_ENV !== 'production', the origin validator
// additionally accepts any localhost/loopback or RFC1918 private-IP origin
// (10.x, 172.16-31.x, 192.168.x), so a phone on the same Wi-Fi can connect
// to a Vite `--host 0.0.0.0` dev server without editing FRONTEND_URL. This
// branch NEVER fires in production — the allowlist is the only gate there.
const FRONTEND_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(u => u.trim());

const IS_PROD = process.env.NODE_ENV === 'production';

function isPrivateNetworkOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    if (/^10\./.test(hostname))                                           return true;
    if (/^192\.168\./.test(hostname))                                     return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname))                  return true;
    return false;
  } catch {
    return false;
  }
}

function originAllowed(origin, cb) {
  // No Origin header (same-origin, curl, health probe) — allow
  if (!origin) return cb(null, true);
  if (FRONTEND_ORIGINS.includes(origin)) return cb(null, true);
  if (!IS_PROD && isPrivateNetworkOrigin(origin)) return cb(null, true);
  return cb(new Error(`CORS: origin not allowed: ${origin}`));
}

const io = new Server(httpServer, {
  cors: {
    origin: originAllowed,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: originAllowed }));
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));

// ─── Auth middleware ───────────────────────────────────────────────────────

io.use((socket, next) => {
  const { userId, username } = socket.handshake.auth;
  if (!userId || !username) return next(new Error('Authentication required'));
  socket.userId = userId;
  socket.username = username;
  next();
});

// ─── Broadcast helpers ─────────────────────────────────────────────────────

function broadcast(room) {
  for (const player of room.players) {
    const s = io.sockets.sockets.get(player.socketId);
    if (s) {
      s.emit('roomUpdate', {
        room: rm.publicRoom(room),
        game: rm.publicGame(room, player.position),
        myPosition: player.position,
      });
    }
  }
  // Persist after broadcast. Fire-and-forget; in-memory Map stays authoritative.
  persistence.saveRoom(room);
}

function emitError(socket, message) {
  socket.emit('error', { message });
}

// Persist the just-finished round as a GameRecord and notify the room creator.
// Guarded by room.game.gameId so a second broadcast of the same ROUND_OVER
// phase (e.g. through bot confirm cascades) does not rewrite the file.
function maybeSaveGameRecord(room) {
  const g = room.game;
  if (!g || !g.gameId) return;
  if (g.phase !== 'ROUND_OVER') return;
  if (room._lastSavedGameId === g.gameId) return;

  try {
    const record = rm.buildGameRecord(room);
    const filePath = gameRecordStorage.writeGameRecord(record);
    room._lastSavedGameId = g.gameId;

    // Notify the room creator. Skip silently if they're not connected — no
    // retry buffering; file write is the authoritative result.
    const creator = room.players.find(p => p.userId === room.creatorId);
    const creatorSocket = creator ? io.sockets.sockets.get(creator.socketId) : null;
    if (creatorSocket) {
      creatorSocket.emit('gameRecordSaved', { gameId: g.gameId, filePath });
    }
  } catch (err) {
    console.error(`[gameRecord] save failed for room ${room.code}: ${err.message}`);
  }
}

// Broadcast + queue the next bot turn (if any) for game-state changes.
// When the round just ended, schedule bot auto-confirms instead of bot turns.
function broadcastGame(room) {
  broadcast(room);
  if (room.phase === 'ROUND_OVER') {
    maybeSaveGameRecord(room);
    scheduleBotConfirms(room.code, broadcastGame);
  } else if (room.phase === 'GAME_OVER') {
    maybeSaveGameRecord(room);
  } else if (room.phase === 'SHUFFLE' || room.phase === 'CUT') {
    scheduleBotShuffleCut(room.code, broadcastGame);
  } else {
    scheduleBotTurns(room.code, broadcastGame);
  }
}

// ─── Socket handlers ───────────────────────────────────────────────────────

io.on('connection', socket => {
  const { userId, username } = socket;

  // Rate-limit every event from this socket. Normal play emits ~1 event/sec;
  // 30/sec is well above that and still stops a spammy client from wedging
  // the server or triggering bot cascades.
  socket.use((packet, next) => {
    const event = packet[0];
    if (!rateLimit.allow(`${socket.id}:${event}`, 30, 1000)) {
      emitError(socket, 'Too many requests — slow down');
      return; // drop the packet
    }
    next();
  });

  // ── Create room ──────────────────────────────────────────────────────────
  socket.on('createRoom', () => {
    // Leave any existing room
    const existing = rm.getRoomForSocket(socket.id);
    if (existing) socket.leave(existing.code);

    const room = rm.createRoom({ userId, username, socketId: socket.id });
    socket.join(room.code);
    socket.emit('roomJoined', {
      room: rm.publicRoom(room),
      game: rm.publicGame(room, 0),
      myPosition: 0,
    });
    persistence.saveRoom(room);
  });

  // ── Join room ────────────────────────────────────────────────────────────
  socket.on('joinRoom', ({ code }) => {
    const existing = rm.getRoomForSocket(socket.id);
    if (existing && existing.code !== code) socket.leave(existing.code);

    // If the room is already in-game, handle based on whether the joiner is the creator
    const peek = rm.getRoom(code);
    if (peek && peek.phase !== 'LOBBY') {
      if (peek.creatorId === userId) {
        // Creator bypasses approval — seats directly
        const result = rm.creatorJoin(code, { userId, username, socketId: socket.id });
        if (result.error) return emitError(socket, result.error);
        socket.join(code);
        socket.emit('roomJoined', {
          room: rm.publicRoom(result.room),
          game: rm.publicGame(result.room, result.position),
          myPosition: result.position,
        });
        broadcastGame(result.room);
      } else {
        // Non-admin: create a pending join request for the creator to approve
        const result = rm.requestJoin(code, { userId, username, socketId: socket.id });
        if (result.error) return emitError(socket, result.error);
        socket.join(code);
        socket.emit('joinPending', { code });
        if (!result.alreadyPending) broadcast(result.room);
      }
      return;
    }

    const result = rm.joinRoom(code, { userId, username, socketId: socket.id });
    if (result.error) return emitError(socket, result.error);

    socket.join(code);
    const room = result.room;
    const position = rm.getPosition(room, userId);

    socket.emit('roomJoined', {
      room: rm.publicRoom(room),
      game: rm.publicGame(room, position),
      myPosition: position,
    });
    broadcast(room);
  });

  // ── Rejoin after disconnect ──────────────────────────────────────────────
  socket.on('rejoinRoom', ({ code }) => {
    const result = rm.handleReconnect(socket.id, code, userId);
    if (!result) {
      // Not in room anymore (e.g. removed by admin) — clear client state
      socket.emit('leftRoom');
      return;
    }

    socket.join(code);

    if (result.pending) {
      // Was a pending join requester — re-show waiting screen
      socket.emit('joinPending', { code });
      return;
    }

    const { room, player } = result;
    socket.emit('roomJoined', {
      room: rm.publicRoom(room),
      game: rm.publicGame(room, player.position),
      myPosition: player.position,
    });
    broadcast(room);
  });

  // ── Fill with bots ───────────────────────────────────────────────────────
  socket.on('fillWithBots', ({ code }) => {
    const result = rm.fillWithBots(code, userId);
    if (result.error) return emitError(socket, result.error);
    broadcast(result.room); // lobby broadcast, no bot scheduling needed yet
  });

  // ── Team / settings ──────────────────────────────────────────────────────
  socket.on('assignTeam', ({ code, targetUserId, team }) => {
    const result = rm.assignTeam(code, userId, targetUserId, team);
    if (result.error) return emitError(socket, result.error);
    broadcast(result.room);
  });

  socket.on('setTargetScore', ({ code, targetScore }) => {
    const result = rm.setTargetScore(code, userId, targetScore);
    if (result.error) return emitError(socket, result.error);
    broadcast(result.room);
  });

  // ── Start game ───────────────────────────────────────────────────────────
  socket.on('startGame', ({ code }) => {
    const result = rm.startGame(code, userId);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room); // may need to kick off bot bidding immediately
  });

  // ── Bidding ──────────────────────────────────────────────────────────────
  socket.on('placeBid', ({ code, value, suit }) => {
    const result = rm.placeBid(code, userId, value, suit);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room);
  });

  socket.on('passBid', ({ code }) => {
    const result = rm.passBid(code, userId);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room);
  });

  socket.on('coinche', ({ code }) => {
    const result = rm.coinche(code, userId);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room);
  });

  socket.on('surcoinche', ({ code }) => {
    const result = rm.surcoinche(code, userId);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room);
  });

  // ── Undo last action (creator only) ─────────────────────────────────────
  socket.on('undoLastAction', ({ code }) => {
    const result = rm.undoLastAction(code, userId);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room);
  });

  // ── Play card ────────────────────────────────────────────────────────────
  socket.on('playCard', ({ code, card, declareBelote }) => {
    const result = rm.playCard(code, userId, card, declareBelote);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room);
  });

  // ── Game Review: tag an error card (creator only) ────────────────────────
  socket.on('createGameErrorAnnotation', ({ gameId, cardRef, note }) => {
    const result = rm.createGameErrorAnnotation(gameId, userId, cardRef, note);
    if (result.error) return socket.emit('error', { message: result.error, code: result.code });

    socket.emit('gameErrorAnnotationCreated', { gameId, annotation: result.annotation });
    // Broadcast the updated game state so the client's publicGame.errorAnnotations
    // stays in sync. Non-creators can't see the annotations UI but the payload is
    // harmless metadata and keeping one code path simple is worth it here.
    broadcast(result.room);
  });

  socket.on('getCurrentGameState', ({ gameId }) => {
    const room = rm.getRoomByGameId(gameId);
    if (!room) return socket.emit('error', { message: 'Unknown game', code: 'UNKNOWN_GAME' });
    const player = room.players.find(p => p.userId === userId);
    if (!player) return socket.emit('error', { message: 'Not in this room' });
    socket.emit('roomUpdate', {
      room: rm.publicRoom(room),
      game: rm.publicGame(room, player.position),
      myPosition: player.position,
    });
  });

  // ── Shuffle / Cut ────────────────────────────────────────────────────────
  socket.on('shuffleDeck', ({ code }) => {
    const result = rm.shuffleDeck(code, userId);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room);
  });

  socket.on('skipShuffle', ({ code }) => {
    const result = rm.skipShuffle(code, userId);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room);
  });

  socket.on('cutDeck', ({ code, n }) => {
    const result = rm.doCutDeck(code, userId, n);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room);
  });

  socket.on('skipCut', ({ code }) => {
    const result = rm.skipCut(code, userId);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room);
  });

  // ── Next round (per-player confirmation) ─────────────────────────────────
  socket.on('confirmNextRound', ({ code }) => {
    const result = rm.confirmNextRound(code, userId);
    if (result.error) return emitError(socket, result.error);
    if (result.started) {
      broadcastGame(result.room); // new round started — may need bot bidding
    } else {
      broadcast(result.room); // just update the ready-count for all clients
    }
  });

  // ── Leave room (intentional) ─────────────────────────────────────────────
  socket.on('leaveRoom', ({ code }) => {
    const result = rm.leaveRoom(code, userId);
    if (result.error) return emitError(socket, result.error);

    socket.leave(code);
    socket.emit('leftRoom');
    // result.room is null only if the lobby was deleted (no human players remain)
    if (result.room) broadcast(result.room);
    if (result.deleted) persistence.deleteRoom(code);
  });

  // ── Remove player (creator only) ─────────────────────────────────────────
  socket.on('removePlayer', ({ code, targetUserId }) => {
    const result = rm.removePlayer(code, userId, targetUserId);
    if (result.error) return emitError(socket, result.error);
    if (result.removedSocketId) {
      const s = io.sockets.sockets.get(result.removedSocketId);
      if (s) { s.leave(code); s.emit('leftRoom'); }
    }
    broadcast(result.room);
  });

  // ── Accept pending join request (creator only) ────────────────────────────
  socket.on('acceptJoin', ({ code, targetUserId }) => {
    const result = rm.acceptJoin(code, userId, targetUserId);
    if (result.error) return emitError(socket, result.error);
    const { room, acceptedSocketId, acceptedPosition } = result;
    if (acceptedSocketId) {
      const s = io.sockets.sockets.get(acceptedSocketId);
      if (s) {
        s.join(code);
        s.emit('roomJoined', {
          room: rm.publicRoom(room),
          game: rm.publicGame(room, acceptedPosition),
          myPosition: acceptedPosition,
        });
      }
    }
    broadcastGame(room); // may resume bot scheduling if game unpaused
  });

  // ── Cancel pending join request ───────────────────────────────────────────
  socket.on('cancelJoinRequest', ({ code }) => {
    const result = rm.cancelJoinRequest(code, userId);
    socket.leave(code);
    if (!result.error && result.room) broadcast(result.room);
  });

  // ── Training mode ────────────────────────────────────────────────────────
  // Parallel subsystem; does not touch rm, botProcessor, or persistence.
  const training = registerTrainingHandlers(socket);
  training.surfaceResumableOnConnect();

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    rateLimit.clearSocket(socket.id);
    const result = rm.handleDisconnect(socket.id);
    if (result) broadcast(result.room);
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

async function start() {
  // Try to hydrate from Redis before accepting connections. If Redis is
  // unavailable we continue in-memory only.
  await persistence.connect();
  const persistedRooms = await persistence.loadAllRooms();
  rm.hydrateRooms(persistedRooms);

  // Promote stale training partials to abandoned-partial and prime scenario cache.
  trainingStartupCleanup();

  httpServer.listen(PORT, () => {
    console.log(`Coinche server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
