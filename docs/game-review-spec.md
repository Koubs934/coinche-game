# Game Review — canonical spec

`schemaVersion: 1` • Ship date: 2026-04-22
Source of truth for the persisted record: [`backend/src/game/gameRecordStorage.js`](../backend/src/game/gameRecordStorage.js)
Source of truth for the in-memory lifecycle + annotation rules: [`backend/src/roomManager.js`](../backend/src/roomManager.js)

## Background

Game Review is a second annotation surface, parallel to Training mode. Where
Training captures reasoning on **curated bidding scenarios**, Game Review
captures the **complete play phase of real games**. Every round played to
completion auto-saves a JSON `GameRecord`. The room creator can additionally
tag specific cards with a free-text note while the round is in progress.

Both systems feed the same downstream Claude-based analysis pipeline aimed at
deriving "rules of optimal play" and, eventually, informing bot strategy.
They share the philosophy but have separate data domains — there is no
cross-reading between `${TRAINING_DATA_DIR}` and `${GAMES_DATA_DIR}`.

In this document, "game" refers to **one round** — one complete deal with its
bidding, eight tricks, and final scoring. The multi-round *match* is not a
unit of persistence; every round is an independent `GameRecord`.

---

## Storage layout

```
${GAMES_DATA_DIR}/<roomCreatorUserId>/<isoStamp>-<gameId>.json
```

- **`GAMES_DATA_DIR`** env var. Local default: `backend/data/games/`
  (parallels `TRAINING_DATA_DIR`). Railway production:
  `GAMES_DATA_DIR=/data/games`, sharing the same persistent volume already
  mounted for Training.
- **`<roomCreatorUserId>`** — Supabase user ID of the room creator at the
  time the round started. Not the winning team, not all seats — just the
  creator. Recommits to the same directory if the same user creates a new
  room and plays another round.
- **`<isoStamp>`** — filesystem-safe ISO timestamp of the round's
  `completedAt` (colons and `.Z` replaced with hyphens; millisecond
  precision). Keeps back-to-back rounds from colliding on filename.
- **`<gameId>`** — per-round UUID minted at `_startRound` time.

Writes are atomic: `<path>.tmp` + `fs.renameSync` to final path (same pattern
as `backend/src/training/annotationStorage.js`). No `.tmp` residue after a
successful write.

---

## GameRecord schema

```jsonc
{
  "schemaVersion": 1,
  "gameId": "6b0a9d4e-3c1f-4a2b-9e8a-2d5c7b1f9a04",
  "roomCreatorUserId": "ff4c2d…",
  "roomCreatorUsername": "AK7",
  "createdAt":   "2026-04-22T18:07:12.045Z",
  "completedAt": "2026-04-22T18:15:40.902Z",

  "players": [
    { "seat": 0, "userId": "ff4c2d…", "username": "AK7"  },
    { "seat": 1, "userId": "a19-b…",  "username": "Rod"  },
    { "seat": 2, "userId": "c92-e…",  "username": "Jeje" },
    { "seat": 3, "userId": "bot-1",   "username": "Bot 1" }
  ],

  "teams": [
    { "teamId": 0, "seats": [0, 2] },
    { "teamId": 1, "seats": [1, 3] }
  ],

  "deal": {
    "hands": {
      "0": ["JS", "9S", "AS", "10D", "KH", "8C", "7C", "QH"],
      "1": ["...", "..."],
      "2": ["...", "..."],
      "3": ["...", "..."]
    },
    "dealer": 0
  },

  "bidding": {
    "rounds": [
      { "seat": 1, "action": { "type": "bid",  "value": 80, "suit": "H" } },
      { "seat": 2, "action": { "type": "pass" } },
      { "seat": 3, "action": { "type": "pass" } },
      { "seat": 0, "action": { "type": "pass" } }
    ],
    "winner":  { "seat": 1, "value": 80, "suit": "H", "team": 1 },
    "coinche": null
  },

  "play": {
    "tricks": [
      {
        "trickIndex": 0,
        "leadSeat":   1,
        "cards": [
          { "seat": 1, "card": "9H", "playedAt": "2026-04-22T18:08:01.144Z" },
          { "seat": 2, "card": "8H", "playedAt": "2026-04-22T18:08:04.209Z" },
          { "seat": 3, "card": "QH", "playedAt": "2026-04-22T18:08:06.714Z" },
          { "seat": 0, "card": "AH", "playedAt": "2026-04-22T18:08:09.332Z" }
        ],
        "winnerSeat": 0
      }
      /* … 7 more tricks … */
    ],
    "belote": { "declaredBy": null, "trickIndex": null, "rebeloteAt": null }
  },

  "outcome": {
    "team0Score":            92,
    "team1Score":            70,
    "team0CumulativeScore":  502,
    "team1CumulativeScore":  308,
    "winningTeam":           0
  },

  "errorAnnotations": [
    {
      "annotationId":   "4f01-…",
      "cardRef":        { "trickIndex": 2, "seat": 3, "card": "9H" },
      "note":           "Should have kept the 9 of trump for later — was the master, wasted on a trick we'd already lost.",
      "createdAt":      "2026-04-22T18:12:44.801Z",
      "createdByUserId":"ff4c2d…"
    }
  ]
}
```

