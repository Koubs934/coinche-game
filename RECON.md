# RECON — restyling `frontend/` toward the 1920s mockup

Read-only investigation (no code changed). Goal: know the *real* post-merge state of
`frontend/` before restyling it to match `redesign-mocks/01-bidding-table.html`
(1920s French-club aesthetic; tokens in `redesign-mocks/DESIGN-SYSTEM.md`).

Method: 5 parallel deep-readers over GameBoard / bidding / avatars / game-state / CSS,
then the load-bearing claims re-verified by direct read. Every claim below is grounded in
a real `file:line`.

> **Headline findings (the three that change the plan):**
> 1. **Cards are CSS-drawn text/Unicode glyphs, NOT images.** The mockup's PNG deck is *not*
>    wired into React — adopting it is a real change, not a drop-in.
> 2. **Avatars are already solved**, richer than the mockup: a shared `<Avatar>` backed by
>    **react-peeps** (Open Peeps). The mockup's DiceBear SVGs are superseded (and unused even
>    by the mockup itself). → No avatar work needed; just retheme the surrounding circle.
> 3. **The felt is a flex *rectangle*, not an oval, and seats are flex chips — not absolutely
>    positioned around an ellipse.** The mockup's around-the-oval seating is a structural
>    rewrite of the felt layout, not a token swap. The fanned hand, by contrast, already exists.

---

## 1. Inventory (real paths)

### `frontend/src/` (depth 2, the restyle-relevant tree)
```
src/
├── main.jsx                      # entry; imports App.css then throw.css (the ONLY 2 css files)
├── App.jsx                       # socket.io init + roomJoined/roomUpdate → gameState/roomState/myPosition
├── App.css            (3937)     # the entire global stylesheet (no modules, no preprocessor)
├── throw.css           (296)     # food-throw projectile overlay only
├── components/
│   ├── GameBoard.jsx  (1181)     # the in-game table screen (seats, center, fanned hand, score bar)
│   ├── gameBoardParts.jsx (251)  # CardFace, CardBack, TrickDisplay, BidStack, ContractBadge, PlayerSeat…
│   ├── gameBoardHelpers.js (176) # SUIT_SYM, sortHand, deriveHandOrder, bestSuitForHand, displayName
│   ├── BiddingPanel.jsx (169)    # live bid controls (legal-bids grid + suit strip + action row)
│   ├── ShuffleCutPanel.jsx (109) # pre-bidding shuffle/cut phase
│   ├── Avatar.jsx      (104)     # shared avatar: react-peeps <Peep> figure OR letter-circle fallback
│   ├── ProfileScreen.jsx (137)   # the avatar BUILDER (saves to Supabase profiles.avatar_config)
│   ├── RoundSummary.jsx (481)    # end-of-round score card + auction recap / trick replay
│   ├── Header.jsx       (37)     # app chrome top bar (logo/room/user/gear) — NOT the score bar
│   ├── Lobby.jsx       (400)     # lobby + waiting room (full-figure avatars)
│   ├── OnlineFriends.jsx, ActiveGamesList.jsx, ChatPanel.jsx, ChatBubbles.jsx,
│   ├── SettingsModal.jsx, ThrowLayer.jsx, ThrowTray.jsx, ThrowMock.jsx, HandSizeToggle.jsx,
│   ├── AdminPanel.jsx, Auth.jsx, EnvBadge.jsx
│   └── shared/AuctionRecap.jsx   # 2×2 seat recap (used by RoundSummary, not live bidding)
├── lib/
│   ├── avatar.js       (146)     # framework-free Open Peeps config layer (normalize/toPeepProps/botConfig)
│   ├── throwItems.js, avatar.test.js, supabase.js
├── context/  AuthContext.jsx · LanguageContext.jsx · ModeSachaContext.jsx
├── i18n/     en.js · fr.js       # t.us/t.them, t.capot, t.suitSymbol, bid labels
├── training/ …                   # Claude training-mode UI (out of restyle scope)
└── game/     GameErrorTagger* …  # game-review overlay (out of scope)
```

