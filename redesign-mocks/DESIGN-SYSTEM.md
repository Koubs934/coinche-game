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