### Field reference

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | integer | Always `1` in this release. Incremented on any shape change. |
| `gameId` | UUID | Per-round identifier minted server-side at `_startRound`. Stable through the round; new round = new `gameId`. |
| `roomCreatorUserId` | string | Supabase user ID of the room creator at round start. Determines the per-user directory. |
| `roomCreatorUsername` | string | Display name at round start. Captured for analysis even if the user later renames. |
| `createdAt` | ISO timestamp | When `_startRound` fired (hands dealt). |
| `completedAt` | ISO timestamp | When `_finishRound` fired (8th trick complete). File named off this stamp. |
| `players[]` | array | Seat → userId + username. Always length 4. Seats 0–3 in positional order. |
| `teams[]` | array | Fixed `[{teamId:0, seats:[0,2]}, {teamId:1, seats:[1,3]}]`. Included for downstream analysis symmetry. |
| `deal.hands` | object keyed by seat | 8-card starting hand per seat, values as `"value+suit"` strings (`"10D"`, `"JH"`, `"AS"`). Captured before any card is played — `hands[]` in the live room state is mutated as cards leave. |
| `deal.dealer` | seat index | Who dealt this round. |
| `bidding.rounds[]` | array | Every bidding action in order: `bid` (with value + suit), `pass`, `coinche`, `surcoinche`. |
| `bidding.winner` | object or `null` | Final contract `{seat, value, suit, team}`. `null` only if all 4 passed (which does not reach `_finishRound`, so this is effectively always non-null in persisted records). |
| `bidding.coinche` | `null` \| `{surcoinched}` | `null` when the contract was not coinched; `{surcoinched: boolean}` otherwise. |
| `play.tricks[]` | array, length 8 | Each trick carries its `trickIndex`, `leadSeat`, the 4 cards in play order (with per-card `playedAt`), and `winnerSeat`. |
| `play.belote` | object | `declaredBy` seat (or `null`), `trickIndex` the declaration happened on, `rebeloteAt` timestamp when the second K/Q landed (or `null` if never completed). |
| `outcome.team0Score` / `team1Score` | integer | Points this round. |
| `outcome.team0CumulativeScore` / `team1CumulativeScore` | integer | Match-wide running totals **after** this round's points are applied. |
| `outcome.winningTeam` | 0 \| 1 | The team that won this contract: contract team if `contractMade`, otherwise defenders. |
| `errorAnnotations[]` | array | Always present, possibly empty. Populated by `createGameErrorAnnotation` during play. |

### Card string format