### Role → real component map (what the user asked to identify)
| Mockup concern | Real component(s) | Path |
| --- | --- | --- |
| Game/table **screen** | `GameBoard` | `components/GameBoard.jsx:751` (`<div className="game-board">`) |
| **Bidding** UI | `BiddingPanel` (controls) + bid-sheet/bid-bar/contract-focal **in GameBoard** | `components/BiddingPanel.jsx`; `GameBoard.jsx:1018-1075`, `:869-891` |
| **4 players** render | `PlayerSeat` (opponents) + `self-player-bar` (you) | `gameBoardParts.jsx` `PlayerSeat`; `GameBoard.jsx:998-1006` |
| **Avatar** render | `Avatar` (shared, react-peeps) | `components/Avatar.jsx`; config in `lib/avatar.js` |
| **Hand** render | `.my-hand` fan in GameBoard + `CardFace` | `GameBoard.jsx:1102-1117` (`arcStyle`, `:658-669`) |
| **Card** render | `CardFace` / `CardBack` (CSS glyphs) | `gameBoardParts.jsx:12-37` |
| Score Nous/Eux | `.score-bars` in GameBoard (NOT `Header.jsx`) | `GameBoard.jsx:800-806` |

---

## 2. Component summaries (JSX structure + consumed state)

### `GameBoard.jsx` — the table screen
`<div className="game-board">` is a **flex column** (`App.css:834`) of 3 stacked rows:
- **Row 1 `.score-bars` / `.total-score-bar`** — one thin strip with the two team totals only
  (`:800-806`). *No* "COINCHE 500 pts" panel; contract lives in the center, not here.
- **Row 2 `.board-middle`** — `position:relative; display:flex; flex-direction:row`, a **rounded
  rectangle** (`border-radius:14px` + radial-gradient, `App.css:896-913`) — **not** a `50%` oval.
  Four children laid out by **flexbox**, not grid-areas:
  - `.board-top` (partner) — the **only** absolutely-positioned seat (`top:2px; left:50%`, `:851`).
  - `.board-left` / `.board-right` — fixed-width **86px flex gutter columns**, vertically centered.
  - `.board-center` — `flex:1`; phase-switched: BIDDING → `.bid-focal` (highest bid) + whose-turn;
    PLAYING → `<TrickDisplay>` + last-trick widget.
- **Row 3 `.board-hand`** — translucent band: `.self-player-bar` (your Avatar + name + BidStack +
  throw button), the collapsible bid sheet, and `.my-hand` (the fanned hand).
- **Landscape (`max-height:500px`)**: the whole board switches to **CSS grid**
  (`grid-template-areas: "scores…" / "left center right" / "hand…"`), `.board-middle` becomes
  `display:contents`, and the partner seat is `display:none` (`App.css:2667-2686`). *A second,
  divergent layout the restyle must also handle.*

**Consumed state** (`GameBoard.jsx:158-168`): `const {players, scores, paused…} = room;`
`const {phase, currentTrick, currentPlayer, biddingTurn, trumpSuit, currentBid, hands,
handCounts, beloteInfo, tricks} = game;` — `myPlayer = players.find(p=>p.position===myPosition)`,
`myTeam = myPlayer?.team ?? 0`.

### `BiddingPanel.jsx` — live bid controls
Early-returns `null` unless it's *my* bid turn (`:71`). Three blocks: (1) **legal-bids-only**
value grid — `BID_VALUES=[80…160,'capot']` filtered by `isValidBid()` then split into two
stretch rows (`:78-84`) — so the grid **shrinks as bidding climbs** (after 80, only 90…160+capot
remain); (2) a centered 4-chip **suit strip** (`♠♥♦♣`) + per-value suit-echo glyphs; (3) an
action row: `Annoncer` (solid CTA) + conditional `Coinche`/`Surcoinche` outline buttons +
always-present `Passer`. **No** per-cell COINCHE/CAPOT/SURCOINCHE buttons like the mockup —
capot is just the last numeric chip; coinche/surcoinche are separate action buttons emitting
their own socket events. The collapsible **bottom sheet + highest-bid bar** live in *GameBoard*
(`:1018-1075`), not here.

### `gameBoardParts.jsx` — primitives
`CardFace` = `<button className="card card-face">` with `<span className="ci-rank">{card.value}</span>`
+ `SUIT_SYM[card.suit]` glyph + a big `.card-center` glyph (`:12-32`). `CardBack` = a single
`🂠` (`:36`). `TrickDisplay` maps four `.trick-slot.trick-{top,left,right,bottom}` to seats
**viewer-relative**: `getArea(pos)=['bottom','right','top','left'][(pos-myPosition+4)%4]` (`:43-45`).
`PlayerSeat` renders `<Avatar variant="head" circleClassName={\`player-avatar team${team}-avatar\`}>`.

