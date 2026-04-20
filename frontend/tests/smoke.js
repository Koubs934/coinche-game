// E2E smoke: verify the frontend authenticates and lands on the dev picker,
// capture screenshots at desktop + mobile viewports. Credentials come from
// backend/.env.test.local via Node's --env-file flag.
//
// Run:
//   cd frontend
//   npm run test:e2e
//
// Screenshots are written to frontend/tests/shots/. Gitignored.

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from './helpers/authenticate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, 'shots');
const BASE_URL  = process.env.SMOKE_BASE_URL || 'http://localhost:5173';

fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800, isMobile: false, deviceScaleFactor: 1 },
  { name: 'mobile',  width: 375,  height: 812, isMobile: true,  deviceScaleFactor: 2 },
];

async function shot(page, tag) {
  const p = path.join(OUT_DIR, `${tag}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`saved ${path.relative(process.cwd(), p)}`);
  return p;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // ── Capture the auth wall once (desktop) ──────────────────────────────
    {
      const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE_URL}/?training-dev=1`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      await shot(page, 'login-desktop');
      await ctx.close();
    }

    // ── Authenticated dev picker, both viewports ──────────────────────────
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
      });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));

      await page.goto(`${BASE_URL}/?training-dev=1`, { waitUntil: 'networkidle' });
      await authenticate(page);
      // Wait for the dev picker's "Démarrer" button so we know scenarios loaded
      await page.waitForSelector('text=/Démarrer|Start/i', { timeout: 10000 });
      await page.waitForTimeout(200);
      await shot(page, `picker-${vp.name}`);

      // Mid-flow snapshot from desktop only: click into scenario 1, then
      // screenshot the training table so we prove picker → table works.
      if (vp.name === 'desktop') {
        const startBtns = await page.$$('button:has-text("Démarrer"), button:has-text("Start")');
        if (startBtns.length > 0) {
          await startBtns[0].click();
          // Wait for the game board (look for the self-player bar or a card)
          await page.waitForSelector('.game-board, .bidding-panel, .my-hand', { timeout: 10000 });
          // Scripted events play for ~300ms; give them a moment to settle
          await page.waitForTimeout(1200);
          await shot(page, `training-table-desktop`);
        } else {
          console.log('no Start/Démarrer button found — scenario start skipped');
        }
      }

      if (errs.length) {
        console.log(`── page errors (${vp.name}) ──`);
        for (const e of errs) console.log(' ', e);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
})();