`"<value><suit>"` where `value ∈ {7,8,9,10,J,Q,K,A}` and `suit ∈ {S,H,D,C}`.
`"10D"` is four characters; every other card is two. The conversion mirror
on the frontend is
[`GameErrorTagOverlay.jsx`](../frontend/src/game/GameErrorTagOverlay.jsx)
(`cardToString`).

### ErrorAnnotation fields

| Field | Type | Meaning |
|---|---|---|
| `annotationId` | UUID | Minted server-side. Lets downstream tooling key annotations without collisions. |
| `cardRef.trickIndex` | integer | 0-based. Accepts the in-progress trick's index too (so you can tag a card the moment after it's played). |
| `cardRef.seat` | 0–3 | Seat that played the card. |
| `cardRef.card` | string | `"value+suit"`. Must match what was actually played in that `(trickIndex, seat)` slot — the server validates this on every submission. |
| `note` | string | Non-empty after `trim()`, max 2000 characters. |
| `createdAt` | ISO timestamp | Server-side at acceptance. |
| `createdByUserId` | string | V1: always equal to `roomCreatorUserId`. Kept as its own field so multi-annotator support in future releases does not need a schema change. |

---

## In-game annotation lifecycle

```
  _startRound                      playCard × N                 _finishRound
       │                                 │                             │
       ▼                                 ▼                             ▼
 game.errorAnnotations = []   ←─ admin taps "Erreur de jeu" ─→   buildGameRecord
 game.gameId = uuid              server: createGameErrorAnnotation  → writeGameRecord
 game.createdAt = now()          pushes annotation onto              → emit gameRecordSaved
 game.initialHands = snapshot     room.game.errorAnnotations[]         to room creator only
                                  (+ broadcasts roomUpdate)
```

Behaviour at each step:

1. **Round starts** (`_startRound`). `room.game` gains `gameId`,
   `createdAt`, `initialHands` (deep copy of the dealt hands — `hands[]` is
   mutated as cards are played), `errorAnnotations: []`,
   `beloteDeclaredTrickIndex: null`, `beloteRebeloteAt: null`. The public
   game state (`publicGame`) now includes `gameId` + `errorAnnotations` so
   the client can key annotation actions and render "already-tagged"
   badges.
2. **Admin taps "Erreur de jeu"**. Frontend opens
   `GameErrorTagOverlay`. Pause is **frontend-only** — the backend keeps
   accepting plays from other seats. If the game advances while the
   overlay is open, the admin simply returns to an updated state on
   close.
3. **Admin picks a card + writes a note + hits Save**. Client emits
   `createGameErrorAnnotation { gameId, cardRef, note }`. Server
   validates in this order:
   - `UNKNOWN_GAME` — `gameId` doesn't match any active room.
   - `FORBIDDEN_NOT_ROOM_CREATOR` — requester is not the room creator.
   - `NOTE_EMPTY` / `NOTE_TOO_LONG` — note constraints.
   - `INVALID_CARD_REF` — `trickIndex` out of range, `seat` didn't play
     in that trick, or `card` string doesn't match the played card.
4. **Acceptance.** Server pushes the annotation onto
   `room.game.errorAnnotations`, emits `gameErrorAnnotationCreated` to
   the creator's socket, and broadcasts `roomUpdate` so every client's
   `publicGame.errorAnnotations` stays in sync. Badge rendering on the
   overlay reads from that list (subject to availability when the
   admin re-opens).
5. **Round ends** (`_finishRound`). `buildGameRecord(room)` assembles the
   full JSON from the authoritative in-memory state (initial hands,
   bidding history, tricks, belote info, `errorAnnotations`).
   `gameRecordStorage.writeGameRecord(record)` persists atomically under
   `${GAMES_DATA_DIR}/<creatorId>/`. Server emits `gameRecordSaved
   { gameId, filePath }` to the creator only. An idempotency guard
   (`room._lastSavedGameId`) ensures re-broadcasts of the ROUND_OVER or
   GAME_OVER phase do not trigger a duplicate write.

