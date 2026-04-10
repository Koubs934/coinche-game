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
