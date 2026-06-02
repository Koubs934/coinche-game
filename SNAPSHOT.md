# PROJECT SNAPSHOT — coinche-game-redesign

> Bootstrap snapshot for a fresh Claude Code conversation.
> Generated on the `redesign-frontend-v3` branch. Purpose: hand a new session the
> full state of the frontend redesign work (1920s French-club bidding-table mockup
> + Paris-pattern card pipeline) without it having to re-discover anything.

**Reading order for a new session:** §3 (BRIEF) → §3 (DESIGN-SYSTEM) → §4 (active HTML)
→ §3 (card COMPLETION/SOURCES) → §6 (prod frontend it eventually feeds into).

---

## 0. Orientation & caveats (read first)

- **Active reference mockup** = `redesign-mocks/01-bidding-table.html` (38 KB, 1222 lines).
  This is the file the most recent commits iterate on (paris-pro card swap, figure rank
  letters). It is embedded verbatim in §4.
- **Naming wrinkle:** `BRIEF.md` and `DESIGN-SYSTEM.md` describe a "clean rebuild" named
  `01-bidding-table-v2.html` and say the design tokens live there. In practice the work
  converged back onto `01-bidding-table.html` (the v2 file is an older 24 KB draft). Treat
  `01-bidding-table.html` as the source of truth for the current visual state; the v2 file
  is a parallel draft.
- **Two `COMPLETION.md` files exist:**
  - `redesign-mocks/COMPLETION.md` (root) — the redesign-v3 (HTML/layout) completion report.
  - `redesign-mocks/cards/COMPLETION.md` — the Paris-pattern **card pipeline** report.
  §3 embeds the **`cards/`** one (as requested). The root one is *not* embedded here.
- **Scope discipline (from BRIEF):** redesign work is confined to `redesign-mocks/`.
  `frontend/src/` and `backend/` are the live production app and were not to be touched by
  the redesign session. §6 documents the prod frontend for context / eventual integration.
- The active deck lives in `redesign-mocks/assets/cards/` (32 PNGs). The `redesign-mocks/cards/`
  directory is the **pipeline / tooling** workspace (Python + JS scripts, intermediate
  renders, backups), not the deck consumed by the HTML.

---

## 1. Git state

### Current branch
```
* redesign-frontend-v3
```

### All branches
```
  fix/bidding-layout-mobile
  main
* redesign-frontend-v3
  remotes/origin/HEAD -> origin/main
  remotes/origin/main
```
Git user: `Koubs934`. Default/main branch for PRs: `main`.

### Status (uncommitted changes)
```
?? reference.jpeg          # untracked, repo root
```
Working tree is otherwise clean. `reference.jpeg` at the repo root is untracked
(note: distinct from `redesign-mocks/reference.png`, the committed visual target).

### Last 20 commits
```
ebc00ae fix: render rank letters V/D/R on figure cards
38b3322 cards: add SOURCES_EVAL.md and paris-pro COMPLETION.md
597f7c0 cards: swap assets/cards to paris-pro deck, archive prior
a318502 cards: add Paris pattern paris-pro pipeline (source + slicer + 32 PNGs)
1779927 swap: use Paris pattern cards in 01-bidding-table.html
c63f72a fix: slicer y-offset, eliminate sliver bleed in card crops
1b8228a redesign v3: completion report
960efee redesign v3 phase 3+4: composition + polish
359c6bc redesign v3 phase 1+2: assets + clean rebuild
a03ff84 docs: brief for frontend redesign v3 session
06701e3 docs: add session artifacts before redesign worktree setup
5704c19 ui: header to exactly 2 rows with space-between layout
b98bb5f ui: Mode Delfino - move below Belote, restore total score position, swap emoji
df4f2c9 feat: Mode Delfino - hand card size toggle (S/M/L cycle, persisted)
fea6864 fix(training): correct rule-silent miscategorization + harden prompt
7447d6a fix: pièce + maître only apply to trump suit of contract
eee2200 fix: remove 21 broken training scenarios + add scan script
39a0e69 fix: auto-end Claude conversation on unmount
a15633b feat: V2.2 calibration - chiquer rename, pièce fix, glossary + few-shot
475ccd7 feat: display user's hand inside felt during Claude conversation
```
Reading the log: commits `a03ff84` onward (`docs: brief…`) are the redesign-v3 session;
everything from `06701e3` back is the production game/training app.

---

## 2. File structure

### `redesign-mocks/` tree (2 levels deep)
```
redesign-mocks/
├── 01-bidding-table.html          # 38 KB, 1222 lines — ACTIVE reference mockup (see §4)
├── 01-bidding-table-v2.html       # 24 KB — older "clean rebuild" draft
├── BRIEF.md                       # autonomous redesign brief (see §3)
├── DESIGN-SYSTEM.md               # design tokens & component rules (see §3)
├── COMPLETION.md                  # redesign-v3 (HTML) completion report  [NOT embedded]
├── reference.png                  # 1.95 MB — the visual target screenshot
├── package.json                   # playwright-only (see §5)
├── package-lock.json
├── node_modules/                  # (playwright + deps)
├── assets/
│   ├── cards/                     # 32 active paris-pro PNGs + back.svg + contact-sheet.html
│   ├── cards-source/              # Svg-cards-2.0.svg (master) + .fr.svg (French-default)
│   ├── cards-prev/                # 32 PNGs — earlier deck
│   ├── cards-backup-pre-pro/      # 32 PNGs — deck before paris-pro swap (archive)
│   ├── avatars/                   # pierre.svg sophie.svg marc.svg vous.svg (DiceBear CC0)
│   └── textures/                  # felt.png (256×256 seamless) + felt_tile_preview.png
├── cards/                         # CARD PIPELINE workspace (scripts + intermediates) — see below
│   ├── COMPLETION.md              # paris-pro card report (see §3)
│   ├── SOURCES_EVAL.md            # source-deck research (see §3)
│   ├── *.py / *.js                # pipeline scripts (full list below)
│   ├── Individual 2/              # ChatGPT-generated candidate images (rejected source)
│   ├── individual/                # 32 PNGs — intermediate per-card slices
│   ├── processed/                 # 32 PNGs — processed slices
│   ├── final/                     # final-stage PNGs
│   ├── paris-pro/                 # 32 final 600×870 PNGs (copied into assets/cards/)
│   ├── sources/                   # svg-cards-2.0.svg, svg-cards-cream.svg, master-cream.png
│   └── fonts/                     # font assets for rendering
├── screenshots/
│   ├── current-360.png / -390.png / -430.png   # 3 target viewports
│   ├── old-with-new-cards-{360,390,430}.png
│   ├── contact-sheet.png
│   └── paris-pro/                 # bidding-{360,390,430}, hand-*, zoom/, per-card/
└── scripts/
    ├── screenshot.js              # 3-viewport Playwright capture (per BRIEF)
    ├── screenshot_contact.js / screenshot_old.js
    ├── render_master.js / render_master_inline.js / render_source_master.html
    ├── slice_master.py / frenchify_svg.py / gen_felt.py / verify_cards.py
    ├── fetch_avatars.sh
    ├── preview_avatars.{js,html,png,svg} / preview_avatar.svg / preview_candidates.js
    ├── candidates/ candidates_view.{html,png}
    ├── source_master.png / preview_jack_spade.png
    └── (avatar + felt + master-render tooling)
```

### `redesign-mocks/assets/cards/` — the 32 expected cards (active deck)
PNG count: **32** ✓ (plus `back.svg` and `contact-sheet.html`).
```
7-coeur.png   8-coeur.png   9-coeur.png   10-coeur.png   V-coeur.png   D-coeur.png   R-coeur.png   A-coeur.png
7-carreau.png 8-carreau.png 9-carreau.png 10-carreau.png V-carreau.png D-carreau.png R-carreau.png A-carreau.png
7-trefle.png  8-trefle.png  9-trefle.png  10-trefle.png  V-trefle.png  D-trefle.png  R-trefle.png  A-trefle.png
7-pique.png   8-pique.png   9-pique.png   10-pique.png   V-pique.png   D-pique.png   R-pique.png   A-pique.png
--- non-card files ---
back.svg            # card back (pattern losangé doré)
contact-sheet.html  # 8×4 visual grid of all 32
```
Naming: `{7|8|9|10|V|D|R|A}-{coeur|carreau|trefle|pique}.png`, uniform 600×870 RGB.

### `redesign-mocks/cards/` — pipeline scripts
```
# Python
modify_svg.py            # SVG transforms: #base → cream fill/no-stroke, collapse <switch> to FR
slice_all.py             # slice 32 cards from master render by known SVG coords → 600×870
slice_deck.py            # (earlier) slicer for raster deck.png
normalize_cards.py       # normalize crops
finalize_cards.py        # final compositing onto cream canvas
inspect_borders.py       # debug: inspect card border pixels
validate.py              # 5 programmatic checks (count/dims/cream-edges/suit-ink/alpha)
verify_cards.py          # card verification
verify_final.py          # final verification pass
make_contact_sheet.py    # contact sheet builder
make_contact_sheet_pro.py# paris-pro contact sheet (8×4 on felt)

# JS (Playwright/Chromium)
render_master.js         # render cream SVG at 4× (8713×4865) via headless Chromium
screenshot_bidding.js    # bidding-table viewport screenshots
zoom_inspect.js          # 1/2/4× DPR zoom shots
single_card_zoom.js      # per-card zoom shots

# Non-script artifacts in cards/
deck.png, contact_sheet.png, contact_sheet_final.png, paris-pro-contact.png  (PNG outputs)
COMPLETION.md, SOURCES_EVAL.md  (docs — embedded in §3)
```

---

## 3. Key documentation (verbatim)

### 3.1 `redesign-mocks/DESIGN-SYSTEM.md`

````markdown
# Coinche bidding-table — design system v3

A 1920s French private club aesthetic for the bidding screen. All values are
implemented as CSS custom properties at the top of `01-bidding-table-v2.html`.

## Palette

| Token            | Hex       | Use                                              |
| ---------------- | --------- | ------------------------------------------------ |
| `--vert-tapis`   | `#1f3d2e` | Felt base                                        |
| `--vert-tapis-2` | `#25492f` | Felt highlight                                   |
| `--vert-ombre`   | `#0d1f17` | Felt shadow / panel back                         |
| `--or-laiton`    | `#c9a961` | Brass gold — primary accent                      |
| `--or-clair`     | `#e0c987` | Light gold — accent highlight                    |
| `--or-faible`    | `rgba(201,169,97,0.35)` | Faint gold — borders, dividers     |
| `--creme`        | `#f4e8d0` | Cream — body text, card cream tint                |
| `--creme-2`      | `#ead9b8` | Cream-2 — second tone                            |
| `--bordeaux`     | `#5a2a2a` | Bordeaux — Coinche/Surcoinche actions, dealer badge |
| `--vert-sauge`   | `#7daa7a` | Sage — reserved for trump indicators              |

