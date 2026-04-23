#!/usr/bin/env node
// Reads every GameRecord under backend/data/games-mirror/ and writes a single
// self-contained HTML report to docs/games-report.html. No server, no build
// step, no dependencies — open the output in a browser.
//
// Anonymization: userIds are mapped to short codes (2-3 chars) derived from
// usernames, shown in a legend at the top of the report. The real userIds
// never appear in the HTML.
//
// Idempotent and side-effect-free with respect to source data — reads JSON,
// writes one HTML file. Malformed records are skipped with a console warning
// and counted in the footer.

const fs   = require('fs');
const path = require('path');

const REPO_ROOT  = path.resolve(__dirname, '..');
const MIRROR_DIR = path.join(REPO_ROOT, 'backend', 'data', 'games-mirror');
const OUT_FILE   = path.join(REPO_ROOT, 'docs', 'games-report.html');

// Exported so the test can exercise the pure pipeline without touching disk.
module.exports = {
  codeFor,
  buildPlayerCodeMap,
  renderHTML,
  readAllGames,
  MIRROR_DIR,
  OUT_FILE,
};

// ── Reading & validation ───────────────────────────────────────────────────

function readAllGames(mirrorDir = MIRROR_DIR) {
  const out = [];
  const skipped = [];
  if (!fs.existsSync(mirrorDir)) return { games: out, skipped };
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(abs); continue; }
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      try {
        const rec = JSON.parse(fs.readFileSync(abs, 'utf8'));
        const missing = validateRecord(rec);
        if (missing) {
          skipped.push({ file: abs, reason: `missing fields: ${missing}` });
          continue;
        }
        out.push(rec);
      } catch (err) {
        skipped.push({ file: abs, reason: err.message });
      }
    }
  })(mirrorDir);
  return { games: out, skipped };
}

function validateRecord(rec) {
  const req = ['gameId', 'completedAt', 'players', 'deal', 'bidding', 'play', 'outcome'];
  const miss = req.filter(k => rec?.[k] == null);
  if (miss.length) return miss.join(',');
  if (!Array.isArray(rec.players) || rec.players.length !== 4) return 'players (length 4)';
  if (!Array.isArray(rec.play?.tricks)) return 'play.tricks';
  if (!Array.isArray(rec.errorAnnotations)) rec.errorAnnotations = [];
  return null;
}

// ── Anonymization ──────────────────────────────────────────────────────────

// Compact code rule:
//   - first letter-run of the username, up to 3 chars
//   - if <3 chars, append the first digit in the username (if any)
//   - truncate to 3
//   - "???" fallback if the username has no letters or digits
function codeFor(username) {
  const u = String(username || '');
  const lead = u.match(/^[A-Za-z]+/);
  if (!lead) return '???'; // no leading letters → no meaningful code
  let code = lead[0].slice(0, 3);
  if (code.length < 3) {
    const d = u.match(/\d/);
    if (d) code += d[0];
  }
  if (code.length > 3) code = code.slice(0, 3);
  return code;
}

function buildPlayerCodeMap(games) {
  // userId → best-known username (first seen wins; usernames are assumed
  // reasonably stable within the short window of this dataset).
  const usernames = {};
  for (const g of games) {
    for (const p of g.players) {
      if (!usernames[p.userId]) usernames[p.userId] = p.username;
    }
    if (g.roomCreatorUserId && !usernames[g.roomCreatorUserId] && g.roomCreatorUsername) {
      usernames[g.roomCreatorUserId] = g.roomCreatorUsername;
    }
  }

  // Sort userIds for stable codes across runs (no dependency on filesystem order).
  const codes = {};
  const used = new Map();
  for (const uid of Object.keys(usernames).sort()) {
    const base = codeFor(usernames[uid]);
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    codes[uid] = n === 1 ? base : `${base}${n}`;
  }
  return { codes, usernames };
}

// ── Formatting helpers ─────────────────────────────────────────────────────

