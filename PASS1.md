# PASS 1 — 1920s global skin (App.css + index.html only)

Scope: the **global skin** only — palette, team-color tokenization, fonts, and avatar
CSS retheme. **No** felt geometry, **no** PNG cards, **no** bid-grid model (all later passes).
Files touched: `frontend/src/App.css` + `frontend/index.html` **only** (verified — `git status`
shows just those two). No JSX, no state fields, no `redesign-mocks/`.

Source of truth: `RECON.md` (selectors) + `redesign-mocks/DESIGN-SYSTEM.md` (target tokens).

**Result: ✅ skin holds on both layouts** (portrait flex + landscape grid), `npm run build`
passes (`✓ built in 4.93s`). Two judgment calls flagged for confirmation in §6.

---

## 1. Diff summary

```
frontend/index.html  |   6 +-
frontend/src/App.css | 172 +++++++++++++++++++++++++++++----------------------
2 files changed, 103 insertions(+), 75 deletions(-)
```

### `:root` palette — values remapped, names kept (App.css:4-39)
| Token | Before | After | Meaning |
| --- | --- | --- | --- |
| `--table` | `#1a5e2a` | `#1f3d2e` | deep felt |
| `--table-dark` | `#144a20` | `#0d1f17` | felt shadow / vert-ombre |
| `--card-bg` | `#fffef8` | `#f4e8d0` | crème card face |
| `--card-border` | `#ccc` | `#d8c79a` | warm card edge |
| `--red` | `#cc1111` | `#b3261a` | playing-card red on cream |
| `--ui-bg` | `#1e2a38` (navy) | `#13261a` | dark-green panel back |
| `--ui-card` | `#28374a` (navy) | `#1d3a28` | lifted green panel |
| `--sheet` | `#1e2a38` (navy) | `#13261a` | bid sheet / bar back |
| `--accent` | `#f0a500` (orange) | `#c9a961` | brass gold |
| `--accent2` | `#e05050` | `#b5483f` | warm secondary red |
| `--text` | `#f0f0f0` | `#f4e8d0` | crème body text |
| `--muted` | `#7a9ab0` (cool) | `#b9a884` | muted parchment/gold |
| `--black` / `--success` / `--radius` / `--card-w/h` | — | unchanged | (card sizes stay fixed px — fluid `clamp()` is a later pass) |

**New tokens added:** `--or-clair: #e0c987`, `--bordeaux: #5a2a2a`, `--vert-sauge: #7daa7a`,
`--team-nous`, `--team-nous-tint`, `--team-eux`, `--team-eux-tint`,
`--font-display: 'Cinzel'`, `--font-body: 'Cormorant Garamond'`.

