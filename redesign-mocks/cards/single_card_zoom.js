/**
 * Zoom into individual cards in the player hand to inspect at extreme
 * magnification. Each shot frames a single card from the fan.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HTML = path.resolve(__dirname, '../01-bidding-table.html');
const OUT = path.resolve(__dirname, '../screenshots/paris-pro/per-card');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 4,  // very high for inspection
  });
  await page.goto('file:///' + HTML.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const cards = await page.locator('.hand .card').all();
  for (let i = 0; i < cards.length; i++) {
    const box = await cards[i].boundingBox();
    if (!box) continue;
    // Pad the clip so we capture rotation tails
    const pad = 8;
    await page.screenshot({
      path: path.join(OUT, `card-${i}.png`),
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      },
    });
  }
  await browser.close();
  console.log(`Wrote ${cards.length} per-card shots to ${OUT}`);
})();