## Typography

- Display: **Cinzel** (Google Fonts), 400/500/600/700.
  Used for COINCHE wordmark, score numbers, contract value, name plates.
- Display alt: **Cormorant SC** — small caps title alternative.
- Body: **Cormorant Garamond** — italics for caption, regular for sub-text.
- Card corner marks: Cinzel SemiBold (baked into the rendered card PNGs).

## Spacing scale (4-px base)

`--s-1: 4px` `--s-2: 8px` `--s-3: 12px` `--s-4: 16px` `--s-6: 24px` `--s-8: 32px` `--s-12: 48px`

## Elevation tokens

```css
--elev-raised:    0 1px 2px rgba(0,0,0,0.20), 0 4px 8px rgba(0,0,0,0.15);
--elev-floating:  0 4px 8px rgba(0,0,0,0.30), 0 12px 24px rgba(0,0,0,0.20);
--elev-prominent: 0 6px 12px rgba(0,0,0,0.40), 0 14px 28px rgba(0,0,0,0.25),
                  0 0 16px rgba(201,169,97,0.20);
```

`--elev-raised` for the score panels and bid container.
`--elev-floating` for the avatar rings and contract panel.
`--elev-prominent` for the active bottom-nav button (raised "Jeu") and the 80
selected bid (with the gold inner highlight).

## Fluid sizing

All major dimensions use `clamp(min, vw-based, max)`:

```
--avatar:      clamp(60px, 15.5vw, 80px)   /* player portrait */
--hand-card-w: clamp(44px, 11.5vw, 60px)   /* bottom hand */
--back-card-w: clamp(26px, 6.5vw, 34px)    /* Pierre's face-down */
```

A `@media (max-height: 700px)` block compresses everything for the 360×640
viewport (smallest target): smaller avatars, contract panel, wordmark, bid
buttons.

## Breakpoints

| Width | Height | Form factor target            |
| ----- | ------ | ----------------------------- |
| 360   | 640    | Older Android (worst case)    |
| 390   | 844    | iPhone 14, reference target   |
| 430   | 950    | iPhone 14 Pro Max, breathing  |

## Component rules

- **Oval table** is a flat ellipse (`border-radius: 50%`). Depth comes from
  inset shadow + radial gradient + a faint outer halo, **not** from
  `rotateX()`. (Lesson learned from prior iterations — 3D rotation
  compresses the vertical extent of the felt.)

- **Players** are positioned to visibly straddle the oval line — the avatar
  ring sits half inside, half outside the oval border. Pierre at top has a
  row of 5 face-down `back.svg` cards sitting just above his portrait.
  Vous at bottom has the dealer "D" badge and an active "À VOUS" pill;
  inactive players show "PASSE" in small letter-spaced caps.

- **Wordmark**: `COINCHE` in Cinzel 700 with `letter-spacing: 0.28em` and a
  cream→gold→brass vertical text gradient via `background-clip: text`.
  Subtitle "DEPUIS 1921" in tracked small Cinzel 400. Spade ornament with
  flanking thin gold lines below.

