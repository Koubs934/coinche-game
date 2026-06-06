const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const rm = require('./roomManager');
const presence = require('./presence');
const { scheduleBotTurns, scheduleBotConfirms, scheduleBotShuffleCut, cancelBotSchedules } = require('./botProcessor');
const rateLimit = require('./rateLimit');
const persistence = require('./persistence');
const gameRecordStorage = require('./game/gameRecordStorage');
const { registerTrainingHandlers, runStartupCleanup: trainingStartupCleanup } = require('./training/trainingSocket');
const claudeService = require('./services/claudeService');
const personalFeuilleService = require('./services/personalFeuille');
const { caseTypeFor } = require('./training/divergence');
const { loadFeuille, buildConversationHistory, stripCaptureRules } = require('./training/conversationContext');
const cardFeatures = require('./game/cardFeatures');
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

// ─── V2.2 Claude conversational annotation (Phase 1) ──────────────────────
// Three endpoints attach a Socratic-detective conversation to an existing
// "Pas d'accord" annotation. State lives in the annotation file itself
// under `claude_conversation` (schemaVersion 4). No socket.io path here —
// the FE polls/streams via plain HTTP since the conversation is bound to
// a specific annotation file, not a live game room.

const TRAINING_ROOT = () => process.env.TRAINING_DATA_DIR
  || path.join(__dirname, '..', 'data', 'training');
const SCENARIOS_DIR = path.join(__dirname, 'training', 'scenarios');
// loadFeuille + FEUILLE_PATH now live in ./training/conversationContext (shared
// with the offline eval harness); imported above.

function safeUserSeg(userId) {
  return String(userId).replace(/[\\/]/g, '_');
}

function annotationPath(userId, filename) {
  // Defence-in-depth: filename must be a flat .json file, no path traversal.
  const safe = String(filename);
  if (!safe.endsWith('.json'))               throw new Error('annotationFilename must be a .json file');
  if (safe.includes('/') || safe.includes('\\') || safe.includes('..')) {
    throw new Error('annotationFilename must not contain path separators');
  }
  return path.join(TRAINING_ROOT(), safeUserSeg(userId), safe);
}

function readAnnotation(userId, filename) {
  const p = annotationPath(userId, filename);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeAnnotationAtomic(userId, filename, record) {
  const target = annotationPath(userId, filename);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2));
  fs.renameSync(tmp, target);
}

