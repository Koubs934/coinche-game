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

## Bot coach context (V2.2 — system prompt layers)
Injection order in `buildSystemPrompt`: **RÈGLES DU JEU < LA FEUILLE (authority) < FICHE DE
MAIN**. Label is `LA FEUILLE (référence)` (no version). Both docs read fresh per request (no cache).
- `docs/regles-du-jeu.md` — factual layer BELOW the Feuille: card order/points, 152+10der=162,
  belote/antibelote, announce arithmetic off 162/182, capot=all tricks (500 at mark), coinche
  ×2 / surcoinche ×4, trick obligations, group lexicon (le 34, le 21, la partance, capot servi,
  antibelote). **Facts sourced from `game/scoring.js` + `game/rules.js` — the engine is the
  house-rule authority; the Feuille stays the convention authority on top.**
- `backend/src/training/handFeatures.js` — deterministic per-suit fiche (atouts, pièce, maître,
  belote, antibelote, As ext/totaux, petit-jeu, points). **USER's hand only — seats 1–3 are
  never exposed to the bot.**
- **Coach mods M-D→M-G** (`claudeService.js`, test-locked as Mods 20–24): citation discipline
  (quote Feuille verbatim or say "non couvert"; never invent rules/tie-breaks; "La Feuille dit"
  vs "Mon raisonnement"); arithmetic from the fiche only (enumerate trump splits 2-2/3-1/4-0,
  no "forcément"); clôture+capture (≤2 follow-ups then synthesize; `CAPTURE_RULE` + "Noté:" ack;
  close without trailing question); first message (never open with "La Feuille ne couvre pas ce
  cas"; ≤3 sentences, one question); `PLAYER_STYLE_HINTS` map (Pacha ultra-court / Faispaschier
  technique / AK7 pédago / default — editable in `claudeService.js`).
- **Terminology**: PISSER (small trump when you can't overtrump) ≠ SE DÉFAUSSER (discard another
  suit) — two distinct terms, aligned in doc + glossary.