### `RoundSummary.jsx` / `shared/AuctionRecap.jsx`
End-of-round score card (`.manche-score` hero, cumulative total, collapsible breakdown) +
a 2×2 viewer-relative seat recap (`topPos=(my+2)%4` etc., `AuctionRecap.jsx:102-104`). Recap is
its own grid-with-center-felt idiom — distinct from both the live oval and the mockup.

---

## 3. The socket game-state object (traced end-to-end)

Backend `roomManager.js` builds it; `publicRoom()` (`:152`) + `publicGame(room, viewerPosition)`
(`:236`) are the **exact serialized shapes**; `server.js:536` broadcasts `roomUpdate`
`{room, game, myPosition}` **per seat**; `App.jsx:234-241` stores them; `GameBoard` consumes.
The payload is always the triple `{ room, game, myPosition }` (`socketEvents.js:79`).

```jsonc
room = {                          // publicRoom()  roomManager.js:152
  code, creatorId,                // creatorId === my userId ⇒ I am host (Undo/admin)
  players: [ {                    // VARIABLE length, ONE PER SEAT — key by .position, not [0..3]
    userId, username,             // ← player names
    team: 0|1,                    // = position % 2  (team0 = seats 0,2)
    position: 0|1|2|3,            // seat, clockwise
    connected, isBot,
    avatarConfig: {…}|null        // ← OPEN PEEPS config (see §5); null ⇒ letter fallback
  } … ],
  targetScore: 2000,              // ← mockup's "500 pts" (default 2000); NOT shown on the table today
  phase: 'LOBBY'|'SHUFFLE'|'CUT'|'PLAYING'|'ROUND_OVER'|'GAME_OVER',   // ROOM phase
  scores: [team0, team1],         // ← CUMULATIVE Nous/Eux — indexed by TEAM, not seat
  paused, pendingJoins, nextRoundReady,
  shuffleDealer, cutPlayer, lastShuffleCutAction, lastShuffleCutActorPos,
  canUndo
}

game = {                          // publicGame()  roomManager.js:236 — FILTERED PER VIEWER (null pre-deal)
  dealer: 0..3,                   // ← dealer seat (NOT visually marked anywhere today)
  phase: 'BIDDING'|'PLAYING'|'ROUND_OVER',   // in-round phase. Mockup = 'BIDDING'
  currentBid: {                   // ← contract. null until first bid
    value: 80..160 | 'capot',     //   number OR string 'capot'
    suit: 'S'|'H'|'D'|'C',        // ← atout of the contract
    playerIndex: 0..3, team: 0|1, //   who holds the high bid
    coinched: bool, surcoinched: bool
  } | null,
  biddingTurn: 0..3|null,         // ← whose turn DURING BIDDING
  biddingActions: [a0,a1,a2,a3],  // last action PER SEAT: {type:'bid',value,suit}|{type:'pass'}|… |null
  biddingHistory: [ {position,type,value?,suit?} … ],  // chronological; last entry = most recent
  currentTrick: [{card:{suit,value}, playerIndex, playedAt}],
  tricks: [{cards:[…], winner}],
  currentPlayer: 0..3|null,       // ← whose turn DURING PLAYING
  trumpSuit: 'S'|'H'|'D'|'C'|null,// ← set ONLY once bidding closes. During bidding use currentBid.suit
  beloteInfo: {playerIndex, declared, rebeloteDone, complete, team},
  roundScores: [t0,t1],           // this round (0,0 until ROUND_OVER)
  contractMade: bool|null, trickPoints: [t0,t1]|null,
  hands: [h0,h1,h2,h3],           // ← hands[myPosition] = real [{suit,value}] (9). OTHERS = Array(n).fill(null) — HIDDEN
  handCounts: [n0,n1,n2,n3]       // true per-seat count (use for opponents)
}
```
Refs: `publicGame` `roomManager.js:244-279`; `publicRoom` `:152-169`; `placeBid` builds
`currentBid` `:504-513`; `_startPlaying` sets `trumpSuit` `:608`; broadcast `server.js:536-545`;
consumption `GameBoard.jsx:158-168`; `EMPTY_GAME` fallback `App.jsx:33-40`.

