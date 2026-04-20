# Coinche-Belote — Full Codebase Context Document

> Generated 2026-04-19. Grounded in actual source code. Use this to onboard a new Claude session.

---

## 1. Project Overview

### Tech Stack
| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite, Socket.io-client, Supabase JS SDK |
| **Backend** | Node.js + Express, Socket.io server |
| **Auth** | Supabase (email + username/password) |
| **Deployment** | Vercel (frontend SPA), Railway (backend — needs persistent process for WebSocket) |
| **i18n** | Custom context-based en/fr toggle, localStorage persistence |

### Purpose
A real-time, 4-player multiplayer implementation of French Coinche-Belote, playable in a browser. Supports human players, bot fill-in, team assignment, bidding, trump-card play, Belote/Rebelote declarations, shuffle/cut phases between rounds, and a detailed round-summary screen with interactive trick replay.

### What Works End-to-End
- Supabase auth (sign up / sign in / sign out)
- Room creation, joining, team assignment, target-score setting, fill-with-bots
- Full game loop: LOBBY → SHUFFLE → CUT → PLAYING (BIDDING → PLAYING → ROUND_OVER) → repeat → GAME_OVER
- Bidding: normal bids, pass, coinche, surcoinche, capot, all-pass re-deal
- Card play: full legality enforcement (follow suit, overtrump, partner-winning exemption)
- Belote/Rebelote: human prompt flow and bot auto-declare
- Persistent deck across rounds (tricks → rebuilt deck → shuffle/cut → deal)
- Round summary: score breakdown, auction recap mini-table, interactive trick replay, all-tricks view
- Disconnect/reconnect: game pauses and resumes
- Pending join requests with creator approval while in-game
- Admin panel: remove players
- Hand sort: auto-trump sort, manual drag-to-reorder (localStorage-persisted per round)
- Bot players: bidding, card play, belote declaration, shuffle/cut, round confirmation
- Mobile-first responsive layout, English/French toggle

---

## 2. Architecture

### Directory Structure (top 3 levels, node_modules excluded)
```
coinche-game/
├── backend/
│   ├── src/
│   │   ├── server.js               (318 lines)
│   │   ├── roomManager.js          (755 lines)  ← most central/complex file
│   │   ├── botProcessor.js         (122 lines)
│   │   └── game/
│   │       ├── deck.js             (56 lines)
│   │       ├── rules.js            (79 lines)
│   │       ├── scoring.js          (73 lines)
│   │       ├── botLogic.js         (90 lines)
│   │       └── verify.js           (562 lines)  ← test suite
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx                (16 lines)
│   │   ├── App.jsx                 (169 lines)
│   │   ├── App.css                 (main stylesheet)
│   │   ├── components/
│   │   │   ├── GameBoard.jsx       (1092 lines) ← largest/most complex frontend file
│   │   │   ├── RoundSummary.jsx    (474 lines)
│   │   │   ├── Lobby.jsx           (208 lines)
│   │   │   ├── ShuffleCutPanel.jsx (109 lines)
│   │   │   ├── BiddingPanel.jsx    (94 lines)
│   │   │   ├── Auth.jsx            (99 lines)
│   │   │   ├── Header.jsx          (37 lines)
│   │   │   └── AdminPanel.jsx      (47 lines)
│   │   ├── context/
│   │   │   ├── AuthContext.jsx     (52 lines)
│   │   │   └── LanguageContext.jsx (36 lines)
│   │   ├── i18n/
│   │   │   ├── en.js               (140 lines)
│   │   │   └── fr.js               (140 lines)
│   │   └── lib/
│   │       └── supabase.js         (10 lines)
│   ├── vite.config.js
│   └── package.json
│
└── CONTEXT.md  (this file)
```

**Total source lines (excluding node_modules):** ~4,778

### Backend Entry Point
`backend/src/server.js` — creates Express + HTTP + Socket.io server, attaches auth middleware, defines all socket event handlers, delegates logic to `roomManager.js`, schedules bots via `botProcessor.js`.

### Frontend Entry Point
`frontend/src/main.jsx` — mounts React with `LanguageProvider` → `AuthProvider` → `App`.

`frontend/src/App.jsx` — manages socket lifecycle, top-level state (`roomState`, `gameState`, `myPosition`, `pendingRoom`), routes to `Lobby` or `GameBoard` based on room phase.

### Backend ↔ Frontend Communication
**WebSocket only** (Socket.io). No REST endpoints used for game state — only a `/health` GET endpoint exists.

All game state is pushed from server to clients via `roomUpdate` and `roomJoined` events after every state mutation. Clients emit action events (e.g., `playCard`, `placeBid`) and receive either a new state or an `error` event.