- **Card fan**: 9 cards, each rotated ±12.5° in 2.5° steps, transform-origin
  at 50% 110% (a virtual point below the card's bottom edge), with horizontal
  stride 42% of card width. Outer cards drop slightly (yLift = |offset|^1.6 *
  1.4 px) so the fan reads as a held hand, not a flat rainbow.

- **Bid row**: two-row grid. Row 1 = `PASSE | 80 | 90 | 100 | 110 | 120 |
  COINCHE`. Row 2 = `130 | 140 | 150 | 160 | CAPOT | SURCOINCHE`. Selected
  bid uses a bright gold gradient with inner highlight; coinche-class buttons
  are bordeaux.

## Asset inventory

```
assets/
├── cards/
│   ├── {7,8,9,10,V,D,R,A}-{coeur,carreau,trefle,pique}.png    (32 PNGs, ~600×853)
│   ├── back.svg
│   └── contact-sheet.html
├── cards-source/
│   ├── Svg-cards-2.0.svg          (Wikimedia master, English default)
│   └── Svg-cards-2.0.fr.svg       (post-processed: French is the default)
├── avatars/
│   └── pierre.svg, sophie.svg, marc.svg, vous.svg
│                                   (DiceBear notionists, public domain CC0)
└── textures/
    └── felt.png                    (256×256 seamless, Pillow-generated)
```

The 32 cards are sliced from the rendered Wikimedia master so all 12 court
cards (4 jacks, 4 queens, 4 kings) are the **distinct** historical Paris
pattern figures, not a single repeated illustration.
````

---

### 3.2 `redesign-mocks/cards/COMPLETION.md`

````markdown
# Paris pattern card redesign — completion report

## Outcome

32 professional Paris pattern (`portrait officiel`) playing cards
generated from David Bellot's `svg-cards-2.0.svg` master, integrated
into `redesign-mocks/01-bidding-table.html`.

- Files: `redesign-mocks/assets/cards/{rank}-{suit}.png`, 32 PNGs.
- Dimensions: uniform 600 × 870 RGB, no transparency.
- Naming: `{V|D|R|A|7|8|9|10}-{coeur|carreau|trefle|pique}.png`.
- Backup of previous cards: `redesign-mocks/assets/cards-backup-pre-pro/`.

## Source chosen

**`File:Svg-cards-2.0.svg`** by David Bellot (Wikimedia, LGPL v2.1+).

Why this beat the alternatives is documented in `SOURCES_EVAL.md`. The
short version: it is the canonical modern Paris pattern in vector form,
with named `<g>` elements per card making clean extraction trivial, and
all 12 face cards are visually distinct per suit (the four jacks, four
queens, four kings each have unique posture, garments, and props).

## Pipeline

```
sources/svg-cards-2.0.svg   ──[modify_svg.py]──▶ sources/svg-cards-cream.svg
                                                          │
                                                          ▼
                                  ──[render_master.js, Chromium 4×]──▶ sources/master-cream.png  (8713×4865)
                                                          │
                                                          ▼
                                                ──[slice_all.py]──▶ paris-pro/*.png  (600×870)
                                                          │
                                                          ▼
                                                ──[validate.py]──▶ pass/fail report
                                                          │
                                                          ▼
                                                ──[cp]──▶ assets/cards/*.png  (drop-in)
```

### `modify_svg.py`

Two transformations on the master SVG before render:

1. **`#base` rectangle**: original is `fill:#FFFFFF;stroke:#000000;stroke-width:2.5`.
   Replaced with `fill:#f4e8d0;stroke:none` so cards have a cream body
   and no harsh black outline. The cream value matches `--creme` in
   the bidding-table CSS, so cards blend with the design system.

2. **`<switch>` collapse**: SVG `<switch systemLanguage="…">` doesn't
   pick up the document's `lang="fr"` reliably in headless Chromium —
   default falls back to English (J/Q/K). Solution: collapse every
   switch in the document to its `systemLanguage="fr"` branch so we
   always get V/D/R.

### `render_master.js` (Playwright)

Loads the cream SVG inline into a minimal HTML page, sets viewport to
4× source units (8713 × 4865), screenshots with `omitBackground:true`.
The 4× upscale gives ~666 × 941 per card, comfortably above the 600 ×
870 target for clean Lanczos downsampling.

### `slice_all.py`

For each of the 32 cards:

- Compute pixel rect using known SVG coordinates (`COL_X[rank]`,
  `ROW_Y[suit]`, card 166.575 × 235.27 in source units, `viewBox`
  origin `(-0.2, -236)`).
- Crop master, downsize to 600 × 870 with Lanczos.
- Composite onto fresh cream canvas to fill the transparent
  rounded-corner pixels left by Chromium's `omitBackground`.

### `validate.py`

Five programmatic checks: filename count + names, dimensions + RGB
mode, edge cream uniformity at the four bounding-box corners (where
the rounded card cannot reach), suit-color presence by ink census
(reds for ♥♦, darks for ♣♠), alpha opacity. **All 32 cards pass.**

Plus a separate one-off uniformity check confirmed all V/D/R cards
have the figure ink-bbox centered at (300, 434) ± 1px and width
±2px — geometric uniformity is essentially perfect.

## Notable decisions

- **Output dimensions kept at 600 × 870** so the new cards drop into
  `assets/cards/` with no CSS changes in `01-bidding-table.html`.
- **No CSS-side border**. The cream-on-cream blend at card edges is
  intentional — matches the reference image (commercial Coinche app).
  CSS `border-radius` on `.card` already handles visible rounding.
- **Cream is `#f4e8d0`**, sourced from `--creme` in the design system.
  Avoids two-tone "card cream vs. design cream" mismatch.
- **Removed the SVG's 2.5px black stroke around `#base`** rather than
  trying to recolour it. A subtle gold border could be re-added later
  via CSS, but the bare cream looks closer to the reference.

## Visual self-evaluation (honest)

### What I'm satisfied with
- All 32 cards render identically in dimensions, framing, and corner
  geometry. The face-card figure positions match within ±2px.
- The four jacks, four queens, four kings are unmistakably distinct:
  V-coeur (Lahire), V-carreau (Hector), V-trefle (Lancelot),
  V-pique (Hogier) — anyone familiar with French cards will recognise
  the figures immediately.
- Cream backgrounds match the felt of the bidding table — no
  visual seam at card edges.
- Zooming the rendered hand to 4× device pixel ratio shows no edge
  aliasing, no rasterisation artifacts, no sliver bleed.
- Suit colours render correctly: bright red for ♥/♦ (the original SVG
  uses #E61408 / #E6180A, slightly less crimson than crimson-red but
  still unambiguously "playing-card red"), dark for ♣/♠.

### What could still be improved
- The bottom-right corner mark of ♠/♣ cards is visually identical to
  a small heart shape because the SVG simply rotates the suit glyph
  180°. This is faithful to the source but a custom-drawn rotated-spade
  glyph would be cleaner. Low priority — it's correct, just a quirk
  of the David Bellot art.
- The number-card pip layouts (especially 9, 10) follow the original
  SVG arrangement, which is slightly bottom-heavy compared to some
  modern decks. Acceptable but could be re-balanced if Aaron prefers.
- Aces are rendered with one large central pip plus the corner marks.
  Some commercial decks add ornamentation around the central pip
  (the "fancy ace of spades" tradition); this deck keeps it minimalist.
  Matches the reference image, so left as-is.

### Would a graphic designer call it commercial?
I believe yes for the player hand at game scale. Side-by-side with the
reference in `redesign-mocks/reference.png` (the commercial Coinche
app screenshot Aaron provided), the visual character is comparable —
distinct Paris pattern figures, cream body, no visible border, clean
corner marks. There may be subtle stylistic preferences that vary
between professional decks (saturation choices, line weight on the
figures) but the deck reads as "professional Paris pattern" rather
than "proto-quality slice".

## Validation artifacts

- `cards/paris-pro-contact.png` — 8 × 4 contact sheet, 300 × 435 per
  card on green felt background. Useful for spotting any one card
  that visually deviates from the others.
- `screenshots/paris-pro/bidding-{360,390,430}.png` — full bidding
  table at three viewport widths.
- `screenshots/paris-pro/hand-{360,390,430}.png` — clipped hand only.
- `screenshots/paris-pro/zoom/hand-zoom-{1,2,4}x.png` — same hand at
  device pixel ratios 1, 2, 4 for inspection at extreme zoom.
- `screenshots/paris-pro/per-card/card-{0..8}.png` — one image per
  card in the rendered hand at 4× DPR.

## File layout

```
redesign-mocks/
├── 01-bidding-table.html              # references assets/cards/*.png (unchanged)
├── assets/
│   ├── cards/                          # 32 new paris-pro cards (active)
│   └── cards-backup-pre-pro/           # 32 prior cards (backup)
└── cards/
    ├── COMPLETION.md                   # this file
    ├── SOURCES_EVAL.md                 # source research notes
    ├── modify_svg.py                   # SVG transform
    ├── render_master.js                # Chromium 4× render
    ├── slice_all.py                    # 32-card slicer
    ├── validate.py                     # programmatic checks
    ├── make_contact_sheet_pro.py       # contact sheet
    ├── screenshot_bidding.js           # bidding-table viewport shots
    ├── zoom_inspect.js                 # 1/2/4× DPR shots
    ├── single_card_zoom.js             # per-card zoom shots
    ├── paris-pro/                      # 32 final 600×870 PNGs
    ├── paris-pro-contact.png           # 8×4 contact sheet
    └── sources/
        ├── svg-cards-2.0.svg           # original Bellot master
        ├── svg-cards-cream.svg         # post-modify_svg.py
        └── master-cream.png            # 8713×4865 render
```

## Reproducing

```
cd redesign-mocks
python cards/modify_svg.py
node cards/render_master.js
python cards/slice_all.py
python cards/validate.py
python cards/make_contact_sheet_pro.py
node cards/screenshot_bidding.js
cp cards/paris-pro/*.png assets/cards/
```
````

---

### 3.3 `redesign-mocks/cards/SOURCES_EVAL.md`

````markdown
# Paris pattern source evaluation

Goal: identify the highest-quality public-domain Paris pattern source
for 32 Coinche cards (7,8,9,10,V,D,R,A × ♥♦♣♠) where each face card
must be visually distinct per suit.

## Sources surveyed

### 1. svg-cards-2.0.svg — Wikimedia Commons (David Bellot, 2005) — SELECTED

URL: https://commons.wikimedia.org/wiki/File:Svg-cards-2.0.svg
License: GNU LGPL v2.1+
Source units: 2178 × 1216, 52 cards + jokers + back, all in one document.

**Pros**
- Authentic Paris pattern (`portrait officiel`) — the four jacks, four
  queens, four kings are each drawn as a unique historical figure, exactly
  what Coinche players expect to see (Hogier, Argine, Charlemagne…).
- Vector source with named `<g id="…">` elements per card (e.g.
  `jack_spade`, `queen_heart`, `king_diamond`) — clean, predictable,
  programmatically extractable.
- Localised rank labels via SVG `<switch systemLanguage="…">` — French
  V/D/R available out of the box.
- Single canonical source: any visual consistency between suits/ranks is
  guaranteed because every card is built from the same primitives
  (`#base`, `#club`, `#spade`, `#jack_3`, …).

**Cons**
- Original `#base` fill is white with a 2.5px black stroke — needed
  modification to cream + no stroke to match the design system's
  `--creme: #f4e8d0`.
- The `<switch>` defaults to English in headless Chromium even when the
  document has `lang="fr"` — needed pre-processing to collapse to French.

### 2. Existing redesign-mocks/cards/deck.png — REJECTED

This was the prior source: a 1536×1024 raster of an unknown Paris
pattern deck. At ~192×256 per card, it is too low-resolution for clean
upscaling to the 600×870 target. The previously checked-in
`assets/cards/` was sliced from this and shows the consequences (rough
edges, inconsistent black borders, sliver bleed near corners).

### 3. SVG French portrait card deck (Category, Wikimedia) — REJECTED

URL: https://commons.wikimedia.org/wiki/Category:SVG_French_portrait_card_deck

Twelve individual SVGs for face cards only (`King_of_spades_fr.svg`,
etc.). Would have required sourcing the 16 number cards (A, 7–10 × 4
suits) elsewhere, risking a stylistic mismatch between the ranks. The
single-document master in source #1 is strictly better.

### 4. htdebeer/SVG-cards (GitHub) — NOT EXAMINED

Searched for but not deeply evaluated. The Bellot master at #1 was
already the canonical reference and met every requirement, so no
further search was necessary.

### 5. BnF Gallica historical scans — NOT NEEDED

Aaron's brief mentions Gallica as a possible source. Since the Bellot
master is already the canonical Paris pattern in modern publishing and
it produced professional-grade output, no need to fall back to scans
of historical decks (which would require additional work to clean).

## Decision

Use **svg-cards-2.0.svg** (David Bellot, 2005) with two SVG
modifications applied via `cards/modify_svg.py`:

1. `#base` rectangle: white fill + 2.5 black stroke → cream fill + no
   stroke (so the cards blend with the table felt and have no harsh
   black outline).
2. Every `<switch>` element collapsed to its `systemLanguage="fr"`
   text branch (force French rank labels regardless of locale).

Render via headless Chromium at 4× scale (8713 × 4865 master), slice
each card by its known SVG coordinates, composite onto a cream canvas
to fill the rounded-corner empty pixels, downsize to 600 × 870 PNG.

## Pipeline outputs

```
cards/sources/svg-cards-2.0.svg     — original master
cards/sources/svg-cards-cream.svg   — SVG after modify_svg.py
cards/sources/master-cream.png      — 8713×4865 PNG render
cards/paris-pro/{rank}-{suit}.png   — 32 final cards at 600×870 RGB
```

## Time spent

~30 minutes on source research + master-SVG inspection (per the brief's
30-minute minimum). The Bellot master was identified as canonical
quickly, so most of that time went into verifying it had distinct
faces per suit and the right primitives for clean extraction.
````

---

### 3.4 `redesign-mocks/BRIEF.md`

````markdown
# COINCHE BIDDING TABLE — AUTONOMOUS REDESIGN BRIEF

## TL;DR

Mobile-first redesign of the Coinche bidding table, **pro-grade, indistinguishable from a designed product**. 1920s French private club aesthetic. Three viewports: 360×640, 390×844, 430×950.

Visual reference: `redesign-mocks/reference.png` (the WhatsApp polished render). **Match its quality.**

This document is your single source of truth. You operate autonomously. Aaron returns periodically.

## Operating principles

You do NOT ask permission for:
- Tactical code/library/file/structure decisions
- Minor visual tweaks
- Tool installation (npm/pip whatever you need)

You DO escalate (write to `BRIEF-QUESTIONS.md` and pause) when:
- An asset is unobtainable and no fallback works
- The reference is ambiguous on a specific element
- You've iterated 5+ times on the same visual gap with diminishing returns
- A decision affects brand identity (style choices)

## Working environment

- Repo root: `C:/Users/Aaron/Projects/coinche-game-redesign/`
- Branch: `redesign-frontend-v3` (stay here, do not switch)
- Working directory: `redesign-mocks/`
- **DO NOT TOUCH**: `frontend/src/`, `backend/`, anything outside `redesign-mocks/`

## Tools to install on first run

```bash
# Playwright for autonomous visual self-evaluation
npm init -y
npm install -D @playwright/test playwright
npx playwright install chromium

# Image processing
pip install Pillow --break-system-packages
```

## The visual goal

Open `redesign-mocks/reference.png`. That's the target.

Anatomy of the target:
- **Top bar**: Score icon | Nous panel | COINCHE 500pts panel | Eux panel | hamburger
- **Oval table area**: rich green felt with subtle directional lighting; thin gold oval border; 4 players at cardinal positions visibly overlapping the oval line
- **COINCHE wordmark** with "DEPUIS 1921" subtitle and decorative spade ornament
- **Contract panel** inside oval: "Contrat en cours" / "80" / "Atout: ♠"
- **4 photo-realistic avatars** (NOT letters): Pierre top, Sophie left, Marc right, Vous bottom; PASSE labels; Vous has dealer "D" badge
- **Bid row** below table: PASSE | 80(selected) | 90 | 100 | 110 | 120 | COINCHE / second row 130-160 | CAPOT | SURCOINCHE
- **Hand of 9 cards** fanned at bottom: 7♣ 9♣ D♣ 10♦ A♥ R♥ D♥ 10♠ A♠
- **Bottom nav**: Chat | Offres | Jeu (raised, active) | Astuces | Réglages

## Design system (LOCKED — implement as CSS custom properties)

### Palette
```
--vert-tapis: #1f3d2e
--vert-ombre: #0d1f17
--or-laiton: #c9a961
--or-clair: #e0c987
--creme: #f4e8d0
--bordeaux: #5a2a2a
--vert-sauge: #7daa7a
```

### Typography
- Display: Cinzel (Google Font)
- Display alt: Cormorant SC
- Body: Cormorant Garamond
- Card corner marks: Cinzel SemiBold

### Spacing scale (4px base)
4, 8, 12, 16, 24, 32, 48 px

### Elevation tokens
```css
--elev-raised:    0 1px 2px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.15);
--elev-floating:  0 4px 8px rgba(0,0,0,0.3), 0 12px 24px rgba(0,0,0,0.2);
--elev-prominent: 0 6px 12px rgba(0,0,0,0.4), 0 14px 28px rgba(0,0,0,0.25), 0 0 16px rgba(201,169,97,0.2);
```

### Breakpoints
360 / 390 / 430 px width. All layouts must work at all 3 with no overflow.

Use `clamp()` with vh/vw for fluid sizing throughout.

## Lessons learned — DO NOT REPEAT THESE MISTAKES

1. **No CSS 3D rotateX() on the oval.** It compresses vertical extent. The reference is a flat ellipse; depth comes from lighting + composition + photo avatars.

2. **No synthetic SVG pip patterns for spot cards.** Loses gravure aesthetic. Use real Paris pattern card illustrations.

3. **No CSS patches over patches.** If an approach requires 5+ overrides, the approach is wrong. Restart that component.

4. **No identical figures across suits.** The 12 court cards must be 12 distinct historical characters (Lancelot/Hector/La Hire/Hogier for Valets; Argine/Rachel/Judith/Pallas for Dames; Alexandre/César/Charles/David for Rois).

5. **No SVGs loaded as `<img src>` referencing external `<image href>`.** Browser blocks. Use inline SVG, base64 data URIs, or process to PNG first.

6. **No letter placeholder avatars (P/S/M/V).** Flattens the composition into a schematic diagram. Use real portrait images.

## Phase plan

### Phase 1 — Asset acquisition (BLOCKING — do this first)

#### 1.1 Cards

Download the master Paris pattern deck SVG:
- URL: `https://upload.wikimedia.org/wikipedia/commons/4/4f/Svg-cards-2.0.svg`
- Save to: `redesign-mocks/assets/cards-source/Svg-cards-2.0.svg`

Fallback if the URL fails:
- https://commons.wikimedia.org/wiki/File:Svg-cards-2.0.svg (download manually)
- https://www.tekeye.uk/playing_cards/svg-playing-cards (zip file)
- https://github.com/htdebeer/SVG-cards (git clone)

Slice the master into 32 individual SVGs:
- Files: `redesign-mocks/assets/cards/{rank}-{suit}.svg`
- Ranks: `7, 8, 9, 10, V, D, R, A` (map source J/Q/K to V/D/R)
- Suits: `coeur, carreau, trefle, pique` (map source hearts/diamonds/clubs/spades)
- Coinche only uses 7-A; discard 2-6 from source.

Generate `redesign-mocks/assets/cards/contact-sheet.html` showing all 32 in 8×4 grid.

Verify visually: open the contact sheet, confirm 32 distinct cards with consistent style.

#### 1.2 Avatars (4 portraits)

Need: Pierre, Sophie, Marc, Vous. Style: vintage 1920s portraits OR sepia-toned modern photos OR illustrated portraits — must be cohesive across the 4.

**Approach:** generate via consistent AI prompts OR source from a free portrait library (Unsplash/Pexels) with cohesive sepia filter applied via Pillow.

Output: `redesign-mocks/assets/avatars/{name}.png`, 300×300 each, names: `pierre, sophie, marc, vous`.

If you genuinely cannot acquire 4 cohesive portraits autonomously, **escalate** — this is a brand decision.

#### 1.3 Felt texture

Source a subtle felt/wool texture, or generate via SVG noise. Save to `redesign-mocks/assets/textures/felt.png` (tileable, ~256×256).

#### 1.4 Card back

Pattern losangé doré for the back of Pierre's cards. SVG-generate it (geometric pattern). Save to `redesign-mocks/assets/cards/back.svg`.

### Phase 2 — Clean rebuild

Once Phase 1 is complete, build `redesign-mocks/01-bidding-table-v2.html` from scratch.

Keep the existing `01-bidding-table.html` untouched as reference for what worked.

Architecture rules:
- Single HTML file with inline `<style>`
- CSS custom properties at top implementing design system
- Mobile-first with `clamp()` for fluid sizing
- Component-oriented class naming
- No magic numbers — every value references a token

Build components in this order, screenshotting after each:
1. `.app` (felt bg)
2. `.topbar`
3. `.table` + `.oval`
4. `.player` × 4 (with avatar images + labels)
5. `.center` (logo + contract panel)
6. `.bid-row`
7. `.hand` (fan of 9 cards)
8. `.bottomnav`

### Phase 3 — Composition

Tune positions to match reference. Cible :
- Oval fills majority of available vertical space (≥55% of viewport height)
- Players visibly straddle the oval line (~50/50 inside/outside)
- Composition is dense (no large empty felt areas)
- Vertical hierarchy fits without overflow at all 3 viewports

### Phase 4 — Polish

- Directional lighting on felt (radial gradient brighter near top center)
- Apply elevation tokens consistently
- Card fan calibration: angles ±10° in 2.5° steps, transform-origin 50% 100%
- Bottom nav active state for Jeu (raised circle)
- Final typography pass (Cinzel kerning on COINCHE wordmark)

## Visual self-evaluation protocol

Create `redesign-mocks/scripts/screenshot.js`:

```javascript
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const viewports = [
    {w: 360, h: 640, name: '360'},
    {w: 390, h: 844, name: '390'},
    {w: 430, h: 950, name: '430'}
  ];
  for (const vp of viewports) {
    const ctx = await browser.newContext({viewport: {width: vp.w, height: vp.h}});
    const page = await ctx.newPage();
    await page.goto('http://localhost:8000/01-bidding-table-v2.html');
    await page.waitForTimeout(500);
    await page.screenshot({path: `screenshots/current-${vp.name}.png`, fullPage: true});
    await ctx.close();
  }
  await browser.close();
})();
```

After each meaningful change:
```bash
cd redesign-mocks
python -m http.server 8000 &
SERVER_PID=$!
sleep 1
node scripts/screenshot.js
kill $SERVER_PID
```

Then INSPECT each screenshot. Compare to `reference.png`. List the visual gaps. Address the largest gap first. Repeat.

## Done criteria

Done when ALL of these are true:
- All 4 phases complete
- Screenshots at 3 viewports show no overflow, no visual bugs
- Visual gap with reference is below "noticeable at glance" threshold
- All assets are in `assets/`
- HTML/CSS consistently uses design tokens
- Contact sheet shows 32 distinct cards

## File structure (target end state)

```
redesign-mocks/
├── reference.png                       # KEEP — visual target
├── BRIEF.md                            # this doc
├── BRIEF-QUESTIONS.md                  # escalations (create if needed)
├── DESIGN-SYSTEM.md                    # write this in Phase 2
├── 01-bidding-table.html               # KEEP — old version for comparison
├── 01-bidding-table-v2.html            # NEW clean version
├── assets/
│   ├── cards/
│   │   ├── 7-coeur.svg ... A-pique.svg # 32 cards
│   │   ├── back.svg
│   │   └── contact-sheet.html
│   ├── cards-source/
│   │   └── Svg-cards-2.0.svg
│   ├── avatars/
│   │   └── pierre.png, sophie.png, marc.png, vous.png
│   └── textures/
│       └── felt.png
├── screenshots/
│   └── current-360.png, current-390.png, current-430.png
└── scripts/
    ├── slice-deck.py
    └── screenshot.js
```

## Start now

Phase 1.1 first. Download, slice, contact sheet, verify. Don't touch HTML until cards are pro.

If at any point you're tempted to "patch" or "work around" — STOP. That's the bricolage trap. Solve root cause or escalate.
````

---

## 4. Active HTML mockup — `redesign-mocks/01-bidding-table.html` (verbatim, 1222 lines)

````html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>Coinche — Bidding Table Mockup</title>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cormorant+SC:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap" rel="stylesheet" />

<style>
:root {
  --vert-tapis:  #1f3d2e;
  --vert-ombre:  #0d1f17;
  --or-laiton:   #c9a961;
  --or-clair:    #e0c987;
  --creme:       #f4e8d0;
  --bordeaux:    #5a2a2a;
  --vert-sauge:  #7daa7a;

  --display: 'Cinzel', serif;
  --body:    'Cormorant Garamond', serif;

  /* Fluid sizing — scales 360x640 → 430x950 viewports */
  --avatar-h:    clamp(48px, 7.8vh, 64px);
  /* Hand cards: ~70% larger than v1 max (was 56). Vh-based so card
     height fits the available hand container, not just viewport width. */
  --card-w:      clamp(40px, 10vh, 96px);
  --card-h:      calc(var(--card-w) * 1.5);
  --card-back-w: clamp(22px, 5.2vw, 32px);
  --card-back-h: calc(var(--card-back-w) * 1.5);
}

body.font-b {
  --display: 'Cormorant SC', serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%;
  background: #000;
  color: var(--creme);
  font-family: var(--body);
  font-size: clamp(0.7rem, 1.3vh, 0.9rem);
  -webkit-font-smoothing: antialiased;
  font-smoothing: antialiased;
  overflow: hidden;
}

body {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ------- Debug font toggle (out of mockup) ------- */
.font-toggle {
  position: fixed;
  top: 2px;
  right: 2px;
  z-index: 999;
  display: inline-flex;
  background: rgba(20,20,20,0.85);
  border: 1px solid #333;
  border-radius: 3px;
  overflow: hidden;
  font-family: ui-monospace, monospace;
  font-size: 8px;
  color: #aaa;
  opacity: 0.4;
  transition: opacity 0.15s ease;
}
.font-toggle:hover { opacity: 1; }
.font-toggle button {
  background: transparent;
  color: #aaa;
  border: 0;
  padding: 2px 4px;
  cursor: pointer;
  letter-spacing: 0.3px;
  font-family: inherit;
  font-size: inherit;
}
.font-toggle button.active {
  background: #c9a961;
  color: #1a1a1a;
  font-weight: 600;
}
/* Hide chip on narrow viewports — keyboard `T` shortcut still works */
@media (max-width: 380px) {
  .font-toggle { display: none; }
}

/* ------- App frame: fills viewport, capped on desktop ------- */
.app {
  position: relative;
  width: 100%;
  max-width: 430px;
  height: 100%;
  background:
    /* central warm spotlight — light pulled higher and stronger so the
       eye is drawn toward the contract panel */
    radial-gradient(
      ellipse at 50% 30%,
      rgba(48, 88, 65, 0.35) 0%,
      transparent 50%
    ),
    /* lit center / dark corners — pronounced felt vignette */
    radial-gradient(
      ellipse at center,
      var(--vert-tapis) 25%,
      rgba(13, 31, 23, 0.88) 100%
    ),
    var(--vert-tapis);
  overflow: hidden;
  font-family: var(--body);
  color: var(--creme);
  box-shadow: 0 0 80px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
}

.display { font-family: var(--display); }

/* ============= TOP BAR ============= */
.topbar {
  display: flex;
  align-items: center;
  gap: clamp(4px, 1.6vw, 10px);
  padding: clamp(4px, 1vh, 9px) clamp(8px, 3vw, 14px) clamp(2px, 0.5vh, 5px);
  flex-shrink: 0;
}

.icon-btn {
  flex-shrink: 0;
  width: clamp(32px, 5.2vh, 42px);
  height: clamp(32px, 5.2vh, 42px);
  border: 1px solid var(--or-laiton);
  border-radius: 6px;
  background:
    linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.25));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--or-laiton);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 1px 2px rgba(0, 0, 0, 0.25),
    0 2px 6px rgba(0, 0, 0, 0.15);
}
.icon-btn .label {
  font-family: var(--body);
  font-size: clamp(7px, 1.1vh, 9px);
  letter-spacing: 0.5px;
  margin-top: 1px;
}
.icon-btn.score { flex-direction: column; gap: 0; }
.icon-btn.score .bars {
  display: flex;
  align-items: flex-end;
  gap: 1.5px;
  height: 11px;
}
.icon-btn.score .bars span {
  width: 2px;
  background: var(--or-laiton);
  border-radius: 1px;
}
.icon-btn.score .bars span:nth-child(1){ height: 5px; }
.icon-btn.score .bars span:nth-child(2){ height: 8px; }
.icon-btn.score .bars span:nth-child(3){ height: 11px; }

