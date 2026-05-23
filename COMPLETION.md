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
