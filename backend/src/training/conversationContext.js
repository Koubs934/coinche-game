// Shared conversation-context helpers, extracted from server.js so the offline
// behavioral-eval harness (backend/eval/) can reuse the EXACT same Feuille
// loading and per-turn seed assembly as production — no copy of the prompt or
// the message layout. Non-destructive: server.js re-imports these and behaves
// identically.

const fs = require('fs');
const path = require('path');
const { formatScenarioForClaude } = require('../services/claudeService');
const { extractCaptureRules } = require('../services/personalFeuille');

// The same file the server injects as "LA FEUILLE V2.1". The path is resolved
// from THIS module's location: this file lives one directory deeper than
// server.js (src/training/ vs src/), so it needs three `..` to reach the repo
// root, where server.js used two. The resolved absolute path is identical.
const FEUILLE_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'la-feuille-v2.md');

function loadFeuille() {
  if (!fs.existsSync(FEUILLE_PATH)) return '(la-feuille-v2.md introuvable)';
  return fs.readFileSync(FEUILLE_PATH, 'utf8');
}

// Reproduces server.js's per-turn assembly EXACTLY (was server.js:417-421): the
// synthetic seed scenario message (rebuilt every turn, never persisted) prepended
// before the stored conversation messages. Callers pass `conv.messages` as
// priorMessages.
function buildConversationHistory(scenario, annotation, cardSelection, priorMessages) {
  const seedMessage = formatScenarioForClaude(scenario, annotation, cardSelection);
  return [
    { role: 'user', content: seedMessage },
    ...priorMessages,
  ];
}

// Shared CAPTURE_RULE strip: returns { rules, cleanText } — the user-visible
// message (cleanText) with the silent `CAPTURE_RULE:` lines removed, plus the
// extracted rules. Single entry point used by BOTH server.js (before
// persistence/FE) and the eval harness (so it judges the SAME post-strip text
// the user actually sees). Delegates to the regex in personalFeuille
// (kept there because personalFeuille.test.js locks its behavior).
function stripCaptureRules(rawText) {
  return extractCaptureRules(rawText);
}

module.exports = { FEUILLE_PATH, loadFeuille, buildConversationHistory, stripCaptureRules };