const SUIT_SYM   = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED_SUITS  = new Set(['H', 'D']);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDateTime(iso) {
  if (!iso) return '';
  // Keep it short + locale-agnostic: "YYYY-MM-DD HH:MM" in UTC.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return esc(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ` +
         `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function suitHTML(suit) {
  const sym = SUIT_SYM[suit] || suit || '';
  const cls = RED_SUITS.has(suit) ? 'suit red' : 'suit';
  return `<span class="${cls}">${sym}</span>`;
}

function cardHTML(cardStr) {
  // GameRecord stores cards as "<value><suit>" ("10D", "9H", "AS").
  const m = String(cardStr || '').match(/^(10|[789JQKA])([SHDC])$/);
  if (!m) return `<span class="card">${esc(cardStr)}</span>`;
  const [, val, suit] = m;
  return `<span class="card${RED_SUITS.has(suit) ? ' red' : ''}">${esc(val)}${SUIT_SYM[suit]}</span>`;
}

function contractText(bidding) {
  const w = bidding?.winner;
  if (!w) return '<span class="muted">(no contract)</span>';
  const val = w.value === 'capot' ? 'Capot' : esc(w.value);
  const coin = bidding.coinche
    ? (bidding.coinche.surcoinched ? ' <b class="sur">✓✓</b>' : ' <b class="coin">✓</b>')
    : '';
  return `${val}${suitHTML(w.suit)} <span class="muted">by T${esc(w.team + 1)}</span>${coin}`;
}

function bidActionHTML(a) {
  switch (a?.type) {
    case 'bid': {
      const val = a.value === 'capot' ? 'Capot' : esc(a.value);
      return `<span class="bid-value">${val}${suitHTML(a.suit)}</span>`;
    }
    case 'pass':       return '<span class="bid-pass">pass</span>';
    case 'coinche':    return '<span class="bid-coin">coinche</span>';
    case 'surcoinche': return '<span class="bid-coin">surcoinche</span>';
    default:           return esc(a?.type || '?');
  }
}

// ── HTML rendering ─────────────────────────────────────────────────────────

function renderHTML({ games, codes, usernames, skipped }) {
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16) + 'Z';

  // Descending by completedAt so newest appears first by default.
  const sorted = [...games].sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
  const total = sorted.length;
  const userIds = Object.keys(codes);
  const uniquePlayers = userIds.length;
  const withErrors = sorted.filter(g => (g.errorAnnotations || []).length > 0).length;
  const clean = total - withErrors;
  const pct = total ? Math.round((withErrors / total) * 100) : 0;
  const cleanPct = total ? 100 - pct : 0;
  const earliest = sorted.length ? sorted[sorted.length - 1].completedAt : null;
  const latest   = sorted.length ? sorted[0].completedAt : null;

  const codeOf = uid => codes[uid] || '???';

  // Map seat → code for a game. Seats always 0–3.
  function seatCodes(g) {
    const ordered = [...g.players].sort((a, b) => a.seat - b.seat);
    return ordered.map(p => codeOf(p.userId));
  }

  // Player→team lookup within a game.
  function teamOfSeat(g, seat) {
    return g.teams?.find(t => t.seats.includes(seat))?.teamId ?? (seat % 2);
  }

  // ── Empty state short-circuit ─────────────────────────────────────────
  if (total === 0) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Coinche Games Report</title>${STYLE_TAG}</head>
<body><div class="wrap">
  <h1>Coinche Games Report</h1>
  <p class="muted">Generated ${esc(generatedAt)}</p>
  <p>No games found. Run <code>node scripts/sync-games.js</code> first.</p>
</div></body></html>`;
  }

  // ── Summary top band ─────────────────────────────────────────────────
  const summary = `
<section class="summary">
  <div><b>${esc(total)}</b> games</div>
  <div><b>${esc(uniquePlayers)}</b> unique players</div>
  <div>Date range: <b>${fmtDateTime(earliest)}</b> → <b>${fmtDateTime(latest)}</b></div>
  <div>With errors: <b>${esc(withErrors)}</b> (${esc(pct)}%)</div>
  <div>Clean: <b>${esc(clean)}</b> (${esc(cleanPct)}%)</div>
</section>`;

  const legendRows = userIds
    .sort((a, b) => codeOf(a).localeCompare(codeOf(b)))
    .map(uid => `<tr><td><b>${esc(codeOf(uid))}</b></td><td>${esc(usernames[uid])}</td></tr>`)
    .join('');
  const legend = `
<section class="legend">
  <h2>Player codes</h2>
  <table class="legend-table">
    <thead><tr><th>Code</th><th>Username</th></tr></thead>
    <tbody>${legendRows}</tbody>
  </table>
</section>`;

  // ── Table rows ───────────────────────────────────────────────────────
  const tableRows = sorted.map((g, i) => {
    const seats = seatCodes(g);
    const winT = g.outcome.winningTeam; // 0|1
    const t0 = esc(g.outcome.team0Score);
    const t1 = esc(g.outcome.team1Score);
    const score = winT === 0
      ? `<b>${t0}</b> / ${t1}`
      : `${t0} / <b>${t1}</b>`;
    const coin = g.bidding.coinche
      ? (g.bidding.coinche.surcoinched ? '✓✓' : '✓')
      : '';
    const belote = g.play.belote?.declaredBy != null
      ? codeOf(g.players.find(p => p.seat === g.play.belote.declaredBy)?.userId)
      : '';
    const errCount = (g.errorAnnotations || []).length;
    const errCell = errCount === 0
      ? '<span class="muted">0</span>'
      : `<b class="err-count">${esc(errCount)}</b>`;
    const anchor = `game-${esc(g.gameId)}`;
    const contractSortKey = g.bidding.winner
      ? `${g.bidding.winner.value === 'capot' ? 500 : g.bidding.winner.value}-${g.bidding.winner.suit}`
      : '';
    return `
<tr>
  <td data-sort="${esc(g.completedAt)}">${fmtDateTime(g.completedAt)}</td>
  <td>${seats.map(s => `<span class="code">${esc(s)}</span>`).join(', ')}</td>
  <td data-sort="${esc(contractSortKey)}">${contractText(g.bidding)}</td>
  <td>${esc(coin)}</td>
  <td>${belote ? `<span class="code">${esc(belote)}</span>` : ''}</td>
  <td data-sort="${esc((g.outcome.team0Score + g.outcome.team1Score) * 1)}">${score}</td>
  <td><span class="team team-${winT}">T${winT + 1}</span></td>
  <td data-sort="${esc(errCount)}">${errCell}</td>
  <td><a class="jump" href="#${anchor}">view ↓</a></td>
</tr>`;
  }).join('');

  // ── Per-game details ─────────────────────────────────────────────────
  const details = sorted.map(g => renderDetail(g, codes)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Coinche Games Report — ${esc(generatedAt)}</title>
  ${STYLE_TAG}
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Coinche Games Report</h1>
      <p class="muted">Generated ${esc(generatedAt)}</p>
      ${summary}
      ${legend}
    </header>

    <section class="games-list">
      <h2>Games</h2>
      <div class="table-wrap">
        <table id="games-table">
          <thead>
            <tr>
              <th data-col="0" class="sort active desc">Date</th>
              <th>Players</th>
              <th data-col="2" class="sort">Contract</th>
              <th>Coinche?</th>
              <th>Belote?</th>
              <th data-col="5" class="sort">Score</th>
              <th>Won</th>
              <th data-col="7" class="sort">Errors</th>
              <th>View</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </section>

    <section class="details">
      <h2>Details</h2>
      ${details}
    </section>

    <footer>
      <p class="muted">Generated from <code>backend/data/games-mirror/</code>.
      Re-run <code>node scripts/sync-games.js</code> then
      <code>node scripts/build-games-report.js</code> to refresh.</p>
      ${skipped?.length
        ? `<p class="warn">Skipped ${esc(skipped.length)} malformed record${skipped.length === 1 ? '' : 's'}.</p>`
        : ''}
    </footer>
  </div>
  ${SCRIPT_TAG}
</body>
</html>`;
}

function renderDetail(g, codes) {
  const codeOf = uid => codes[uid] || '???';
  const anchor = `game-${g.gameId}`;

  const seats = [...g.players].sort((a, b) => a.seat - b.seat);
  function seatLabel(seatIdx) {
    const p = seats.find(p => p.seat === seatIdx);
    const code = p ? codeOf(p.userId) : '???';
    const t = g.teams?.find(t => t.seats.includes(seatIdx))?.teamId ?? (seatIdx % 2);
    return `Seat ${seatIdx}: <span class="code">${esc(code)}</span> <span class="team-tag team-${t}">T${t+1}</span>`;
  }

  // Bidding sequence
  const biddingHTML = (g.bidding.rounds || []).map((r, i) => {
    const isWinner = g.bidding.winner
      && r.action.type === 'bid'
      && r.action.value === g.bidding.winner.value
      && r.action.suit === g.bidding.winner.suit
      && r.seat === g.bidding.winner.seat;
    const code = seats.find(p => p.seat === r.seat)
      ? codeOf(seats.find(p => p.seat === r.seat).userId) : '???';
    return `
<div class="bid-chip${isWinner ? ' bid-winning' : ''}${r.action.type === 'pass' ? ' bid-pass-chip' : ''}">
  <div class="bid-seat">S${esc(r.seat)} · <span class="code">${esc(code)}</span></div>
  <div class="bid-action">${bidActionHTML(r.action)}</div>
</div>`;
  }).join('');

  // Error annotation index keyed by `${trickIndex}-${seat}-${card}` → [notes]
  const annIndex = new Map();
  for (const a of (g.errorAnnotations || [])) {
    const key = `${a.cardRef.trickIndex}-${a.cardRef.seat}-${a.cardRef.card}`;
    if (!annIndex.has(key)) annIndex.set(key, []);
    annIndex.get(key).push(a);
  }

  // Tricks
  const tricksHTML = (g.play.tricks || []).map(tr => {
    const leadCode = codeOf(seats.find(p => p.seat === tr.leadSeat)?.userId);
    const winnerCode = codeOf(seats.find(p => p.seat === tr.winnerSeat)?.userId);
    const cardsHTML = tr.cards.map((c, i) => {
      const playerCode = codeOf(seats.find(p => p.seat === c.seat)?.userId);
      const key = `${tr.trickIndex}-${c.seat}-${c.card}`;
      const hasAnn = annIndex.has(key);
      const isWinner = c.seat === tr.winnerSeat;
      return `
<div class="card-slot${isWinner ? ' card-winner' : ''}${hasAnn ? ' card-annotated' : ''}">
  <div class="card-order">${i + 1}</div>
  ${cardHTML(c.card)}
  <div class="card-seat">S${esc(c.seat)} · <span class="code">${esc(playerCode)}</span></div>
  ${hasAnn ? `<div class="card-badge" title="Has annotation${annIndex.get(key).length > 1 ? 's' : ''}">●</div>` : ''}
</div>`;
    }).join('');
    return `
<div class="trick">
  <div class="trick-header">
    <span class="trick-label">Trick ${tr.trickIndex + 1}</span>
    <span class="muted">led by <span class="code">${esc(leadCode)}</span></span>
    <span class="trick-winner">→ won by <span class="code">${esc(winnerCode)}</span></span>
  </div>
  <div class="trick-cards">${cardsHTML}</div>
</div>`;
  }).join('');

  // Belote line
  const b = g.play.belote;
  const beloteLine = (b && b.declaredBy != null)
    ? `<p class="belote-line">Belote declared by <span class="code">${esc(codeOf(seats.find(p => p.seat === b.declaredBy)?.userId))}</span> on trick ${esc((b.trickIndex ?? 0) + 1)}${b.rebeloteAt ? `, rebelote at ${fmtDateTime(b.rebeloteAt)}` : ''}.</p>`
    : '';

  // Annotations
  const annsHTML = (g.errorAnnotations || []).length === 0
    ? `<p class="muted">No errors tagged.</p>`
    : (g.errorAnnotations || []).map(a => {
        const cr = a.cardRef;
        const byCode = codeOf(a.createdByUserId);
        const playerCode = codeOf(seats.find(p => p.seat === cr.seat)?.userId);
        return `
<div class="annotation">
  <blockquote>${esc(a.note)}</blockquote>
  <div class="ann-caption">
    ↑ Trick ${esc(cr.trickIndex + 1)}, <span class="code">${esc(playerCode)}</span>'s
    ${cardHTML(cr.card)}
    <span class="muted">· tagged by <span class="code">${esc(byCode)}</span> at ${fmtDateTime(a.createdAt)}</span>
  </div>
</div>`;
      }).join('');

  // Outcome line
  const winT = g.outcome.winningTeam;
  const t0 = esc(g.outcome.team0Score);
  const t1 = esc(g.outcome.team1Score);
  const outcomeLine = `
<p class="outcome-line">
  Final: <b class="${winT === 0 ? 'win' : ''}">${t0}</b> / <b class="${winT === 1 ? 'win' : ''}">${t1}</b>
  — winner: <span class="team team-${winT}">T${winT+1}</span>
  <span class="muted">(cumulative ${esc(g.outcome.team0CumulativeScore)} / ${esc(g.outcome.team1CumulativeScore)})</span>
</p>`;

  return `
<article id="${esc(anchor)}" class="game-detail">
  <header class="game-detail-head">
    <h3><a href="#${esc(anchor)}" class="anchor">#</a> Game ${fmtDateTime(g.completedAt)}</h3>
    <div class="game-id"><code>${esc(g.gameId)}</code></div>
    <div class="game-players">
      ${[0,1,2,3].map(seatLabel).join(' <span class="sep">|</span> ')}
    </div>
    ${outcomeLine}
  </header>
  <section class="block">
    <h4>Bidding</h4>
    <div class="bidding-row">${biddingHTML}</div>
  </section>
  <section class="block">
    <h4>Play</h4>
    ${tricksHTML}
    ${beloteLine}
  </section>
  <section class="block">
    <h4>Error annotations</h4>
    ${annsHTML}
  </section>
</article>`;
}

// ── Static HTML assets (inline) ────────────────────────────────────────────

const STYLE_TAG = `<style>
:root {
  --bg:        #0d1117;
  --bg-elev:   #161b22;
  --bg-card:   #1c2330;
  --bg-row:    #141922;
  --border:    #2a3040;
  --border-d:  #3a445a;
  --text:      #e6e8eb;
  --muted:     #8b949e;
  --accent:    #f59e0b;
  --accent-dim:#b37408;
  --red:       #ff6b6b;
  --win:       #4ade80;
  --t0:        #6aa7ff;
  --t1:        #ffb86b;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px; line-height: 1.45; }
.wrap { max-width: 1280px; margin: 0 auto; padding: 24px 20px 48px; }
h1 { font-size: 1.55em; margin: 0 0 6px; letter-spacing: .3px; }
h2 { font-size: 1.15em; margin: 28px 0 12px; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 6px; }
h3 { font-size: 1em; margin: 0 0 8px; }
h4 { font-size: .95em; margin: 0 0 8px; color: var(--accent); text-transform: uppercase; letter-spacing: .6px; }
p { margin: 6px 0; }
code { font-family: "SF Mono", Consolas, "Liberation Mono", Menlo, monospace; font-size: .9em; background: rgba(255,255,255,0.04); padding: 1px 5px; border-radius: 3px; }
.muted { color: var(--muted); }
.warn  { color: var(--accent); }

/* ── Header summary ─────────────────────────────────────────────── */
.summary { display: flex; flex-wrap: wrap; gap: 10px 22px; margin: 12px 0 18px; padding: 12px 14px;
  background: var(--bg-elev); border: 1px solid var(--border); border-radius: 8px; }
.summary div { font-size: .92em; color: var(--muted); }
.summary b { color: var(--text); font-weight: 700; }

/* ── Legend ─────────────────────────────────────────────────────── */
.legend-table { border-collapse: collapse; font-size: .9em; }
.legend-table th, .legend-table td { padding: 4px 12px; text-align: left; border-bottom: 1px solid var(--border); }
.legend-table th { color: var(--muted); font-weight: 600; }
.code { font-family: "SF Mono", Consolas, Menlo, monospace; font-size: .88em; color: var(--accent); font-weight: 700; }

/* ── Games list table ──────────────────────────────────────────── */
.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-elev); }
#games-table { border-collapse: collapse; width: 100%; font-size: .9em; }
#games-table th, #games-table td { padding: 7px 10px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
#games-table th { background: var(--bg-card); color: var(--muted); font-weight: 600; letter-spacing: .3px; position: sticky; top: 0; z-index: 1; }
#games-table th.sort { cursor: pointer; user-select: none; }
#games-table th.sort:hover { color: var(--text); }
#games-table th.sort.active::after { content: " ▲"; color: var(--accent); font-size: .8em; }
#games-table th.sort.active.desc::after { content: " ▼"; }
#games-table tbody tr:nth-child(odd)  { background: var(--bg-row); }
#games-table tbody tr:nth-child(even) { background: var(--bg-elev); }
#games-table tbody tr:hover { background: rgba(245,158,11,0.08); }
#games-table .err-count { color: var(--accent); }
#games-table a.jump { color: var(--accent); text-decoration: none; }
#games-table a.jump:hover { text-decoration: underline; }