.icon-btn.menu {
  border-radius: 50%;
  font-size: 18px;
  letter-spacing: 1px;
  flex-direction: column;
  gap: 3px;
}
.icon-btn.menu span {
  display: block;
  width: 16px;
  height: 1.5px;
  background: var(--or-laiton);
  border-radius: 1px;
}

.score-panels {
  display: flex;
  flex: 1;
  gap: 0;
  height: clamp(32px, 5.2vh, 42px);
  border: 1px solid var(--or-laiton);
  border-radius: 4px;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 0 0 0.5px rgba(224, 201, 135, 0.15),
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 3px 8px rgba(0, 0, 0, 0.18);
}

.score-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2px 4px;
  background: rgba(0,0,0,0.15);
  border-right: 1px solid var(--or-laiton);
}
.score-panel:last-child { border-right: 0; }

.score-panel .lbl {
  font-family: var(--body);
  font-size: clamp(8px, 1.3vh, 11px);
  color: var(--or-clair);
  letter-spacing: 0.5px;
}
.score-panel .val {
  font-family: var(--display);
  font-size: clamp(0.95rem, 2vh, 1.2rem);
  color: var(--or-clair);
  font-weight: 500;
  margin-top: -1px;
}

.score-panel.coinche {
  flex: 1.5;
  background: rgba(0,0,0,0.25);
}
.score-panel.coinche .lbl {
  font-size: clamp(9px, 1.4vh, 12px);
  letter-spacing: 1.5px;
  color: var(--or-laiton);
}
.score-panel.coinche .val {
  font-size: clamp(10px, 1.5vh, 13px);
  letter-spacing: 0.5px;
  font-family: var(--body);
  color: var(--or-clair);
  margin-top: 0;
}