### Felt gradient (App.css:913, 1733 — both occurrences)
`radial-gradient(… #1e6b30 … #164f22 … #0f3a18)` → `radial-gradient(… #2c5a3c … #1f3d2e … #0d1f17)`
(felt **color** only — the shape/`border-radius:14px` rectangle is untouched, that's the later geometry pass).

### Accent coherence sweep
The old orange accent was hardcoded in **~35 spots** beyond the token (active-seat glow,
belote chips, panel borders/tints, builder swatches, etc.). Swept to brass so the new
`--accent` stays consistent app-wide:
- `#f0a500` → `#c9a961` (all literal occurrences)
- `rgba(240,165,0,α)` → `rgba(201,169,97,α)` (both spacing variants — all occurrences)

### Fonts
- `index.html`: added `<link>` preconnect + Google Fonts (Cinzel 400-700 + Cormorant
  Garamond ital/400-700), same as the mockup. `theme-color` `#1a5e2a` → `#1f3d2e`.
- `App.css`: `body` font → `var(--font-body)` (Cormorant Garamond). New rule applies
  `var(--font-display)` (Cinzel) to: `.app-logo, .splash-logo, .total-score-bar, .tsb-item,
  .score-item, .manche-values, .manche-score, .player-name, .team-slot-name, .contract-badge,
  .seat-contract-badge, .bid-focal-value`.

### Avatars — CSS retheme only (no `Avatar.jsx` / `lib/avatar.js` touched)
- `.player-avatar` border `2px solid rgba(255,255,255,0.15)` (white) → `rgba(201,169,97,0.55)` (brass).
- `.team0-avatar` / `.team1-avatar` tints + text → `--team-*` tokens.
- Active-seat glow (`.active-player .player-avatar`, `.active-player`) → brass via the accent sweep (gold halo).
- `.avatar-bot` ring teal `#21d4b4` → bordeaux `#a05650`; matching `.team-slot-bot` lobby chip likewise.

---

## 2. Hardcoded team colors found + routed (the core of the pass)

`RECON §7` flagged that team colors were **not tokenized**. Grepped for all of them
(`#7ec8e3` team0/blue, `#f4a261` team1/orange, + their rgba tints) — **9 rule clusters, all routed**:

| # | Selector(s) | App.css | Was | Now |
| --- | --- | --- | --- | --- |
| 1 | `.team0 strong` / `.team1 strong` | 99-100 | `#7ec8e3` / `#f4a261` | `--team-nous` / `--team-eux` |
| 2 | `.team-card-0` / `.team-card-1` (border-top) | 329-330 | " | " |
| 3 | `.team-card-0/.1 .team-card-title` | 338-339 | " | " |
| 4 | `.team0-avatar` / `.team1-avatar` (bg tint + text) | 966-967 | `rgba(126,200,227,.25)`+`#7ec8e3` / `rgba(244,162,97,.25)`+`#f4a261` | `--team-nous-tint`+`--team-nous` / `--team-eux-tint`+`--team-eux` |
| 5 | `.ms-nous` / `.ms-eux` (round summary) | 1893-1894 | " | " (clean — these are viewer-relative) |
| 6 | `.twb-team0` / `.twb-team1` (bg+text+border) | 2032-2033 | " | tokens |
| 7 | `.rcu-t0` / `.rcu-t1` | 2037-2038 | " | tokens |
| 8 | `.team0-col` / `.team1-col` (+`strong`) — live score bar | 2114-2117 | " | tokens |
| 9 | `.team-slot-bot` lobby "BOT" chip (teal, bot marker) | 401-410 | `#21d4b4` | `#a05650` bordeaux |

A `:root` swap alone would **not** have recolored any of these — they were literal hexes. All
now flow through `--team-nous` / `--team-eux` (+ tints), so a future palette change is one place.

---

## 3. Screenshots (Playwright, deviceScaleFactor 2)

`pass1-screenshots/` (untracked scratch). Validated the skin on **both** layouts RECON warned about:

| File | Viewport | Layout | Verdict |
| --- | --- | --- | --- |
| `pass1-portrait-360x640.png` | 360×640 (smallest) | flex column | ✅ no overflow |
| `pass1-portrait-390x844.png` | 390×844 (reference) | flex column | ✅ clean |
| `pass1-portrait-430x950.png` | 430×950 (largest) | flex column | ✅ clean |
| `pass1-landscape-800x450.png` | 800×450 | **CSS grid** (`max-height:500px`) | ✅ partner seat hidden, left/center/right + hand grid intact |

**What the screenshots confirm:** deep-green felt; **Nous in gold / Eux in bordeaux**; brass
`/2000` target; Pierre's seat with a **gold active-glow**; Sophie & Marc as bots with **bordeaux
rings**; the `80 ♠` bid focal + "Contrat en cours" + seat badge in dark-green/brass; cream cards
with brass edges (the playable A♠ shows the brass `.valid` highlight); Cinzel on
scores/contract/names, Cormorant body. The skin survives the landscape grid switch.

> Harness note: validated via a **static skin harness** (`%TEMP%/pass1/harness.html`) that links
> the **real edited `App.css`** + the real fonts and reproduces the actual `.game-board` DOM/classes
> (from RECON). It is **not** the live game — avatars render the **letter-circle fallback** (P/S/M/V)
> rather than react-peeps figures (no React in a static page), which is fine here because PASS 1 only
> changed the avatar **circle** CSS (tint/border/ring/glow), all visible above. The hand fan uses
> harness-only transforms (the real fan is JS-driven; geometry is out of scope).

---

## 4. Validation

- `npm run build` → `vite v5.4.21 … ✓ built in 4.93s` (exit 0). CSS 80.52 → 81.19 kB (added tokens/comments).
- `git status` → only `frontend/src/App.css` + `frontend/index.html` modified. No JSX / state / `redesign-mocks/` touched.
- Leftover-color grep after edits: **0** old team/orange/teal hexes remain (one match was my own `(was #1a5e2a)` comment).

---

## 5. Deferred to later passes (intentionally NOT touched)

- **Felt geometry** — still a `border-radius:14px` flex rectangle, seats still flex/grid. (Pass: oval + absolute seats.)
- **Cards** — still CSS text/Unicode glyphs (now cream/brass); the PNG deck is a separate pass.
- **Fluid sizing** — `--card-w/h` stay fixed px + breakpoint swaps; `clamp()` is a separate decision.
- **Bid grid + coinche/surcoinche colors** — `.bid-focal-mod.coin` `#e05050` / `.sur` `#cc66ff`
  (and `.scbt-surcoinche`, `.ar-surcoinche`, `.badge-sur`) left as-is; they belong to the bidding pass.

---

## 6. ⚠ Judgment calls — please confirm (per the "list it, don't guess" instruction)

**(a) Eux foreground color — I lightened bordeaux for legibility.**
True bordeaux `#5a2a2a` as *text on the felt* `#1f3d2e` is ~1.5:1 contrast — effectively invisible.
So `--team-eux` (used for Eux **text**: `.team1-col`, `.ms-eux`, `.rcu-t1`, avatar initials, …) is a
**legible light-bordeaux `#cf8a82`**, while true `--bordeaux: #5a2a2a` is kept for **solid backgrounds**.
The mockup itself distinguishes Eux by a **bordeaux background** + gold text, not bordeaux text.
→ **Confirm** the legible-rose foreground, **or** tell me to switch to the mockup's scheme (gold text
for both teams + a bordeaux background on the Eux panel) — the latter pairs naturally with the
top-bar pass where the Nous/Eux panels get built.

**(b) `.team0-col` / `.team1-col` / `.team{N}-avatar` are FIXED-team, not viewer-relative.**
These classes are keyed to absolute team0/team1, so I mapped team0→gold(Nous), team1→bordeaux(Eux) —
**pixel-correct only when the viewer sits on team 0** (the mockup's POV). For a **team-1 viewer**, the
label "Nous" (which swaps in JSX) would show in bordeaux and the opponents in gold. CSS alone can't
make the color viewer-relative; it needs a JSX conditional class (e.g. `is-mine`/`is-them`) — a later
JSX pass, out of scope here. (`.ms-nous`/`.ms-eux` in RoundSummary are already viewer-relative, so
those are correct for everyone.)
→ Flagging so it's a known limitation; the fix is a small JSX change when we do the top-bar/seat pass.

---

## 7. Scratch artifacts (not committed, safe to delete)
- `pass1-screenshots/` — the 4 validation PNGs (repo root, untracked).
- `%TEMP%/pass1/harness.html` + `shot.js` — the validation harness + Playwright script (OS temp).
