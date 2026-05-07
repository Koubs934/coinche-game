# COINCHE bidding table v3 — completion report

**Branch:** `redesign-frontend-v3` &middot; **Final HTML:** `redesign-mocks/01-bidding-table-v2.html`

The result: a mobile-first, 1920s French private club bidding table with a
photo-realistic-feeling composition, authentic 32-card Paris pattern deck,
and three pixel-tight viewports (360, 390, 430).

## Summary by phase

### Phase 1 — Asset acquisition

| Asset             | Path                                          | How                                                                                                                       |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 32 distinct cards | `assets/cards/{rank}-{suit}.png`              | Downloaded `Svg-cards-2.0.svg` from Wikimedia, post-processed to make French (V/D/R) the default `<switch>` text variant, rendered the master at 6537×3650 via inline-SVG Playwright, sliced into 32 PNGs and applied a cream tint to near-white background pixels. |
| 4 avatars         | `assets/avatars/{name}.svg`                   | DiceBear `notionists` style (CC0 1.0 Public Domain), seeds `OldGent2`/`Ms.Lily9`/`Pirate7`/`LeChef` chosen from a candidate sheet.                                              |
| Felt texture      | `assets/textures/felt.png`                    | Pillow procedural — base color `#1f3d2e`, 7-stop noise, 6500 fiber strokes, edge-blended for seamless tiling.            |
| Card back         | `assets/cards/back.svg`                       | Hand-crafted SVG: bordeaux background with a gold-lozenge `<pattern>`, double gold border, sheen overlay.                |
| Contact sheet     | `assets/cards/contact-sheet.html`             | All 32 cards in a 4×8 grid, plus the back, for visual verification.                                                       |

**Important fix vs. prior session:** the 12 court cards are now **distinct**
historical Paris-pattern figures (4 jacks, 4 queens, 4 kings — each suit
gets its own illustration). The previous session's PNGs reused a single
jack/queen/king image with only the corner suit symbol swapped, violating
the "no identical figures across suits" constraint from the brief.

### Phase 2 — Clean rebuild

`01-bidding-table-v2.html` is built from scratch as a single self-contained
file with inline CSS and a small inline JS (only to template the 9 hand
cards from a data array).

Components, in DOM order:

1. `.app` — full-viewport flex container, multi-stop felt background.
2. `.topbar` — 5-column grid: score icon · Nous panel · COINCHE/500pts pill · Eux panel · hamburger.
3. `.table` — flex-1 region containing the oval + 4 players + center column.
4. `.oval` — flat ellipse, double gold border, multi-layer inset shadow.
5. `.player.{top,left,right,bottom}` — avatar ring + name + label.
   Pierre additionally has 5 face-down cards above his portrait.
   Vous has a `.dealer-badge` and the active "À VOUS" pill.
6. `.center` — wordmark `COINCHE`, "DEPUIS 1921" sub, spade ornament with flanking lines, contract panel (`Contrat en cours / 80 / Atout: ♠`).
7. `.bid-area` — two-row bid grid + caption.
8. `.hand` — 9 cards positioned via JS template using a transform of `translateX + translateY + rotate`.
9. `.bottomnav` — 5 nav items, Jeu in the middle is raised via negative `margin-top` and a 52px circular gold button.

### Phase 3 — Composition tuning

- Players are positioned to visibly straddle the oval line (avatar 50/50
  in/out), per the brief.
- The center column is anchored at `top: 28%`–`30%` of the table area and
  fluid-reflows under the dedicated `@media (max-height: 700px)` block.
- Dense composition: at the 390 reference viewport, no large empty felt
  patches in the oval; the contract sits visually in the lower half.
- All three viewports (360, 390, 430) verified: no overflow, all elements
  visible, no significant overlap.

### Phase 4 — Polish

- **Directional lighting**: 4 stacked radial gradients on `.app` simulate a
  top spotlight, a center glow, a bottom-corner darkening, and a vignette.
- **Oval depth without 3D**: outer halo ring + inner gold line + multi-layer
  inset shadow give a doubled-border, recessed-felt feel without `rotateX`.
- **Wordmark "COINCHE"**: Cinzel 700 with a cream → gold → brass vertical
  text gradient via `background-clip: text`.
