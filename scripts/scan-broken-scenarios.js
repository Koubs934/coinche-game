#!/usr/bin/env node
/**
 * Scan all training scenarios for malformed timelines that would leave
 * the user "stuck" (the production bug from 2026-05-05): timeline events
 * applied at the wrong seat drift `biddingTurn` away from `userSeat`,
 * and when the runner hits `user-turn` the user's submit is rejected
 * with NOT-YOUR-TURN.
 *
 * The training runner (backend/src/training/trainingProcessor.js) blindly
 * applies whatever the timeline says — it does NOT validate per-step
 * turn order, bid escalation, or auction termination. That permissiveness
 * is what lets broken scenarios hide on disk.
 *
 * This script simulates each scenario's bidding sequence WITHOUT touching
 * the runner code, classifies any defect, and prints a report. With user
 * confirmation it then deletes the offending JSON files.
 *
 * Usage:
 *   node scripts/scan-broken-scenarios.js              # report only, no delete
 *   node scripts/scan-broken-scenarios.js --delete     # report + prompt to delete
 *
 * Exit codes:
 *   0 — no broken scenarios (or deletions confirmed and applied)
 *   1 — broken scenarios found and not deleted (or aborted)
 *   2 — script error (file system, JSON parse outside expected paths, etc.)
 */

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const SCENARIOS_DIR = path.resolve(__dirname, '..', 'backend', 'src', 'training', 'scenarios');
const VALID_SUITS   = new Set(['S', 'H', 'D', 'C']);
const VALID_BID_VALUES = new Set([80, 90, 100, 110, 120, 130, 140, 150, 160, 'capot']);

// ─── Failure codes ─────────────────────────────────────────────────────────
const CODE = {
  MALFORMED_SCENARIO:     'MALFORMED_SCENARIO',
  MISSING_USER_TURN:      'MISSING_USER_TURN',
  OUT_OF_TURN_USER_TURN:  'OUT_OF_TURN_USER_TURN',
  OUT_OF_TURN_EVENT:      'OUT_OF_TURN_EVENT',
  INVALID_BID_VALUE:      'INVALID_BID_VALUE',
  BID_AFTER_AUCTION_END:  'BID_AFTER_AUCTION_END',
  INVALID_EVENT_SHAPE:    'INVALID_EVENT_SHAPE',
};

// ─── Per-scenario simulator ────────────────────────────────────────────────
// Returns null if the scenario simulates cleanly, else { code, detail }.
function simulateScenario(scenario) {
  // Required fields. (validateScenarios.js handles deck integrity and
  // schema-version checks; we focus on the runner-relevant invariants.)
  if (typeof scenario.userSeat !== 'number' || scenario.userSeat < 0 || scenario.userSeat > 3) {
    return { code: CODE.MALFORMED_SCENARIO, detail: 'userSeat missing or out of range' };
  }
  if (typeof scenario.dealer !== 'number' || scenario.dealer < 0 || scenario.dealer > 3) {
    return { code: CODE.MALFORMED_SCENARIO, detail: 'dealer missing or out of range' };
  }
  if (!Array.isArray(scenario.timeline) || scenario.timeline.length === 0) {
    return { code: CODE.MALFORMED_SCENARIO, detail: 'timeline missing or empty' };
  }

  // Card-play scenarios are out of scope — they don't drive bidding turn
  // pointers. None exist today (all 126 are BIDDING) but skip defensively.
  if (scenario.initialState?.phase === 'PLAYING') {
    return null;
  }

  let biddingTurn       = (scenario.dealer + 1) % 4;
  let currentBid        = null;
  let consecutivePasses = 0;
  let auctionEnded      = false;       // 3 passes after a bid, or 4 passes from start
  let coinched          = false;
  let surcoinched       = false;
  let sawUserTurn       = false;

  for (let i = 0; i < scenario.timeline.length; i++) {
    const ev = scenario.timeline[i];

    if (ev?.event === 'user-turn') {
      sawUserTurn = true;
      // V1 invariant: user-turn is the last event; anything after is
      // schema-illegal but already caught by validateScenarios.js.
      if (biddingTurn !== scenario.userSeat) {
        return {
          code:   CODE.OUT_OF_TURN_USER_TURN,
          detail: `user-turn at step ${i}: biddingTurn=${biddingTurn}, userSeat=${scenario.userSeat}`,
        };
      }
      if (auctionEnded) {
        // The user can't usefully act on a terminated auction. This is the
        // most common production-stuck signature when an earlier scripted
        // pass-quad terminated the auction before user-turn.
        return {
          code:   CODE.OUT_OF_TURN_USER_TURN,
          detail: `user-turn at step ${i}: auction already ended (${consecutivePasses} consecutive passes)`,
        };
      }
      break;
    }

    // Scripted event must have a numeric seat 0..3.
    if (typeof ev?.seat !== 'number' || ev.seat < 0 || ev.seat > 3) {
      return {
        code:   CODE.INVALID_EVENT_SHAPE,
        detail: `step ${i}: ${ev?.event ?? '<no event>'} missing/invalid seat`,
      };
    }
    if (ev.seat !== biddingTurn) {
      return {
        code:   CODE.OUT_OF_TURN_EVENT,
        detail: `step ${i}: ${ev.event} by seat ${ev.seat}, expected biddingTurn=${biddingTurn}`,
      };
    }
    if (auctionEnded) {
      return {
        code:   CODE.BID_AFTER_AUCTION_END,
        detail: `step ${i}: ${ev.event} after auction terminated by ${consecutivePasses} consecutive passes`,
      };
    }

    switch (ev.event) {
      case 'bid': {
        if (!VALID_BID_VALUES.has(ev.value)) {
          return { code: CODE.INVALID_EVENT_SHAPE, detail: `step ${i}: invalid bid value ${ev.value}` };
        }
        if (!VALID_SUITS.has(ev.suit)) {
          return { code: CODE.INVALID_EVENT_SHAPE, detail: `step ${i}: invalid bid suit ${ev.suit}` };
        }
        if (currentBid) {
          // capot can never be outbid (only coinched).
          if (currentBid.value === 'capot') {
            return { code: CODE.INVALID_BID_VALUE, detail: `step ${i}: bid ${ev.value} ${ev.suit} after capot` };
          }
          // Numeric escalation: must be strictly greater. capot beats any number.
          const newIsCapot = ev.value === 'capot';
          if (!newIsCapot && ev.value <= currentBid.value) {
            return {
              code:   CODE.INVALID_BID_VALUE,
              detail: `step ${i}: bid ${ev.value} ${ev.suit} not above current ${currentBid.value} ${currentBid.suit}`,
            };
          }
        }
        currentBid = { value: ev.value, suit: ev.suit, playerIndex: ev.seat };
        consecutivePasses = 0;
        coinched = false;
        surcoinched = false;
        break;
      }
      case 'pass': {
        consecutivePasses++;
        // Auction terminates: 4 initial passes (no bid yet), or 3 passes
        // after any bid/coinche/surcoinche. Also, 3 passes after a coinche
        // ends bidding (the contract is locked at the coinched value).
        if (!currentBid && consecutivePasses >= 4)            auctionEnded = true;
        else if (currentBid && consecutivePasses >= 3)        auctionEnded = true;
        break;
      }
      case 'coinche': {
        if (!currentBid) {
          return { code: CODE.INVALID_EVENT_SHAPE, detail: `step ${i}: coinche with no current bid` };
        }
        if (coinched) {
          return { code: CODE.INVALID_EVENT_SHAPE, detail: `step ${i}: coinche when already coinched` };
        }
        coinched = true;
        consecutivePasses = 0;
        break;
      }
      case 'surcoinche': {
        if (!coinched) {
          return { code: CODE.INVALID_EVENT_SHAPE, detail: `step ${i}: surcoinche without preceding coinche` };
        }
        if (surcoinched) {
          return { code: CODE.INVALID_EVENT_SHAPE, detail: `step ${i}: surcoinche when already surcoinched` };
        }
        surcoinched = true;
        consecutivePasses = 0;
        break;
      }
      default:
        return {
          code:   CODE.INVALID_EVENT_SHAPE,
          detail: `step ${i}: unknown event ${ev?.event}`,
        };
    }

    biddingTurn = (ev.seat + 1) % 4;
  }

  if (!sawUserTurn) {
    return { code: CODE.MISSING_USER_TURN, detail: 'timeline ended without a user-turn event' };
  }
  return null;
}