/* ── Suits / cards ─────────────────────────────────────────────── */
.suit { display: inline-block; }
.suit.red, .card.red { color: var(--red); }
.card { font-family: "SF Mono", Consolas, Menlo, monospace; font-weight: 700; }

/* ── Team / winner badges ──────────────────────────────────────── */
.team { font-weight: 700; font-size: .85em; padding: 1px 6px; border-radius: 4px; }
.team-0 { background: rgba(106,167,255,0.15); color: var(--t0); border: 1px solid rgba(106,167,255,0.3); }
.team-1 { background: rgba(255,184,107,0.15); color: var(--t1); border: 1px solid rgba(255,184,107,0.3); }
.team-tag { font-size: .75em; padding: 0 5px; border-radius: 3px; margin-left: 4px; }
.team-tag.team-0 { background: rgba(106,167,255,0.12); color: var(--t0); }
.team-tag.team-1 { background: rgba(255,184,107,0.12); color: var(--t1); }
b.win { color: var(--win); }

/* ── Game detail block ─────────────────────────────────────────── */
.game-detail { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 10px;
  padding: 16px 18px; margin-bottom: 20px; }
.game-detail-head h3 { display: inline-block; }
.game-detail-head .anchor { color: var(--muted); text-decoration: none; margin-right: 4px; }
.game-detail-head .anchor:hover { color: var(--accent); }
.game-id code { font-size: .78em; color: var(--muted); background: transparent; padding: 0; }
.game-players { margin: 6px 0 4px; font-size: .9em; }
.game-players .sep { color: var(--border-d); margin: 0 2px; }
.outcome-line { margin: 8px 0 14px; font-size: .95em; }
.block { margin-top: 16px; padding-top: 12px; border-top: 1px dashed var(--border); }
.block:first-of-type { border-top: none; padding-top: 0; }

