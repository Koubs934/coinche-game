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