.score-panel.eux {
  background: linear-gradient(to bottom, rgba(90,42,42,0.5), rgba(0,0,0,0.15));
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}

/* ============= TABLE ============= */
.table {
  position: relative;
  flex: 1 1 auto;
  margin: 0 clamp(6px, 2vw, 12px);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

/* Oval — lit playing surface distinct from the outer felt.
   Flat 2D ellipse, sized to occupy the majority of the table area
   (96% wide × 58% tall ≈ 1.66:1) so it has presence — like the
   WhatsApp ref. Depth-pass styling (interior gradient, gold rim,
   inner ring, inset pénombre, warm halo) carries the table feel. */
.oval {
  position: absolute;
  top: 21%;
  left: 2%;
  right: 2%;
  bottom: 21%;
  border: 1.5px solid rgba(201, 169, 97, 0.65);
  border-radius: 50%;
  pointer-events: none;
  /* Interior fill — slightly warmer/lighter than the felt outside,
     giving the impression of a lit playing zone */
  background:
    radial-gradient(
      ellipse at center,
      rgba(40, 75, 56, 0.45) 0%,
      rgba(31, 61, 46, 0) 75%
    );
  box-shadow:
    /* inner gold ring — the table's rim */
    inset 0 0 0 0.5px rgba(224, 201, 135, 0.25),
    /* internal pénombre — felt curves inward */
    inset 0 0 30px rgba(13, 31, 23, 0.35),
    /* warm ambient halo around the rim */
    0 0 24px rgba(201, 169, 97, 0.10);
}

/* Players — avatar/name positioned around the oval */
.player {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: auto;
  text-align: center;
}

/* Players — flat 2D positioning. Avatars straddle the oval line at
   their respective edges. With the larger oval (21% top / 79% bottom)
   there's more clearance room between Pierre and the center logo, so
   the Pierre shift is reduced — he can sit closer to the oval edge. */
/* Pierre: a small shift only — avatar straddles the new oval top
   edge (21%). Name-wrap descends into the (taller) oval interior. */
.player.top    { top: 21%; left: 50%; transform: translate(-50%, calc(var(--avatar-h) / -2 - clamp(8px, 1.2vh, 14px))); }
/* Sophie: avatar-center on oval mid-left (equator, 50%) */
.player.left   { top: 50%; left: 0;   transform: translateY(calc(var(--avatar-h) / -2)); }
/* Marc: avatar-center on oval mid-right (equator, 50%) */
.player.right  { top: 50%; right: 0;  transform: translateY(calc(var(--avatar-h) / -2)); }
/* Vous: avatar-center on the new oval bottom edge (79%); name-wrap
   descends into the bid-row zone, which is intended. */
.player.bottom { top: 79%; left: 50%; transform: translate(-50%, calc(var(--avatar-h) / -2)); }

.avatar {
  position: relative;
  width: var(--avatar-h);
  height: var(--avatar-h);
  border-radius: 50%;
  border: clamp(2px, 0.4vh, 3px) solid var(--or-laiton);
  box-shadow:
    inset 0 0 0 0.5px rgba(224, 201, 135, 0.25),
    inset 0 1px 2px rgba(0, 0, 0, 0.4),
    0 0 10px rgba(224, 201, 135, 0.12),
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 6px 14px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-size: clamp(1.2rem, 3vh, 1.8rem);
  color: var(--or-clair);
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  letter-spacing: 1px;
  background:
    radial-gradient(circle at 35% 30%,
      rgba(201, 169, 97, 0.18) 0%,
      transparent 60%),
    radial-gradient(circle at center,
      var(--vert-tapis) 0%,
      var(--vert-ombre) 100%);
}

.player .name {
  font-family: var(--body);
  font-size: clamp(11px, 1.7vh, 14px);
  color: var(--creme);
  margin-top: 4px;
  letter-spacing: 0.3px;
}
.player .status {
  font-family: var(--body);
  font-size: clamp(9px, 1.3vh, 11px);
  letter-spacing: 1.5px;
  color: var(--vert-sauge);
  font-weight: 500;
}
.player.bottom .status {
  color: var(--or-clair);
  font-weight: 600;
  letter-spacing: 2px;
}

.player .name-wrap {
  position: relative;
  border: 1px solid rgba(201,169,97,0.5);
  border-radius: 4px;
  padding: clamp(1px, 0.3vh, 3px) clamp(6px, 2vw, 10px);
  background: rgba(0,0,0,0.25);
  margin-top: clamp(2px, 0.5vh, 4px);
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.15;
}
.player .name-wrap .name { margin-top: 0; }
.player .name-wrap .status { margin-top: 0; }

/* Vous info row — name-wrap + contextual PASSE button alongside */
.vous-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: clamp(6px, 1.5vw, 10px);
  margin-top: clamp(2px, 0.5vh, 4px);
}
.vous-info .name-wrap {
  /* override the player name-wrap top margin (we manage it on the row) */
  margin-top: 0;
}

.pass-btn {
  font-family: var(--body);
  font-size: clamp(9px, 1.3vh, 11px);
  font-weight: 500;
  letter-spacing: 1.5px;
  color: var(--vert-sauge);
  background: var(--vert-tapis);
  border: 1px solid var(--or-laiton);
  border-radius: 4px;
  padding: clamp(3px, 0.6vh, 6px) clamp(8px, 2.2vw, 14px);
  /* Comfortable tap target via min-height even though visual stays compact */
  min-height: clamp(30px, 4.2vh, 40px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
}
.pass-btn:hover,
.pass-btn:focus,
.pass-btn:focus-visible {
  background: rgba(0, 0, 0, 0.35);
  color: var(--or-clair);
  border-color: var(--or-clair);
  outline: none;
}

/* Dealer badge — mini avatar treatment, clearly raised over the avatar */
.dealer-badge {
  position: absolute;
  right: -6px;
  top: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid var(--or-laiton);
  background:
    radial-gradient(circle at 35% 30%,
      rgba(244, 232, 208, 0.4) 0%,
      transparent 60%),
    radial-gradient(circle at center, #d4b878 0%, #a8893f 100%);
  color: var(--vert-ombre);
  font-family: var(--display);
  font-weight: 700;
  font-size: 10px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-shadow: 0 1px 0 rgba(255,255,255,0.25);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,0.35),
    0 0 6px rgba(224, 201, 135, 0.25),
    0 2px 4px rgba(0, 0, 0, 0.45),
    0 4px 8px rgba(0, 0, 0, 0.25);
}

/* Pierre's card fan — opens wider above his head for a clearer
   "cards held above" impression */
.card-fan {
  position: absolute;
  top: calc(var(--card-back-h) * -0.5 - 5px);
  left: 50%;
  transform: translateX(-50%);
  width: calc(var(--card-back-w) * 5);
  height: calc(var(--card-back-h) * 1.5);
  pointer-events: none;
  z-index: 0;
}
.card-back {
  position: absolute;
  width: var(--card-back-w);
  height: var(--card-back-h);
  left: 50%;
  top: 0;
  margin-left: calc(var(--card-back-w) / -2);
  border-radius: 4px;
  background-color: var(--vert-tapis);
  background-image:
    repeating-linear-gradient(45deg,
      transparent 0, transparent 7px,
      rgba(201, 169, 97, 0.25) 7px, rgba(201, 169, 97, 0.25) 8px),
    repeating-linear-gradient(-45deg,
      transparent 0, transparent 7px,
      rgba(201, 169, 97, 0.25) 7px, rgba(201, 169, 97, 0.25) 8px);
  border: 1.5px solid var(--or-laiton);
  box-shadow:
    inset 0 0 0 1px rgba(15,30,22,0.6),
    0 1px 3px rgba(0,0,0,0.4);
  transform-origin: 50% 100%;
}
.card-back::after {
  content: '♠';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(9px, 1.4vh, 12px);
  color: var(--or-laiton);
  opacity: 0.3;
}
.card-fan .card-back:nth-child(1) { transform: rotate(-32deg) translate(calc(var(--card-back-w) * -1),    25%); }
.card-fan .card-back:nth-child(2) { transform: rotate(-16deg) translate(calc(var(--card-back-w) * -0.5),  6%); }
.card-fan .card-back:nth-child(3) { transform: rotate(0deg)   translate(0, 0); }
.card-fan .card-back:nth-child(4) { transform: rotate(16deg)  translate(calc(var(--card-back-w) * 0.5),   6%); }
.card-fan .card-back:nth-child(5) { transform: rotate(32deg)  translate(var(--card-back-w),              25%); }

/* Make Pierre's avatar sit above the fan */
.player.top .avatar { z-index: 2; }
.player.top .card-fan { z-index: 0; }

/* ============= CENTER LOGO + CONTRAT ============= */
/* Centered both axes inside the oval bounding box. On tall viewports
   (>=740px), nudged down a few pixels to compensate for the asymmetry
   created by Pierre's name-wrap eating the upper oval space while
   Vous's name-wrap lives below the oval entirely. */
.center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: clamp(140px, 50vw, 200px);
  display: flex;
  flex-direction: column;
  align-items: center;
}
@media (min-height: 740px) {
  .center {
    top: calc(50% + clamp(0px, 0.2vh, 2px));
  }
}
/* (max-height: 700px center upshift removed — the larger oval gives
   Vous enough clearance below center without compensation, and the
   upshift was causing Pierre's name-wrap to overlap the logo
   ornament on small viewports.) */