/* ── Bidding chips ─────────────────────────────────────────────── */
.bidding-row { display: flex; flex-wrap: wrap; gap: 8px; }
.bid-chip { min-width: 68px; padding: 6px 8px; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 6px; font-size: .85em; text-align: center; }
.bid-chip.bid-winning { border-color: var(--accent); box-shadow: inset 0 0 0 1px rgba(245,158,11,0.28); }
.bid-chip.bid-pass-chip { opacity: 0.72; }
.bid-seat { font-size: .72em; color: var(--muted); margin-bottom: 3px; }
.bid-value { font-weight: 700; }
.bid-pass { color: var(--muted); font-style: italic; }
.bid-coin { color: var(--accent); font-weight: 700; }

/* ── Tricks ────────────────────────────────────────────────────── */
.trick { margin: 8px 0 12px; padding: 8px 10px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; }
.trick-header { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; font-size: .85em; margin-bottom: 6px; }
.trick-label { font-weight: 700; color: var(--text); }
.trick-winner { margin-left: auto; color: var(--muted); }
.trick-cards { display: flex; flex-wrap: wrap; gap: 8px; }
.card-slot { position: relative; min-width: 72px; padding: 8px 6px;
  background: var(--bg-elev); border: 1.5px solid var(--border); border-radius: 6px; text-align: center; }