---

## 3. Game State Machine

### Room-Level Phases (`room.phase`)
```
LOBBY
  └─ startGame() ──────────────────────────→ SHUFFLE
                                               │ shuffleDeck() or skipShuffle()
                                               ↓
                                             CUT
                                               │ cutDeck() or skipCut()
                                               ↓
                                           PLAYING  (room.phase)
                                               │ all 8 tricks done
                                               ↓
                                          ROUND_OVER
                                               │ all humans confirmNextRound()
                                               ↓
                                             SHUFFLE  (next round)
                                               ↓ ... (loop)
                                           GAME_OVER  (if team ≥ targetScore)
```

### Game-Level Sub-Phases (`room.game.phase`, only exists when room.phase === 'PLAYING')
```
BIDDING
  └─ 3 consecutive passes after a bid, OR surcoinche + 3 passes → PLAYING
  └─ 4 passes with no bid → _beginShuffle() (re-deals with new dealer)

PLAYING
  └─ 8 tricks completed → ROUND_OVER (via _finishRound)
```

### Phase Transitions — What Triggers Each
| Transition | Trigger | Function |
|---|---|---|
| LOBBY → SHUFFLE | creator calls `startGame` with 4 players, 2v2 teams | `startGame()` → `_beginShuffle()` |
| SHUFFLE → CUT | dealer shuffles or skips | `shuffleDeck()` / `skipShuffle()` → `_beginCut()` |
| CUT → PLAYING | cut player cuts or skips | `doCutDeck()` / `skipCut()` → `_startRound()` |
| BIDDING → PLAYING | 3 consecutive passes after a bid | `passBid()` → `_startPlaying()` |
| BIDDING → SHUFFLE | 4 passes with no bid | `passBid()` → `_beginShuffle()` (new dealer) |
| trick complete → next trick | 4th card played | `_completeTrick()` sets `g.currentPlayer = winner` |
| PLAYING → ROUND_OVER | 8th trick completed | `_completeTrick()` → `_finishRound()` |
| ROUND_OVER → SHUFFLE | all humans confirm next round | `confirmNextRound()` → `_beginShuffle()` |
| ROUND_OVER → GAME_OVER | score ≥ targetScore at end of `_finishRound` | `_finishRound()` sets `room.phase = 'GAME_OVER'` |

### Who Acts in Each Phase
| Phase | Who acts |
|---|---|
| SHUFFLE | `room.shuffleDealer` (= current dealer position) |
| CUT | `room.cutPlayer` (= `(dealer + 3) % 4`, i.e., player to the left) |
| BIDDING | `game.biddingTurn` (cycles from `dealer+1`) |
| PLAYING | `game.currentPlayer` (trick winner leads next) |
| ROUND_OVER | all human players must confirm |

### Where This Is Implemented
- Phase transitions: `backend/src/roomManager.js` — `_beginShuffle()` (line 194), `_beginCut()` (line 202), `_startRound()` (line 207), `_startPlaying()` (line 359), `_completeTrick()` (line 423), `_finishRound()` (line 436)
- Bot phase handling: `backend/src/botProcessor.js` — `scheduleBotTurns()`, `scheduleBotConfirms()`, `scheduleBotShuffleCut()`

---

## 4. Game Rules (as Currently Implemented)

### Card Values — Trump
Defined in `backend/src/game/rules.js` lines 1–4:
```
TRUMP_POINTS: J=20, 9=14, A=11, 10=10, K=4, Q=3, 8=0, 7=0
TRUMP_RANK:   J=8,  9=7,  A=6,  10=5,  K=4, Q=3, 8=2, 7=1
```

### Card Values — Non-Trump
```
NON_TRUMP_POINTS: A=11, 10=10, K=4, Q=3, J=2, 9=0, 8=0, 7=0
NON_TRUMP_RANK:   A=8,  10=7,  K=6, Q=5, J=4, 9=3, 8=2, 7=1
```

### Rank Orders
- Trump: J > 9 > A > 10 > K > Q > 8 > 7
- Non-trump: A > 10 > K > Q > J > 9 > 8 > 7

### Bidding Rules (`backend/src/roomManager.js`)
- Valid values: `[80, 90, 100, 110, 120, 130, 140, 150, 160, 'capot']` (line 257)
- Valid suits: `['S', 'H', 'D', 'C']`
- Must outbid current bid (numeric only; capot always higher than any numeric)
- Cannot bid after coinche (only surcoinche or passes allowed)
- **Coinche:** opposing team; doubles contract value in scoring (×2); available when it is your turn; resets `consecutivePasses` to 0
- **Surcoinche:** contracting team only; after coinche; quadruples contract value (×4); resets `consecutivePasses` to 0
- **Pass closure:** 3 consecutive passes after a bid (or after coinche/surcoinche) closes bidding → `_startPlaying()`
- **All-pass:** 4 passes with no bid → new SHUFFLE phase with dealer+1 (no scoring)