// ─── Driver ────────────────────────────────────────────────────────────────

function listScenarioFiles() {
  if (!fs.existsSync(SCENARIOS_DIR)) {
    console.error(`scenarios dir not found: ${SCENARIOS_DIR}`);
    process.exit(2);
  }
  return fs.readdirSync(SCENARIOS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
}

function scan() {
  const files = listScenarioFiles();
  const broken = [];
  for (const filename of files) {
    const fullPath = path.join(SCENARIOS_DIR, filename);
    let scenario;
    try {
      scenario = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (err) {
      broken.push({ filename, fullPath, code: CODE.MALFORMED_SCENARIO, detail: `JSON parse error: ${err.message}` });
      continue;
    }
    const result = simulateScenario(scenario);
    if (result) broken.push({ filename, fullPath, ...result });
  }
  return { total: files.length, broken };
}

function printReport({ total, broken }) {
  console.log(`\nTotal scenarios: ${total}`);
  console.log(`Working: ${total - broken.length}`);
  console.log(`Broken: ${broken.length}`);
  if (broken.length === 0) return;
  console.log('\nBroken scenarios:');
  for (const b of broken) {
    console.log(`  - ${b.filename}: ${b.code} — ${b.detail}`);
  }
}

function promptYes(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer).trim().toLowerCase() === 'yes');
    });
  });
}

async function main() {
  const wantsDelete = process.argv.includes('--delete');
  const { total, broken } = scan();
  printReport({ total, broken });

  if (broken.length === 0) {
    console.log('\nNo broken scenarios — all simulated cleanly.');
    process.exit(0);
  }

  if (!wantsDelete) {
    console.log('\nRun with --delete to remove broken scenarios after a yes/no confirmation.');
    process.exit(1);
  }

  const ok = await promptYes(`\nDelete these ${broken.length} broken scenarios? Type 'yes' to confirm: `);
  if (!ok) {
    console.log('Aborted, no files deleted.');
    process.exit(1);
  }
  for (const b of broken) {
    try {
      fs.unlinkSync(b.fullPath);
      console.log(`  ✓ deleted ${b.filename}`);
    } catch (err) {
      console.error(`  ✗ failed to delete ${b.filename}: ${err.message}`);
    }
  }

  // Re-scan to confirm.
  const after = scan();
  if (after.broken.length === 0) {
    console.log(`\nAll ${after.total} remaining scenarios pass simulation.`);
    process.exit(0);
  }
  console.log(`\nWARNING: ${after.broken.length} scenarios still broken after deletion:`);
  for (const b of after.broken) console.log(`  - ${b.filename}: ${b.code} — ${b.detail}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(2);
});
