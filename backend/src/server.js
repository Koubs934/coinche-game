const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const rm = require('./roomManager');
const { scheduleBotTurns } = require('./botProcessor');

const app = express();
const httpServer = createServer(app);

// Support comma-separated origins so LAN IPs can be added without changing production config
// e.g. FRONTEND_URL=http://localhost:5173,http://192.168.1.42:5173
const FRONTEND_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(u => u.trim());

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_ORIGINS,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: FRONTEND_ORIGINS }));
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
}

function emitError(socket, message) {
  socket.emit('error', { message });
}

// Broadcast + queue the next bot turn (if any) for game-state changes
function broadcastGame(room) {
  broadcast(room);
  scheduleBotTurns(room.code, broadcast);
}

// ─── Socket handlers ───────────────────────────────────────────────────────

io.on('connection', socket => {
  const { userId, username } = socket;

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
  });

  // ── Join room ────────────────────────────────────────────────────────────
  socket.on('joinRoom', ({ code }) => {
    const existing = rm.getRoomForSocket(socket.id);
    if (existing && existing.code !== code) socket.leave(existing.code);

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
    if (!result) return emitError(socket, 'Could not rejoin room');

    socket.join(code);
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

  // ── Play card ────────────────────────────────────────────────────────────
  socket.on('playCard', ({ code, card }) => {
    const result = rm.playCard(code, userId, card);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room);
  });

  // ── Next round ───────────────────────────────────────────────────────────
  socket.on('nextRound', ({ code }) => {
    const result = rm.nextRound(code);
    if (result.error) return emitError(socket, result.error);
    broadcastGame(result.room); // new round may start with a bot bidder
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const result = rm.handleDisconnect(socket.id);
    if (result) broadcast(result.room);
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Coinche server listening on port ${PORT}`);
});
