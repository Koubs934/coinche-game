# PASS 4 — score bar + central contract focal (1920s)

First JSX pass. Scope: the **score-bar** and **bid-focal** regions of `GameBoard.jsx` +
`App.css` only. **No** state/data contracts changed (existing fields rendered), no backend,
no `redesign-mocks/`, no other components. Source of truth: `RECON.md`.

**Result: ✅** Score bar → 3 cells (Nous gold / COINCHE+target / Eux bordeaux); bid-focal →
contract panel (Contrat / value / Atout). Validated across **3 portrait + landscape grid** and
the **null / numeric / capot / team-1-viewer** matrix. `npm run build` ✓ (`built in 4.95s`).
Files changed: `frontend/src/components/GameBoard.jsx` + `frontend/src/App.css` **only**.

> Note: `git diff --stat` against HEAD shows cumulative PASS 1 + PASS 4 (the branch isn't
> committed per-pass). The PASS-4-specific edits are the 2 JSX regions + 3 CSS blocks below.

---

## 1. What changed

### A. Score bar (`GameBoard.jsx`, the `.score-bars` region)
Was a thin 2-total strip (`.tsb-item.team0-col` / `.team1-col`). Now **three cells**:

| Cell | Content | Source field | Color |
| --- | --- | --- | --- |
| **Nous** (left) | `t.us` + score | `scores[myTeam]` | gold text on felt (`--team-nous`) |
| **Center** | `COINCHE` wordmark + target | `room.targetScore` | brass Cinzel wordmark |
| **Eux** (right) | `t.them` + score | `scores[1 - myTeam]` | **true bordeaux cell** `--bordeaux` + gold text (`--or-clair`) |

- **Viewer-relative & symmetric:** Nous = `scores[myTeam]`, Eux = `scores[1-myTeam]`. The cell
  *classes* are `.tsb-nous`/`.tsb-eux` (semantic), **not** fixed `.team0/.team1` — so the
  gold/bordeaux split is correct for **both camps**. This **resolves the PASS 1 §6b caveat for
  the score bar** (verified with a team-1 viewer screenshot). The now-dead `.team0-col`/`.team1-col`
  CSS rules were removed.
- **Eux finally uses true `--bordeaux` #5a2a2a** — as a cell **background** with gold text on top
  (the asymmetry the mockup intends; PASS 1 had reserved true bordeaux for exactly this).
- **Target = `room.targetScore`** (real field, default 2000) — the mockup's hardcoded "500" is ignored.

### B. Central contract focal (`GameBoard.jsx`, the BIDDING `.bid-focal`)
Restyled into the mockup's contract panel (vertical: label → value → atout). Kept the `.bid-focal`
class (so its short-viewport overrides still apply) + added `.contrat-panel`/`.contrat-label`/`.contrat-atout`.

| Element | Logic | Source |
| --- | --- | --- |
| Label "Contrat" (Cormorant italic) | `t.contract` | i18n (reused; see §4) |
| Value (big, Cinzel brass) | **union branch**: `value === 'capot' ? t.capot : value` | `game.currentBid.value` |
| Atout line "Atout ♠" | `const atout = currentBid.suit ?? trumpSuit` (✅ `trumpSuit` is null mid-auction, used only as post-close fallback) | `game.currentBid.suit` |
| Atout glyph color | red for H/D (`.bid-focal-suit.red`), brass for S/C (default `--accent`) | `t.suitSymbol` |
| Placeholder (no bid yet) | `currentBid` null → clean `—`, **no crash** | — |
| coinche/surcoinche mod | kept (existing `.bid-focal-mod`) | `currentBid.coinched/.surcoinched` |

### C. CSS (`App.css`)
- `.total-score-bar` → 3-cell flex with a gold hairline border; new `.tsb-cell`/`.tsb-team`/`.tsb-score`/`.tsb-nous`/`.tsb-eux`/`.tsb-center`/`.tsb-wordmark`; removed dead `.tsb-item`/`.team0-col`/`.team1-col`.
- `.bid-focal.contrat-panel` flips the focal to a column + casket look (green radial + brass border); `.contrat-label`/`.contrat-row`/`.contrat-atout` added; `.bid-focal-empty` re-tuned for the `—` placeholder.

