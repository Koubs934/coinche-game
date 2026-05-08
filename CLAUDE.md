# CLAUDE.md

Scannable project index for Claude Code sessions. For deep dives — game-state machine,
socket-event tables, scoring formulas, full file listing — see [CONTEXT.md](CONTEXT.md).

## Project overview
Real-time, 4-player French Coinche-Belote in the browser (humans + bots). React/Vite
frontend on Vercel, Node/Socket.io backend on Railway, Supabase auth. Plus a
training-mode subsystem (`backend/src/training/`) for collecting annotated bids,
feeding a Claude conversational tutor (V2.2). End-to-end gameplay works; current
focus is bot intelligence + the training tool calibration.

## Tech stack
- **Frontend**: React 18, Vite, Socket.io-client, Supabase JS SDK
- **Backend**: Node 18+, Express, Socket.io, `@anthropic-ai/sdk` (training V2.2)
- **Auth**: Supabase email/password
- **Deploy**: Vercel (FE), Railway (BE — needs persistent process for WebSocket)
- **i18n**: custom context-based en/fr toggle, localStorage-persisted

## Architecture
Two parallel subsystems share the Socket.io connection:
- **Game** — `roomManager.js` (Map of in-memory rooms) + `botProcessor.js` schedules bot turns
- **Training** — `trainingRooms.js` / `trainingProcessor.js` / `trainingSocket.js`, isolated
  from game rooms; annotation files written to `/data/training/<userId>/`
- **Claude conversational (V2.2)** — `services/claudeService.js` + 4 HTTP endpoints
  in `server.js`: `/api/conversation/{start,turn,end,select-cards}`