### Card-Play Legality (`backend/src/game/rules.js:38`, `getValidCards()`)
1. **Leading** (empty trick): any card
2. **Led suit is trump:**
   - Must play trump if able
   - Must overtrump (higher trump than current best) if possible; else any trump
   - If no trump: any card
3. **Led suit is not trump:**
   - Must follow led suit if able
   - If can't follow: partner is current winner (maître) → free to play anything
   - If can't follow + opponent winning + no trump in trick → must play any trump
   - If can't follow + opponent winning + trump already in trick → must overtrump if possible; else free (any card)

### Belote / Rebelote Logic (`backend/src/roomManager.js:386–407`, `playCard()`)
- Triggered when playing K or Q of trump suit
- **First card of pair:** if player still holds the partner card (Q or K of same trump suit), they must declare (true/false). Error `'beloteDecisionRequired'` returned if `declareBelote` is not a boolean.
  - `declareBelote = true`: sets `beloteInfo.declared = 'yes'`, records `beloteInfo.playerIndex`
  - `declareBelote = false`: sets `beloteInfo.declared = 'no'`
- **Second card of pair:** if `declared === 'yes'` and same player, sets `rebeloteDone = true`, `complete = true`
- **Scoring:** `beloteTeam = beloteInfo.rebeloteDone ? beloteInfo.playerIndex % 2 : null` — only counted if rebelote was completed (`backend/src/roomManager.js:440`)
- Worth +20 per declaration (belote +20, rebelote +20, total +40)
- Belote counts toward making the contract when held by the contracting team (`scoring.js:51`)
- No belote bonus on capot outcomes (flat 500 either way) (`scoring.js:44`)

### Scoring Formulas (`backend/src/game/scoring.js`)

**Multiplier:**
```js
multiplier = surcoinched ? 4 : coinched ? 2 : 1
```

**Dix de Der:** +10 added to last trick winner's team (`scoring.js:26`)

**Capot:**
- All 8 tricks won by contracting team → `scores[contractTeam] = 500 * multiplier`
- Failed → `scores[opposingTeam] = 500 * multiplier`
- No belote bonus applied

**Normal contract:**
- `contractTeamTotal = trickPoints[contractTeam] + (beloteTeam === contractTeam ? 20 : 0)`
- **Made** (`contractTeamTotal >= contract.value`):
  ```
  scores[contractTeam] = trickPoints[contractTeam] + contractTeamBelote + contract.value * multiplier
  scores[opposingTeam] = trickPoints[opposingTeam] + (beloteTeam === opposingTeam ? 20 : 0)
  both rounded to nearest 10
  ```
- **Failed:**
  ```
  scores[opposingTeam] = 160 + contract.value * multiplier
  scores[contractTeam] = 0
  (not rounded — exact)
  ```

**Key rule:** The multiplier applies ONLY to `contract.value`, not to trick points.

**Cumulative scores:** Added to `room.scores[0]` and `room.scores[1]` in `_finishRound()`. Game ends when either score ≥ `room.targetScore`.

---

## 5. Key Files and Responsibilities

