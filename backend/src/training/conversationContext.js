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
// Factual reference layer BELOW the Feuille (faits du jeu: ordre/points des
// cartes, obligations de pli, lexique). La Feuille reste l'autorité conventionnelle.
const REGLES_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'regles-du-jeu.md');

function loadFeuille() {
  if (!fs.existsSync(FEUILLE_PATH)) {
    // Loud, never silent: the bot must not coach without the convention authority.
    console.error(`[conversationContext] LA FEUILLE INTROUVABLE: ${FEUILLE_PATH} — le bot coacherait SANS la convention (autorité). Corrige le déploiement.`);
    return '(la-feuille-v2.md introuvable)';
  }
  return fs.readFileSync(FEUILLE_PATH, 'utf8');
}

// Read docs/regles-du-jeu.md fresh on every request (same no-cache pattern as
// loadFeuille — Aaron's edits take effect on the next turn without a restart).
// Graceful on miss, but LOUD: we never silently coach without the factual layer.
function loadReglesDuJeu() {
  if (!fs.existsSync(REGLES_PATH)) {
    console.error(`[conversationContext] RÈGLES DU JEU INTROUVABLES: ${REGLES_PATH} — le bot coacherait SANS la couche de référence factuelle (faits du jeu). Corrige le déploiement.`);
    return '';
  }
  try {
    return fs.readFileSync(REGLES_PATH, 'utf8');
  } catch (err) {
    console.error(`[conversationContext] Échec lecture regles-du-jeu.md: ${err.message} — coaching SANS règles factuelles.`);
    return '';
  }
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

module.exports = { FEUILLE_PATH, REGLES_PATH, loadFeuille, loadReglesDuJeu, buildConversationHistory, stripCaptureRules };
