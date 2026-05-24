# COMPLETION.md — Bidding-phase mobile layout fix

Branch: `fix/bidding-layout-mobile`
Date: 2026-05-23

## Goal

The bidding controls were getting clipped on short portrait viewports — the
120/Capot row and sometimes the toolbar disappeared, worst at Mode Delfino = L.
Root cause was layout pressure (not z-index, not conditional render): the
`.board-middle` row (`flex:1`, no overflow) held ~230 px-tall vertical opponent
card-back columns; on short phones those columns + larger Delfino cards squeezed
the layout and `.game-board {overflow:hidden}` clipped the bottom of the 5×2
`.bid-values` grid.

## What changed, per file

### `frontend/src/components/gameBoardParts.jsx`
- **`PlayerSeat`**: replaced the `.face-down-cards` block (which mapped the full
  `handCount` to individual `<CardBack small/>` elements, producing a ~230 px
  column for side seats) with a compact `.hand-chip`: up to 3 overlapping
  `.mini-back` chips + a numeric `.hand-chip-count`. Every seat is now ~one card
  row tall regardless of `handCount`. Added `aria-label={`${handCount} cartes`}`.
- **`PlayerSeat`**: added a `bidHistory` prop; renders
  `{bidHistory?.length > 0 && <BidStack history={bidHistory} t={t} />}` directly
  under `.player-name` so each opponent's bid sits beneath their own avatar.
  (`BidStack` and `useLang`/`t` were already in this module.)
- `CardBack` is left in place (still exported); it is no longer referenced by
  `PlayerSeat` but was not part of this change's scope to remove.

### `frontend/src/components/GameBoard.jsx`
- Deleted the three absolute overlay blocks `.table-bid.tbid-top/left/right`
  from `.board-center` (the detached bid bubbles).
- Passed each opponent's auction history into their seat via the new prop:
  - top (partner): `bidHistory={isBidding ? perPlayerHistory[(myPosition + 2) % 4] : null}`
  - left:          `bidHistory={isBidding ? perPlayerHistory[(myPosition + 3) % 4] : null}`
  - right:         `bidHistory={isBidding ? perPlayerHistory[(myPosition + 1) % 4] : null}`
  (Same position math the deleted overlays used.)
- The central `.bid-center` / `.bid-focal` / `.bid-whose-turn` (highest-bid
  reference) is unchanged.

### `frontend/src/App.css`
- **Change 1 (CSS)**: deleted `.face-down-cards` base rule + the column override
  `.player-left/.player-right .face-down-cards { max-width:36px; flex-direction:column; }`.
  Added `.hand-chip` / `.hand-chip-stack` / `.mini-back` (11×16 px, overlapping
  via `margin-left:-5px`) / `.hand-chip-count`. Updated the landscape
  (`max-height:500px`) override that referenced the old column to scale the chip
  instead.
- **Change 2 (CSS)**: deleted the `.table-bid`, `.tbid-top`, `.tbid-left`,
  `.tbid-right` rules and their landscape nudges. Bid bubbles now flow inside
  the seat via the existing `.bid-stack` styles.
- **Change 3**: added `overflow: hidden` to `.board-middle` so opponent content
  can never spill onto the panel. Reworked `.my-hand` to
  `flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; min-height: 0;`
  (+ `-webkit-overflow-scrolling: touch`) so wide / Delfino-scaled hands scroll
  horizontally instead of growing `.board-hand` and evicting the controls.
- **Change 4**: added height-based Delfino caps after the `[data-hand-size]`
  rules:
  - `@media (max-height: 720px) { [data-hand-size="L"] { --hand-card-scale: 1.3; } }`
  - `@media (max-height: 640px) { [data-hand-size="L"],[data-hand-size="M"] { --hand-card-scale: 1.1; } }`
  The `HandSizeToggle` component and its `localStorage` behaviour are untouched —
  only the CSS *result* is capped on short screens.
- **Change 5**: progressive-enhanced the height chain from `100%` to `100dvh`
  (keeping the `100%` fallback line directly above each `100dvh` line, and
  keeping `overflow:hidden`) on `html, body`, `#root`, and `.app`. The
  `.board-hand` `env(safe-area-inset-bottom)` padding was left as-is.

### Untracked additions
- `BIDDING_CONTEXT.md` — the read-only inspection map produced earlier (root).
- `verification-screenshots/` — the 9 Playwright screenshots (see below).

## Constraints honoured
- `BiddingPanel.jsx` logic untouched (validation, `placeBid`/`passBid`/`coinche`/
  `surcoinche` emits, `trainingMode` routing). Its CSS was not changed.
- No i18n keys added, renamed, or removed. The relocated `BidStack` reuses the
  same `t.*` labels (`t.pass`, `t.capot`, suit symbols, etc.).
- No backend / game-state / Delfino-toggle behaviour changes.
- No new dependencies. Existing colours/variables (`--accent`, `--red`,
  `--table`, …) reused.

## Verification

Verified with Playwright at the three portrait worst-case sizes, each cycled
through Mode Delfino S → M → L (9 combinations). Because local auth/sockets
weren't available, a TEMPORARY `?mock=bidding-fixture` harness was added to
`App.jsx` to mount the real `GameBoard` with synthetic mid-bidding state
(my turn, current bid 90♥, Bot1 bid 80♣, Bot2 passed, Bot3 bid 90♥, 8 cards
each). The harness was **removed after verification** — `App.jsx` is unmodified
in the final diff (confirmed via `git status`). Production `npm run build`
passes (127 modules, no errors). No browser console errors during the run.

### Acceptance criteria (all held, including Delfino-L @ 360×650)

1. **All value buttons incl. 120 and Capot fully visible, none overlapped** —
   PASS. The grid renders 10 bid buttons (80–160 + Capot; "11" in the brief
   counts the row visually). Programmatic check at the tightest case
   (430×780 / L, the largest cards) confirmed all `.bid-val-btn` within viewport;
   120 bottom=469, Capot bottom=509, viewport=780.
2. **Suit row + Annoncer/Coinche/Passer fully visible** — PASS. 4 suit buttons
   present; action row (Bid/Coinche!/Pass) bottom=605 < 780.
3. **Toolbar (Trier/Annuler/Gérer/Quitter) fully visible** — PASS. All 4
   toolbar buttons bottom=646 < 780.