| File | Purpose | Key exports/components | Lines | Risk |
|---|---|---|---|---|
| `backend/src/server.js` | Express + Socket.io server; all event handlers | socket event wiring, `broadcast()`, `broadcastGame()` | 318 | Low |
| `backend/src/roomManager.js` | All game state mutations; room lifecycle | `createRoom`, `joinRoom`, `startGame`, `placeBid`, `passBid`, `coinche`, `surcoinche`, `playCard`, `shuffleDeck`, `doCutDeck`, `confirmNextRound`, `leaveRoom`, `handleDisconnect`, `handleReconnect`, `publicRoom`, `publicGame` | 755 | **HIGH — central, largest backend file** |
| `backend/src/botProcessor.js` | Schedules bot actions with delays; re-fetches state at execution time | `scheduleBotTurns`, `scheduleBotConfirms`, `scheduleBotShuffleCut` | 122 | Low |
| `backend/src/game/deck.js` | Deck creation, shuffle, cut, deal, rebuild from tricks | `createDeck`, `shuffle`, `buildDeckFromTricks`, `cutDeck`, `dealFrom` | 56 | Low |
| `backend/src/game/rules.js` | Card play validation, trick winner detection, point values | `cardPoints`, `getTrickWinner`, `getValidCards`, `TRUMP_RANK` | 79 | Medium |
| `backend/src/game/scoring.js` | Round score calculation | `calculateRoundScore` | 73 | Low |
| `backend/src/game/botLogic.js` | Bot bid and card strategies | `getBotBidAction`, `getBotCardAction` | 90 | Low |
| `backend/src/game/verify.js` | Test suite (not loaded by server) | run directly with `node` | 562 | N/A |
| `frontend/src/App.jsx` | Socket lifecycle, top-level state, route to Lobby/GameBoard | `EMPTY_GAME` constant | 169 | Low |
| `frontend/src/components/GameBoard.jsx` | Main in-game UI: hand, trick, bidding, animations, sorting, belote prompt | `CardFace`, `CardBack`, `TrickDisplay`, `BidStack`, `sortHand`, `bestSuitForHand` | 1092 | **HIGH — largest frontend file** |
| `frontend/src/components/RoundSummary.jsx` | Score display, auction recap, trick replay, all-tricks view | `AllTricksView`, `TopArea`, `ScoreCard` | 474 | Medium |
| `frontend/src/components/Lobby.jsx` | Room create/join/lobby UI | — | 208 | Low |
| `frontend/src/components/ShuffleCutPanel.jsx` | Shuffle/cut UI with drum picker | — | 109 | Low |
| `frontend/src/components/BiddingPanel.jsx` | Bid value/suit selection, coinche/surcoinche buttons | — | 94 | Low |
| `frontend/src/components/Auth.jsx` | Sign in/up form | — | 99 | Low |
| `frontend/src/components/AdminPanel.jsx` | Player removal overlay | — | 47 | Low |
| `frontend/src/components/Header.jsx` | Logo, room code, scores, lang toggle, sign out | — | 37 | Low |
| `frontend/src/context/AuthContext.jsx` | Supabase auth session, `useAuth()` hook | `useAuth` | 52 | Low |
| `frontend/src/context/LanguageContext.jsx` | i18n context, `useLang()` hook | `useLang` | 36 | Low |
| `frontend/src/i18n/en.js` / `fr.js` | Translation strings | — | 140 each | Low |
| `frontend/src/lib/supabase.js` | Supabase client init | `supabase` | 10 | Low |

---

## 6. Socket Events

### Client → Server (emitted from `frontend/src/App.jsx` and components)