---

## 4. Mockup datum → real game-state field

| Mockup element | Real source | Notes / gotcha |
| --- | --- | --- |
| Player names (Pierre/Sophie/Marc/Vous) | `room.players[].username` (find by `.position`) | Map seat→slot **viewer-relative**: `(pos - myPosition + 4) % 4` → `[bottom,right,top,left]` |
| **Nous** score | `room.scores[myTeam]` | `scores` is **by team**, not seat. `myTeam = players.find(p=>p.position===myPosition).team` |
| **Eux** score | `room.scores[1-myTeam]` | naive `scores[0]=Nous` is wrong for team-1 viewers |
| "COINCHE **500 pts**" | `room.targetScore` (default **2000**) | mockup hardcodes 500; **not currently rendered** on the table |
| Contract value "**80**" | `game.currentBid.value` | union: number `80..160` **or** string `'capot'` → branch on type |
| Atout **♠** | `game.currentBid.suit` *(during bidding)* / `game.trumpSuit` *(after)* | `trumpSuit` is **null mid-auction** — reading it for the panel shows blank |
| "Dernière enchère : 80 par Vous" | last entry of `game.biddingHistory[]` (+ `currentBid` for value/bidder) | no dedicated field; derive from history tail |
| Whose turn / "**À VOUS**" | `game.biddingTurn` (BIDDING) / `game.currentPlayer` (PLAYING) | pick per `game.phase`; active = `=== myPosition` |
| Per-seat "**PASSE**" | `game.biddingActions[position]` `{type:'pass'\|'bid'\|…}` | one slot per seat |
| Bid paliers (80…160, CAPOT, **COINCHE/SURCOINCHE**) | **FE-owned** `BID_VALUES` const (not in payload) | COINCHE/SURCOINCHE are `currentBid.coinched/.surcoinched` **flags** + separate socket events, *not* bid values |
| Hand of 9 cards | `game.hands[myPosition]` = `[{suit,value}]` | only your own hand has real cards |
| Opponent face-down fan | `game.handCounts[pos]` (their `hands[]` are `null`-filled) | can only show N face-down backs, never faces |
| Dealer "**D**" badge | `game.dealer` | exists in state but **no seat currently renders a dealer marker** |

---

## 5. Avatars — already solved (react-peeps: **yes**)

**Verdict: do not bring in the mockup's `assets/avatars/*.svg`.** They are DiceBear "Notionists"
SVGs (CC0) that the mockup *itself doesn't even use* (its seats are bare letter divs
`<div class="avatar">P</div>`, `01-bidding-table.html:1064-1110`). The live app is strictly better.

- **Pipeline**: shared `<Avatar>` (`Avatar.jsx:2` `import Peep from 'react-peeps'`) renders an inline
  **Open Peeps** two-tone line-art SVG from a plain-string config
  `{body,hair,face,facialHair,accessory,strokeColor,backgroundColor}` (`lib/avatar.js`). No image
  files, no network, no sprite. There's a working **builder** (`ProfileScreen.jsx`) persisting to
  Supabase `profiles.avatar_config`.
  > **Correction to one agent's note:** `avatarConfig` is an **Open Peeps** config, *not* a DiceBear
  > avataaars blob. `normalizeAvatarConfig` explicitly rejects legacy avataaars → `null` → letter
  > fallback (`lib/avatar.js:69-80`).
- **At the table**: `PlayerSeat` and the self-bar use `<Avatar variant="head" …>` — a **head-crop**
  (`HEAD_VIEWBOX`, `Avatar.jsx:29`) in a 30px `.player-avatar` circle, **team-tinted** (team0 blue
  `#7ec8e3`, team1 orange `#f4a261`, `App.css:954-967`), white 2px border, gold glow when active.
- **Bots**: a deterministic Open Peeps person from a seed (`botAvatarConfig`, `avatar.js:131-146`),
  marked **only** by a teal ring `.avatar-bot` (`App.css:599`) — not by appearance.
- **What it looks like**: a hand-drawn cartoon figure (head-only at seats, full-body in lobby/profile),
  two-tone (ink outline + fill), in a tinted ring. Legacy/no-config users see an initial letter.
