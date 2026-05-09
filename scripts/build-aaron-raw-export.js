#!/usr/bin/env node
// Generate a raw markdown export of Aaron's training annotations
// (active + archived) for offline pattern extraction. Mirrors the
// shape of docs/sacha-v22-conversations-raw-2026-05-07.md.

const fs   = require('fs');
const path = require('path');

const REPO_ROOT     = path.resolve(__dirname, '..');
const TRAINING_DIR  = path.join(REPO_ROOT, 'backend', 'data', 'training');
const SCENARIOS_DIR = path.join(REPO_ROOT, 'backend', 'src', 'training', 'scenarios');

const SOURCES = [
  '7f35ed6a-8e9a-421e-8e79-1086fa663478', // active
  '_aaron-archive-2026-05-07',             // archived
];

const TODAY    = new Date().toISOString().slice(0, 10);
const OUT_FILE = path.join(REPO_ROOT, 'docs', `aaron-annotations-raw-${TODAY}.md`);

const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };

function readScenarios() {
  const out = new Map();
  for (const f of fs.readdirSync(SCENARIOS_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const obj = JSON.parse(fs.readFileSync(path.join(SCENARIOS_DIR, f), 'utf8'));
      if (obj.id) out.set(obj.id, obj);
    } catch (_) { /* skip malformed */ }
  }
  return out;
}

function formatAction(a) {
  if (!a) return '(no action)';
  if (a.type === 'bid') return `${a.value} ${SUIT_SYM[a.suit] || a.suit || ''}`.trim();
  return a.type || '(unknown)';
}

function formatHand(cards) {
  if (!cards || cards.length === 0) return '(no hand)';
  const bySuit = { S: [], H: [], D: [], C: [] };
  for (const c of cards) if (bySuit[c.suit]) bySuit[c.suit].push(c.value);
  return ['S','H','D','C']
    .filter(s => bySuit[s].length > 0)
    .map(s => `${SUIT_SYM[s]} ${bySuit[s].join(' ')}`)
    .join('  ·  ');
}

function formatTimeline(timeline, userSeat) {
  if (!timeline) return '(no timeline)';
  const lines = [];
  for (const ev of timeline) {
    const role = ev.seat === userSeat ? 'you'
               : ev.seat === (userSeat + 2) % 4 ? 'partner'
               : 'opponent';
    if (ev.event === 'user-turn') {
      lines.push(`- pos ${ev.seat} (you) : ?`);
      break;
    } else if (ev.event === 'bid') {
      lines.push(`- pos ${ev.seat} (${role}) : ${ev.value} ${SUIT_SYM[ev.suit] || ev.suit || ''}`);
    } else if (ev.event === 'pass') {
      lines.push(`- pos ${ev.seat} (${role}) : pass`);
    } else {
      lines.push(`- pos ${ev.seat} (${role}) : ${ev.event}`);
    }
  }
  return lines.join('\n');
}

function emitAnnotation(a, scenario, sourceLabel) {
  const decision   = a.decisions?.[0] || {};
  const userAction = decision.action;
  const userNote   = (decision.note || '').trim();
  const out = [];
  out.push(`## ${a.scenarioId}  _(${sourceLabel})_`);
  out.push('');
  out.push(`**Date**: ${a.completedAt || a.createdAt || 'unknown'}`);
  out.push(`**File**: \`${a._file}\``);
  if (scenario) {
    const userSeat = scenario.userSeat ?? 0;
    out.push(`**Hand**: ${formatHand(scenario.hands?.[String(userSeat)])}`);
    out.push(`**Bidding context**:`);
    out.push('```');
    out.push(formatTimeline(scenario.timeline, userSeat));
    out.push('```');
    const ea = scenario.expectedAnswer;
    out.push(`**V2.1 expected**: ${
      ea ? formatAction(ea.action) + (ea.ruleReference ? ` (rule ${ea.ruleReference})` : '') : '(rule-silent)'
    }`);
  } else {
    out.push(`**Scenario lookup failed** for id \`${a.scenarioId}\``);
  }
  out.push(`**Aaron's action**: ${formatAction(userAction)}`);
  if (decision.divergenceAgreement) {
    out.push(`**Divergence type**: ${decision.divergenceAgreement}`);
  }
  out.push('');
  out.push(`**Aaron's note**:`);
  out.push('');
  out.push(userNote ? `> ${userNote.replace(/\n/g, '\n> ')}` : '> _(no note)_');

  // Card selection (V2.2 Phase 2C)
  const sel = a.cardSelection;
  if (sel && sel.features && sel.features.selectedCount > 0) {
    out.push('');
    out.push(`**Selected cards features**:`);
    out.push('```json');
    out.push(JSON.stringify(sel.features, null, 2));
    out.push('```');
  }

  // Claude conversation (V2.2 chat) — accept multiple field shapes
  const conv = a.claude_conversation || a.claudeConversation || a.conversation;
  const messages = conv?.messages || [];
  if (messages.length > 0) {
    out.push('');
    out.push('### Conversation');
    for (const m of messages) {
      const isClaude = m.role === 'claude' || m.role === 'assistant';
      const label = isClaude ? '**Claude**' : '**Aaron**';
      out.push('');
      out.push(`${label} :`);
      out.push('');
      out.push((m.content || '').toString());
    }
  }

  out.push('');
  out.push('---');
  out.push('');
  return out.join('\n');
}

function main() {
  const scenarios   = readScenarios();
  const annotations = [];

  for (const src of SOURCES) {
    const dir = path.join(TRAINING_DIR, src);
    if (!fs.existsSync(dir)) {
      console.warn(`Skipping missing source: ${dir}`);
      continue;
    }
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const full = path.join(dir, f);
      try {
        const obj = JSON.parse(fs.readFileSync(full, 'utf8'));
        obj._file = f;
        obj._source = src;
        annotations.push(obj);
      } catch (e) {
        console.warn(`Failed to parse ${full}: ${e.message}`);
      }
    }
  }

  annotations.sort((a, b) => {
    const da = a.completedAt || a.createdAt || '';
    const db = b.completedAt || b.createdAt || '';
    return da.localeCompare(db);
  });

  const withNote = annotations.filter(a => (a.decisions?.[0]?.note || '').trim().length > 0).length;
  const withConv = annotations.filter(a => {
    const c = a.claude_conversation || a.claudeConversation || a.conversation;
    return c?.messages?.length > 0;
  }).length;

  const header = [
    `# Aaron — V2.2 annotations raw export`,
    '',
    `**Total annotations**: ${annotations.length}`,
    `**With non-empty note**: ${withNote}`,
    `**With Claude conversation**: ${withConv}`,
    `**Sources**:`,
    ...SOURCES.map(s => `- \`${s}\``),
    `**Generated**: ${TODAY}`,
    '',
    '---',
    '',
  ];

  const body = annotations.map(a =>
    emitAnnotation(a, scenarios.get(a.scenarioId),
      a._source.startsWith('_aaron-archive') ? 'archived' : 'active')
  );

  fs.writeFileSync(OUT_FILE, header.concat(body).join('\n'));
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`${annotations.length} annotations (${withNote} with note, ${withConv} with conversation)`);
}

if (require.main === module) main();
