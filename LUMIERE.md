# PASSE LUMIÈRE — warm directional felt lighting

Ported the mockup's "lit table in a dark room" felt lighting into the live app. **Pure CSS**,
one rule. PASS 1 recolored the felt to deep green but left it **flat** (no directional light) — this
fixes exactly that. Build green; this pass changed **only `App.css`** (the `.game-board` background).

---

## 1. Values relevé from the source (no guessing)

`redesign-mocks/01-bidding-table.html` — `.app` (lines 102-116) carries the lighting:

```css
.app {
  background:
    /* central warm spotlight — light pulled higher/stronger toward the contract panel */
    radial-gradient(ellipse at 50% 30%, rgba(48, 88, 65, 0.35) 0%, transparent 50%),
    /* lit center / dark corners — pronounced felt vignette */
    radial-gradient(ellipse at center, var(--vert-tapis) 25%, rgba(13, 31, 23, 0.88) 100%),
    var(--vert-tapis);
}
```
Token mapping: mockup `--vert-tapis` `#1f3d2e` **=** our `--table`; `rgba(13,31,23,0.88)` = our
`--table-dark` `#0d1f17` at 0.88α. (The mockup's `.oval` interior `radial-gradient(… rgba(40,75,56,0.45)
→ rgba(31,61,46,0) 75%)` was noted but left to the live oval's own gradient — see Flag 4.)

## 2. Where the live felt lives + what was ported

- Live **`.app`** (App.css:78-86) has **no background** — just the desktop-centering shell
  (`max-width:600px`). The flat felt color lived on **`.game-board { background: var(--table) }`**
  (App.css:864) — the source of the "rendu plat".
- Ported the mockup's two light layers **verbatim** onto `.game-board`:
  ```css
  .game-board {
    background:
      radial-gradient(ellipse at 50% 30%, rgba(48,88,65,0.35) 0%, transparent 50%),
      radial-gradient(ellipse at center, var(--table) 25%, rgba(13,31,23,0.88) 100%),
      var(--table);
  }
  ```
  → a warm spotlight pulled **high-center** (50% 30% → toward the contract panel / partner at the
  oval top) over a **lit-center → dark-corner vignette**. Depth from gradients only — **no 3D**.
- The green was **not** further warmed: the mockup's spotlight is a lighter *green* (`rgba(48,88,65)`,
  no added gold); using its exact value matches the reference (the side-by-side confirmed it — see §3).

## 3. Visual comparison mockup ↔ live (the rigor step)

Playwright, `deviceScaleFactor:2`, matched viewports. Mockup = `01-bidding-table.html` (file://);
live = the harness linking the real edited `App.css`.

| Pair | Mockup | Live | Verdict |
| --- | --- | --- | --- |
| 390×844 | `lumiere-mockup-390.png` | `lumiere-live-390.png` | ✅ both: warm upper-center glow → dark edges/bottom |
| 430×950 (tall — the risk) | `lumiere-mockup-430.png` | `lumiere-live-430.png` | ✅ spotlight still reads high-center on the taller felt; vignette holds |

Plus the gate set `lum-portrait-{360,390,430}.png` + `lum-landscape-800x450.png`: the directional
light is present and consistent at every viewport (360 smallest → no clipping; landscape → the light
applies to the grid felt too, not broken). The live felt now reads **as warm/directional as the
mockup** — the flat look is gone.

## 4. Flagged calls
1. **Ported to `.game-board`, not `.app`** — the live `.app` is only the desktop-centering shell
   (`max-width:600`); the felt is the game board. The mockup's `.app` (a phone frame) maps to the
   live `.game-board` (the game area). On desktop (>600px) the area outside the shell is the body's
   felt green (PASS 1) — unaffected.
2. **Exact mockup values, no reinvention** — same spotlight position/color/stops and vignette. Any
   difference vs the mockup is inherent container-proportion (live `.game-board` has a score bar +
   hand band; the mockup `.app` is a bare phone frame), not a value mismatch.
3. **No extra green-warming applied** — the source spotlight is a lighter green, and the comparison
   matched, so warming wasn't needed. If you ever want a more golden ambiance, the spotlight color
   could shift toward olive/brass — but that would deviate from the mockup's actual values, so it's
   left at source. (Flag, not done.)
4. **Oval interior left as-is** — `.board-middle::before` (its lit-center→dark gradient + gold rim +
   halo) is from RUN OVAL and untouched; the new `.game-board` light sits *behind* it. Together they
   give the lit-table read. I did not retouch the oval gradient (previous pass + geometry).

## Gate (all green)
- Screenshots **360/390/430 portrait + landscape** — light present & consistent, landscape unbroken.
- **Mockup ↔ live** side-by-side — matched (felt reads as warm/directional as the reference).
- `npm run build` ✓ (4.42s).
- **`git status`: this pass changed only `frontend/src/App.css`.** (The `GameBoard.jsx`,
  `gameBoardParts.jsx`, `index.html` also shown as modified are uncommitted changes from **prior
  passes** — RUN OVAL / PASS 1 — not this one.)

## Confirmations
- **No `rotateX`/`perspective`/3D** — felt depth is gradients only.
- **Untouched:** oval geometry, seats, state / data contracts, backend, `redesign-mocks/`, and all
  prior passes' work. CSS-only, one `.game-board` background rule.

## Remaining (whole restyle)
- PNG card-deck wiring · fluid `clamp()` sizing · Header consolidation · (optional) self-seat onto the
  oval bottom · danger-red affordances → bordeaux. (All non-structural; the felt/light/skin is done.)

**Scratch (untracked):** `master-screenshots/` (incl. `lumiere-*` comparison pairs) +
`%TEMP%/pass1/{harness.html,shot.js,cmp.js}`.