| Event | Payload | Purpose |
|---|---|---|
| `createRoom` | _(none)_ | Create a new room; emits `roomJoined` back |
| `joinRoom` | `{ code }` | Join existing room (lobby or pending-approval flow) |
| `rejoinRoom` | `{ code }` | Reconnect to a room after disconnect (uses sessionStorage code) |
| `fillWithBots` | `{ code }` | Fill empty seats with bots (creator only) |
| `assignTeam` | `{ code, targetUserId, team }` | Change a player's team (creator only, lobby only) |
| `setTargetScore` | `{ code, targetScore }` | Set winning score threshold (creator only, lobby only) |
| `startGame` | `{ code }` | Start the game (creator only, 4 players, balanced teams) |
| `placeBid` | `{ code, value, suit }` | Place a bid during BIDDING phase |
| `passBid` | `{ code }` | Pass during BIDDING phase |
| `coinche` | `{ code }` | Coinche the current bid (opposing team, your turn) |
| `surcoinche` | `{ code }` | Surcoinche (contracting team, after coinche, your turn) |
| `playCard` | `{ code, card: {suit, value}, declareBelote?: boolean }` | Play a card; `declareBelote` required when playing first of K/Q trump pair |
| `shuffleDeck` | `{ code }` | Shuffle the deck (dealer's turn in SHUFFLE phase) |
| `skipShuffle` | `{ code }` | Skip shuffle (dealer opts not to shuffle) |
| `cutDeck` | `{ code, n }` | Cut deck at position n (1–31); cut player's turn in CUT phase |
| `skipCut` | `{ code }` | Skip cut |
| `confirmNextRound` | `{ code }` | Mark self ready for next round (ROUND_OVER phase) |
| `leaveRoom` | `{ code }` | Intentional leave |
| `removePlayer` | `{ code, targetUserId }` | Remove a player (creator only) |
| `acceptJoin` | `{ code, targetUserId }` | Approve a pending join request (creator only) |
| `cancelJoinRequest` | `{ code }` | Withdraw own pending join request |

### Server → Client (emitted from `backend/src/server.js`)

| Event | Payload | Purpose |
|---|---|---|
| `roomJoined` | `{ room: PublicRoom, game: PublicGame, myPosition: number }` | Sent to the joining player on successful join/rejoin |
| `roomUpdate` | `{ room: PublicRoom, game: PublicGame, myPosition: number }` | Broadcast to all players after any state change |
| `error` | `{ message: string }` | Error toast (auto-clears after 4s on client) |
| `joinPending` | `{ code }` | Sent to requester when awaiting creator approval |
| `leftRoom` | _(none)_ | Sent when player is removed or leaves; client clears all state |

### PublicRoom Shape (from `roomManager.js:publicRoom`)
```js
{
  code, creatorId,
  players: [{ userId, username, team, position, connected, isBot }],
  targetScore, phase, scores: [number, number],
  paused, pendingJoins: [{ userId, username }],
  nextRoundReady: string[],
  shuffleDealer: number|null,
  cutPlayer: number|null,
  lastShuffleCutAction: 'shuffled'|'notShuffled'|'cut'|'notCut'|null,
  lastShuffleCutActorPos: number|null,
}
```

### PublicGame Shape (from `roomManager.js:publicGame`)
```js
{
  dealer, phase, currentBid, biddingTurn, consecutivePasses,
  biddingActions: [null|{type,value?,suit?}, ...],  // per position, latest action
  biddingHistory: [{position, type, value?, suit?}],  // full ordered log
  tricks: [{cards: [{card, playerIndex}], winner: number}],
  currentTrick: [{card, playerIndex}],
  currentPlayer, trumpSuit,
  beloteInfo: { playerIndex, declared, rebeloteDone, complete, team },
  roundScores: [number, number],
  contractMade: boolean|null,
  trickPoints: [number, number]|null,
  hands: (own hand: [{suit,value}][], others: null[]),
  handCounts: [number, number, number, number],
}
```

---

## 7. Bot Logic

**File:** `backend/src/game/botLogic.js`

### Bidding (`getBotBidAction`)
- If no current bid exists: bid 80 in the longest suit (by card count)
- If a bid already exists: always pass
- **Weakness:** Bots never coinche, never surcoinche, never bid above 80, never bid capot. In a 4-bot game, the first bot always opens 80 and the rest pass.

### Card Play (`getBotCardAction`)
- **Leading:** Play highest non-trump card; if only trump available, play highest trump
- **Partner winning (maître):** Play lowest card (conserve high cards)
- **Otherwise:** Play highest available card (try to win)
- Highest/lowest computed by `sortKey()` which ranks trump cards 100+ vs non-trump by NON_TRUMP_RANK — so bots always prefer trump when "winning" even if a non-trump would suffice
- **Weakness:** No suit management, no finessing, no void-suit play, no memory of played cards

### Belote Declaration
- Bot always declares belote (`declareBelote = true`) when playing the first of K+Q of trump — checked in `getBotCardAction` lines 77–84

### Shuffle / Cut Automation (`backend/src/botProcessor.js:scheduleBotShuffleCut`)
- Dealer bot: always shuffles (never skips)
- Cut bot: picks random n in [1, 31] and always cuts (never skips)
- Delay: 1500ms

### Round Confirmation (`scheduleBotConfirms`)
- All bots auto-confirm after 2000ms delay
- If all humans also confirmed by that time, new round starts immediately

### Scheduling Pattern
- All bot actions use `setTimeout` and **re-fetch room state at execution time** via `rm.getRoom(code)` to avoid stale closure bugs (key insight behind commit `34de144`)
- After each bot action, `scheduleBotTurns` is called again to chain subsequent bot turns

---

## 8. UI / UX Behaviors

**File:** `frontend/src/components/GameBoard.jsx` (1092 lines)

### Mobile-First Layout
- CSS class-based responsive layout in `App.css`
- Hand displayed at bottom, opponents at top/left/right, trick in center
- Suit symbols rendered as Unicode characters (♠♥♦♣)

### Sort Modes
Controlled by `sortMode` state (localStorage-persisted key `coinche_sort_mode`):
- `'S'`, `'H'`, `'D'`, `'C'` — auto-sort with that suit as trump (used before trump is revealed, as "pre-trump" candidate)
- `'manual'` — drag-to-reorder, order persisted in `manualOrderKeys` (localStorage key `coinche_manual_order_${dealer}`)

**Auto-sort algorithm** (`sortHand()`, lines 101–117):
1. Trump suit goes first (if present in hand)
2. Non-trump suits arranged by `bestNonTrumpOrder()` — minimises same-color adjacencies (black/red alternation) using brute-force permutation search (feasible since max 3 non-trump suits)
3. Within each suit, cards sorted by rank order (TRUMP_ORDER / NON_TRUMP_ORDER)

**Pre-trump sort candidate** (`bestSuitForHand()`, lines 54–65):
- Scores each suit using TRUMP_PTS (trump potential)
- Tiebreak 1: more cards; tiebreak 2: canonical order S→H→D→C
- Re-evaluated when dealer changes (via `dealer: -1` in EMPTY_GAME ensuring effect fires)

**Sort mode cycle:** Cycling through S→H→D→C→manual→S; when trump is revealed the sort mode auto-switches to the actual trump suit.

### Hand Reordering Mechanics (Manual Mode)
- Long-press (250ms via `setTimeout` on `touchstart`/`mousedown`) activates drag
- Drag position computed from touch/mouse X coordinate
- `reorderArr()` updates `manualOrderKeys` on drop
- `applyManualOrder()` reconstructs hand display order from saved keys + current hand cards (handles cards played mid-order gracefully)

### Belote Prompt Flow (Human Players)
- When human plays K or Q of trump while holding the partner card:
  - Backend returns `error: 'beloteDecisionRequired'`
  - Frontend sets `beloteDecisionCard` state to the card that was played
  - UI shows "Belote?" prompt with Oui/Non buttons
  - On choice: re-emits `playCard` with `declareBelote: true/false`

### Deal Animation
- On CUT → PLAYING transition, `dealAnimCounts` state is set to `[3, 2, 3]`
- Cards rendered with 0.3s interval staggering per batch

### Trick Animation
- On trick completion (4th card), `trickOverlay` state holds the completed trick
- Trick displayed statically for 1500ms
- Then `animDir` class added (bottom/right/top/left depending on winner relative to viewer) for 400ms fly-off animation
- After 1900ms total, overlay clears and new trick begins

### Belote/Rebelote Announcement Banner
- `beloteMsg` state shows "Belote!" or "Rebelote!" banner for 2500ms
- Triggered when `beloteInfo.declared` or `beloteInfo.rebeloteDone` changes

### Shuffle/Cut Feedback
- `shuffleCutMsg` state shows action feedback ("Aaron shuffled the deck", etc.) for 3500ms
- Message resolved at render time from `room.lastShuffleCutAction` + `room.lastShuffleCutActorPos` (avoiding stale closure — see commit `34de144`)

### Round Summary (`frontend/src/components/RoundSummary.jsx`)
- `replayStep` state: -1 = auction recap, 0+ = trick replay step
- **Auction recap:** Mini 4-seat table showing per-player bid stacks (reversed, latest first); winning bid highlighted; first-to-bid badge
- **Trick replay:** Step through tricks with ◀/▶ buttons; shows: current trick cards, winner badge + trick points, running cumulative scores (team 0 vs team 1), dix de der label on last trick
- **All-tricks view** (`AllTricksView`): Full list of all 8 tricks with running totals and lead/win indicators; separate view toggled by "Voir tous les plis" button
- **Score card:** Trick points, contract value × multiplier, belote bonuses, coinche/surcoinche row, final rounded scores, contract made/failed badge, ready count, "Tour suivant" button

---

## 9. Recent Changes / Current Work

### Git Log (last 30 commits)
```
34de144 fix: resolve shuffle/cut actor name at render time to avoid stale closure
42a43b0 refactor: improve shuffle/cut action messages — player name, color, larger
7abd2b3 feat: show shuffle/cut action feedback to all players on the table
023fa41 feat: manual Belote/Rebelote declaration
cada9cd refactor: move 'Voir tous les plis' button into score card above 'Tour suivant'
5cc78f8 feat: add 'Voir tous les plis' all-tricks view on round summary screen
e72c39c feat: sync bidding suit default with pre-trump sort candidate
9e1ca65 fix: cycleSortMode re-enters best candidate suit instead of defaulting to S
df65363 fix: use dealer:-1 in EMPTY_GAME so pre-trump sort always evaluates on real hand
a812602 debug: log bestSuitForHand scoring for pre-trump candidate verification
63d8c95 fix: improve pre-trump sort candidate using trump-only scoring
bebfc9a feat: integrate shuffle/cut controls into game table
8e7cfc6 style: enlarge and vertically centre shuffle/cut panel
16c10ba feat: persistent deck with shuffle/cut phases between rounds
6301c89 feat: replace sort toggle with multi-mode cycle (suit analysis + manual)
ff03f14 feat: manual drag-to-reorder hand + localStorage persistence
4051072 feat: upgrade hand sort to optimal color-alternation based on visible suits
ce471f3 style: right-align Rejouer button in replay control zone
acc3044 style: shrink Rejouer button to center lane, match nav button height
d0edbfa refactor: consolidate replay controls into bottom nav area
7d8eb02 feat: add Previous button and move replay nav to bottom of mini-table
31d3f4b refactor: move trick replay into top mini-table area (inline swap)
1954b7c feat: interactive step-by-step trick replay on round summary
81d0efe feat: mini auction table recap on round summary page
137fc85 feat: separate contract badge from coinche/surcoinche actor badge
24d5f1b feat: detailed score breakdown on round summary for all scenarios
7415cc9 fix: correct failed-contract formula and remove ×2/×4 from live auction display
fde2146 feat: show Coinche/Surcoinche as explicit bonus row on round summary
0734cc6 fix: coinche/surcoinche multiplier applies to contract value only, not full score
2d3dc78 feat: update Round Over table labels and add contract value row
```

**Active branch:** `main` only. No feature branches.

### TODOs / FIXMEs
**None found** in `backend/src` or `frontend/src`. Codebase is clean.

---

## 10. Known Issues / Fragile Areas

### In-Memory State
- All game state lives in `roomManager.js`'s `rooms` Map. Server restart wipes all active games. No persistence layer. This is by design for now but means any Railway restart (deploy, crash, idle timeout) kills all in-progress games.

### Reconnect Behavior
- Disconnect: player marked `connected: false`, game paused (`room.paused = true`) in PLAYING, ROUND_OVER, SHUFFLE, CUT phases
- Reconnect: `handleReconnect()` updates socketId, marks connected, unpauses if all players reconnected
- **Gap:** If a bot's position is vacated by an in-game player removal (creator removes a human), that seat stays empty with no bot replacement — game stays paused indefinitely unless another human joins via pending-join flow
- **Gap:** If the creator leaves during a game (`leaveRoom` in non-LOBBY phase), their entry is spliced from `room.players` but `room.creatorId` is not transferred. Pending join approvals would fail since no creator is in-room.

### GAME_OVER Phase
- When score hits target, `room.phase = 'GAME_OVER'`. There is no server-side "new game" reset — the client would need to navigate back to lobby / create a new room. Not found in codebase: a `restartGame` or `newGame` socket event.

### Scoring — Failed Contract Rounding
- Failed contract: `scores[opposingTeam] = 160 + contract.value * multiplier` — this is NOT rounded to nearest 10 (unlike made contracts). E.g., 160 + 80 = 240 (not 240→240 but not rounded either). The verify.js tests confirm this is intentional.

### GameBoard.jsx Complexity
- At 1092 lines, this is the most complex file. Contains: sorting logic, manual drag state machine, deal animation, trick animation, belote prompt state, shuffle/cut feedback, bidding UI, playing UI, admin panel overlay, ShuffleCutPanel, RoundSummary. High risk of subtle bugs when adding features.

### Bidding — Coinche Turn Validation
- `coinche()` checks `room.game.biddingTurn !== position` — coinche can only be called on your bidding turn, not freely at any time. This differs from some Coinche variants where opponents can coinche immediately after a bid regardless of turn order.

### Bot Bidding Weakness
- Only one bot ever bids (the first in turn order after dealer), always at 80. If that bot's bid is coinched, bots never surcoinche. Games with 3 or 4 bots will always have a boring auction.

### No Spectator Mode
- There is no concept of a spectator — players either have a seat or are pending approval for a seat. A 5th person cannot watch.

### Debug Log in Production
- `a812602` added a `console.log` for `bestSuitForHand` scoring. If not removed, this fires on every dealer change in production builds.

---

## 11. Testing

### Test File
`backend/src/game/verify.js` (562 lines)

### How to Run
```bash
node backend/src/game/verify.js
```
Exit code 0 if all pass. Prints `[PASS]`/`[FAIL]` per assertion plus a summary.

### What It Covers
**Card play rule scenarios (R1–R8+):**
- R1: Leading — all cards valid
- R2: Follow trump when trump is led; overtrump if possible
- R3: Follow led non-trump suit
- R4: Can't follow suit + opponent winning → must play trump (any)
- R5: Can't follow suit + partner winning → play anything (no trump obligation)
- R6: Can't follow + opponent winning + trump already in trick → overtrump if possible; else free
- R7: No trump at all → play any card when can't follow
- R8: Various edge cases for trump vs non-trump winner detection

**Scoring scenarios (S1–S11):**
- S1: Contract made, no special bonuses
- S2: Contract failed
- S3: Coinche, contract made
- S4: Coinche, contract failed
- S5: Surcoinche, contract made
- S6: Surcoinche, contract failed
- S7: Capot made
- S8: Capot failed
- S9: Contract made with belote (contracting team)
- S10: Contract made with belote (opposing team)
- S11: Failed contract + belote

Total: 64+ assertions.

**No frontend tests.** No integration tests. No CI pipeline found in codebase.

---

## 12. How to Run Locally

### Install
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### Dev Commands
```bash
# Backend (with nodemon auto-reload)
cd backend && npm run dev
# or: node src/server.js

# Frontend (Vite dev server)
cd frontend && npm run dev
```

### Environment Variables

**Backend** (`backend/.env`):
```
PORT=3001
FRONTEND_URL=http://localhost:5173
# For LAN testing: comma-separate multiple origins
# FRONTEND_URL=http://localhost:5173,http://192.168.1.42:5173
```

**Frontend** (`frontend/.env.local`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SOCKET_URL=http://localhost:3001
# For LAN testing: VITE_SOCKET_URL=http://192.168.1.42:3001
```

Supabase project must have email auth enabled. No database tables are needed — only Supabase Auth is used; all game state is in-memory on the backend.

---

## 13. Glossary

| Term | Definition |
|---|---|
| **Coinche** | A challenge by the opposing team doubling the contract value (×2). Called during bidding. |
| **Surcoinche** | A counter-challenge by the contracting team after a coinche, quadrupling the contract value (×4). |
| **Capot** | A contract to win all 8 tricks. If made: 500 points; if failed: opponents get 500. No belote bonus applies. |
| **Atout / Trump** | The trump suit chosen by the contracting team. Trump cards outrank all non-trump cards and have a special rank order (J highest, then 9). |
| **Valet d'atout (J)** | Highest trump card, worth 20 points. |
| **Neuf d'atout (9)** | Second-highest trump, worth 14 points ("la seconde"). |
| **Belote** | Declaration when playing the King of trump while holding the Queen (or vice versa). Worth +20 points. |
| **Rebelote** | Playing the second of the K/Q trump pair after declaring Belote. Worth another +20 points (+40 total). |
| **Dix de der** | +10 bonus points awarded to the team that wins the last trick. |
| **Maître** | A card (or the partner) that is currently winning the trick. When your partner is maître, you are free to play any card. |
| **Contract team** | The team whose player placed the winning bid. They must meet or exceed the bid value in trick points to "make" the contract. |
| **Contrée** | Alternative French term for Coinche. |
| **Dealer** | The player who "deals" (manages shuffle/cut phases). Rotates clockwise each round (`(dealer + 1) % 4`). |
| **Cut player** | Player to the left of the dealer (`(dealer + 3) % 4`) who cuts the deck. |
| **Positions 0–3** | Seat positions at the table. Teams: positions 0,2 = team 0; positions 1,3 = team 1. Players sit across from their partner. |
| **Target score** | Configurable game-winning score (default 2000). First team to reach it wins. |
| **All-pass** | When all 4 players pass without any bid being made. Results in a re-deal with a new dealer. |

---

## 14. Open Questions / Next Likely Improvements

### Clearly Incomplete / Missing
1. **GAME_OVER flow:** No `newGame` or `restartGame` socket event. After GAME_OVER, players presumably need to create a new room. The UI may already handle this (GameBoard likely shows a winner screen) but there's no server-side reset mechanism.

2. **Debug log** (`a812602`): `console.log` for `bestSuitForHand` left in `GameBoard.jsx` from a debug commit. Should be removed before treating the codebase as production-clean.

3. **Failed-contract rounding:** Failed scores (e.g., 240, 480) are not rounded to nearest 10 like made-contract scores. May be intentional per rules, or an oversight.

### Natural Next Steps (from code patterns)
1. **Bot intelligence:** Current bot always bids 80, never coinches/surcoinches, has no card memory. A strong next step would be a smarter bidding system based on trump point potential in hand.

2. **Creator leave mid-game:** `leaveRoom` during non-LOBBY phases removes the creator without transferring `creatorId`. Pending join approvals and admin actions would break.

3. **Spectator mode:** Architecture would need a new player type that receives `roomUpdate` but has no position or hand.

4. **Persistent storage:** Add a Redis or Supabase table for room state so server restarts don't kill games.

5. **Sound effects:** The animation system (trick fly-off, deal, belote banner) is in place — sound would be a natural addition.

6. **Lobby chat or emoji reactions:** The socket infrastructure supports it trivially.

7. **Bot difficulty levels:** The `getBotBidAction` / `getBotCardAction` interface is clean — adding a `difficulty` parameter and alternate strategies would be straightforward.

8. **Remove debug console.log** from `GameBoard.jsx` (added in commit `a812602`, fires on every dealer change).

9. **Coinche timing:** Currently coinche requires it to be your turn. Some rule variants allow any opposing player to coinche immediately after an opponent bids. Worth clarifying intended rules.

10. **Score display during play:** `computeLivePoints()` exists in `GameBoard.jsx` (lines 41–49) but it's unclear if it's actively used in the UI or just defined. Could power a live score tracker during the playing phase.