.logo-block {
  text-align: center;
  margin-bottom: clamp(2px, 0.6vh, 6px);
  /* Logo sits ABOVE the contrat-panel for the slight overlap effect */
  position: relative;
  z-index: 2;
}
.logo-ornament {
  font-size: clamp(11px, 1.8vh, 15px);
  color: var(--or-laiton);
  letter-spacing: 6px;
  line-height: 1;
  margin-bottom: clamp(1px, 0.3vh, 3px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.logo-ornament .swirl {
  display: inline-block;
  height: 1px;
  background: var(--or-laiton);
  width: clamp(20px, 6vw, 30px);
  position: relative;
}
.logo-ornament .swirl::before,
.logo-ornament .swirl::after {
  content: '';
  position: absolute;
  width: 4px;
  height: 4px;
  border: 1px solid var(--or-laiton);
  border-radius: 50%;
  top: -2px;
}
.logo-ornament .swirl.left::before { right: 0; }
.logo-ornament .swirl.right::after { left: 0; }

.logo-title {
  font-family: var(--display);
  font-size: clamp(1.2rem, 3.5vh, 1.8rem);
  letter-spacing: 0.22em;
  color: var(--or-laiton);
  font-weight: 600;
  line-height: 1;
  margin: clamp(1px, 0.3vh, 4px) 0 clamp(2px, 0.5vh, 5px);
}
.logo-tagline {
  font-family: var(--body);
  font-size: clamp(0.55rem, 1vh, 0.7rem);
  letter-spacing: 0.3em;
  color: var(--or-laiton);
  text-transform: uppercase;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.logo-tagline::before,
.logo-tagline::after {
  content: '';
  height: 1px;
  background: var(--or-laiton);
  width: clamp(10px, 4vw, 18px);
  display: inline-block;
}

/* Hide swirls on tight viewports — keep just the central spade */
@media (max-height: 700px) {
  .logo-ornament .swirl { display: none; }
}

/* Contrat panel — premium focal point: gold-rimmed casket with the
   cream "80" cell sitting like a jeton inside.
   Negative margin-top + lower z-index makes the logo above appear
   to slightly overlap the panel's top edge ("posé au centre, sous
   le logo"). */
.contrat-panel {
  width: clamp(108px, 32vw, 140px);
  margin-top: clamp(-8px, -1vh, -4px);
  position: relative;
  z-index: 1;
  background:
    radial-gradient(
      ellipse at center,
      rgba(20, 45, 32, 0.95) 0%,
      var(--vert-ombre) 100%
    );
  border: 1px solid var(--or-laiton);
  border-radius: 4px;
  padding: clamp(3px, 0.7vh, 7px) clamp(8px, 2.5vw, 12px) clamp(4px, 0.8vh, 8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow:
    /* inner gold ring — the casket's lining */
    inset 0 0 0 0.5px rgba(224, 201, 135, 0.4),
    /* subtle top highlight as if lit from above */
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    /* internal darkening into the corners */
    inset 0 0 14px rgba(0, 0, 0, 0.45),
    /* deep drop shadow — sits above the felt */
    0 4px 12px rgba(0, 0, 0, 0.4),
    /* warm gold halo — premium ambient */
    0 0 24px rgba(201, 169, 97, 0.06);
}
.contrat-panel .header {
  font-family: var(--body);
  font-size: clamp(9px, 1.4vh, 11px);
  font-style: italic;
  color: var(--or-clair);
  letter-spacing: 0.5px;
  margin-bottom: clamp(2px, 0.4vh, 4px);
}
.contrat-value {
  width: clamp(70px, 22vw, 92px);
  height: clamp(34px, 5.5vh, 50px);
  background:
    linear-gradient(to bottom, #fdf3da 0%, var(--creme) 100%);
  border: 1px solid var(--or-laiton);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-size: clamp(1.5rem, 3.5vh, 2.2rem);
  font-weight: 600;
  color: var(--vert-tapis);
  line-height: 1;
  box-shadow:
    /* top edge highlight — light catches the bevel */
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    inset 0 0 0 1px rgba(0, 0, 0, 0.05),
    /* the cell sits raised above the dark casket floor */
    0 2px 4px rgba(0, 0, 0, 0.35),
    0 4px 10px rgba(0, 0, 0, 0.18);
}
.contrat-atout {
  font-family: var(--body);
  font-size: clamp(10px, 1.5vh, 13px);
  color: var(--creme);
  margin-top: clamp(2px, 0.5vh, 6px);
  letter-spacing: 0.5px;
}
.contrat-atout .suit {
  color: var(--creme);
  font-size: clamp(11px, 1.6vh, 14px);
  margin-left: 2px;
}

/* ============= BID ROW =============
   Symmetric 6+6 grid inside the bordered wrapper:
     Row 1: 80 | 90 | 100 | 110 | 120 | COINCHE
     Row 2: 130 | 140 | 150 | 160 | CAPOT | SURCOINCHE
   PASSE moved out of bid-row entirely — now lives next to "À VOUS"
   under the Vous avatar.
*/
.bid-section {
  flex-shrink: 0;
  padding: clamp(2px, 0.5vh, 5px) clamp(6px, 2vw, 12px);
}

.bid-row {
  display: flex;
  flex-direction: column;
  gap: clamp(3px, 0.6vh, 6px);
  border: 1px solid var(--or-laiton);
  border-radius: 4px;
  padding: clamp(3px, 0.5vh, 5px);
  background: rgba(0,0,0,0.2);
}

.bid-row__line {
  display: flex;
  gap: clamp(3px, 0.8vw, 6px);
}

.bid-row__line .bid-btn {
  flex: 1 1 0;
  min-width: 0;
}

.bid-btn {
  /* 6 buttons per row → ~53px each at 360, gives comfortable tap area
     horizontally (vs the ~30px we had with 10 buttons). Vertical tap
     target 44px ideal, viewport-fit forces smaller on tight phones. */
  min-height: clamp(26px, 4vh, 44px);
  border: 1px solid var(--or-laiton);
  background:
    linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.18));
  color: var(--or-clair);
  font-family: var(--display);
  font-size: clamp(0.75rem, 1.6vh, 1rem);
  font-weight: 500;
  letter-spacing: 0.5px;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(2px, 0.4vh, 6px) clamp(2px, 0.7vw, 6px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 1px 2px rgba(0, 0, 0, 0.25);
}
.bid-btn.selected {
  background:
    linear-gradient(to bottom, #fdf3da 0%, var(--creme) 100%);
  color: var(--vert-tapis);
  font-weight: 700;
  font-size: clamp(0.85rem, 1.8vh, 1.1rem);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.6),
    inset 0 0 0 1px rgba(0, 0, 0, 0.05),
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 4px 10px rgba(0, 0, 0, 0.15);
}
.bid-btn.capot {
  /* premium intermediate: numeric body + emphasised gold treatment */
  background: var(--vert-tapis);
  border: 1.5px solid var(--or-laiton);
  color: var(--or-clair);
  font-weight: 600;
  letter-spacing: 1px;
  box-shadow: inset 0 0 6px rgba(224, 201, 135, 0.18);
}
.bid-btn.coinche {
  background: var(--bordeaux);
  color: var(--creme);
  border-color: var(--or-laiton);
  font-family: var(--body);
  font-size: clamp(0.7rem, 1.5vh, 0.9rem);
  letter-spacing: 1px;
  font-weight: 600;
}
.bid-btn.surcoinche {
  /* deeper, more saturated oxblood vs COINCHE for clear distinction */
  background: #3a1818;
  color: var(--creme);
  border-color: var(--or-laiton);
  font-family: var(--body);
  font-size: clamp(0.6rem, 1.3vh, 0.8rem);
  letter-spacing: -0.01em;
  font-weight: 600;
}

.last-bid {
  text-align: center;
  font-family: var(--body);
  font-size: clamp(9px, 1.3vh, 11px);
  font-style: italic;
  color: var(--or-clair);
  margin-top: clamp(2px, 0.4vh, 5px);
  letter-spacing: 0.3px;
}
.last-bid b { font-weight: 600; font-style: normal; }

/* ============= HAND =============
   Subtle "displayed hand" fan: cards mostly upright, modest rotation
   (±10° at edges), spread mainly via horizontal offset. Bottom-anchored
   pivot (transform-origin: 50% 100%) keeps card bottoms aligned so
   no card descends into the bottom nav regardless of rotation. */
.hand {
  flex-shrink: 0;
  position: relative;
  height: clamp(85px, 16vh, 155px);
  margin-top: clamp(0px, 0.3vh, 4px);
  /* horizontal step between adjacent card centers — bounded by both
     vh (so it scales with card height) and vw (so the fan never
     overflows narrow viewports). At 430x950 ≈ 38px gap on 95px
     cards → ~60% overlap. At 360x640 ≈ 32px gap on 64px cards
     → ~50% overlap. */
  --gap: clamp(22px, min(5.5vh, 9vw), 42px);
  /* Global shadow under the entire fan — reinforces the "cards held
     in front of the player, away from the felt" feel. Pure GPU op,
     negligible perf cost on a static element. */
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
  /* No explicit overflow — default 'visible' lets the hover lift rise
     into the bid-row zone above; the bottom offset on .card keeps
     rotated card bottoms from poking into the bottom-nav below. */
}

.card {
  position: absolute;
  /* Lift the card a fraction of its width off the hand bottom so the
     ±10° bottom-pivot rotation (which dips the outer bottom corner by
     ~card_w/2 * sin(10°)) doesn't poke into the bottom-nav. */
  bottom: calc(var(--card-w) * 0.1);
  left: 50%;
  width: var(--card-w);
  aspect-ratio: 2 / 3;
  background: #F4E8D0;
  /* No CSS border — the SVG draws its own gold-brown rect stroke
     at the same color/width to keep the visual edge consistent. */
  border: 0;
  border-radius: 4%;
  /* Two-layer shadow per card — close contact + further lift —
     stacked with the .hand-level drop-shadow gives the "cards held
     in front of you" depth. */
  box-shadow:
    0 6px 12px rgba(0, 0, 0, 0.45),
    0 14px 28px rgba(0, 0, 0, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  overflow: hidden;
  user-select: none;
  cursor: pointer;
  transform-origin: 50% 100%;
  /* Order matters: the two translateX collapse into a single
     horizontal placement (centering + per-card offset), then rotate
     around the bottom-center pivot, then translateY(0) baseline so
     hover can interpolate cleanly to a lift value. */
  transform:
    translateX(-50%)
    translateX(calc(var(--off, 0) * var(--gap)))
    rotate(var(--rot, 0deg))
    translateY(0);
  transition:
    transform 200ms ease-out,
    filter 200ms ease-out,
    box-shadow 200ms ease-out;
}
.card img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  -webkit-user-drag: none;
}

/* Hover/focus/active: lift the card 14px in its own rotated frame
   while preserving rotation + horizontal offset. The card rises out
   of the fan diagonally for outer cards (natural "pulled from hand"
   motion), straight up for the centered card. */
.card:hover,
.card:focus,
.card:focus-visible,
.card:active {
  transform:
    translateX(-50%)
    translateX(calc(var(--off, 0) * var(--gap)))
    rotate(var(--rot, 0deg))
    translateY(-14px);
  filter: brightness(1.08);
  z-index: 20;
  box-shadow:
    0 6px 12px rgba(0, 0, 0, 0.5),
    0 14px 28px rgba(0, 0, 0, 0.28),
    0 0 0 1px var(--or-laiton),
    0 0 16px rgba(201, 169, 97, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  outline: none;
}

/* Per-card offset (--off) and rotation (--rot). 9 cards centered on
   the 5th, ±10° at edges in 2.5° steps. */
.hand .card:nth-child(1) { --off: -4; --rot: -10deg;  z-index: 1; }
.hand .card:nth-child(2) { --off: -3; --rot: -7.5deg; z-index: 2; }
.hand .card:nth-child(3) { --off: -2; --rot: -5deg;   z-index: 3; }
.hand .card:nth-child(4) { --off: -1; --rot: -2.5deg; z-index: 4; }
.hand .card:nth-child(5) { --off:  0; --rot:  0deg;   z-index: 5; }
.hand .card:nth-child(6) { --off:  1; --rot:  2.5deg; z-index: 6; }
.hand .card:nth-child(7) { --off:  2; --rot:  5deg;   z-index: 7; }
.hand .card:nth-child(8) { --off:  3; --rot:  7.5deg; z-index: 8; }
.hand .card:nth-child(9) { --off:  4; --rot:  10deg;  z-index: 9; }

/* ============= BOTTOM NAV ============= */
.bottom-nav {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  padding: clamp(2px, 0.5vh, 6px) clamp(6px, 2vw, 10px) clamp(4px, 0.8vh, 10px);
  border-top: 1px solid rgba(201,169,97,0.3);
  background: linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(13,31,23,0.4));
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(1px, 0.2vh, 2px);
  color: var(--or-laiton);
  font-family: var(--body);
  font-size: clamp(8px, 1.2vh, 10px);
  letter-spacing: 0.5px;
}

.nav-icon {
  width: clamp(22px, 3.6vh, 30px);
  height: clamp(22px, 3.6vh, 30px);
  border: 1px solid var(--or-laiton);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(11px, 1.7vh, 14px);
}

.nav-item.active {
  color: var(--or-clair);
}
.nav-item.active .nav-icon {
  width: clamp(34px, 5.5vh, 48px);
  height: clamp(34px, 5.5vh, 48px);
  border: 1.5px solid var(--or-laiton);
  background:
    radial-gradient(
      ellipse at 50% 35%,
      rgba(31, 61, 46, 0.95) 0%,
      var(--vert-ombre) 100%
    );
  font-size: clamp(12px, 1.9vh, 15px);
  position: relative;
  margin-bottom: clamp(1px, 0.3vh, 3px);
  box-shadow:
    /* surrounding ring of dark felt — separates the button from neighbors */
    0 0 0 2px var(--vert-tapis),
    /* second ring in soft gold — premium glow */
    0 0 0 3px rgba(201, 169, 97, 0.35),
    /* inner top highlight */
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    /* drop shadow stack — clearly floats above the nav row */
    0 4px 8px rgba(0, 0, 0, 0.45),
    0 10px 22px rgba(0, 0, 0, 0.22),
    /* warm ambient halo */
    0 0 18px rgba(201, 169, 97, 0.1);
  margin-top: clamp(-12px, -1.5vh, -8px);
}
.nav-item.active .nav-label {
  font-size: clamp(9px, 1.3vh, 11px);
  font-weight: 500;
  color: var(--or-clair);
}

/* Mini cards icon for active "Jeu" */
.mini-cards {
  position: relative;
  width: clamp(14px, 2.2vh, 20px);
  height: clamp(18px, 2.7vh, 24px);
}
.mini-cards .mc {
  position: absolute;
  width: 65%;
  height: 80%;
  background: var(--creme);
  border: 1px solid var(--or-laiton);
  border-radius: 2px;
}
.mini-cards .mc:nth-child(1) {
  left: -5%;
  top: 8%;
  transform: rotate(-12deg);
}
.mini-cards .mc:nth-child(2) {
  left: 40%;
  top: 0;
  transform: rotate(8deg);
  background: linear-gradient(145deg, #fefaf0, #f4e8d0);
}
.mini-cards .mc:nth-child(2)::after {
  content: '♠';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1a1a1a;
  font-size: clamp(7px, 1.1vh, 9px);
}

</style>
</head>
<body>

<!-- Debug toggle: swap display font for A/B comparison (press T to toggle) -->
<div class="font-toggle" role="group" aria-label="Display font toggle" title="Display font (T to toggle)">
  <button id="font-a" class="active" type="button">Cz</button>
  <button id="font-b" type="button">CSC</button>
</div>

<div class="app">

  <!-- ============================================
       TOP BAR: score icon | Nous | COINCHE | Eux | menu
       ============================================ -->
  <header class="topbar">
    <div class="icon-btn score" aria-label="Score">
      <div class="bars"><span></span><span></span><span></span></div>
      <div class="label">Score</div>
    </div>

    <div class="score-panels">
      <div class="score-panel nous">
        <span class="lbl">Nous</span>
        <span class="val">82</span>
      </div>
      <div class="score-panel coinche">
        <span class="lbl">COINCHE</span>
        <span class="val">500 pts</span>
      </div>
      <div class="score-panel eux">
        <span class="lbl">Eux</span>
        <span class="val">67</span>
      </div>
    </div>

    <div class="icon-btn menu" aria-label="Menu">
      <span></span><span></span><span></span>
    </div>
  </header>

  <!-- ============================================
       TABLE: oval felt with 4 players + center logo
       ============================================ -->
  <section class="table" aria-label="Table de jeu">
    <div class="oval"></div>

    <!-- Pierre (top) — fan of card backs behind avatar -->
    <div class="player top">
      <div class="card-fan" aria-hidden="true">
        <div class="card-back"></div>
        <div class="card-back"></div>
        <div class="card-back"></div>
        <div class="card-back"></div>
        <div class="card-back"></div>
      </div>
      <div class="avatar">P</div>
      <div class="name-wrap">
        <span class="name">Pierre</span>
        <span class="status">PASSE</span>
      </div>
    </div>

    <!-- Sophie (left) -->
    <div class="player left">
      <div class="avatar">S</div>
      <div class="name-wrap">
        <span class="name">Sophie</span>
        <span class="status">PASSE</span>
      </div>
    </div>

    <!-- Marc (right) -->
    <div class="player right">
      <div class="avatar">M</div>
      <div class="name-wrap">
        <span class="name">Marc</span>
        <span class="status">PASSE</span>
      </div>
    </div>

    <!-- Center: logo + contrat panel -->
    <div class="center">
      <div class="logo-block">
        <div class="logo-ornament">
          <span class="swirl left"></span>
          <span>♠</span>
          <span class="swirl right"></span>
        </div>
        <div class="logo-title">COINCHE</div>
        <div class="logo-tagline">Depuis 1921</div>
      </div>

      <div class="contrat-panel">
        <div class="header">Contrat en cours</div>
        <div class="contrat-value">80</div>
        <div class="contrat-atout">Atout <span class="suit">: ♠</span></div>
      </div>
    </div>

    <!-- Vous (bottom) — turn indicator + dealer badge + contextual PASSE -->
    <div class="player bottom">
      <div class="avatar">V<span class="dealer-badge">D</span></div>
      <div class="vous-info">
        <div class="name-wrap">
          <span class="name">Vous</span>
          <span class="status">À VOUS</span>
        </div>
        <button class="pass-btn" type="button">PASSE</button>
      </div>
    </div>
  </section>

  <!-- ============================================
       BID ROW + last bid label
       ============================================ -->
  <section class="bid-section" aria-label="Enchères">
    <div class="bid-row">
      <div class="bid-row__line">
        <button class="bid-btn selected">80</button>
        <button class="bid-btn">90</button>
        <button class="bid-btn">100</button>
        <button class="bid-btn">110</button>
        <button class="bid-btn">120</button>
        <button class="bid-btn coinche">COINCHE</button>
      </div>
      <div class="bid-row__line">
        <button class="bid-btn">130</button>
        <button class="bid-btn">140</button>
        <button class="bid-btn">150</button>
        <button class="bid-btn">160</button>
        <button class="bid-btn capot">CAPOT</button>
        <button class="bid-btn surcoinche">SURCOINCHE</button>
      </div>
    </div>
    <div class="last-bid">Dernière enchère : <b>80 par Vous</b></div>
  </section>

  <!-- ============================================
       HAND: 9 cards fanned (7♣ 9♣ D♣ 10♦ A♥ R♥ D♥ 10♠ A♠)
       ============================================ -->
  <section class="hand" aria-label="Votre main">
    <div class="card" tabindex="0" role="button" aria-label="7 de trèfle"><img src="assets/cards/7-trefle.png"  alt=""   draggable="false" /></div>
    <div class="card" tabindex="0" role="button" aria-label="9 de trèfle"><img src="assets/cards/9-trefle.png"  alt=""   draggable="false" /></div>
    <div class="card" tabindex="0" role="button" aria-label="Dame de trèfle"><img src="assets/cards/D-trefle.png"  alt="" draggable="false" /></div>
    <div class="card" tabindex="0" role="button" aria-label="10 de carreau"><img src="assets/cards/10-carreau.png" alt="" draggable="false" /></div>
    <div class="card" tabindex="0" role="button" aria-label="As de cœur"><img src="assets/cards/A-coeur.png"   alt=""    draggable="false" /></div>
    <div class="card" tabindex="0" role="button" aria-label="Roi de cœur"><img src="assets/cards/R-coeur.png"   alt=""   draggable="false" /></div>
    <div class="card" tabindex="0" role="button" aria-label="Dame de cœur"><img src="assets/cards/D-coeur.png"   alt=""  draggable="false" /></div>
    <div class="card" tabindex="0" role="button" aria-label="10 de pique"><img src="assets/cards/10-pique.png"  alt=""   draggable="false" /></div>
    <div class="card" tabindex="0" role="button" aria-label="As de pique"><img src="assets/cards/A-pique.png"   alt=""   draggable="false" /></div>
  </section>

  <!-- ============================================
       BOTTOM NAV: Chat | Offres | Jeu* | Astuces | Réglages
       ============================================ -->
  <nav class="bottom-nav" aria-label="Navigation">
    <div class="nav-item">
      <div class="nav-icon">💬</div>
      <div class="nav-label">Chat</div>
    </div>
    <div class="nav-item">
      <div class="nav-icon">🤝</div>
      <div class="nav-label">Offres</div>
    </div>
    <div class="nav-item active">
      <div class="nav-icon">
        <div class="mini-cards">
          <div class="mc"></div>
          <div class="mc"></div>
        </div>
      </div>
      <div class="nav-label">Jeu</div>
    </div>
    <div class="nav-item">
      <div class="nav-icon">💡</div>
      <div class="nav-label">Astuces</div>
    </div>
    <div class="nav-item">
      <div class="nav-icon">⚙</div>
      <div class="nav-label">Réglages</div>
    </div>
  </nav>

</div>

<script>
  // Display font A/B toggle (Cinzel ↔ Cormorant SC)
  const btnA = document.getElementById('font-a');
  const btnB = document.getElementById('font-b');

  function setFont(which) {
    if (which === 'b') {
      document.body.classList.add('font-b');
      btnB.classList.add('active');
      btnA.classList.remove('active');
    } else {
      document.body.classList.remove('font-b');
      btnA.classList.add('active');
      btnB.classList.remove('active');
    }
  }

  btnA.addEventListener('click', () => setFont('a'));
  btnB.addEventListener('click', () => setFont('b'));

  // Press T to flip display font
  document.addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') {
      setFont(document.body.classList.contains('font-b') ? 'a' : 'b');
    }
  });
</script>
</body>
</html>
````

---

## 5. Tooling installed

### Versions (live)
```
node       v24.14.1
python     Python 3.14.4        # `python` resolves on this machine (Windows)
playwright 1.60.0               # via `npx playwright --version` (auto-installed on demand)
```

### `redesign-mocks/package.json` (verbatim)
```json
{
  "name": "redesign-mocks",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "devDependencies": {
    "@playwright/test": "^1.59.1",
    "playwright": "^1.59.1"
  }
}
```
Notes:
- `redesign-mocks` is a CommonJS package whose only purpose is Playwright (for the
  Chromium render + screenshot tooling). No build step, no test runner.
- Image processing uses **Pillow** (per BRIEF: `pip install Pillow --break-system-packages`),
  invoked by the `cards/*.py` and `scripts/*.py` scripts. Pillow is not pinned in any
  manifest — it's a global/venv dependency of the Python pipeline.
- The mockups are served with `python -m http.server 8000` then screenshotted by
  `scripts/screenshot.js` / `cards/screenshot_bidding.js`.

---

## 6. Frontend production state (`frontend/`)

> This is the **live React app** (separate from the `redesign-mocks/` design exploration).
> The redesign is intended to eventually inform this app's bidding/game UI. Per BRIEF,
> the redesign session was told NOT to modify `frontend/src/`.

### `frontend/` tree (2 levels deep)
```
frontend/
├── .env.example
├── .env.local.example
├── index.html                 # Vite entry HTML
├── package.json               # see below
├── package-lock.json
├── vercel.json                # Vercel deploy config
├── vite.config.js             # Vite config
├── src/
│   ├── main.jsx               # React entry
│   ├── App.jsx                # root component
│   ├── App.css
│   ├── components/            # game + lobby UI (see breakdown below)
│   ├── context/               # AuthContext.jsx, LanguageContext.jsx
│   ├── game/                  # GameErrorTaggerMock.jsx, GameErrorTagOverlay.jsx
│   ├── i18n/                  # en.js, fr.js
│   ├── lib/                   # supabase.js
│   └── training/              # Claude training-mode UI (see breakdown below)
└── tests/
    ├── smoke.js               # Playwright e2e smoke test
    └── helpers/
        └── authenticate.js
```

### Detected tech stack (`frontend/package.json`)
```json
{
  "name": "coinche-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test:e2e": "node --env-file=../backend/.env.test.local tests/smoke.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.7.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "playwright": "^1.47.0",
    "vite": "^5.0.8"
  }
}
```

| Concern          | Choice                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| UI framework     | **React 18.2** (`react` + `react-dom`)                                 |
| Build tool / dev | **Vite 5** (`@vitejs/plugin-react`) — `npm run dev` on port 5173       |
| Real-time        | **socket.io-client 4.7** — server pushes all authoritative game state  |
| Auth             | **@supabase/supabase-js 2.39** — email/password (`src/lib/supabase.js`)|
| State management | **React Context API** — `AuthContext`, `LanguageContext`. No Redux/Zustand/MobX. |
| i18n             | Custom context-based en/fr toggle (`src/i18n/{en,fr}.js`), localStorage-persisted |
| Testing          | **Playwright 1.47** e2e smoke (`tests/smoke.js`, `--env-file` from backend) |
| Deploy           | **Vercel** (`vercel.json`); backend is Node/Socket.io on Railway       |

No CSS framework (Tailwind/MUI/etc.) — styling is hand-rolled CSS (`App.css` + inline).

### Components in `src/` relevant to the game

**Core gameplay (`src/components/`)**
- `GameBoard.jsx` — the main in-game board (the screen the redesign mockup targets).
  - `gameBoardHelpers.js` — board logic helpers (incl. `bestSuitForHand` scoring;
    CLAUDE.md flags a leftover debug `console.log` here from commit `a812602`).
  - `gameBoardParts.jsx` — extracted board sub-components.
- `BiddingPanel.jsx` — the **bidding UI** (direct analogue of the `01-bidding-table.html` mockup).
- `ShuffleCutPanel.jsx` — shuffle/cut phase UI.
- `RoundSummary.jsx` — end-of-round scoring summary.
- `Lobby.jsx` — room create/join lobby.
- `Header.jsx` — top bar (score / nav).
- `HandSizeToggle.jsx` — "Mode Delfino" S/M/L hand-card size cycle (localStorage-persisted).
- `AdminPanel.jsx` — creator/admin controls (undo, kicks, pending-join approvals).
- `Auth.jsx` — Supabase login/signup.
- `EnvBadge.jsx` — environment badge (dev/prod indicator).
- `shared/AuctionRecap.jsx` — auction recap, shared between game and training views.

**Contexts (`src/context/`)**
- `AuthContext.jsx` — Supabase session/user context.
- `LanguageContext.jsx` — en/fr i18n context.

**Game error-tagging overlay (`src/game/`)**
- `GameErrorTaggerMock.jsx`, `GameErrorTagOverlay.jsx` — overlay for tagging in-game errors.

**Training mode (`src/training/`)** — the Claude conversational tutor subsystem (V2.2)
- `ClaudeConversation.jsx` — chat UI (note CLAUDE.md StrictMode unmount→`/end` gotcha).
- `CardSelector.jsx` — card-selection UI for training.
- `CompletionSummary.jsx` — training-session completion summary.
- `TrainingPicker.jsx` / `TrainingPickerMock.jsx` — scenario picker.
- `TrainingTable.jsx` — training table view.
- `divergence.js` — divergence computation (player choice vs reference).
- `formatAction.js` — action formatting helpers.
- `noteDraft.js` — draft-note persistence (localStorage `coinche_*`).

**Lib (`src/lib/`)**
- `supabase.js` — Supabase client init.

---

## 7. Quick-start for the next session

```bash
# View the active mockup (from repo root):
cd redesign-mocks
python -m http.server 8000
# then open http://localhost:8000/01-bidding-table.html

# Regenerate screenshots at the 3 target viewports:
node scripts/screenshot.js            # (note: points at -v2; edit URL for 01-bidding-table.html)

# Rebuild the card deck (full pipeline):
python cards/modify_svg.py && node cards/render_master.js && \
  python cards/slice_all.py && python cards/validate.py && \
  cp cards/paris-pro/*.png assets/cards/

# Run the production frontend:
cd ../frontend && npm install && npm run dev   # Vite on :5173 (needs backend on :3001)
```

**State in one sentence:** the 1920s-club bidding-table mockup
(`redesign-mocks/01-bidding-table.html`) is visually complete with a finished
32-card Paris-pattern deck (`assets/cards/`, all 32 validated); the next likely
step is porting this design into the live React `BiddingPanel.jsx` / `GameBoard.jsx`,
and/or replacing the placeholder letter avatars (P/S/M/V) with the real portrait
assets in `assets/avatars/`.
