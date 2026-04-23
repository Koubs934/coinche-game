#!/usr/bin/env node
// Pulls GameRecord JSONs from the Railway production volume down to a local
// read-only mirror. Idempotent: files already present locally are skipped.
//
// Usage (from repo root):
//   node scripts/sync-games.js
//
// Reads the Railway project token from backend/.env.railway.local — never
// printed, never passed as argv. Requires the `railway` CLI on PATH and the
// host `tar` executable (Windows 10+ bundles one; Git Bash has GNU tar).
//
// Strategy: one `railway ssh` call tars /data/games on the remote, we extract
// the stream to a temp directory, then copy only files whose relative path is
// not yet present in backend/data/games-mirror/. Remote data is never
// modified (read-only `tar -cf`).

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawn } = require('child_process');

const REPO_ROOT  = path.resolve(__dirname, '..');
const ENV_FILE   = path.join(REPO_ROOT, 'backend', '.env.railway.local');
const MIRROR_DIR = path.join(REPO_ROOT, 'backend', 'data', 'games-mirror');
const SERVICE    = 'coinche-game';

// Shell selection: we need single-quote-aware quoting so the entire
// `tar -C /data/games -cf - .` reaches the remote sh as one argv token (and
// thus avoids any path-translation shenanigans at the boundary). cmd.exe
// doesn't treat single-quotes specially; bash does. On Windows this requires
// Git Bash (or another bash in PATH). On Linux/macOS the default /bin/sh is
// POSIX-compatible and suffices.
const SHELL = process.platform === 'win32' ? 'bash' : '/bin/sh';

// ── Env loading ────────────────────────────────────────────────────────────

function loadRailwayEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    throw new Error(
      `Missing ${ENV_FILE}. Create it with RAILWAY_TOKEN=<project token>.`
    );
  }
  const env = { ...process.env };
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  if (!env.RAILWAY_TOKEN) {
    throw new Error(`RAILWAY_TOKEN not found in ${ENV_FILE}`);
  }
  // Disable MSYS path translation in case this ever runs under Git Bash —
  // railway's argv parser should not see /data/games rewritten to a Windows
  // path. Node's spawn without a shell already bypasses Bash, so this is
  // belt-and-braces for anyone who might shell in.
  env.MSYS_NO_PATHCONV = '1';
  return env;
}

// ── Local filesystem helpers ───────────────────────────────────────────────

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function walkJson(root) {
  const out = new Set();
  if (!fs.existsSync(root)) return out;
  (function walk(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const r   = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory())      walk(abs, r);
      else if (entry.isFile() && entry.name.endsWith('.json')) out.add(r);
    }
  })(root, '');
  return out;
}

// ── Remote pull via railway ssh + tar stream ───────────────────────────────

function streamRemoteTar(env, tmpdir) {
  return new Promise((resolve, reject) => {
    // Remote: tar the contents of /data/games/ (using "." as source so the
    // extracted paths come out as "<userId>/<file>.json" without a "games/"
    // prefix). stderr is captured so we can surface auth errors cleanly.
    // Single-string remote command so the MSYS/Bash layer between Node and
    // railway.cmd can't path-mangle `/data/games` into `C:/Program Files/…`.
    // The entire tar invocation lives inside single-quotes and reaches the
    // remote container's `sh -c` verbatim.
    // Remote tars /data/games and base64-encodes it; the base64 pipe is
    // load-bearing because railway's SSH transport mangles binary streams
    // (observed: partial LF↔CRLF conversion corrupting the tar header
    // blocks after the first file). Base64 is pure ASCII and survives the
    // transport unchanged, at a ~33% size cost — negligible for this data.
    const remoteCmd =
      `railway ssh --service ${SERVICE} -- 'tar -C /data/games -cf - . | base64 -w0'`;
    const remote = spawn(remoteCmd, {
      env, shell: SHELL, stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Local pipeline: base64 -d → tar -x. Both standard on Git Bash +
    // Linux/macOS.
    const decoder = spawn(
      'base64',
      ['-d'],
      { stdio: ['pipe', 'pipe', 'inherit'] }
    );
    const local = spawn(
      'tar',
      ['-C', tmpdir, '-xf', '-'],
      { stdio: ['pipe', 'inherit', 'inherit'] }
    );

    let remoteStderr = '';
    remote.stderr.on('data', d => { remoteStderr += d.toString(); });

    remote.stdout.pipe(decoder.stdin);
    decoder.stdout.pipe(local.stdin);

    const done = { remote: false, decoder: false, local: false };
    function finish(err) {
      if (err) return reject(err);
      if (done.remote && done.decoder && done.local) resolve();
    }

    remote.on('error',  err => reject(err));
    decoder.on('error', err => reject(err));
    local.on('error',   err => reject(err));

    remote.on('exit', (code, signal) => {
      done.remote = true;
      if (code !== 0) {
        if (/Unauthorized|authentication|token/i.test(remoteStderr)) {
          return reject(new Error(
            `Railway token in ${ENV_FILE} is invalid or revoked. ` +
            `Generate a fresh project token in the Railway dashboard.`
          ));
        }
        return reject(new Error(
          `railway ssh exited ${code}${signal ? ` (signal ${signal})` : ''}: ` +
          `${remoteStderr.trim() || '(no stderr)'}`
        ));
      }
      finish();
    });

    decoder.on('exit', code => {
      done.decoder = true;
      if (code !== 0) return reject(new Error(`base64 -d exited ${code}`));
      finish();
    });

    local.on('exit', code => {
      done.local = true;
      if (code !== 0) return reject(new Error(`local tar exited ${code}`));
      finish();
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const env = loadRailwayEnv();
  ensureDir(MIRROR_DIR);

  const existing = walkJson(MIRROR_DIR);
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'games-mirror-'));

  try {
    await streamRemoteTar(env, tmpdir);

    let pulled = 0, alreadyThere = 0;
    (function copy(dir, rel) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const src = path.join(dir, entry.name);
        const r   = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) copy(src, r);
        else if (entry.isFile() && entry.name.endsWith('.json')) {
          if (existing.has(r)) { alreadyThere++; continue; }
          const dst = path.join(MIRROR_DIR, r);
          ensureDir(path.dirname(dst));
          fs.copyFileSync(src, dst);
          pulled++;
        }
      }
    })(tmpdir, '');

    // Report
    const final = walkJson(MIRROR_DIR);
    let earliest = null, latest = null;
    for (const rel of final) {
      try {
        const rec = JSON.parse(fs.readFileSync(path.join(MIRROR_DIR, rel), 'utf8'));
        if (!rec.completedAt) continue;
        if (!earliest || rec.completedAt < earliest) earliest = rec.completedAt;
        if (!latest   || rec.completedAt > latest)   latest   = rec.completedAt;
      } catch { /* deliberate: a malformed file shouldn't break the summary */ }
    }

    console.log(`  Pulled ${pulled} new games (${alreadyThere} already on disk).`);
    console.log(`  Total games on local mirror: ${final.size}`);
    if (earliest && latest) {
      console.log(`  Date range: ${earliest} → ${latest}`);
    } else if (final.size === 0) {
      console.log(`  Date range: (mirror empty)`);
    }
  } finally {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(`\nsync failed: ${err.message}`);
  process.exit(1);
});
