/**
 * High-zoom inspection shots: render the bidding HTML at 100%, 200%,
 * 400% (via deviceScaleFactor) so we can spot rendering artifacts that
 * hide at base resolution.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HTML = path.resolve(__dirname, '../01-bidding-table.html');
const OUT = path.resolve(__dirname, '../screenshots/paris-pro/zoom');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const dpr of [1, 2, 4]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: dpr,
    });
    await page.goto('file:///' + HTML.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const handBox = await page.locator('.hand').boundingBox();
    await page.screenshot({
      path: path.join(OUT, `hand-zoom-${dpr}x.png`),
      clip: handBox,
    });
    await page.close();
  }
  await browser.close();
  console.log(`Wrote zoom shots to ${OUT}`);
})();
