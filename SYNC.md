# SYNC — `redesign-frontend-v3` ← `main`

Goal: bring `frontend/` + `backend/` (and the rest of the app) up to date inside
`redesign-frontend-v3`, without losing the `redesign-mocks/` work.

**Result: ✅ MERGED CLEANLY.** Merge commit `0e9d280`, no conflicts, `redesign-mocks/`
untouched, frontend builds.

---

## ÉTAPE 1 — Recon (read-only)

### Working tree
```
On branch redesign-frontend-v3
Untracked files:
	SNAPSHOT.md       (created in the previous session — not tracked by main)
	reference.jpeg    (not tracked by main)
nothing added to commit but untracked files present
```
- **No modified/staged tracked files.** The only working-tree content is 2 untracked
  files. Verified neither is tracked in `main`, so the merge cannot overwrite them and
  does not touch them. → No need to stash/commit `reference.jpeg` first.

### `main` local vs `origin/main`
```
git fetch --all          → up to date
git log --oneline origin/main..main   → (empty)  local main NOT ahead of origin
git log --oneline main..origin/main   → (empty)  origin NOT ahead of local main
```
- Local `main` is **exactly level** with `origin/main`. Safe to merge from local `main`.

### Branch point
```
merge-base(main, redesign-frontend-v3) = a03ff84  "docs: brief for frontend redesign v3 session"
```

### Incoming from main — `redesign-frontend-v3..main` (64 commits)
All app/infra work, no redesign-mocks. Highlights:
```
8d43e9e fix(game): bidding hand sort follows the selected bid suit (Sacha OFF)
7852c86 fix(game): rebuild hand-sort as a single reactive source of truth
8ae4708 fix(game): hand auto-sorts reliably for all players (bidding + per-deal reset)
113d8a6 feat(avatars): switch to full-body Open Peeps + redesign waiting room
a963bab feat(profile): profile screen + custom cartoon avatar builder
3bdf469 feat(game): add hand + train throw items with impact text callouts
633dfcf feat(game): throw projectiles at players (animated reactions)
6616234 feat: in-game table chat with per-seat notification bubbles
3a45ba6 feat: lobby redesign (layout B) + active games list
fe57e9b feat: lobby — online friends presence (all users)
d9fc3c5 feat: partner-peek toggle gated to two users (per-recipient, no leak)
9ae3247 feat(ui): redesign Réglages overlay + add Mode Sacha sort preference
745bd60 fix(scoring): flat coinche/surcoinche made score (value×mult + 160, defenders 0)
90e85ca fix(bidding): post-coinche only contracting team responds; surcoinche closes bidding
43b7778 feat: V2.2 Phase 3 - personal feuille (passive capture + batch curation)
534bcaf Add Feuille V2.3 draft with 7 rules extracted from Aaron annotations
0c61f2f Harden V2.2 conversational prompt against Sacha-audit hallucinations
... (+ ~47 more: bidding-sheet/mobile-layout reworks, training snapshots, tests, gitignore)
```