4. **Hand visible, may scroll horizontally, never clipped at the bottom** —
   PASS. `.my-hand` bottom=770 < 780; `overflow-x:auto` scrolls wide/large hands;
   `.board-middle` computed `overflow: hidden`.
5. **Each opponent's bid bubble sits directly under that opponent's avatar; the
   top (partner) bubble reads highest** — PASS. Measured at 430×780/L: top
   (Bot2 "Pass") avatar top=106, bubble top=154; left (Bot3 "90♥") avatar=232,
   bubble=280; right (Bot1 "80♣") avatar=232, bubble=280. Each bubble is below
   its own avatar, and the top bubble (154) is highest on screen.

### Screenshots (`verification-screenshots/`)
- `bidding-360x650-S.png`, `bidding-360x650-M.png`, `bidding-360x650-L.png`
- `bidding-390x700-S.png`, `bidding-390x700-M.png`, `bidding-390x700-L.png`
- `bidding-430x780-S.png`, `bidding-430x780-M.png`, `bidding-430x780-L.png`

### Delfino cap behaviour observed
- 360×650 and 390×700 (both ≤ 720): L is capped to 1.3 (matches M); M stays 1.3
  (height > 640).
- 430×780 (> 720): L renders at full 1.6 (card width measured 67.2 px) and still
  passes all criteria.

## Not verified / caveats
- Tested via the synthetic fixture, not a full live bots game (auth/sockets not
  available locally). The fixture mounts the real `GameBoard` component with the
  same prop shape the server pushes, so the rendered DOM/CSS is representative;
  socket-driven state transitions (placing an actual bid) were not exercised.
- UI text rendered in English (default `t` in the harness session); the layout
  is language-agnostic and i18n keys were not changed, but French string lengths
  (e.g. "Quitter la table") were not separately screenshotted — they fit in the
  existing toolbar which already used these keys before this change.
