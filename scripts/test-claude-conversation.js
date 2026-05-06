#!/usr/bin/env node
/**
 * V2.2 Phase 1 smoke test — exercise claudeService.startConversation against
 * a real "user-disagrees" annotation from the Sacha snapshot.
 *
 * Reads only — never writes to /data/training. Pure stdout output.
 *
 * Run from repo root after exporting ANTHROPIC_API_KEY:
 *
 *   cd backend && export $(cat .env.railway.local | xargs) && \
 *     node ../scripts/test-claude-conversation.js
 *
 * Exit codes:
 *   0 — Claude returned a non-empty message
 *   1 — any failure (missing API key, no candidate annotation, API error, etc.)
 */

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const SNAPSHOT_DIR  = path.join(ROOT, 'backend', 'data', 'training', '_sacha-snapshot');
const SCENARIOS_DIR = path.join(ROOT, 'backend', 'src', 'training', 'scenarios');
const FEUILLE_PATH  = path.join(ROOT, 'docs', 'la-feuille-v2.md');

// Loaded from backend/node_modules so the script doesn't need its own install.
const claudeService = require(path.join(ROOT, 'backend', 'src', 'services', 'claudeService.js'));

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function pickDisagreeAnnotation() {
  if (!fs.existsSync(SNAPSHOT_DIR)) fail(`snapshot dir missing: ${SNAPSHOT_DIR}`);
  for (const entry of fs.readdirSync(SNAPSHOT_DIR)) {
    if (!entry.endsWith('.json') || entry.startsWith('_')) continue;
    const p = path.join(SNAPSHOT_DIR, entry);
    let rec;
    try { rec = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    if (rec.decisions?.[0]?.divergenceAgreement === 'user-disagrees') {
      return { filename: entry, annotation: rec };
    }
  }
  return null;
}

function loadScenario(scenarioId) {
  const p = path.join(SCENARIOS_DIR, `${scenarioId}.json`);
  if (!fs.existsSync(p)) fail(`scenario file missing: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadFeuille() {
  if (!fs.existsSync(FEUILLE_PATH)) fail(`feuille missing: ${FEUILLE_PATH}`);
  return fs.readFileSync(FEUILLE_PATH, 'utf8');
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    fail('ANTHROPIC_API_KEY not set — `export $(cat backend/.env.railway.local | xargs)` first');
  }

  const picked = pickDisagreeAnnotation();
  if (!picked) fail(`no "user-disagrees" annotation found in ${SNAPSHOT_DIR}`);
  const { filename, annotation } = picked;

  console.log(`▸ Annotation:    ${filename}`);
  console.log(`▸ Scenario:      ${annotation.scenarioId}`);
  console.log(`▸ Decision:      ${JSON.stringify(annotation.decisions[0].action)}`);
  console.log(`▸ Note:          ${JSON.stringify(annotation.decisions[0].note)}`);
  console.log('');

  const scenario       = loadScenario(annotation.scenarioId);
  const feuilleContent = loadFeuille();

  console.log(`▸ Calling Claude (${claudeService.MODEL}, max_tokens=${claudeService.MAX_TOKENS})...`);
  console.log('');

  const result = await claudeService.startConversation({
    scenario,
    annotation,
    userName:        annotation.username || 'Faispaschier',
    pastAnnotations: [],     // smoke test: skip past-annotations context
    feuilleContent,
  });

  console.log('─── Claude\'s opening question ───────────────────────────────');
  console.log(result.text);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('▸ Token usage:');
  console.log(JSON.stringify(result.usage, null, 2));

  if (!result.text || result.text.trim().length === 0) fail('Claude returned an empty message');
  console.log('');
  console.log('✓ Smoke test passed.');
}

main().catch(err => fail(err.stack || err.message));
