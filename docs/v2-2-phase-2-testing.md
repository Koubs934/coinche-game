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

## Phase 2C flow summary

After the user submits a training action, three branches run with **no
intermediate modal**:

| Case          | Trigger                                | Result                                                        |
|---------------|----------------------------------------|---------------------------------------------------------------|
| `match`       | action equals scenario.expectedAnswer  | Auto-advance to next scenario (no completion screen)          |
| `divergent`   | action differs from expectedAnswer     | Completion screen + Claude conversation opens automatically    |
| `rule-silent` | scenario has no expectedAnswer         | Completion screen + Claude conversation opens automatically    |

The "D'accord / Pas d'accord" modal and the rule-silent obligatory-note
modal are gone. The note field is empty by default — the conversation
with Claude replaces it as the reasoning-collection surface.

## Test scenarios

### A. Match → auto-advance (no completion screen)

1. Open http://localhost:5173, login.
2. Open the training picker.
3. Pick a scenario where the V2.1 expected answer is e.g. `pass`
   (`opening-petit-jeu-first-to-speak` qualifies).
4. Submit `pass`.
5. Verify: NO completion screen flashes. The next scenario in
   alphabetical order loads directly.
6. If there's no next scenario, you bounce back to the picker.

### B. Divergent → completion + Claude

1. Pick `raise-partner-90-hearts` (V2.1 expects `110 ♥`).
2. Submit a different bid, e.g. `130 ♥`.
3. Verify: NO modal appears. Completion screen shows directly with the
   AuctionRecap header + your action + the Claude conversation panel.
4. Claude's first question arrives within ~5 seconds.

### C. Rule-silent → completion + Claude

1. Pick `petit-jeu-after-opp-80-spades` (rule-silent — `expectedAnswer: null`).
2. Submit any bid.
3. Verify: NO obligatory-note modal. Completion screen shows directly
   with the AuctionRecap header + your action + the Claude conversation.
4. Claude's first question is framed for rule-silent (he says the
   Feuille doesn't cover this case rather than accusing you of diverging).

## Verification checklist

- [ ] Match scenarios skip the completion screen entirely.
- [ ] Divergent scenarios skip the modal — completion screen with
      Claude opens immediately on submit.
- [ ] Rule-silent scenarios skip the modal — completion screen with
      Claude opens immediately on submit.
- [ ] No "VOTRE NOTE" section appears for new annotations (note is empty).
- [ ] AuctionRecap header is visible on every completion screen.
- [ ] Claude's first message is in French and concise (2-4 sentences).
- [ ] For rule-silent: Claude does NOT say "you diverged from the rule".
- [ ] Textarea accepts multi-line input. Shift+Enter newline, Enter submits.
- [ ] Loading indicator shows during Claude's response.
- [ ] Conversation auto-scrolls to the bottom on each new message.
- [ ] "Terminer la discussion" closes the conversation without errors.
- [ ] "Scénario suivant" still works while conversation is open.
- [ ] Reload of the page → annotation file on disk has the
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

## File touchpoints (Phase 2C)

- Frontend
  - `frontend/src/training/ClaudeConversation.jsx` (Phase 2)
  - `frontend/src/training/CompletionSummary.jsx` (Phase 2C — Claude
    opens for divergent + rule-silent; note section conditional)
  - `frontend/src/training/TrainingTable.jsx` (Phase 2C — auto-fires
    submitTrainingReason for every case; modal removed)
  - `frontend/src/App.jsx` (Phase 2C — match auto-advances; threads
    caseType through to CompletionSummary)
  - `frontend/src/training/ReasonPanel.jsx`        — DELETED in Phase 2C
  - `frontend/src/training/ReasonPanelMock.jsx`    — DELETED in Phase 2C
  - `frontend/src/training/formatActionLabel.jsx`  — DELETED in Phase 2C
- Backend
  - `backend/src/training/divergence.js` (Phase 2C — server-canonical
    agreement, no rejection paths)
  - `backend/src/training/trainingSocket.js` (Phase 2C — emits caseType
    in trainingCompleted)
  - `backend/src/services/claudeService.js` (Phase 2C — caseType-aware
    system prompt)
  - `backend/src/server.js` (Phase 2C — derives caseType from annotation
    in /api/conversation/start)

## Endpoints exercised

- `POST /api/conversation/start` — on conversation mount
- `POST /api/conversation/turn`  — on each user message submit
- `POST /api/conversation/end`   — on "Terminer la discussion"