.card-slot.card-winner { border-color: var(--accent); box-shadow: inset 0 0 0 1px rgba(245,158,11,0.22); }
.card-slot .card-order { position: absolute; top: 2px; left: 4px; font-size: .64em; color: var(--muted); }
.card-slot .card { font-size: 1.2em; display: block; margin: 2px 0; }
.card-slot .card-seat { font-size: .72em; color: var(--muted); }
.card-badge { position: absolute; top: -6px; right: -6px; width: 14px; height: 14px;
  background: var(--accent); color: #1a1a1a; border: 2px solid var(--bg-elev); border-radius: 999px;
  font-size: .6em; display: flex; align-items: center; justify-content: center; font-weight: 700; }

/* ── Belote / annotations ──────────────────────────────────────── */
.belote-line { margin: 10px 0 2px; font-style: italic; color: var(--muted); font-size: .88em; }
.annotation { margin: 8px 0 10px; }
.annotation blockquote { margin: 0; padding: 10px 12px; background: var(--bg-card);
  border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0;
  font-style: italic; color: var(--text); font-family: "SF Mono", Consolas, Menlo, monospace; font-size: .92em; }
.ann-caption { margin-top: 6px; font-size: .82em; color: var(--muted); padding-left: 12px; }
.ann-caption .card { font-size: .95em; }