- **Restyle impact**: **zero structural work** — keep `<Avatar>`. Only retheme the *surrounding*
  CSS: team tints, the white border, the gold active-glow, and the teal bot-ring → brass/bordeaux.

---

## 6. Cards — CSS-drawn glyphs, no images

The live deck is **pure CSS/Unicode**, the opposite of the mockup:
- `CardFace` → `<button className="card card-face">` with text rank `{card.value}` + suit glyph
  `SUIT_SYM[card.suit]` (`{S:'♠',H:'♥',D:'♦',C:'♣'}`, `gameBoardHelpers.js:7`); red for H/D. A corner
  index (`.ci-rank`/`.ci-suit`) + a centered glyph (`.card-center`). `CardBack` = `🂠`.
  (`gameBoardParts.jsx:12-37`, verified directly.)
- **No `<img>`, no inline SVG card, no sprite, no PNG import** anywhere in `frontend/src`
  (grep for `.png|assets/cards` → 0 card hits). The **paris-pro PNG deck exists only inside the
  static mockup** and is not referenced by React.
- Sizing: fixed CSS vars `--card-w:42px / --card-h:62px` (`App.css:20`), bumped to 48/70 ≥480px and
  36/44 in landscape (breakpoint **token swaps**, not `clamp()`), scaled in-hand by
  `--hand-card-scale` (1.6 / 1.9 via `[data-hand-size]`).
- The **fanned hand already exists** but is **JS-driven**: `arcStyle(i)` computes
  `translate(…)+rotate(off*5deg)` inline from a **measured** container width (`.hand-ruler` +
  `ResizeObserver`, `GameBoard.jsx:658-669`); CSS only sets `position:absolute` + transition.

**Implication:** to get the mockup's card look you either (a) **reskin the CSS card** (cream face,
brass border, serif rank — cheap, keeps the JS fan), or (b) **wire the PNG deck into `CardFace`**
(`<img>`/background-image) — bigger: must re-derive the aspect ratio and confirm the JS arc x-step
(which measures card width) still works with image cards.

---

## 7. CSS convention & tokens

- **Convention**: one global `App.css` (3937 lines) + `throw.css` (296), both imported once in
  `main.jsx`. **No CSS Modules** (`**/*.module.css` → 0), no styled-components, no Tailwind, no
  preprocessor. Flat single-class selectors, hand-ordered. A handful of **JS-computed inline
  transforms** drive the hand fan / bid sheet (App.css comments at `:1062, :1153`).
- **Tokens already exist** (`:root`, `App.css:4-25`) — but the **wrong palette/units** for the mockup:

| Concern | Live app | Mockup target (`DESIGN-SYSTEM.md`) |
| --- | --- | --- |
| Felt | `--table:#1a5e2a` (bright) + hardcoded `#1e6b30→#0f3a18` | `--vert-tapis:#1f3d2e` (deep) |
| Accent | `--accent:#f0a500` (orange-gold) | `--or-laiton:#c9a961` (brass) |
| Card face | `--card-bg:#fffef8` (near-white) | `--creme:#f4e8d0` |
| "Bordeaux" | none — coinche `#8b1a1a`, surcoinche `#5a0a8a` purple | `--bordeaux:#5a2a2a` |
| Team colors | **hardcoded** team0 `#7ec8e3` / team1 `#f4a261` in many rules | (n/a — must retheme) |
| Card size | `--card-w/h:42/62px` + breakpoint swaps | `clamp(44px,11.5vw,60px)` **fluid** |
| Fonts | **system-ui only** (no web fonts) | **Cinzel + Cormorant** (Google Fonts) |
| Responsive | breakpoints + `em` off fixed 15px root; `100dvh`; safe-area | `clamp()` fluid throughout |

- **`clamp()` count = 0. `Cinzel`/`Cormorant`/`@font-face`/`fonts.googleapis` count = 0** (verified).
- **Gotcha**: team0/team1 colors are **not tokenized** — they're hardcoded across `.team0-col`,
  `.ms-nous/.ms-eux`, `.team{N}-avatar`, etc. A `:root` swap alone won't recolor Nous/Eux.

---

## 8. Friction points + structure verdict

The mockup positions 4 players **absolutely around a flat `.oval` (border-radius:50%)** with a
**pure-CSS card fan** and **`clamp()`** fluid sizing. Against the real JSX:

1. **Felt shape & seat layout (HARD, structural).** `.board-middle` is a flex **rectangle**
   (`border-radius:14px`, `overflow:hidden`) with left/right seats as **86px flex gutter columns
   beside the felt** and only the partner seat absolute. Recreating "4 players straddling an oval
   edge" means: convert `.board-middle` to a `position:relative` ellipse, **absolutely position all
   4 seats** (top/left/right/bottom), drop `overflow:hidden`, and **also** rework the divergent
   **landscape grid** layout. → *The structure does NOT currently host the mockup layout; it imposes
   a flex/grid skeleton. This is a rewrite of the felt, not a token swap.*
2. **Card fan (MEDIUM, but already half-done).** A fan exists, so the *concept* is compatible — but
   geometry is **JS inline transforms from a measured width**, which will fight a static CSS-only
   `clamp()` fan. Keep the JS arc and only restyle card faces, or replace the measuring machinery.
3. **Card medium (MEDIUM).** Text/Unicode glyph buttons vs the mockup's PNGs (see §6).
4. **Bid grid model (MEDIUM).** Live = **dynamic legal-bids-only** two-row grid (count varies per
   turn); mockup = **static 6+6** with dedicated COINCHE/CAPOT/SURCOINCHE cells. Plus the live
   **sliding bottom-sheet/scrim/handle** has no mockup counterpart (mockup is a flat always-on
   section). Reconcile: restyle the dynamic grid, or render a static grid with disabled illegal cells.
5. **Top bar relocation (EASY-MEDIUM).** Mockup wants Nous / "COINCHE 500" / Eux + contract+atout in
   the top bar; today scores are a thin strip and contract lives in `board-center`. Data is all
   available — the markup must move.
6. **Tokens, fonts, palette (EASY but broad).** Wholesale `:root` rewrite + add web fonts; **plus**
   hunt down the **non-tokenized** team colors (friction #7 in CSS agent).

**Bottom line:** the *hand* and the *avatars* are largely there; the *felt/seat geometry* and the
*card medium* are the real work; *tokens/fonts/top-bar* are broad-but-shallow.

---

## 9. Recommended restyle order

Cheapest + most global + reversible first; structural + risky last; "already solved" flagged as no-op.

1. **Tokens + fonts (global skin).** Rewrite `:root` to the brass/cream/bordeaux/deep-felt palette,
   add Cinzel/Cormorant (`@import` or `<link>` in `index.html`) and apply to wordmark/scores/names.
   Then **hunt the hardcoded team0/team1 colors** and route them through new tokens. *Instant 1920s
   feel, no structural risk.*
2. **Avatars = no-op.** Keep `<Avatar>`/react-peeps; only retheme `.player-avatar` tints, border,
   active glow, and the bot ring to brass/bordeaux. Discard the mockup's DiceBear SVGs.
3. **Card faces.** Reskin the CSS card (cream face, brass border, serif rank/suit) to match the
   mockup's warmth — keep the existing JS fan. *(Defer the PNG-deck swap to a later, optional pass;
   it requires re-deriving aspect ratio + the measured arc x-step.)*
4. **Top bar.** Build the Nous / target / Eux + contract+atout panels; wire to `room.scores[myTeam]`,
   `room.targetScore`, `game.currentBid.value`, and `currentBid.suit ?? trumpSuit`.
5. **Bidding panel.** Reskin to brass/felt; decide the static-vs-dynamic grid question; add the
   center "Contrat en cours" panel + "Dernière enchère" line. Suppress/retheme the bottom-sheet
   chrome where the mockup is flat.
6. **Felt → oval + absolute seats (last, most care).** Convert `.board-middle` to a relative
   ellipse, absolutely place all 4 seats straddling the rim (map `position` → slot viewer-relative),
   add the dealer "D" badge (`game.dealer`), and **re-solve the landscape grid** variant. Validate
   at the mockup's 3 viewports (360/390/430) — and confirm `TrickDisplay`'s 4 slots still align to
   the new seat positions.

> Throughout: respect the real data contracts (§3/§4) — `scores`/`trumpSuit`/`currentBid.value`
> typing, viewer-relative seat mapping, the two phase fields (`room.phase` vs `game.phase`), and the
> fact that opponent hands are `null`-filled.