---

## 2. Data fields rendered (no contracts touched — RECON §3/§4)

```
room.scores[myTeam]      → Nous       room.scores[1-myTeam]  → Eux
room.targetScore         → target     myTeam = players.find(p=>p.position===myPosition).team
game.currentBid.value    → value (number 80..160 | 'capot')
game.currentBid.suit ?? game.trumpSuit → atout   (trumpSuit null during bidding)
game.currentBid.{coinched,surcoinched} → mods
```

---

## 3. Screenshots (`pass4-screenshots/`, Playwright @2×) — full test matrix

| File | Case | Verdict |
| --- | --- | --- |
| `pass4-portrait-360-num.png` | 360, numeric bid | ✅ no overflow, wordmark fits |
| `pass4-portrait-390-num.png` | 390, numeric | ✅ Nous 82 gold / COINCHE 2000 / Eux 67 bordeaux; Contrat 80 ♠(brass) |
| `pass4-portrait-430-num.png` | 430, numeric | ✅ clean |
| `pass4-landscape-800x450-num.png` | 800×450 **grid** | ✅ 3-cell bar full-width, contract panel centered, partner hidden |
| `pass4-state-390-bid-null.png` | `currentBid` null | ✅ "Contrat / —", no atout line, no crash |
| `pass4-state-390-bid-capot.png` | value `'capot'` | ✅ "CAPOT" + "Atout ♥"(red) + "Coinché" mod |
| `pass4-viewer-team1-390.png` | **team-1 viewer** | ✅ Nous **67** / Eux **82** (swapped), gold/bordeaux preserved → viewer-relative correct for both camps |

Validated via the static skin harness (`%TEMP%/pass1/harness.html`, parametrized `?team=&bid=`)
linking the **real edited App.css** — its score-bar/contract-panel JS mirrors the GameBoard logic
exactly. (Avatars are the letter-fallback as in prior passes; react-peeps needs React.)

---

## 4. ⚠ Layout calls not dictated by the mockup — implemented a default, flagging (per the brief)

1. **Wordmark may duplicate the Header logo.** I put "COINCHE" in the score-bar center cell per
   the mockup, but the app already has a `Header` with an `.app-logo` "COINCHE" (RECON: Header =
   app chrome). On the real screen both could show. **Default:** added it as the mockup specifies.
   → Confirm: keep both, or consolidate `Header` into this bar (a `Header`-touching pass).
2. **Target format = inline "2000 pts"** stacked under the wordmark (not a "/2000" inline nor a
   dedicated 4th cell). Matches the mockup's stacked center panel. → Confirm the wording/format.
3. **Contract label = existing `t.contract` ("Contrat")**, not "Contrat en cours". The exact mockup
   copy would need a new i18n key, and `i18n/` is outside this pass's allowed files. → Want the
   longer copy? I'll add a `contractInProgress` key in an i18n-touching pass.
4. **Empty placeholder = "—"** (was the text `t.biddingPhase` "Annonces"). Cleaner in the panel
   frame. → Confirm dash vs a worded placeholder.

## 5. Notes / carried forward
- **coinche/surcoinche mod colors** still the deferred red `#e05050` / purple `#cc66ff` (visible as
  "Coinché" beside CAPOT) — retoned in the bidding pass, as noted in PASS1 §5.
- **Seat avatars** (`.team0-avatar`/`.team1-avatar`) are **still fixed-team** (PASS 1 §6b) — out of
  scope here; the score bar is now viewer-relative but the seat tints would need the same
  `is-mine`/`is-them` treatment in a seat pass.
- Scratch: `pass4-screenshots/` (repo root, untracked) + `%TEMP%/pass1/{harness.html,shot.js}`.
