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