- `coinche`/`surcoinche` action-row variants were not separately screenshotted
  (the fixture's `currentBid` was not coinchable by my team); only the default
  Bid/Coinche!/Pass row was captured. The action-row CSS was not modified.
- True device-browser `100dvh` behaviour (mobile address-bar collapse) can only
  be fully validated on a real device; verified here in desktop Chromium where
  `dvh` resolves to the viewport height.

---

# COMPLETION.md — Fanned arc hand + corner index (follow-up task)

Branch: `fix/bidding-layout-mobile`
Date: 2026-05-23

## Goal

Replace the flat scrolling hand with an overlapping fanned **arc** (cards held
like real cards). Rank+suit move to each card's TOP-LEFT corner so they stay
readable under overlap. All 8 cards always fit the width at any size — bigger
Mode Delfino cards just overlap more (never scroll, never clip). Tap-to-play and
long-press drag-reorder must keep working. The previous task's Delfino height
caps are removed (the arc makes them unnecessary).

## What changed, per file

### `frontend/src/components/gameBoardParts.jsx`
- **`CardFace`**: added a top-left `.card-index` (`.ci-rank` + `.ci-suit`) in
  addition to the centred glyph (now wrapped in `.card-center`). Added `style`,
  `lifted`, `onMouseEnter`, `onMouseLeave` props (used by the arc layout in
  GameBoard). Existing red/black suit logic reused. `CardFace` is only used in
  the player's hand, so the corner index never appears on trick cards.

### `frontend/src/components/GameBoard.jsx`
- Module-level arc tuning + geometry: `HAND_ARCH = 2.2`, `HAND_ROT = 5°`,
  `HAND_LIFT = 24px`, and `arcXStep(box, n)` — derives the per-card horizontal
  step from the measured container width, **reserving the rotation overhang**
  (an edge card's rotated bounding box is wider than the card:
  `halfExtent = cardW/2·cos φ + cardH·sin φ`, `φ = mid·HAND_ROT`). Without that
  reservation the fan spilled ~16px past each viewport edge.
- New state: `dragX` (live pointer X so the dragged card follows the finger),
  `handBox` `{ w, cardW, cardH }` (measured arc metrics), `liftIdx` (hover/press
  lifted card). New refs: `rulerRef`, `handBoxRef` (mirror for handlers),
  `dragRectRef` (container rect captured at drag start).
- `useLayoutEffect` measures the container inner width + the hidden `.hand-ruler`
  (whose CSS width/height = scaled card size) via a `ResizeObserver` on both —
  so the arc recomputes on viewport resize AND on Mode Delfino change, without
  GameBoard needing to know about Delfino.
- Render: `.my-hand` maps each card to an absolutely-positioned `CardFace` with
  an inline `transform: translate(calc(-50% + x), y) rotate(rot)` (x = off·xStep,
  y = off²·HAND_ARCH parabola = arch, rot = off·HAND_ROT), `z-index = i` (right
  overlaps on top → each card's left strip + index stays visible). The
  hovered/pressed card straightens (`rotate(0)`), rises (`-HAND_LIFT`), scales
  1.06, z-index 999. The dragged card floats at the pointer (straight, lifted,
  scale 1.08, z 1000) while the rest re-arc around the opening slot.
- `getDropIdx` rewritten to pure slot math using the same `arcXStep` geometry
  (stable under overlap, no DOM midpoint scan). `handleHandPointerDown` now also
  sets a press-lift, captures the container rect, and `setPointerCapture` is
  wrapped in try/catch (synthetic/edge pointers). Move/up/cancel updated to
  track `dragX` and clear `liftIdx`. Tap-to-play and the long-press (250ms) →
  drag-reorder data flow (`manualOrderKeys`, `reorderArr`, `applyManualOrder`,
  localStorage) are otherwise unchanged.

### `frontend/src/App.css`
- `.card-center` (centred glyph) + `.card-index` / `.ci-rank` / `.ci-suit`
  (absolute top-left, em-sized so it scales with `--hand-card-scale`).
- `.my-hand` is now `position: relative; display: block; overflow: visible`
  with `height: calc(var(--card-h) * var(--hand-card-scale) + 40px)` (arch
  headroom; a lifted/dragged card overflows upward over the toolbar transiently).
  Removed the `overflow-x:auto` horizontal-scroll behaviour. Added `.hand-ruler`
  (hidden, width/height = scaled card size — the measurement probe).
- `.my-hand .card-face` is now `position: absolute; left: 50%; top: 6px;
  transform-origin: center bottom` with a `transform` transition (resize/lift/
  drop animate). The old `:hover`/`:active` `translateY` rules were removed
  (an inline transform always wins; lift is JS-driven); kept the highlight ring
  and added `.card-lifted` (stronger shadow). `.card-dragging` now only sets
  `transition:none` + lift shadow (its transform is inline).
- Removed the two Delfino height-cap media blocks (`@media (max-height: 720px)`
  and `@media (max-height: 640px)`).
- Landscape (`max-height:500px`) `.my-hand` override updated off the old
  flex/scroll model to a compact arc height.

## Constraints honoured
- No game-logic changes: bid/play/socket emits, `trainingMode` routing, and
  backend are untouched. The drag/tap reorder reuses the existing
  `reorderArr`/`manualOrderKeys`/`saveManualOrder` path.
- No i18n keys added/changed (card glyphs aren't translated).
- Existing CSS variables/colours reused; no re-skin. No new dependencies.

## Verification

Temporary `?mock=hand-fixture` harness (added to `App.jsx`, then **removed** —
`App.jsx` is absent from the final diff). `&phase=playing` = my card turn
(tappable, trump ♠); default `&phase=bidding` = bidding panel + hand below. The
harness socket recorded emits to `window.__emits` so a click's played card could
be asserted. Production `npm run build` passes (127 modules). No console errors.

### Acceptance criteria (all held at 360×650, 390×700, 430×780 × Delfino S/M/L)

1. **All 8 cards form a readable arc; every top-left index legible at all sizes
   incl. L** — PASS (screenshots). Corner index is em-sized so it scales with
   the card.
2. **No horizontal scroll; all 8 fit the width at every size** — PASS.
   Programmatic bounds check: e.g. 360×650/S `minLeft=12, maxRight=348` (vw 360);
   `cardsFitWidth: true` at 360×650/L and 430×780/L. The x-step reserves the
   rotation overhang so edge cards never spill.
3. **Tapping lifts/straightens and plays the CORRECT card (leftmost/middle/
   rightmost)** — PASS. Hit-tested + clicked via real `elementFromPoint`:
   leftmost A♠ → emitted `AS`, middle Q♥ → `QH`, rightmost 8♦ → `8D`. Lift/
   straighten captured in `arc-430x780-L-lifted.png` (Q♥ rises vertical above
   the fan).
4. **Manual-mode long-press drag reorders correctly** — PASS. Switched to manual
   (Trier), long-pressed (>250ms) A♠ and dragged to the right end: DOM order and
   persisted `localStorage["coinche-hand-TEST01-3"]` both became
   `[SK,S10,HQ,H9,DJ,D8,C7,SA]` (A♠ moved to the end).
5. **Delfino S/M/L are three visibly distinct sizes at ALL heights** — PASS.
   Measured scaled card width at vh=650 (where the old caps had collapsed
   L→M): S=42, M=55, L=67 px — three distinct sizes again.
6. **Controls (bidding panel / toolbar) remain fully visible — nothing clipped**
   — PASS at every combo. Tightest cases checked programmatically:
   360×650/L and 430×780/L → `valuesAllVisible / actionsAllVisible /
   toolbarAllVisible / handWithinViewport` all true.

### Screenshots (`verification-screenshots/`)
- Bidding (panel + arc): `arc-360x650-{S,M,L}.png`, `arc-390x700-{S,M,L}.png`,
  `arc-430x780-{S,M,L}.png`
- Playing (tappable hand): `arc-360x650-S-playing.png`
- Lift/straighten: `arc-430x780-L-lifted.png`

## Caveats
- Verified via the synthetic fixture (mounts the real `GameBoard`), not a full
  live bots game; socket round-trips weren't exercised (the harness socket is a
  recorder). Tap/drag were driven through the real DOM event path.
- Drag was simulated with synthetic `PointerEvent`s + real long-press timing;
  `setPointerCapture` is now try/caught to tolerate synthetic/edge pointers.
- Hover-lift uses mouse enter/leave (desktop). On touch there's no hover, so the
  lift shows briefly on press (`pointerdown`) before the tap plays — the play
  itself targets the correct card regardless.
- Arc height adds ~arch headroom over the old flat strip; at the tightest case
  (360×650/L during BIDDING) the felt/`board-middle` is squeezed (opponent seats
  clip under its `overflow:hidden`) but all controls and the full hand stay
  visible, which is the acceptance bar.
- True on-device `100dvh` (carried over from the previous task) still only fully
  validates on a real mobile browser.

---

# COMPLETION.md — Collapsible bid bottom-sheet + highest-bid bar (follow-up task)

Branch: `fix/bidding-layout-mobile`
Date: 2026-05-23

## Goal

On short viewports, move the bid controls into a collapsible bottom **sheet** so
the full felt (all 3 opponents + their bid bubbles) and the full arc hand are
visible while bidding. OPEN = today's panel (value grid, suit picker,
Annoncer/Coinche/Passer, toolbar) in an opaque sheet that owns its layer (taps
can't fall through — preserves the 120/Capot fix). COLLAPSED = sheet slides out,
replaced by a slim highest-bid bar (top bid + bidder + an "Enchérir" affordance).
Tall viewports keep the sheet permanently open with no handle/bar (behaves like
before).

## What changed, per file

### `frontend/src/i18n/en.js` / `fr.js`
- Added `highestBid` (en `Highest bid` / fr `Enchère la plus haute`) and
  `bidSheetCta` (en `Bid` / fr `Enchérir`). `t.bid` stays `Annoncer` (fr), so the
  bar CTA needed its own key. No other strings hardcoded.

### `frontend/src/components/GameBoard.jsx`
- Module scope: `SHORT_VIEWPORT_QUERY = '(max-height: 820px)'`,
  `DEFAULT_BID_SHEET_OPEN = true` (one-line flip), `SHEET_SWIPE_CLOSE_PX = 45`,
  and a small `useMediaQuery(query)` hook.
- State `sheetOpen` (default from the const) + a `sheetSwipeYRef`. An effect
  re-opens the sheet each time `isMyBidTurn` becomes true. `isShortViewport`
  from the hook gates the gesture handlers (no-ops on tall).
- Handlers: `openBidSheet` (bar tap), `collapseBidSheet` (handle tap),
  `handleSheetPointerDown/Up` (swipe-down > 45px collapses). All guarded to
  short viewports.
- Extracted the toolbar into a single `handToolbar` element so it can live
  inside the sheet during my bid turn and in normal flow otherwise (declared
  once, no duplication).
- Restructured `.board-hand`: when `bidSheetActive` (`BIDDING && isMyBidTurn`)
  it renders a scrim (when open) + `.bid-bar` (collapsed affordance: highest
  value/suit/bidder + `bidSheetCta ▲`, derived from the same `currentBid` that
  feeds the central bid-focal) + a `.bid-sheet` (handle + `BiddingPanel` +
  `handToolbar`). Otherwise it renders shuffle/cut controls + `handToolbar` as
  before. The sheet sits before `.my-hand` in the DOM so tall in-flow ordering
  matches today (panel, toolbar, hand). Board-hand gets `has-bid-sheet` /
  `sheet-collapsed` classes for CSS to raise the hand.
- No bid/play/socket/logic changes — the sheet only shows/hides the same
  `BiddingPanel`.

### `frontend/src/App.css`
- Added `--sheet: #1e2a38` (opaque navy = existing `--ui-bg`). `.app` got
  `position: relative` so the absolute sheet/bar anchor to the (max-600px,
  centred) app box.
- Base (tall) rules: `.bid-sheet` is a plain in-flow flex container;
  `.bid-sheet-handle`, `.bid-bar`, `.bid-scrim` are `display:none` → identical
  to today.
- `@media (max-height: 820px)` (kept in sync with `SHORT_VIEWPORT_QUERY`): the
  sheet becomes `position:absolute; bottom:0; z-index:80`, opaque `var(--sheet)`,
  rounded top corners, sliding `transform: translateY(0 ↔ 110%)` over 0.32s
  (`pointer-events:none` when collapsed); the handle (44×5 pill), the slim
  `.bid-bar` (`z-index:70`, value=accent, red suit, muted bidder, success CTA),
  and a light `.bid-scrim` (`z-index:72`, `rgba(0,0,0,.22)`, pointer-events none)
  appear. `.board-hand.sheet-collapsed .my-hand { margin-bottom: 50px }` raises
  the arc hand clear of the collapsed bar.

## Threshold note (deviation from the suggested 760px)
The task suggested `max-height: 760px` but the acceptance asks for BOTH sheet
states at 430×**780**. 780 > 760 would make 430×780 a "tall" (permanently open)
screen with no collapsed state to screenshot. I set the threshold to **820px**
so all three listed short sizes (650/700/780) are collapsible while the tall
check (390×900) stays permanently open. The JS const and the CSS media query
both use 820 (a comment links them).

## Verification

Temporary `?mock=hand-fixture` harness (added to `App.jsx`, then **removed** —
`App.jsx` is unmodified in the final diff). Default `&` = mid-bidding on my turn
(sheet/bar); `&phase=playing` = my card turn (tap-to-play, no sheet). The harness
socket recorded emits to `window.__emits`. `npm run build` passes (127 modules).
No console errors.

### Acceptance criteria
1. **COLLAPSED: 3 opponents + bid bubbles + full arc hand visible; bar shows
   correct value/suit/bidder** — PASS. At 360×650/S measured: all of top
   (`Pass`), left (`90♥`), right (`80♣`) seats within viewport; bar text
   "Highest bid 90♥ · Bot3" (currentBid 90♥ by Bot3). Screens:
   `sheet-360x650-S-collapsed.png`, `sheet-360x650-L-collapsed.png`,
   `sheet-390x700-L-collapsed.png`, `sheet-430x780-L-collapsed.png`.
2. **OPEN: full value grid (120 + Capot), suit picker, action row, toolbar all
   visible, not clipped; sheet opaque** — PASS. 360×650/S: all 10 value buttons
   + 4 suits + action row + toolbar within viewport; sheet bg
   `rgb(30,42,56)` (opaque); bar hidden while open. Same true at 390×700/L and
   430×780/L. Screens: `sheet-360x650-S-open.png`, `sheet-390x700-L-open.png`,
   `sheet-430x780-L-open.png`.
3. **Tap bar → opens; tap handle / swipe down → collapses; animation smooth**
   — PASS. Bar tap set `bid-sheet open`; handle tap set `collapsed`; a synthetic
   swipe-down (Δy 70 > 45) collapsed it. 0.32s `translateY` transition.
4. **Arc hand cards NOT clipped under the bar at any size (esp. 360×650/L)** —
   PASS. 360×650/L collapsed: bar top 604, hand max-bottom 593 (clears), hand
   min-top 456 (not clipped at top), cards fit width. Also clears at 430×780/L.
5. **Tall (390×900): permanently open, no bar/handle, like today** — PASS.
   handle `display:none`, bar `display:none`, sheet `position:static`,
   `transform:none`. Screen: `sheet-390x900-tall-open.png`.
6. **Drag-reorder + tap-to-play still work; swipe-collapse doesn't trigger
   them** — PASS. Bidding + manual + collapsed: long-press drag moved A♠ to the
   end (DOM + localStorage updated) and the sheet stayed `collapsed` (no
   accidental toggle). Playing (`&phase=playing`): tapping leftmost/middle/
   rightmost played the correct cards (KS / 9H / AS) — and there is no sheet/bar
   during PLAYING (`hasSheet:false, hasBar:false`), so the gestures are mutually
   exclusive and cannot conflict.

### Screenshots (`verification-screenshots/`)
- `sheet-360x650-S-open.png`, `sheet-360x650-S-collapsed.png`,
  `sheet-360x650-L-collapsed.png`
- `sheet-390x700-L-open.png`, `sheet-390x700-L-collapsed.png`
- `sheet-430x780-L-open.png`, `sheet-430x780-L-collapsed.png`
- `sheet-390x900-tall-open.png` (tall, permanently open)

## Caveats
- Verified via the synthetic fixture (mounts the real `GameBoard`), not a live
  bots game; socket round-trips weren't exercised (recorder socket). Gestures
  were driven through the real DOM event path; the swipe-collapse used synthetic
  `PointerEvent`s with the real 45px threshold.
- Screenshot matrix focused on Delfino **L** (tightest) at the three short sizes
  plus S at 360×650; S/M are strictly easier (smaller cards) and the invariants
  (controls within viewport, hand clears bar, cards fit width) were checked
  programmatically at L.
- `coinche`/`surcoinche` action-row variants weren't separately exercised (the
  fixture bid wasn't coinchable by my team); the action row markup is unchanged
  and simply lives inside the sheet now.
- Threshold is 820px, not the suggested 760 — see "Threshold note" above.
- True on-device behaviour (dvh, real touch swipe momentum) only fully validates
  on a physical phone.

---

# COMPLETION.md — Float arc hand above the bar / sheet (positioning fix)

Branch: `fix/bidding-layout-mobile`
Date: 2026-05-24

## Goal

The previous task raised the collapsed-state hand with `margin-bottom: 50px`, but
50 px was *less* than the actual bar height (~46 px bar + its top border/shadow),
so the hand's resting offset sat too low: card bodies were hidden behind the slim
highest-bid bar and only each card's top index strip showed. Fix the resting
offset so the FULL tallest card (Delfino-L) always clears whatever is beneath it,
in both sheet states — without touching the felt.

Two resting offsets for `.my-hand`, both measured so the tallest card clears with
a small gap:
- **Sheet COLLAPSED** (bidding, short vp): hand floats just above the highest-bid
  **bar's** top edge.
- **Sheet OPEN** (bidding, short vp): hand rides up to float just above the
  **sheet's** top edge.

## What changed, per file

### `frontend/src/components/GameBoard.jsx`
- Module scope: `HAND_SHEET_GAP = 12` — the gap left between the floated hand and
  the bar/sheet top edge.
- Two refs (`bidBarRef`, `bidSheetRef`) attached to the existing `.bid-bar` and
  `.bid-sheet` elements (no markup added — refs only).
- New state `sheetMetrics { barH, sheetH }` + a `useLayoutEffect` that measures
  both via `offsetHeight` (ignores the slide transform, so the sheet is
  measurable even while translated off-screen; the bar is `display:none` when the
  sheet is open, so each reading is kept only when non-zero). A `ResizeObserver`
  on both + a window-resize listener re-measure on viewport/content change. Gated
  to `bidSheetActive && isShortViewport`; re-runs on `sheetOpen`.
- Derived `handLift`: on a short viewport during my bid turn it is
  `(sheetOpen ? sheetH : barH) + HAND_SHEET_GAP`; otherwise **0** (tall viewports
  and the playing phase are untouched).
- `.my-hand` gets an inline `style={{ transform: translateY(-handLift) }}` only
  when `handLift > 0` — the hand floats as a layer; nothing reflows.

### `frontend/src/App.css`
- Replaced the old `.board-hand.sheet-collapsed .my-hand { margin-bottom: 50px }`
  with `.board-hand.has-bid-sheet .my-hand { z-index: 90; transition: transform
  0.32s ease; }` inside the existing `@media (max-height: 820px)` block. z-index
  90 keeps the cards above the bar (70), scrim (72) and sheet (80); the `0.32s
  ease` matches the sheet's slide so hand + sheet move in sync.

## Constraints honoured
- **Felt untouched.** No change to `.board-middle`/felt height, flex, or
  overflow. Measured felt height is *identical* between collapsed and open at
  every size (see below) — only the hand layer's transform + z-index change.
- Arc geometry, corner index, drag-reorder and tap-to-play are unchanged; the
  lift is a Y-only container transform, and the drop math uses `clientX` + the
  container's X, so reorder is unaffected.
- No game-logic / socket / backend / i18n changes. No new dependencies.

## Verification

Temporary `?mock=bid-sheet-fixture` harness (added to `App.jsx`, then **removed**
— `App.jsx` is unmodified in the final diff, confirmed via `git diff --stat`).
`&size=S|M|L` set Mode Delfino; `&phase=PLAYING` exercised the playing hand.
`npm run build` passes (127 modules) before and after harness removal. Zero
console errors across the run.

Playwright in the BIDDING phase at 360×650, 390×700, 430×780 × Delfino S/M/L,
screenshotting sheet COLLAPSED and OPEN. Measured clearances (constant across the
three viewport heights because the lift is derived from the measured bar/sheet
height, not the viewport):

| Delfino | COLLAPSED: card-bottom → bar-top | OPEN: card-top* → sheet-top |
|---------|----------------------------------|-----------------------------|
| L       | **18.9 px**                      | **18.5 px**                 |
| M       | 20.8 px                          | 20.4 px                     |
| S       | 22.7 px                          | 22.3 px                     |

*"card-top → sheet-top" in the brief means the gap above the sheet's top edge;
measured as `sheet.top − card-bottom` (the lowest card's body clears the sheet by
that much). Smaller Delfino sizes clear by more (smaller cards sit higher).

### Acceptance criteria (all PASS)
1. **COLLAPSED: every card fully visible above the bar; 3 opponents + bids on the
   felt** — PASS. 360×650/L: lowest card-bottom 585.1, bar-top 604.0 (18.9 px
   clear); all 3 opponent seats within viewport; central bid focal "90♥ ▶ Your
   turn" + the three per-seat bids visible.
2. **OPEN: full arc above the sheet controls; value grid (incl. 120/Capot), suits,
   actions, toolbar all visible** — PASS. 360×650/L: all 10 value buttons
   (Capot bottom 504), suit row, action row (bottom 599) and toolbar (bottom 642)
   within viewport 650; hand floats above sheet-top 404.6 (cards' bottom 386.1).
3. **Felt same size in both states (full-bleed)** — PASS. `.board-middle` height
   was identical between collapsed and open at every size: L 295.1 px (360×650),
   M 313.8, S 332.4; 345.1 at 390×700, 425.1 at 430×780.
4. **360×650 / Delfino L specifically** — PASS. Collapsed clearance 18.9 px above
   the bar; open clearance 18.5 px above the sheet; nothing clipped top or bottom
   (collapsed card-min-top 448, open card-min-top 249 — both well inside the
   viewport).
5. **Hand animates in sync with the sheet** — PASS. Computed transition on
   `.my-hand` is `transform 0.32s ease`, identical to `.bid-sheet`'s — they
   translate together, no jump.
6. **Drag-reorder works at both offsets; PLAYING + tall unchanged** — PASS. In
   manual mode, a long-press (>250 ms) drag of A♠ to the right end reordered the
   hand (DOM + `localStorage["coinche-hand-TEST01-0"]` →
   `[SK,SQ,HJ,H9,DA,C10,C7,SA]`) in **both** the collapsed (translateY −58) and
   open (translateY −257) states, and the sheet did not toggle. PLAYING phase:
   `.my-hand` transform `none`, no sheet/bar. Tall (390×900): hand transform
   `none`, z-index `auto`, sheet `position:static`, bar/handle `display:none`.

### Screenshots (`verification-screenshots/`)
- `bidfix-360x650-{S,M,L}-{open,collapsed}.png`
- `bidfix-390x700-L-{open,collapsed}.png`
- `bidfix-430x780-L-{open,collapsed}.png`
- `bidfix-390x900-tall-open.png` (tall, permanently open, hand at baseline)

## Caveats
- Verified via the synthetic fixture (mounts the real `GameBoard`), not a live
  bots game; gestures were driven through the real DOM event path (synthetic
  `PointerEvent`s with the real 250 ms long-press timing).
- Screenshot matrix covers Delfino L (tightest) at all three short sizes plus
  S/M at 360×650; the clearance invariant was checked programmatically for every
  S/M/L combination.
- The fixture's `highBidder` name renders as "?" in the bar (the recorder
  fixture omits the field `displayName` reads); the bid value/suit ("90♥") is
  correct and the rendering path is unchanged — purely a fixture artifact.
- True on-device behaviour (dvh, real touch momentum) only fully validates on a
  physical phone.

---

# COMPLETION.md — Tighter bid sheet: legal-bids grid, merged row, icon toolbar

Branch: `fix/bidding-layout-mobile`
Date: 2026-05-24

## Goal

Collapse the bid sheet from ~4 chunky rows to ~2: render only *legal* bid values
(no greyed chips) in a two-row fill-then-stretch grid, merge the suit picker onto
the action row, turn the bidding-phase toolbar into a compact icon row, and
restrain colour to a single solid control (Annoncer). Render-filter + CSS only —
no bid/coinche/pass logic, validation, socket, or backend changes.

## What changed, per file

### `frontend/src/components/BiddingPanel.jsx`
- **Legal-bids-only grid.** `const legalValues = BID_VALUES.filter(isValidBid)`
  — reuses the *existing* `isValidBid` predicate (the same one `submitBid` guards
  on), so the grid can never offer a value the emit path would reject. Illegal
  values are not rendered at all (no `.disabled` chips in the DOM). The `disabled`
  attribute and the per-button `isValidBid` click-guard were removed (every
  rendered chip is legal).
- **Two-row fill-then-stretch.** `splitAt = ceil(N/2)`; rows =
  `[legalValues.slice(0, splitAt), legalValues.slice(splitAt)].filter(r => r.length)`.
  Each row is a flex container whose chips are `flex: 1`, so the bottom row
  stretches full-width (no lonely left-aligned chip). N=10→5+5, 6→3+3, 2→1+1, etc.
  Capot is just the last value in the sequence (no special-casing).
- **Merged suit + action row.** Suits moved into `.bid-action-row` as a
  `.suit-chips` group (shown only when not Capot and not surcoinche — same
  condition as before). Buttons renamed for the new styling: `btn-annoncer`
  (solid amber, the one primary), `btn-passer` (quiet navy),
  `btn-coinche-outline` / `btn-surcoinche-outline` (red outline). **Coinche!** is
  rendered only when the existing `canCoinche` is true (freeing space otherwise);
  **Surcoinche!** still replaces Annoncer/Coinche when `canSurcoinche`. All four
  handlers (`submitBid`/`pass`/`doCoinche`/`doSurcoinche`) and the emits are
  byte-for-byte unchanged.

### `frontend/src/components/GameBoard.jsx`
- The `handToolbar` const became `buildToolbar(compact)`, built from one source:
  same buttons, conditions (`isCreator`, `phase`, `trainingMode`) and i18n labels.
  `compact` renders each button as `.ti-icon` (glyph) over a `.ti-cap` (tiny
  caption = the existing label) and adds `.hand-toolbar-icons`; the full variant
  keeps the old inline "icon label". `handToolbar = buildToolbar(false)` (normal
  flow, unchanged), `bidToolbar = buildToolbar(true)` is rendered inside the
  sheet during the bid turn. The full-variant Leave button keeps its no-icon
  presentation (only the compact one gains the `⎋` glyph).

### `frontend/src/App.css`
- Rewrote the bidding-panel block: `.bid-values` is now a flex column of
  `.bid-values-row` flex rows; `.bid-val-btn` is a compact outlined chip
  (`min-height: 30px`, `var(--radius)`, transparent + thin light border) whose
  `.selected` state is the amber fill. `.bid-action-row` lays out `.suit-chips`
  (fixed 33 px outlined chips, selected = gold `outline`) + flexing action
  buttons. Added `.btn-annoncer` (solid amber — the only filled control),
  `.btn-passer` (quiet `#2c3e50` navy, distinct from the sheet behind it), and
  `.btn-coinche-outline` / `.btn-surcoinche-outline` (red outline). Added
  `.hand-toolbar-icons` (icon-over-caption, thin `border-left` dividers,
  transparent). Radius is unified to `var(--radius)` (6 px) across all chips for
  consistency. Removed the now-dead `.bid-values { grid-template-columns }` rule
  from the `min-width: 480px` block and rewired the landscape
  (`max-height: 500px`) overrides to the new class names.

## Legal-filter approach
The grid is derived purely from `isValidBid(v)`, which already encodes the rule:
opening (`!currentBid`) → all of 80…160 + Capot; otherwise only `v > currentBid.value`
plus Capot; nothing after a coinche; nothing above Capot. Because the **same
predicate** gates both the rendered set and `submitBid`, the UI cannot show a
value the server would reject. No validation or emit code was touched.

## Wrap math note
The brief's parenthetical "bid=110 → 4+2" doesn't match N: values `> 110` are
120,130,140,150,160 + Capot = **6**, and the brief's own ceil/floor list says
`6→3+3`. The implementation follows the stated `ceil(N/2)/floor(N/2)` rule, so
bid=110 renders **3+3** (120,130,140 / 150,160,Capot) — confirmed below.

## Verification

Temporary `?mock=bid-sheet-fixture` harness (`?size`, `?bid=open|110|150`,
`?team=opp|mine`), added to `App.jsx` then **removed** (App.jsx matches HEAD;
confirmed via `git diff --stat`). `npm run build` passes (127 modules); zero
console errors. Playwright at 360×650, 390×700, 430×780 × Delfino S/M/L. The
sheet content is size-independent (it uses fixed fonts, not `--hand-card-scale`),
so S/M/L produce an identical sheet; the hand clearance grows for smaller cards.

### Acceptance criteria (all PASS)
1. **Only legal values; no greyed/struck buttons in the DOM** — PASS. Querying
   `.bid-val-btn.disabled, [disabled]` returned **0** in every state (opening,
   110, 150, capot-selected).
2. **Two-row fill-then-stretch; bottom stretches full-width; no lonely chips** —
   PASS. Opening → `[80,90,100,110,120]/[130,140,150,160,Capot]` (5+5); bid=110 →
   `[120,130,140]/[150,160,Capot]` (3+3); bid=150 → `[160]/[Capot]` (1+1), each
   chip measured at **344 px** = full row width.
3. **Suits + Annoncer + Passer (+Coinche! only when legal) in ONE row, nothing
   clipped at 360 px** — PASS. bid=110 @ 360 with Coinche! eligible: suits (×4) +
   Bid (161–220) + Coinche! (226–286) + Pass (292–352) all within 360. With
   `team=mine` (not coinchable) Coinche! is absent; opening has no Coinche!.
4. **Compact icon toolbar, all four actions** — PASS. `.hand-toolbar-icons`
   present inside the sheet; captions `Sort / Undo / Manage / Leave table`
   (icons ⇅/♥, ↩, ⚙, ⎋).
5. **Only Annoncer solid; selected value amber; selected suit gold ring** — PASS.
   Bid is the lone `var(--accent)` fill; selecting a value adds `.selected`
   (amber); the selected suit shows the gold `outline`; Capot select lit amber.
6. **Sheet visibly shorter; opening (tallest) fits at 360×650/L; felt full-bleed;
   hand clears** — PASS. Sheet height **169.9 px** (was 245.4 px in the prior
   task — ~75 px shorter). Opening @ 360×650/L: card→sheet clearance **19.0 px**
   (open) / **18.9 px** above the bar (collapsed); `.board-middle` height
   identical between states (**316.8 px**), felt CSS untouched. Clearances at L
   are 19.0 px at all three viewports; M 20.9 px, S 22.8 px (smaller cards clear
   more). Toolbar within viewport at every size.
7. **Bidding works end-to-end (no logic regression)** — PASS. In the fixture:
   select 160 + suit ♠ → Annoncer emitted `placeBid {code:TEST01, value:160,
   suit:"S"}`; Passer → `passBid {code:TEST01}`; Coinche! → `coinche
   {code:TEST01}`. Selecting Capot hid the suit chips (4→0).

### Screenshots (`verification-screenshots/`)
- `tighten-360x650-{S,M,L}-open.png` (opening, 5+5)
- `tighten-360x650-L-bid110-coinche.png` (3+3 + Coinche! row at 360)
- `tighten-360x650-L-bid150-neartop.png` (1+1 stretched)
- `tighten-390x700-L-open.png`, `tighten-430x780-L-open.png`

## Caveats
- Verified via the synthetic fixture (mounts the real `GameBoard`), not a live
  bots game; clicks/selection driven through the real DOM event path and asserted
  against the recorded socket emits.
- Screenshot matrix focuses on the three auction states at 360×650/L (tightest
  width) plus S/M at 360 and L at 390/430; the legal-filter, wrap math, action-row
  fit and clearance invariants were checked programmatically for the other combos
  (the sheet is size-independent).
- The hand-offset measurement (prior task) re-measures the new shorter,
  variable-height sheet correctly — the open clearance held at ~19 px and the
  collapsed clearance at ~18.9 px.
- True on-device behaviour (dvh, real touch) only fully validates on a physical
  phone.

---

# COMPLETION.md — Suit picker as centered strip + suit echoed on value chips

Branch: `fix/bidding-layout-mobile`
Date: 2026-05-24

## Goal
Move the SUIT picker out of the action row (which last commit had merged onto it,
crowding/clipping "Annoncer") into its own centered strip between the value grid
and the action row (option B), and echo the currently-selected trump suit inline
on every value chip including Capot ("130♦", "Capot♦"). Display/CSS + render
placement only — **no** bidding logic, validation, socket, or backend changes, and
**no** change to what `placeBid` emits.

## What changed, per file

### `frontend/src/components/BiddingPanel.jsx`
- **Suit strip extracted to its own row.** The `.suit-chips` group was lifted out
  of `.bid-action-row` and now renders as a standalone block between `.bid-values`
  and `.bid-action-row`. Markup of the chips themselves (4 `.suit-btn` with the
  existing `red`/`black` + `selected` classes and `t.suitSymbol`) is byte-for-byte
  the same — only its DOM position changed.
- **`showSuits` condition relaxed** from `selectedValue !== 'capot' && !canSurcoinche`
  to `valueRows.length > 0 && !canSurcoinche`. The capot exclusion was dropped so the
  picker stays available when Capot is selected (a suit now echoes onto Capot too);
  gated on `valueRows.length > 0` so the strip never dangles with no biddable value.
  This is display-only — it does not affect what is emitted (see Capot finding).
- **Inline suit echo on value chips.** A `suitEcho` `<span className="bid-val-suit …">`
  (red/black per `selectedSuit`) is appended inside each chip in `renderVal`, after
  the number / "Capot". It is a pure DISPLAY mirror of `selectedSuit` — it reads the
  same state the strip sets and the same value `submitBid` already emits; it adds no
  per-chip property and changes no payload. Guarded by `selectedSuit && …` so it is
  absent if a suit is ever cleared.
- **Action row left clean.** `.bid-action-row` now contains only the action buttons
  (Annoncer / Coinche! when `canCoinche` / Passer, or Surcoinche! when
  `canSurcoinche`) — no suit glyph. All four handlers and emits are unchanged.

### `frontend/src/App.css`
- Added `.bid-val-suit` echo styles: `margin-left: 3px`; on the dark (unselected)
  chip `red → #ff7a7a`, `black → #cfd6dd` (light so it doesn't vanish); on the amber
  (selected) chip `.bid-val-btn.selected .bid-val-suit` `red → #c0392b` (darker),
  `black → #1a1a1a` (matches the chip's own selected text colour).
- `.suit-chips` is now a centered standalone strip (`justify-content: center`); the
  obsolete `flex: none` (it was a flex *item* in the action row) was removed. The
  `.suit-btn` chip styling and the gold `outline` `.selected` ring are unchanged.
- `.bid-action-row` block kept (flex row, `> button { flex: 1 }`) — now lays out only
  action buttons, so each flexes full-width. The landscape / compact `max-height`
  overrides (`.suit-chips`, `.suit-btn`, `.bid-action-row`) still apply by class name.

## Capot payload finding (important)
**Capot bids already carry a suit today — this is purely visual, "Capot♦" is
accurate, not cosmetic-only.** `submitBid` calls `emitBid(selectedValue, selectedSuit)`
for every value; `selectedSuit` is initialised to the sort candidate (or `'H'`) and
is *never null*, so a Capot bid emits e.g. `{value:"capot", suit:"D"}`. The previous
layout merely *hid* the suit chips when Capot was picked — it never stopped sending
the (last-selected/default) suit. Verified live: selecting Capot + ♦ → Annoncer
emitted `placeBid {code:"TEST01", value:"capot", suit:"D"}`. No logic was changed to
make this true; the echo just surfaces the suit that was always being sent.

### "No suit selected → no glyph" note
Because `selectedSuit` always has a default (`'H'` or the sort candidate), there is
no real "no suit selected" state in normal play — a glyph is therefore always shown
(matching today's always-suited payload). The `selectedSuit && …` guard keeps the
echo absent *if* a suit were ever cleared, but the existing default precludes that
state; deliberately not changed, since defaulting to null would change the payload.

## Verification
Temporary `?mock=bid-sheet-fixture` harness (real `.board-hand > .bid-bar +
.bid-sheet` structure wrapping the live `<BiddingPanel>`, the real GameBoard
hand-lift measuring effect + `handLift = sheetH + 12`, and a mock socket recording
emits) added to `App.jsx`, then **removed** — `git diff` shows App.jsx unchanged vs
HEAD and only `App.css` + `BiddingPanel.jsx` modified. `npm run build` passes (127
modules), zero console errors. Playwright at 360×650 / 390×700 / 430×780 × Delfino
S/M/L (the sheet uses fixed fonts, so S/M/L render an identical sheet; only the hand
clearance grows for smaller cards).

### Acceptance criteria
1. **No suit selected → no glyph; action row clean** — N/A in practice (default suit
   always set, see note); the conditional guard is in place. Action row carries no
   glyph in every state (`/[♠♥♦♣]/.test(actionRow.textContent)` = false). PASS.
2. **♦ selected → red ♦ on every legal value chip + Capot; darker red on the amber
   selected chip; actions still glyph-free** — PASS. Unselected chip glyph computed
   `rgb(255,122,122)` = `#ff7a7a`; selected (amber `rgb(240,165,0)`) chip glyph
   `rgb(192,57,43)` = `#c0392b`. `Capot♦` present. Action row glyph-free.
3. **♠ selected → light on dark chips, dark on amber chip; readable (same class
   covers ♣)** — PASS. Unselected glyph `rgb(207,214,221)` = `#cfd6dd`; selected
   (amber) glyph `rgb(26,26,26)` = `#1a1a1a`. Both legible (screenshot).
4. **Suit strip centered between values and actions; gold ring on selected** — PASS.
   Row tops values=493 / strip=564 / actions=603 (strip strictly between); selected
   `.suit-btn` keeps `outline: 2px solid var(--accent)`.
5. **Action row (Annoncer / Coinche! when legal / Passer) full-width, nothing clipped
   at 360px** — PASS. bid=110/opp @360: Bid 8–118, Coinche! 124–235, Pass 241–352 —
   all within 360, no overflow. bid=150/mine: Coinche! absent (not coinchable),
   Bid/Pass only.
6. **Emits UNCHANGED vs today** — PASS. `placeBid {value:120, suit:"S"}`,
   `placeBid {value:"capot", suit:"D"}`, `passBid {code}`, `coinche {code}` — all
   byte-identical to the prior task's recorded payloads. Capot finding above.
7. **Sheet still fits at 360×650/L, felt full-bleed, hand clears** — PASS. Open sheet
   height 180px occupying the bottom 180px of 650 (470px of felt above);
   `handTransform = translateY(-192)` = `sheetH(180) + HAND_SHEET_GAP(12)`; the
   `.my-hand` container clears the sheet top by **18px** (the real arc cards sit
   inside the 139px container, ≈ prior task's 19px). The hand-lift formula is
   unchanged, so the taller sheet auto-lifts the hand and the 12px structural gap
   holds. (The fixture's flat placeholder cards overflow the container — a
   fixture-only artifact, not the real arc geometry.) Felt CSS untouched.

### Screenshots (`verification-screenshots/`)
- `eval-360x650-L-open-default.png` — opening, default ♥ echo on all chips (5+5)
- `eval-360x650-L-bid110-diamond-130sel-coinche.png` — ♦ strip, 130♦ amber, Coinche! row
- `eval-360x650-L-bid110-spades-130sel.png` — ♠ readability (light on dark, dark on amber)
- `eval-390x700-M-open.png`, `eval-430x780-S-bid150-mine.png` (1+1, Bid/Pass only)

## Caveats
- The fixture reproduces the sheet + measuring effect faithfully, but its hand uses
  flat placeholder cards (not the real arc geometry), so absolute card-to-sheet pixel
  clearance is not meaningful from it — the *structural* gap (`handLift = sheetH+12`,
  18px container clearance) is what was validated and is geometry-independent.
- True on-device behaviour (dvh, real touch) only fully validates on a physical phone.