/* ── Footer ───────────────────────────────────────────────────── */
footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid var(--border); font-size: .85em; color: var(--muted); }

/* ── Mobile adjustments ────────────────────────────────────────── */
@media (max-width: 640px) {
  .wrap { padding: 14px 12px 32px; }
  .summary { gap: 6px 14px; padding: 10px 12px; }
  .game-detail { padding: 12px 12px; }
  .card-slot { min-width: 60px; padding: 6px 4px; }
  .card-slot .card { font-size: 1.05em; }
  #games-table th, #games-table td { padding: 6px 7px; }
}
</style>`;

const SCRIPT_TAG = `<script>
(function() {
  // Minimal sortable-table implementation. Columns with data-col carry their
  // data-type implicitly via data-sort on each cell (lexical compare with a
  // numeric parse fallback).
  var table = document.getElementById('games-table');
  if (!table) return;
  var tbody = table.querySelector('tbody');
  var headers = table.querySelectorAll('th.sort');
  headers.forEach(function(th) {
    th.addEventListener('click', function() {
      var col = Number(th.getAttribute('data-col'));
      var currentlyActive = th.classList.contains('active');
      var desc = currentlyActive ? !th.classList.contains('desc') : true;
      headers.forEach(function(h) { h.classList.remove('active', 'desc'); });
      th.classList.add('active');
      if (desc) th.classList.add('desc');
      var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
      rows.sort(function(a, b) {
        var av = a.children[col].getAttribute('data-sort') || a.children[col].textContent;
        var bv = b.children[col].getAttribute('data-sort') || b.children[col].textContent;
        var an = Number(av), bn = Number(bv);
        var cmp;
        if (!isNaN(an) && !isNaN(bn)) cmp = an - bn;
        else cmp = String(av).localeCompare(String(bv));
        return desc ? -cmp : cmp;
      });
      rows.forEach(function(r) { tbody.appendChild(r); });
    });
  });
})();
</script>`;

// ── CLI entry ─────────────────────────────────────────────────────────────

if (require.main === module) {
  const { games, skipped } = readAllGames();
  for (const s of skipped) {
    console.warn(`[build-games-report] skipped ${s.file}: ${s.reason}`);
  }
  const { codes, usernames } = buildPlayerCodeMap(games);
  const html = renderHTML({ games, codes, usernames, skipped });
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, html);
  console.log(`  Wrote ${OUT_FILE}`);
  console.log(`  Games rendered: ${games.length}`);
  if (skipped.length) console.log(`  Skipped:        ${skipped.length} malformed record(s)`);
}