function loadScenario(scenarioId) {
  const p = path.join(SCENARIOS_DIR, `${scenarioId}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// last 10 completed annotations of this user, excluding the current file
// and the _exhausted.json sidecar. Sorted by completedAt desc.
function loadPastAnnotations(userId, currentFilename) {
  const dir = path.join(TRAINING_ROOT(), safeUserSeg(userId));
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.json'))         continue;
    if (entry === currentFilename)        continue;
    if (entry.startsWith('_'))            continue; // _exhausted.json etc.
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8'));
      if (rec.status !== 'complete') continue;
      out.push(rec);
    } catch {
      // skip corrupt files silently — best-effort context
    }
  }
  out.sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
  return out.slice(0, 10);
}

function nowIso() { return new Date().toISOString(); }

// V2.2 Phase 3 — pull every CAPTURE_RULE line out of a Claude message,
// append each as a [PROPOSED] entry to the user's personal feuille, and
// return the cleaned message that the FE will see + the raw rules for
// logging. Best-effort persistence: a filesystem error logs but never
// breaks the conversation flow (the user would never know).
function captureAndStrip(rawText, { userId, scenarioId, userName }) {
  // stripCaptureRules is the shared strip entry (training/conversationContext),
  // also used by the eval so it judges the same post-strip text users see.
  const { rules, cleanText } = stripCaptureRules(rawText);
  if (rules.length === 0) return { cleanText, rules };
  for (const ruleText of rules) {
    try {
      personalFeuilleService.appendProposedRule(userId, ruleText, scenarioId, userName);
      console.log(`[feuille] Captured PROPOSED rule for ${userId}: ${ruleText}`);
    } catch (err) {
      console.error('[feuille] Failed to append rule:', err.message);
    }
  }
  return { cleanText, rules };
}

function buildContext(userId, annotation, currentFilename) {
  const scenario = loadScenario(annotation.scenarioId);
  if (!scenario) throw new Error(`scenario not found: ${annotation.scenarioId}`);
  return {
    scenario,
    feuilleContent:  loadFeuille(),
    userName:        annotation.username || 'l\'utilisateur',
    pastAnnotations: loadPastAnnotations(userId, currentFilename),
  };
}

app.post('/api/conversation/start', async (req, res) => {
  const { userId, annotationFilename } = req.body || {};
  if (!userId || !annotationFilename) {
    return res.status(400).json({ error: 'userId and annotationFilename required' });
  }
  let annotation;
  try {
    annotation = readAnnotation(userId, annotationFilename);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!annotation) return res.status(404).json({ error: 'annotation not found' });
  // V2.2 Phase 2C: rule-silent annotations are also written with
  // divergenceAgreement === 'user-disagrees' (server-canonical). The only
  // case without a conversation is the match path, where divergenceType
  // is null. Match annotations skip the completion screen entirely on the
  // FE and never hit this endpoint, but guard defensively for direct API
  // callers (curl, smoke test).
  const decision = annotation.decisions?.[0];
  if (!decision || decision.divergenceType === null) {
    return res.status(400).json({ error: 'conversation only available for divergent or rule-silent annotations' });
  }
  if (annotation.claude_conversation && !annotation.claude_conversation.ended_at) {
    return res.status(400).json({ error: 'conversation already started for this annotation' });
  }

  let context;
  try {
    context = buildContext(userId, annotation, annotationFilename);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const caseType = caseTypeFor(decision.divergenceType);

  let result;
  try {
    result = await claudeService.startConversation({
      scenario: context.scenario,
      annotation,
      userId,
      userName: context.userName,
      pastAnnotations: context.pastAnnotations,
      feuilleContent: context.feuilleContent,
      caseType,
    });
  } catch (err) {
    console.error('[conversation/start] Anthropic call failed:', err.message);
    return res.status(502).json({ error: 'Claude API call failed', detail: err.message });
  }

  // V2.2 Phase 3 — extract CAPTURE_RULE lines, persist each as a
  // [PROPOSED] entry on the user's personal feuille, and strip them from
  // both the response sent to the FE and the message persisted on disk
  // (so re-loading the conversation later doesn't re-leak them).
  const { cleanText } = captureAndStrip(result.text, {
    userId,
    scenarioId: annotation.scenarioId,
    userName:   context.userName,
  });

  const startedAt = nowIso();
  annotation.schemaVersion = 4;
  annotation.claude_conversation = {
    started_at:      startedAt,
    messages: [
      { role: 'claude', content: cleanText, timestamp: startedAt },
    ],
    card_selections: [],
    rule_candidates: [],
    ended_at:        null,
    ended_reason:    null,
  };
  writeAnnotationAtomic(userId, annotationFilename, annotation);
  return res.json({ message: cleanText, usage: result.usage });
});

// V2.2 Phase 2C — POST /api/conversation/select-cards
// Same shape as /start but the FE attaches the cards the user selected
// on the completion screen ("which cards motivated your bid?"). The
// server computes recognized coinche patterns from the selection (via
// cardFeatures) and feeds both the raw cards and the patterns into
// Claude's system prompt + first user message, so Claude's opening
// question can lean on what the user said matters.
//
// Allowed only BEFORE any user turn — once the conversation has user
// messages, it's too late to inject a fresh opening. If the FE called
// /start first (zero user turns yet), we overwrite the prior opening.
app.post('/api/conversation/select-cards', async (req, res) => {
  const { userId, annotationFilename, selectedCards } = req.body || {};
  if (!userId || !annotationFilename || !Array.isArray(selectedCards)) {
    return res.status(400).json({ error: 'userId, annotationFilename, selectedCards (array) required' });
  }
  // Shape-check each entry.
  const VALID_VALUES = new Set(['7', '8', '9', '10', 'J', 'Q', 'K', 'A']);
  const VALID_SUITS  = new Set(['S', 'H', 'D', 'C']);
  for (const c of selectedCards) {
    if (!c || !VALID_VALUES.has(c.value) || !VALID_SUITS.has(c.suit)) {
      return res.status(400).json({ error: `invalid card: ${JSON.stringify(c)}` });
    }
  }

  let annotation;
  try {
    annotation = readAnnotation(userId, annotationFilename);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!annotation) return res.status(404).json({ error: 'annotation not found' });
  const decision = annotation.decisions?.[0];
  if (!decision || decision.divergenceType === null) {
    return res.status(400).json({ error: 'card selection only available for divergent or rule-silent annotations' });
  }

  // Reject if the conversation already has any user turn (too late to
  // re-seed). Allow re-call if it only has Claude's opening — we'll
  // overwrite that opening with the cards-aware version.
  const conv = annotation.claude_conversation;
  if (conv) {
    if (conv.ended_at)                              return res.status(400).json({ error: 'conversation already ended' });
    const hasUserTurn = (conv.messages || []).some(m => m.role === 'user');
    if (hasUserTurn) return res.status(400).json({ error: 'cannot select cards after the conversation started' });
  }

  // Load the user's full hand from the scenario, then narrow down to the
  // selection. Defensive check: every selected card must be in hand,
  // catches a buggy FE that sends e.g. card values from another seat.
  let context;
  try {
    context = buildContext(userId, annotation, annotationFilename);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  const userSeat = context.scenario.userSeat;
  const userHand = context.scenario.hands?.[String(userSeat)] || [];
  for (const c of selectedCards) {
    if (!userHand.some(h => h.suit === c.suit && h.value === c.value)) {
      return res.status(400).json({ error: `card not in hand: ${JSON.stringify(c)}` });
    }
  }

  const trumpSuit = decision.action?.type === 'bid' ? decision.action.suit : null;
  const features  = cardFeatures.computeFeatures(selectedCards, trumpSuit);
  const cardSelection = { selectedCards: features.selectedCards, features };
  const caseType = caseTypeFor(decision.divergenceType);

  let result;
  try {
    result = await claudeService.startConversation({
      scenario:        context.scenario,
      annotation,
      userId,
      userName:        context.userName,
      pastAnnotations: context.pastAnnotations,
      feuilleContent:  context.feuilleContent,
      caseType,
      cardSelection,
    });
  } catch (err) {
    console.error('[conversation/select-cards] Anthropic call failed:', err.message);
    return res.status(502).json({ error: 'Claude API call failed', detail: err.message });
  }

  // V2.2 Phase 3 — extract + persist CAPTURE_RULE lines (see /start).
  const { cleanText } = captureAndStrip(result.text, {
    userId,
    scenarioId: annotation.scenarioId,
    userName:   context.userName,
  });

  const startedAt = nowIso();
  annotation.schemaVersion = 4;
  annotation.claude_conversation = {
    started_at:     startedAt,
    messages: [
      { role: 'claude', content: cleanText, timestamp: startedAt },
    ],
    // Append, don't overwrite — preserves audit trail if the FE ever
    // resubmits the selection (e.g. user backed out and reselected).
    card_selections: [
      ...(conv?.card_selections || []),
      {
        timestamp:     startedAt,
        selectedCards: features.selectedCards,
        trumpSuit:     features.trumpSuit,
        patterns:      features.patterns,
      },
    ],
    rule_candidates: conv?.rule_candidates || [],
    ended_at:        null,
    ended_reason:    null,
  };
  writeAnnotationAtomic(userId, annotationFilename, annotation);
  return res.json({ message: cleanText, usage: result.usage });
});

app.post('/api/conversation/turn', async (req, res) => {
  const { userId, annotationFilename, userMessage } = req.body || {};
  if (!userId || !annotationFilename || typeof userMessage !== 'string' || !userMessage.trim()) {
    return res.status(400).json({ error: 'userId, annotationFilename, userMessage required' });
  }
  let annotation;
  try {
    annotation = readAnnotation(userId, annotationFilename);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!annotation) return res.status(404).json({ error: 'annotation not found' });
  const conv = annotation.claude_conversation;
  if (!conv)              return res.status(400).json({ error: 'no conversation on this annotation' });
  if (conv.ended_at)      return res.status(400).json({ error: 'conversation already ended' });

  let context;
  try {
    context = buildContext(userId, annotation, annotationFilename);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  // V2.2 Phase 2C: rehydrate the most recent card selection (if any)
  // so the seed message and system prompt stay consistent across turns.
  // The FE doesn't echo the selection on /turn — backend is canonical.
  const lastSelection = (conv.card_selections || [])[conv.card_selections?.length - 1];
  const cardSelection = lastSelection
    ? {
        selectedCards: lastSelection.selectedCards,
        features: cardFeatures.computeFeatures(lastSelection.selectedCards, lastSelection.trumpSuit ?? null),
      }
    : null;

  // Rebuild the seed scenario message so Claude has context on every turn.
  // We don't store it in `messages[]` (FE doesn't need to render the synthetic
  // seed) but we always prepend it before calling the API. Shared with the eval
  // harness via buildConversationHistory (./training/conversationContext).
  const conversationHistory = buildConversationHistory(context.scenario, annotation, cardSelection, conv.messages);

  let result;
  try {
    result = await claudeService.continueConversation({
      conversationHistory,
      userMessage,
      context: {
        feuilleContent:  context.feuilleContent,
        userId,
        userName:        context.userName,
        pastAnnotations: context.pastAnnotations,
        caseType:        caseTypeFor(annotation.decisions?.[0]?.divergenceType),
        cardSelection,
      },
    });
  } catch (err) {
    console.error('[conversation/turn] Anthropic call failed:', err.message);
    return res.status(502).json({ error: 'Claude API call failed', detail: err.message });
  }

  // V2.2 Phase 3 — extract + persist CAPTURE_RULE lines (see /start).
  // Stripping before persistence is critical here: on the next /turn we
  // rebuild the conversation history from conv.messages and feed it back
  // to Claude, so any unstripped CAPTURE_RULE would loop forever.
  const { cleanText } = captureAndStrip(result.text, {
    userId,
    scenarioId: annotation.scenarioId,
    userName:   context.userName,
  });

  const userTs = nowIso();
  conv.messages.push({ role: 'user', content: userMessage, timestamp: userTs });
  conv.messages.push({ role: 'claude', content: cleanText, timestamp: nowIso() });
  writeAnnotationAtomic(userId, annotationFilename, annotation);
  return res.json({ message: cleanText, usage: result.usage });
});

// V2.2 calibration follow-up — `reason` accepts:
//   'skip'        — user closed without typing a message
//   'completed'   — user typed at least one message before closing
//   'navigation'  — user navigated away (Scénario suivant / Retour aux
//                   scénarios) without explicitly closing; fired by the
//                   ClaudeConversation unmount cleanup, best-effort.
//
// Idempotent: a second call on an already-ended conversation returns 200
// with {ok:true, already_ended:true} and does NOT overwrite the original
// ended_at / ended_reason. This preserves the explicit "completed" / "skip"
// reason when the unmount cleanup races against a successful "Terminer la
// discussion" click.
const VALID_END_REASONS = new Set(['skip', 'completed', 'navigation']);

app.post('/api/conversation/end', (req, res) => {
  const { userId, annotationFilename, reason } = req.body || {};
  if (!userId || !annotationFilename || !VALID_END_REASONS.has(reason)) {
    return res.status(400).json({ error: 'userId, annotationFilename, reason required (skip|completed|navigation)' });
  }
  let annotation;
  try {
    annotation = readAnnotation(userId, annotationFilename);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!annotation)                    return res.status(404).json({ error: 'annotation not found' });
  if (!annotation.claude_conversation) return res.status(400).json({ error: 'no conversation on this annotation' });
  if (annotation.claude_conversation.ended_at) {
    return res.json({ ok: true, already_ended: true });
  }
  annotation.claude_conversation.ended_at = nowIso();
  annotation.claude_conversation.ended_reason = reason;
  writeAnnotationAtomic(userId, annotationFilename, annotation);
  return res.json({ ok: true });
});

// ─── Auth middleware ───────────────────────────────────────────────────────

io.use((socket, next) => {
  const { userId, username, avatarConfig } = socket.handshake.auth;
  if (!userId || !username) return next(new Error('Authentication required'));
  socket.userId = userId;
  socket.username = username;
  // Avatar config is an opaque cosmetic blob relayed to other clients. The
  // backend never inspects its fields (it stays Supabase-free); it only caps
  // size + shape so a client can't push something huge or non-object.
  socket.avatarConfig = sanitizeAvatarConfig(avatarConfig);
  next();
});

// Accept only a plain object that serializes under a small cap; anything else
// (oversized, array, string, etc.) → null (the client renders the letter
// fallback). The FE clamps the actual field values on render, so we don't need
// to know the avataaars schema here.
const AVATAR_CONFIG_MAX_BYTES = 2048;
function sanitizeAvatarConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  try {
    const json = JSON.stringify(raw);
    if (json.length > AVATAR_CONFIG_MAX_BYTES) return null;
    return JSON.parse(json); // strip any prototype tricks; plain data only
  } catch {
    return null;
  }
}

// If a create/join/rejoin payload carries an avatarConfig, refresh the value the
// socket relays so edits made since connect take effect on the next join. A
// payload without the key leaves the handshake value untouched.
function refreshAvatar(socket, data) {
  if (data && 'avatarConfig' in data) {
    socket.avatarConfig = sanitizeAvatarConfig(data.avatarConfig);
  }
}

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

// Replay the room's recent table-chat history to a single socket. Called on
// every (re)join so a player who refreshes / reconnects sees the conversation
// so far. Sends an empty list for a fresh room — harmless and keeps the FE's
// load path uniform.
function sendChatHistory(socket, room) {
  socket.emit('chat:history', { messages: room?.chatMessages || [] });
}

// Ping every connected socket that the set of active rooms changed (created /
// joined / left / started / membership). Home-screen clients re-request
// 'lobby:getRooms'; everyone else ignores it. One tiny fan-out, only on
// lifecycle transitions — never on per-card/bid mutations.
function broadcastLobbyChanged() {
  io.emit('lobby:roomsChanged');
}

// Tiny fan-out ping when a user's PRESENCE changes — online/offline (from the
// presence module) or in-game/online (room enter/leave, fired by the handlers
// below). Home-screen clients re-request 'lobby:getFriends'; never fired on
// per-card/bid mutations.
function broadcastPresenceChanged() {
  io.emit('lobby:presenceChanged');
}

// Presence transitions (first socket online / last socket offline) ping the
// lobby. Room enter/leave transitions are pinged inline by the handlers.
presence.configure({ onChange: broadcastPresenceChanged });

// Abandoned-room cleanup: when roomManager deletes a dead room (no human keeping
// it alive), cancel its pending bot turns, drop it from Redis, and refresh
// lobbies. Grace window is configurable via DEAD_ROOM_GRACE_MS (ms); default 4 min.
const DEAD_ROOM_GRACE_MS = Number(process.env.DEAD_ROOM_GRACE_MS);
rm.configureCleanup({
  graceMs: Number.isFinite(DEAD_ROOM_GRACE_MS) ? DEAD_ROOM_GRACE_MS : undefined,
  onRoomDeleted: (code) => {
    cancelBotSchedules(code);
    persistence.deleteRoom(code);
    broadcastLobbyChanged();
  },
});

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

  // Track this socket for online presence. Fires a presence ping only if this
  // is the user's first live socket (offline → online transition).
  presence.connect(userId, socket.id);

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

  // ── Lobby: active-rooms list (home screen "Parties en cours") ────────────
  // Read-only; returns only rooms this user can JOIN or REJOIN (see
  // listJoinableRooms). Clients fetch on mount/focus and re-fetch when they
  // receive the 'lobby:roomsChanged' ping.
  socket.on('lobby:getRooms', () => {
    socket.emit('lobby:rooms', { rooms: rm.listJoinableRooms(userId) });
  });

  // ── Lobby: friends presence (home screen "Amis en ligne") ────────────────
  // Returns a presence map { userId: 'online' | 'in-game' } for every currently
  // online user EXCEPT the requester (any userId not in the map is offline).
  // The full registered-user roster is fetched by the client from Supabase
  // (public.profiles) and merged with this map — the backend has no Supabase
  // access, so it owns presence only, not the roster. Read-only.
  socket.on('lobby:getFriends', () => {
    const map = presence.buildPresenceMap(rm.isUserSeated);
    delete map[userId]; // exclude self
    socket.emit('lobby:friends', { presence: map });
  });

  // ── Create room ──────────────────────────────────────────────────────────
  socket.on('createRoom', (data = {}) => {
    refreshAvatar(socket, data);
    // Leave any existing room
    const existing = rm.getRoomForSocket(socket.id);
    if (existing) socket.leave(existing.code);

    const room = rm.createRoom({ userId, username, socketId: socket.id, avatarConfig: socket.avatarConfig });
    socket.join(room.code);
    socket.emit('roomJoined', {
      room: rm.publicRoom(room),
      game: rm.publicGame(room, 0),
      myPosition: 0,
    });
    sendChatHistory(socket, room);
    persistence.saveRoom(room);
    broadcastLobbyChanged();
    broadcastPresenceChanged(); // creator: online → in-game
  });

  // ── Join room ────────────────────────────────────────────────────────────
  socket.on('joinRoom', ({ code, avatarConfig } = {}) => {
    refreshAvatar(socket, { avatarConfig });
    const existing = rm.getRoomForSocket(socket.id);
    if (existing && existing.code !== code) socket.leave(existing.code);

    // If the room is already in-game, handle based on whether the joiner is the creator
    const peek = rm.getRoom(code);
    if (peek && peek.phase !== 'LOBBY') {
      if (peek.creatorId === userId) {
        // Creator bypasses approval — seats directly
        const result = rm.creatorJoin(code, { userId, username, socketId: socket.id, avatarConfig: socket.avatarConfig });
        if (result.error) return emitError(socket, result.error);
        socket.join(code);
        socket.emit('roomJoined', {
          room: rm.publicRoom(result.room),
          game: rm.publicGame(result.room, result.position),
          myPosition: result.position,
        });
        sendChatHistory(socket, result.room);
        broadcastGame(result.room);
        broadcastLobbyChanged();
        broadcastPresenceChanged(); // joiner: online → in-game
      } else {
        // Non-admin: create a pending join request for the creator to approve
        const result = rm.requestJoin(code, { userId, username, socketId: socket.id, avatarConfig: socket.avatarConfig });
        if (result.error) return emitError(socket, result.error);
        socket.join(code);
        socket.emit('joinPending', { code });
        if (!result.alreadyPending) broadcast(result.room);
      }
      return;
    }

    const result = rm.joinRoom(code, { userId, username, socketId: socket.id, avatarConfig: socket.avatarConfig });
    if (result.error) return emitError(socket, result.error);

    socket.join(code);
    const room = result.room;
    const position = rm.getPosition(room, userId);

    socket.emit('roomJoined', {
      room: rm.publicRoom(room),
      game: rm.publicGame(room, position),
      myPosition: position,
    });
    sendChatHistory(socket, room);
    broadcast(room);
    broadcastLobbyChanged();
    broadcastPresenceChanged(); // joiner: online → in-game
  });

  // ── Rejoin after disconnect ──────────────────────────────────────────────
  socket.on('rejoinRoom', ({ code, avatarConfig } = {}) => {
    refreshAvatar(socket, { avatarConfig });
    const result = rm.handleReconnect(socket.id, code, userId, socket.avatarConfig);
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
    sendChatHistory(socket, room);
    broadcast(room);
    broadcastLobbyChanged();
  });

  // ── Fill with bots ───────────────────────────────────────────────────────
  socket.on('fillWithBots', ({ code }) => {
    const result = rm.fillWithBots(code, userId);
    if (result.error) return emitError(socket, result.error);
    broadcast(result.room); // lobby broadcast, no bot scheduling needed yet
    broadcastLobbyChanged();
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
    broadcastLobbyChanged();    // LOBBY → in-game: list now shows the new phase
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

  // Partner peek toggle — gated server-side to the two specific users; re-broadcast
  // (per-recipient publicGame is what actually reveals the partner hand, to them only).
  socket.on('togglePartnerPeek', ({ code }) => {
    const result = rm.togglePartnerPeek(code, userId);
    if (result.error) return emitError(socket, result.error);
    broadcast(result.room);
  });

  // ── Table chat ─────────────────────────────────────────────────────────
  // Ephemeral per-room text chat. Sender is resolved from the socket's own
  // membership (no client-supplied code/userId is trusted). The message —
  // including the sender's seat position so each recipient can anchor a
  // notification bubble to the right seat — is broadcast to every socket in
  // the room, sender included. Invalid payloads (not a player, empty/non-string
  // text) are silently dropped.
  socket.on('chat:message', ({ text } = {}) => {
    const room = rm.getRoomForSocket(socket.id);
    if (!room) return;
    const result = rm.addChatMessage(room.code, userId, text);
    if (result.error) return; // ignore — never surface chat validation as a toast
    for (const player of result.room.players) {
      const s = io.sockets.sockets.get(player.socketId);
      if (s) s.emit('chat:message', result.message);
    }
    persistence.saveRoom(result.room);
  });

  // ── Throw projectiles ──────────────────────────────────────────────────
  // Cosmetic "throw stuff at a player" gesture, networked like chat but not
  // persisted. Sender resolved from the socket (never client-trusted); bots
  // never throw; target must be another seated position; item must be allowed;
  // a per-sender cooldown throttles spam. On success the throw is broadcast to
  // every room socket (sender included) so each client animates it from its own
  // viewer-relative perspective. Invalid/throttled throws are silently dropped.
  socket.on('throw:item', ({ targetPosition, item } = {}) => {
    const room = rm.getRoomForSocket(socket.id);
    if (!room) return;
    const result = rm.throwItem(room.code, userId, targetPosition, item);
    if (result.error) return; // ignore (incl. cooldown) — never a toast
    for (const player of result.room.players) {
      const s = io.sockets.sockets.get(player.socketId);
      if (s) s.emit('throw:thrown', result.throw);
    }
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
    if (result.deleted) {
      // LOBBY emptied of humans — roomManager already removed it from the Map.
      // Mirror the full-delete side-effects (no bots running pre-start, but keep
      // it uniform).
      cancelBotSchedules(code);
      persistence.deleteRoom(code);
    } else if (result.room) {
      // In-game leave: if no human members remain (solo-vs-bots), delete now;
      // else keep it (paused). Skip broadcasting a just-deleted room.
      const { deleted } = rm.evaluateRoomForCleanup(code);
      if (!deleted) broadcast(result.room);
    }
    broadcastLobbyChanged();
    broadcastPresenceChanged(); // leaver: in-game → online
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
    broadcastLobbyChanged();
    broadcastPresenceChanged(); // removed player: in-game → online
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
        sendChatHistory(s, room);
      }
    }
    broadcastGame(room); // may resume bot scheduling if game unpaused
    broadcastLobbyChanged();
    broadcastPresenceChanged(); // accepted player: online → in-game
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
    // Presence: drop this socket. Going offline (last socket) fires its own
    // 'lobby:presenceChanged' from the presence module, after the grace window.
    presence.disconnect(userId, socket.id);
    const result = rm.handleDisconnect(socket.id);
    if (result) {
      // Re-evaluate the room: delete now if no human members remain (e.g. a
      // solo-vs-bots player vanished), else arm the grace timer. Don't broadcast
      // a room that was just deleted — that would re-persist it to Redis. The
      // delete path already pinged lobbies via onRoomDeleted.
      const { deleted } = rm.evaluateRoomForCleanup(result.code);
      if (!deleted) { broadcast(result.room); broadcastLobbyChanged(); }
    }
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

  // Periodic sweep of abandoned/dead rooms (~every minute). Catches human-less
  // rooms and ones whose grace window has elapsed, including any hydrated from
  // Redis that never got a per-event timer. Each deletion fires onRoomDeleted
  // (cancel bots, drop from Redis, refresh lobbies).
  const sweep = setInterval(() => {
    try {
      const removed = rm.sweepDeadRooms();
      if (removed.length) console.log(`[cleanup] swept ${removed.length} dead room(s): ${removed.join(', ')}`);
    } catch (err) {
      console.error('[cleanup] sweep failed:', err.message);
    }
  }, 60 * 1000);
  if (typeof sweep.unref === 'function') sweep.unref(); // don't keep the process alive for the sweep

  httpServer.listen(PORT, () => {
    console.log(`Coinche server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