---

## Socket event contract

Additions introduced in this release. Full documentation lives in
[`backend/src/socketEvents.js`](../backend/src/socketEvents.js).

### Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `createGameErrorAnnotation` | `{ gameId, cardRef:{trickIndex,seat,card}, note }` | Admin tags an error card. Validation errors surface via the shared `'error'` channel with a `code`. |
| `getCurrentGameState` | `{ gameId }` | Ad-hoc refresh of the game state keyed by `gameId`. Responds on `'roomUpdate'` (filtered to the requester). Used by the overlay to re-hydrate if it opens after reconnect. Errors: `UNKNOWN_GAME`. |

### Server → Client

| Event | Payload | Target |
|---|---|---|
| `gameErrorAnnotationCreated` | `{ gameId, annotation }` | Creator's socket only. Confirms acceptance; the authoritative sync is the broadcast `roomUpdate` that also fires. |
| `gameRecordSaved` | `{ gameId, filePath }` | Creator's socket only, fires on end-of-round after successful disk write. `filePath` is absolute and intended for server-side diagnostics — not for display in the UI. |

### Error codes

- `UNKNOWN_GAME`
- `FORBIDDEN_NOT_ROOM_CREATOR`
- `INVALID_CARD_REF`
- `NOTE_EMPTY`
- `NOTE_TOO_LONG`

All surface via the existing `'error'` channel with a `code` field. The
frontend translates them through `t.errors.byCode[code]`; unknown codes
fall through to the raw server message.

---

## Privacy & data-handling facts

Three facts to be explicit about, since they materially affect what lands
on disk and how long it stays there:

1. **All completed rounds auto-save. No opt-out.** Every round that
   reaches `_finishRound` writes a `GameRecord`. The button labeled
   "Erreur de jeu" only controls error *annotations*; the underlying
   record is always persisted. Abandoned rounds (disconnect, undo back
   through bidding, etc.) are not persisted.
2. **Usernames are captured verbatim** into `players[*].username` and
   `roomCreatorUsername`. Not hashes, not user IDs alone — the exact
   string from the user's Supabase profile at round start. Downstream
   analysis is intended to consume these.
3. **Persistent volume on Railway.** `GAMES_DATA_DIR=/data/games`
   points at the mounted persistent volume, so records survive deploys
   and container restarts. They do not survive volume deletion (not an
   automated action). No automatic retention policy — records accumulate
   indefinitely until manually archived or purged.

---

## V1 scope (explicit)

Included:

- Per-round `GameRecord` auto-save with the full schema above.
- Free-text error annotations attached to specific cards.
- Room-creator-only tagging (server-enforced via
  `FORBIDDEN_NOT_ROOM_CREATOR`).
- Already-tagged badges in the overlay with multi-note tooltips.
- End-of-round toast to the creator confirming save.

Not included:

- **Non-creator tagging.** Only the room creator can submit annotations.
- **Structured vocabulary.** Annotations are freeform text. No reason-tag
  system analogous to Training mode's `reasonTags.json`.
- **Trick-level or hand-level annotations.** Every annotation is attached
  to a specific card. Tagging "this whole trick was wrong" or "we played
  this hand badly" is not expressible.
- **Replay viewer.** There is no UI for browsing past `GameRecord`s. The
  records are produced for downstream analysis, not in-app review.
- **Mid-round crash recovery.** In-memory
  `room.game.errorAnnotations` is lost if the server crashes mid-round
  or the round is undone back through. No on-disk partial state like
  Training mode's `awaiting-reason` files. Acceptable tradeoff for V1
  given how rare both situations are.

Future iterations may add any of the above plus multi-annotator
support, per-annotation categories, review UI, and volume-level
retention policy. Schema evolves via `schemaVersion` bump with clear
migration notes alongside.