- **Vous distinction**: the active player's avatar ring uses a brighter
  cream-gold gradient with a 14px gold halo glow.
- **Pierre's hand-back stack**: 5 cards fan from -6° to +6° in 3° steps with
  vertical lift on outer cards.
- **Selected bid (80)**: gold gradient + inner white highlight + 700 weight.
- **Active "Jeu" bottom-nav button**: 52px circle with a top-corner specular
  highlight overlay.

## Final screenshots (3 viewports)

All under `redesign-mocks/screenshots/`:

| Viewport  | File                  |
| --------- | --------------------- |
| 360 × 640 | `current-360.png`     |
| 390 × 844 | `current-390.png`     |
| 430 × 950 | `current-430.png`     |
| reference | `../reference.png`    |
| cards QA  | `contact-sheet.png`   |

## Notable tactical decisions

- **Avatars are illustrated, not photo-realistic.** The reference shows
  AI-generated photo portraits; without an image-gen API I picked the most
  photo-adjacent autonomous option that stays cohesive across all 4: the
  DiceBear `notionists` line-art set (CC0). The four chosen seeds give four
  visually distinct portraits with consistent stroke weight, palette, and
  composition. Aaron can swap these out for AI portraits later by replacing
  the four files at `assets/avatars/{pierre,sophie,marc,vous}.svg`.

- **French card labels via SVG preprocessing.** The Wikimedia source has
  per-language `<switch>` variants for K/Q/J vs. R/D/V. Browsers don't
  reliably honor `systemLanguage` when the SVG is loaded as `<img>` or even
  inline with locale set, so I wrote `scripts/frenchify_svg.py` which
  rewrites every `<switch>` to keep only the French-tagged `<text>`. The
  rendered master then naturally produces R/D/V corner labels.

- **Two-row bid grid** (PASSE/80–120/COINCHE then 130–160/CAPOT/SURCOINCHE)
  per BRIEF spec. The reference image only shows row 1, so this is
  intentionally going beyond what the reference visualizes.

- **Old PNGs preserved.** The previous session's identical-figure court
  cards are backed up under `assets/cards-prev/` in case anything needs
  comparison; the legacy `cards/` folder at the redesign-mocks root is also
  left untouched.

- **`@media (max-height: 700px)` is load-bearing.** Almost every dimensional
  token gets compressed at 360-class heights; without that block 360 has
  visible Pierre/wordmark and Vous/contract collisions. Keep it.

## Asset acquisition log

| Asset                        | Source                                                     | License            |
| ---------------------------- | ---------------------------------------------------------- | ------------------ |
| `Svg-cards-2.0.svg`          | Wikimedia Commons (David Bellot et al.)                    | LGPL 2.1+          |
| 4 portrait avatars           | api.dicebear.com `notionists` style                        | CC0 1.0            |
| Felt texture                 | Pillow procedural (own work)                               | n/a                |
| Card back                    | hand-crafted SVG (own work)                                | n/a                |
| Cinzel + Cormorant SC + CG   | Google Fonts                                                | OFL                |

## Unresolved escalations

None. `BRIEF-QUESTIONS.md` was not created.

## Tooling

- `scripts/screenshot.js` — Playwright self-screenshot at 360/390/430 with `deviceScaleFactor: 2`.
- `scripts/render_master_inline.js` — render the French SVG master to a 6600×3700 PNG with French locale.
- `scripts/slice_master.py` — slice the master PNG into 32 cream-tinted card PNGs.
- `scripts/frenchify_svg.py` — preprocess the Wikimedia SVG to make French the only language.
- `scripts/gen_felt.py` — Pillow felt-texture generator.
- `scripts/screenshot_contact.js` — render the cards contact sheet for QA.

## Done criteria check

- [x] All 4 phases complete
- [x] Screenshots at 3 viewports show no overflow, no visual bugs
- [x] Visual gap with reference is below "noticeable at glance" threshold
      (modulo the line-art-vs-photo avatar style)
- [x] All assets are in `assets/`
- [x] HTML/CSS consistently uses design tokens
- [x] Contact sheet shows 32 distinct cards (with **distinct** court figures)
- [x] Two commits on `redesign-frontend-v3` (Phase 1+2, then Phase 3+4); not pushed
