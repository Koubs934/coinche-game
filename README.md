# Coinche — Multiplayer Card Game

Full-stack web app for the French Coinche card game. 4 players, real-time, mobile-first.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express + Socket.io |
| Auth | Supabase (email + username + password) |
| Frontend deploy | Vercel |
| Backend deploy | Railway |

---

## Quick start (local)

### 1. Supabase setup

1. Create a free project at [supabase.com](https://supabase.com)
2. In **Authentication → Settings**, enable **Email** provider
3. Copy your **Project URL** and **anon/public key**

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set PORT and FRONTEND_URL
npm install
npm run dev        # starts on :3001
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env:
#   VITE_SUPABASE_URL=https://xxx.supabase.co
#   VITE_SUPABASE_ANON_KEY=eyJ...
#   VITE_SOCKET_URL=http://localhost:3001
npm install
npm run dev        # starts on :5173
```

Open [http://localhost:5173](http://localhost:5173) in four browser tabs (or devices).

### LAN / phone testing (same Wi-Fi)

Find your machine's IP (`ipconfig` on Windows, `ip a` on Linux/Mac), then:

1. Create `frontend/.env.local` (gitignored, overrides `.env`):
   ```
   VITE_SOCKET_URL=http://192.168.1.11:3001
   ```
2. In `backend/.env`, append the LAN IP to `FRONTEND_URL`:
   ```
   FRONTEND_URL=http://localhost:5173,http://192.168.1.11:5173
   ```
3. Restart both servers. Vite prints a `Network:` URL — open that on your phone.

---

## Deploying

Architecture: **Vercel** (frontend static SPA) + **Railway** (backend WebSocket server).
Socket.io requires a persistent process — serverless platforms (Vercel functions, etc.) will not work for the backend.

### Step 1 — Push to GitHub

Create a GitHub repository and push the entire project root (monorepo).
Both Vercel and Railway will reference this same repo but deploy different subdirectories.

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/your-username/coinche-game.git
git push -u origin main
```

### Step 2 — Deploy backend to Railway

Railway auto-detects Node.js and runs `npm start`.

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select the monorepo root; set **Root Directory** to `backend/`
3. Under **Variables**, add:
   - `FRONTEND_URL` = `https://your-app.vercel.app` ← fill in after Step 3
   - (Railway provides `PORT` automatically — do not set it)
4. Deploy. Note the public URL Railway assigns (e.g. `https://coinche-backend.up.railway.app`).

> Railway's free Trial gives $5 credit. The Hobby plan ($5/month) is required for always-on hosting
> (needed so game state isn't lost between plays).

### Step 3 — Deploy frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import GitHub repo
2. Set **Root Directory** to `frontend/`
3. Vercel auto-detects Vite. Build command: `npm run build`, Output dir: `dist`
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon/public key
   - `VITE_SOCKET_URL` = your Railway URL from Step 2 (e.g. `https://coinche-backend.up.railway.app`)
5. Deploy. Note the Vercel URL (e.g. `https://coinche-game.vercel.app`).

### Step 4 — Wire up cross-references

- In **Railway** → Variables: update `FRONTEND_URL` to your actual Vercel URL, then redeploy
- In **Supabase** → Authentication → URL Configuration:
  - Set **Site URL** to your Vercel URL (required for email confirmation links)
  - Add your Vercel URL to **Redirect URLs**

### Step 5 — Verify

Open the Vercel URL on your phone or share it with a friend. Sign up, create a room, send the 6-character code.

### Production storage (persistent volume)

Railway containers have ephemeral disks — anything written to the filesystem
is wiped on every redeploy or restart. Training annotations under
`backend/data/training/<userId>/` are user-generated data and must survive
both, so they go on a persistent volume in production.

1. In the Railway backend service → **Volumes** → **Attach Volume**. Mount point: `/data`.
2. Under **Variables**, add:
   - `TRAINING_DATA_DIR` = `/data/training`
   - `GAMES_DATA_DIR` = `/data/games` (Game Review records share the same volume, different subdirectory)
3. Redeploy. `annotationStorage.js` and `gameRecordStorage.js` each read their
   own env var and write there instead of the default `backend/data/training/`
   or `backend/data/games/`.
4. Verify after a submitted run via Railway's shell:
   `ls /data/training/<userId>/` should contain the `<isoStamp>-<scenarioId>.json` file, and
   `ls /data/games/<userId>/` should contain a `<isoStamp>-<gameId>.json` file after any completed round.

Local dev does not need this — when `TRAINING_DATA_DIR` is unset, writes go
to the default path.

---

## Game flow

1. Sign up / log in
2. One player **creates a room** → gets a 6-character code
3. Three others **join** with the code
4. Room creator **assigns teams** (Team 1 / Team 2) and optionally adjusts the target score (default 2000)
5. Room creator clicks **Start Game**
6. Bidding → Playing → Round summary → Next round — until a team reaches the target

## Rules summary

- 32-card deck, 4 suits, trump-based trick-taking
- Bidding: 80–160 or Capot; must outbid to bid again
- Coinche (×2) can be called by the opposing team at any point; Surcoinche (×4) by the contracting team after a coinche — both end bidding immediately
- Belote/Rebelote: hold K+Q of trump, announce when playing each
- Scoring: actual trick points; failed contract = 0 / 160; capot bid & made = 500; accidental capot = 250; dix de der = 10; belote = 20; all rounded to nearest 10
- Running totals across rounds; game ends after the round where a team hits the target
- Disconnected player pauses the game; resumes automatically on reconnect

## Training mode

A solo practice table for playing pre-authored belote scenarios and capturing structured reasoning (tags + freeform note) for every decision. The goal is an annotated dataset of the user's personal convention, which will later drive rule extraction and bot tuning.

Access it from the Lobby home screen via the **Training** / **Entraînement** button. Scenarios live under `backend/src/training/scenarios/`.

### Annotation flow — exhaustion sessions

Each scenario run is an *exhaustion session*. The user records one decision, tags it, writes an optional note, and then is prompted **"Autre stratégie possible ?"**:

- **Oui, autre stratégie** — the scenario replays and the user records a different bid (same-bid duplicates are server-refused). All alternatives in a session share a `sessionId`; the annotation record carries a 0-based `alternativeIndex`.
- **Non, c'est tout** — the session concludes. The scenario is added to the user's `_exhausted.json` sidecar and hidden from the picker. A muted "Afficher les scénarios terminés (N)" toggle reveals exhausted scenarios with a "Terminé" badge and the count of alternatives recorded; starting an exhausted scenario begins a fresh session (and replaces the old `_exhausted.json` entry on conclusion).

### Data storage

Annotations are written to `backend/data/training/<userId>/<isoStamp>-<scenarioId>.json` (production: the `/data` persistent volume on Railway). Two version fields on every record:

- **`schemaVersion`** is the annotation record shape. Currently **2** (2026-04-21) — adds `sessionId`, `alternativeIndex`, `sessionStatus` for exhaustion sessions. Legacy `schemaVersion: 1` annotations remain on disk unmigrated; the rule extractor treats them as single-alternative sessions.
- **`tagsSchemaVersion`** is the tag vocabulary version. Currently **2** — see [`docs/tags-v2-spec.md`](docs/tags-v2-spec.md) for the canonical reference. v1 is archived at `backend/src/training/reasonTags.v1.json` for historical lookups only.

The sidecar file `backend/data/training/<userId>/_exhausted.json` indexes the user's exhausted scenarios (schema, sessionId, exhaustedAt, alternativesRecorded). The leading underscore keeps it visually distinct from annotation files; backup, recovery, and annotation-count scripts filter `_`-prefixed filenames.

The validator enforces one tag from the `bidding-action` group per decision and emits a non-blocking confirmation when the `trump-hand` group is empty. Duplicate bids within an exhaustion session are hard-refused with `DUPLICATE_BID_IN_SESSION`. All annotation files and the sidecar are gitignored.

## Game Review

A second annotation surface, parallel to Training mode. Every completed round of a real game auto-saves a full play record (initial hands, bidding, all 8 tricks with per-card timestamps, belote, outcome) to disk. No opt-out.

While the round is in progress, the **room creator** sees an **Erreur de jeu** / **Game error** button in the hand toolbar. Tapping it opens a full-screen overlay listing every completed trick (plus the in-progress one); the creator picks a card, writes a free-text note, and hits **Enregistrer**. The annotation is attached to that specific card (trick index + seat + card) and persisted into the `errorAnnotations` array of the round's final `GameRecord`. Cards already tagged in the current round show an amber dot; hovering (desktop) or tapping (mobile) reveals the existing note text so the creator doesn't unknowingly double-tag.

Records land at `backend/data/games/<roomCreatorUserId>/<isoStamp>-<gameId>.json` (production: `/data/games` on the same Railway persistent volume as Training — set via `GAMES_DATA_DIR`). `schemaVersion: 1`.

V1 scope is deliberately narrow: creator-only tagging, free-text notes only (no structured vocabulary), one card per annotation (no trick/hand-level notes), and no in-app replay viewer. Mid-round crashes lose the in-memory annotations. Full spec — schema, socket events, error codes, privacy facts — in [`docs/game-review-spec.md`](docs/game-review-spec.md).
