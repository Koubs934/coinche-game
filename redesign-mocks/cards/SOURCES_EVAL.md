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
