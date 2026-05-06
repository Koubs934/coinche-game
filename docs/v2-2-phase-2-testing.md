# V2.2 Phase 2 — Local Testing Guide

## Prerequisites
- Backend `.env.railway.local` contains a valid `ANTHROPIC_API_KEY`
- Frontend `.env` already has `VITE_SOCKET_URL=http://localhost:3001` (committed)
- Node 18+ installed

## Run

Terminal 1 (backend):
```
cd backend
export $(cat .env.railway.local | xargs)
node src/server.js
```
Backend listens on port 3001.

Terminal 2 (frontend):
```
cd frontend
npm run dev
```
Frontend serves on http://localhost:5173.

## Test scenario

1. Open http://localhost:5173 in your browser.
2. Login with your Supabase account (any existing test account).
3. Click "Mode entraînement" / open the training picker.
4. Pick a scenario where you'll deliberately diverge from the rule
   (e.g. `raise-partner-90-hearts` — V2.1 expects 110 ♥; bid something else like 130 ♥).
5. Submit your action.
6. The reason panel opens. Click "Pas d'accord" and write a brief
   reasoning note. Click "Valider".
7. The completion screen appears. Below the action / note card, a Claude
   conversation panel should open inline with a "Votre main / Enchères"
   recap above the existing card.
8. Verify Claude's first question arrives within ~5 seconds.
9. Type a response and either press Enter or click "Envoyer".
10. Verify Claude's reply arrives within 2-5 seconds.
11. Click "Terminer la discussion" to close the conversation
    (or "Scénario suivant" / "Retour aux scénarios" to move on
    without closing — the conversation will be auto-marked `skip`
    only if you click "Terminer la discussion" first).

## Verification checklist

- [ ] Claude's first message arrives within ~5 seconds.
- [ ] Message is in French and concise (2-4 sentences).
- [ ] Message references your bid AND the Feuille's expected bid.
- [ ] Textarea accepts multi-line input. Shift+Enter inserts a newline,
      plain Enter submits.
- [ ] Loading indicator shows during Claude's response.
- [ ] Conversation auto-scrolls to the bottom on each new message.
- [ ] Hand and bidding context are visible above the action / note card.
- [ ] "Terminer la discussion" closes the conversation without errors.
- [ ] "Scénario suivant" still works while conversation is open.
- [ ] Reload of the page → annotation file on disk still has the
      `claude_conversation` field with stored messages
      (`backend/data/training/<userId>/<...>.json`).

## Network failure smoke check

1. Start the conversation.
2. Stop the backend (Ctrl-C in Terminal 1).
3. Send a message.
4. Verify the UI shows "Erreur de connexion. Réessayer ?" with a retry button.
   The user message you typed should still be visible (not lost).
5. Restart the backend, click "Réessayer". The turn should complete.

## Cost guardrails

Each turn costs ~$0.02–0.05. A typical 5-turn conversation ≈ ~$0.15.
Budget cap: $50/month set in Anthropic console.

## File touchpoints

- Frontend
  - `frontend/src/training/ClaudeConversation.jsx` (new)
  - `frontend/src/training/CompletionSummary.jsx` (modified — renders the
    conversation + a hand/bidding recap)
  - `frontend/src/App.jsx` (modified — threads `userId` and
    `annotationFilename` through to CompletionSummary)
  - `frontend/src/i18n/{fr,en}.js` (new keys: `training.claudeConversation.*`)
  - `frontend/src/App.css` (new `.claude-*` rules)
- Backend
  - `backend/src/training/trainingSocket.js` (modified — `trainingCompleted`
    now also emits `annotationFilename`)

## Phase 1 endpoints exercised

- `POST /api/conversation/start` — on conversation mount
- `POST /api/conversation/turn`  — on each user message submit
- `POST /api/conversation/end`   — on "Terminer la discussion"