## Commands
```
# Install
cd backend && npm install
cd frontend && npm install

# Dev
cd backend && npm run dev          # nodemon, port 3001
cd frontend && npm run dev         # Vite, port 5173

# Tests
cd backend && npm run test:vitest  # 322 tests / 22 suites — RUN FROM backend/ (repo root = EXIT 127)
node backend/src/game/verify.js    # CLI assertion suite (140): rules, scoring, bot bidding + card play

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

## Current focus — RATIFICATION ROUND (2026-06)
**24 zone-grise scenarios deployed** (19-scene seed set + 5 `response-zg-q*` color-change probes added since). Aaron + Sacha + Jerem each play them independently →
tabulate-in-chat → ratify → update `la-feuille-v2.md` (Sacha+Jerem ratify) → align
`botBidding.js` → flip the flag.
- Set: 11 `opening-zg-*` (7 real-deal divergences + 4 trump-strength probes) + 8
  `response-zg-*` (patterns R-A/R-B/R-C). All seeded from Jerem's real games;
  `expectedAnswer` = current written Feuille (NOT rule-silent).
- **TEMP picker filter** (`scenarioLoader.js`): flag `TRAINING_ONLY_ZG` (prefixes
  `opening-zg-`/`response-zg-`) renumbers the filtered list #1–24. **Flip to `false` =
  restore all scenarios** (one boolean).
- Training data **fully reset 2026-06-09** → clean single-version baseline (bot M-A→M-G +
  Feuille V2.3 + 19 zg). Backups in `coinche-backups/`:
  `training-data-pre-reset-2026-06-09.tgz`, `bot-conversations.jsonl`,
  `jerem-openings.jsonl`, `jerem-responses.jsonl`, `prod-data-2026-06-06.tgz`.
- **Candidate rules pending ratification — do NOT hardcode yet.** Openings: trump dominance
  opens 90 w/o outside ace; no 80-cap on strong long trump; lone 9 too weak to carry.
  Responses: over-80 table not practiced (real scale ≈ pièce 90 / J+9 100 / +10 per outside
  ace); over-90 counts OUTSIDE aces; 9-without-Jack doesn't carry.

Background: bot intelligence V1 (`botBidding.js`, V2.1 opening+responses, V2.2 ADC/chiquer
minimal-but-live) + training tool V2.2 (Phase 1–2D done; calibration ongoing).

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
- **Unlimited cross-partie undo (creator-only)** — `undoLastAction` (server gate
  `room.creatorId === userId`, turn-independent) pops `room.history`. `pushHistorySnapshot`
  deep-clones game + **scores + deck** (both were previously omitted) + phase/dealer/
  shuffle-cut/nextRoundReady, pushed BEFORE every mutating action — bids/passes/plays AND
  `shuffleDeck`/`skipShuffle`/`doCutDeck`/`skipCut` + the ROUND_OVER→SHUFFLE advance in
  `confirmNextRound` — so undo traverses round boundaries with no gaps. `HISTORY_LIMIT`
  10→5000 (runaway guard only; unbounded in practice), `room.history` cleared on
  `startGame`. A per-room `actionNonce` bump aborts bot callbacks scheduled before the
  undo (`scheduleBotTurns` AND `scheduleBotShuffleCut` both re-check it). `undoLastAction`
  resets `room._lastSavedGameId = null` so a replayed round re-saves a fresh GameRecord.
  `room.history` is NOT persisted to Redis (excluded from `saveRoom`) → undo does not
  survive a server restart. FE: one creator-only undo control in the bottom hand-toolbar
  (left of "Erreur de jeu" in PLAYING; alone above the bid sheet in BIDDING) + on the
  round summary — the old turn-coupled copies were removed.
- **All-pass is an atomic close** (`passBid`) — 4 passes with no bid rebuilds the 32-card
  deck from the four hands (`[].concat(...room.game.hands)`), sets `room.game = null`, then
  `_beginShuffle(dealer+1)`. The null game renders via the FE `EMPTY_GAME` first-deal path
  (interactive mélanger/couper prompt), and a stray 5th `passBid` hits the existing
  `!room.game` guard → rejected. Replaces the old stale-`BIDDING`-game behavior (extra-pass
  window / silent re-deal with no shuffle prompt). Don't "fix" it back to keeping the game.
- **Socket-only transport** for game state; `/health` is the only REST endpoint
  (training V2.2's `/api/conversation/*` is the deliberate exception).
- **Scoring rounding by case**: uncoinched made contracts are rounded to nearest 10
  (trick points + announced value); coinche/surcoinche made contracts use a FLAT score
  (`value × multiplier + 160 + belote_if_contract_team`, defenders 0) that is already a
  multiple of 10, so rounding is moot; failed-contract scores (`160 + value × multiplier`)
  are intentionally NOT rounded. Capot is flat `500 × multiplier` (no +160). Confirmed in
  `verify.js` S1/S2/S4/S6/S8 (rounded/failed/capot) and S10/S11/S12 (flat coinche made).
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
- **CAPTURE_RULE pipeline fix** — extracted rules are now persisted to the annotation's
  `claude_conversation.rule_candidates` as `{rule, scenarioId, capturedAt}` (via
  `personalFeuille.toRuleCandidates`) in `/start`, `/select-cards`, `/turn`. Previously never
  wired (the field's "Phase 1 — always empty" comment): `feuille-personnelle.md` got the lines
  but the annotation record stayed `[]`.
- **Training data reset 2026-06-09** — all annotations/conversations/feuilles wiped for a clean
  single-version ratification baseline; `/data/games` untouched. Pre-reset backup
  `coinche-backups/training-data-pre-reset-2026-06-09.tgz` (320 files). Repo unchanged.

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
- **vitest runs from `backend/`**: `npm run test:vitest` at repo root = `EXIT 127` (a non-run,
  not a pass). Push only on `VITEST_EXIT=0` over the FULL suite — targeted tests miss
  cross-module breakage.
- **Verbatim-locked prompt text**: Mods 7 and 20–24 in `claudeService.js` are string-locked by
  `claudeService.regression.test.js`; editing their wording requires updating the locks.
- **Data roots** (Railway persistent volume, shared, different subdirs):
  `GAMES_DATA_DIR=/data/games` (1021+ records, keyed by room CREATOR),
  `TRAINING_DATA_DIR=/data/training` (annotations with embedded `claude_conversation` +
  per-user `feuille-personnelle.md`). Pull via `railway ssh … | base64` (see
  `scripts/sync-games.js`).
- **Undo snapshot completeness**: `pushHistorySnapshot` MUST capture `room.scores` +
  `room.deck` (deep-cloned) and EVERY mutating gameplay action must snapshot before it
  mutates — miss one and cross-donne undo silently breaks (no un-scoring / no deck revert
  / a gap at the round boundary). It is deliberately NOT persisted to Redis, so undo dies
  on a server restart (acceptable — same class as the in-memory-state decision).
- **All-pass nulls `room.game` by design**: the 4-passes-no-bid path sets `room.game = null`
  to close bidding atomically and render the shuffle prompt via `EMPTY_GAME`. A future
  reader might mistake this for a bug and restore a stale `BIDDING` game — don't; that
  reintroduces the extra-pass loop.

## Known issues to fix
- None currently. (The `bestSuitForHand` debug `console.log` from commit `a812602`
  has been removed.)

## Maintenance
Keep this file current — when a decision is reversed or a gotcha goes away, edit or
delete the entry. Drift makes it useless. CONTEXT.md owns the deep dives; CLAUDE.md
owns the index.