### What v3 has extra — `main..redesign-frontend-v3` (9 commits)
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
```

### File-level divergence — `git diff --stat main...redesign-frontend-v3`
```
371 files  — ALL under redesign-mocks/
```
- **RED-FLAG CHECK** — files diverging outside `redesign-mocks/`: **EMPTY**.
- **Scoped diff** `-- frontend backend`: **EMPTY** → zero overlap with app code.
- Per-top-level-dir count: `371  redesign-mocks/` (and nothing else).

### Remote redesign branch?
```
git branch -r | grep redesign  → (none)
```
- `origin/redesign-frontend-v3` does **not** exist — this branch is **local-only**.
  (So nothing was pushed; the merge stays local until you decide to push.)

---

## ÉTAPE 2 — Decision

Conditions for the auto-merge ("SI") branch:
- ✅ Working tree clean of tracked-file changes (only 2 untracked files, both verified
  safe — `main` doesn't track them, no overwrite risk).
- ✅ v3 diverges from `main` **only inside `redesign-mocks/`** (371 files), **zero**
  overlap with `frontend/`+`backend/`.

Both hold → **proceeded with `git merge main`.** (The two sides touch disjoint paths,
so the merge is conflict-free by construction.)

### Merge result
```
git merge main → "Merge made by the 'ort' strategy."  (exit 0, no conflicts)
Merge commit: 0e9d280  "Merge branch 'main' into redesign-frontend-v3"
Parents:      ebc00ae (old v3 tip)  +  8d43e9e (main tip)
83 files changed, 14895 insertions(+), 728 deletions(-)
```

**Files brought in (83), grouped:**

| Area | What arrived |
| --- | --- |
| `frontend/src/components/` | NEW: `Avatar.jsx`, `ProfileScreen.jsx`, `ActiveGamesList.jsx`, `ChatPanel.jsx`, `ChatBubbles.jsx`, `OnlineFriends.jsx`, `SettingsModal.jsx`, `ThrowLayer.jsx`, `ThrowTray.jsx`, `ThrowMock.jsx`, `__tests__/handSort.test.js`. CHANGED: `GameBoard.jsx` (+806), `Lobby.jsx`, `BiddingPanel.jsx`, `RoundSummary.jsx`, `Header.jsx`, `HandSizeToggle.jsx`, `gameBoardHelpers.js`, `gameBoardParts.jsx` |
| `frontend/src/` (other) | NEW: `context/ModeSachaContext.jsx`, `lib/avatar.js` (+test), `lib/throwItems.js`, `throw.css`. CHANGED: `App.jsx` (+239), `App.css` (+1471), `main.jsx`, `i18n/{en,fr}.js`, `training/*` |
| `frontend/` (deps) | `package.json` + `package-lock.json` — **new deps `react-peeps`, `vitest`** + `test:vitest` script |
| `backend/src/` | CHANGED: `roomManager.js` (+461), `server.js` (+286), `socketEvents.js`, `botProcessor.js`, `scoring.js`, `verify.js`, `services/claudeService.js`, `training/*`. NEW: `presence.js`, `services/personalFeuille.js`, `nodemon.json`, **11 new `__tests__/` suites** |
| `docs/` | NEW: training snapshots (rod/sacha/aaron), `la-feuille-v2.3-draft.md`, `feuille-personnelle-curation.md`, master-prompt task doc, v2-2 design notes |
| `scripts/` | NEW: `analyze-rod-snapshot.js`, `build-aaron-raw-export.js` |
| `supabase/migrations/` | NEW: `..._create_profiles_for_friends.sql`, `..._add_avatar_config_to_profiles.sql` |
| root | `CLAUDE.md`, `CONTEXT.md` updated; NEW `BIDDING_CONTEXT.md`; `.gitignore` +6; removed tracked `.claude/settings.local.json` |
| `redesign-mocks/` | **0 files changed — fully preserved.** |

---

## Post-merge verification

### `redesign-mocks/` integrity
```
assets/cards/*.png            → 32 PNGs ✓
01-bidding-table.html         → present ✓
DESIGN-SYSTEM.md              → present ✓
cards/COMPLETION.md           → present ✓
```

### Frontend builds
```
npm install   → added 148 packages (react-peeps, vitest, deps) ✓
              → (npm audit: 7 vulns reported — pre-existing, informational, not blocking)
npm run build → vite v5.4.21, 710 modules transformed, ✓ built in 5.07s  (exit 0)
```
Build warnings are pre-existing advisories only (Vite CJS-Node-API deprecation; one
chunk >500 kB) — **no errors**.

### Final tree state
```
git status --short
  ?? SNAPSHOT.md       (untracked, unchanged)
  ?? reference.jpeg    (untracked, unchanged)
frontend/dist/ → gitignored ✓ (build artifact, not staged)
```

---

## Notes / what's left to you

- **Not pushed.** `origin/redesign-frontend-v3` doesn't exist; the merge is local. Push
  with `git push -u origin redesign-frontend-v3` when you want it remote.
- **Backend deps not installed here** (the task scoped verification to `frontend/`). If
  you'll run the backend, `cd backend && npm install` (new test suites + deps landed).
- `SNAPSHOT.md` and `reference.jpeg` remain untracked by design — commit or ignore them
  as you see fit.
- The redesign mockup (`redesign-mocks/01-bidding-table.html`) and the now-updated live
  `frontend/src/components/BiddingPanel.jsx` / `GameBoard.jsx` are both in the tree —
  porting the mockup's design into the live components is the natural next step.
