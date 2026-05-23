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