Key files index lives in [CONTEXT.md §5](CONTEXT.md#5-key-files-and-responsibilities).

## Commands
```
# Install
cd backend && npm install
cd frontend && npm install

# Dev
cd backend && npm run dev          # nodemon, port 3001
cd frontend && npm run dev         # Vite, port 5173

# Tests
cd backend && npm run test:vitest  # 118 tests across 9 suites
node backend/src/game/verify.js    # legacy CLI test runner (R/S scenarios)

# Smoke-test the Anthropic conversational flow
cd backend && export $(cat .env.railway.local | xargs) && \
  node ../scripts/test-claude-conversation.js

# Scan for broken training scenarios
node scripts/scan-broken-scenarios.js          # report-only
node scripts/scan-broken-scenarios.js --delete # prompt to delete
```

## Conventions
- **Server pushes all state.** Clients emit actions, never compute authoritative state.
  No REST endpoints for gameplay; `/health` is the only REST. Training V2.2 adds
  `/api/conversation/*` HTTP endpoints because they're file-bound, not room-bound.
- **Positions 0–3 / Teams 0–1**: seats clockwise; team = position % 2; partner = +2 mod 4.
- **i18n keys** under `frontend/src/i18n/{en,fr}.js`; never hardcode user-facing strings.
- **localStorage keys** are namespaced `coinche_*` (sort mode, manual hand order, draft notes).
- **No TODO/FIXME comments.** If something is incomplete, it goes in *Known issues to fix*
  here or as a tracked decision — never as a stray comment that rots in source.

## Domain knowledge
French Coinche-Belote: 32-card deck, 4 players in 2 fixed teams, bidding phase establishes
trump suit + contract value, then 8 tricks, then scoring. Trump rank is `J > 9 > A > 10 > K > Q > 8 > 7`.
Belote/Rebelote = K+Q of trump declaration (+20 each, only scored if both played).
Coinche/Surcoinche = ×2/×4 challenges. Capot = win all 8 tricks (500 pts).
Full rule + scoring tables in [CONTEXT.md §4](CONTEXT.md#4-game-rules-as-currently-implemented).

## Current focus
1. **Bot intelligence V1** — V2.1 opening + responses wired in `botBidding.js`; V2.2
   anti-double-comptage and chiquer (+10 strict signal) are minimal but live.
2. **Training tool V2.2** — Phase 1/2/2A/2B/2C/2D done (backend, frontend chat, shared
   AuctionRecap, simplified flow, card selection, hand-in-felt). Calibration ongoing
   (chiquer rename, pièce trump-only, no rule fabrication).

## Roadmap
1. Bot V2.2 broader strategy — defense / bloquage / exploration are still pass-only.
2. Smarter card-play bots — currently no suit management, no void awareness, no card memory.
3. GAME_OVER → new round — no `restartGame` socket event yet; FE forces re-create-room.
4. Spectator mode — not modeled; 5th seat is impossible today.

## Decisions log
- **In-memory room state** in a `Map` — accepted that Railway restarts wipe games.
  No DB persistence layer. (CONTEXT.md §10 expands on this.)
- **Bot actions use `setTimeout` + re-fetch room** (commit `34de144`) to avoid stale-
  closure bugs when room state mutates between schedule and fire.
- **Belote only scores if rebelote completed** (`beloteInfo.rebeloteDone`).
  K+Q held but only one played → no +20 / +40.
- **Undo is creator-only**, guarded by a per-room bot-action nonce so a bot scheduled
  before the undo doesn't fire after.
- **Socket-only transport** for game state; `/health` is the only REST endpoint
  (training V2.2's `/api/conversation/*` is the deliberate exception).
- **Failed-contract scores intentionally NOT rounded** to nearest 10 (made-contract
  scores are). Confirmed in `verify.js` S2/S4/S6/S8.
- **Rule-silent prompt hardened against V2.1 fabrication** (claudeService.js, this
  commit). Model must explicitly state when Feuille is silent rather than invent a rule.
- **Scenario authoring principle**: distinguish "V2.1 covers it but author wrote null"
  (= bug, fix it) from "V2.1 has a real gap" (= legitimate rule-silent, leave null).
  Audit case-by-case, never batch-fix.
- **Petit jeu suit tie-break**: when 2+ suits qualify for petit jeu (80 with 2 Aces),
  pick the strongest — most trumps, with J preferred. Used in `fourth-position-02`.
  Worth promoting into V2.2 as an explicit rule.
- **V2.2 Phase 3 — passive capture, batch curation** (`personalFeuille.js`). Diverged
  from the original "Claude proposes inline, user validates one-word" design: friction
  on the user's path was rejected. New model — Claude emits silent `CAPTURE_RULE: …`
  lines in its response; server extracts them, appends to
  `<TRAINING_DATA_DIR>/<userId>/feuille-personnelle.md` as `[PROPOSED]`, strips them
  from both the FE response and the persisted message history. Aaron curates the file
  manually in batch — flips `[PROPOSED]` to `[VALIDATED]` (or deletes). Both the
  per-user personal feuille and the shared `feuille-commune.md` are injected into the
  system prompt fresh on every call (no caching), so manual edits take effect on the
  next turn without a server restart. Curation guide:
  `docs/feuille-personnelle-curation.md`.

## Pending decisions
- Whether to formalize the petit-jeu tie-break in `docs/la-feuille-v2.md` as a V2.2
  rule (see Decisions log entry).
- `creatorId` transfer when the creator leaves mid-game — pending-join approvals and
  admin actions break silently today.
- `restartGame` / `newGame` socket event for the GAME_OVER → new-game flow.

## Gotchas
- **Bot scheduling closures**: any `setTimeout` callback that touches room state must
  re-fetch via `rm.getRoom(code)`. Direct closure capture leads to stale-state bugs
  (the entire reason for commit `34de144`).
- **Creator leave mid-game**: `leaveRoom` in non-LOBBY phases splices the creator out
  but does not transfer `creatorId`. Pending-join approvals and admin actions then
  fail silently. Don't assume the creator is always present.
- **Railway `PORT` env var**: server reads `process.env.PORT || 3001`. Railway injects
  PORT at runtime; locally it's 3001. Don't hardcode.
- **React 18 StrictMode double-mount**: dev mounts → cleanup → remounts the same
  component instance. Effects with side-effecting cleanups (e.g. ClaudeConversation
  unmount → POST `/end`) must use the `setTimeout(100ms)` deferral pattern with a
  ref-stashed timer id so the remount can cancel before the fetch fires.
- **`ANTHROPIC_API_KEY` required at runtime** for `/api/conversation/*`. Server boots
  without it (lazy-init) but the endpoints 502 on first call. Set in Railway dashboard
  for prod, in `backend/.env.railway.local` for local.

## Known issues to fix
- Debug `console.log` for `bestSuitForHand` scoring left in `GameBoard.jsx` from
  commit `a812602`. Fires on every dealer change in production builds. Remove.

## Maintenance
Keep this file current — when a decision is reversed or a gotcha goes away, edit or
delete the entry. Drift makes it useless. CONTEXT.md owns the deep dives; CLAUDE.md
owns the index.
