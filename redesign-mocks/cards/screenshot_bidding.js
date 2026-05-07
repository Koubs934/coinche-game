/**
 * Screenshot the bidding table at 3 viewport widths plus zoomed inspection
 * shots of the player hand.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HTML = path.resolve(__dirname, '../01-bidding-table.html');
const OUT = path.resolve(__dirname, '../screenshots/paris-pro');

const VIEWPORTS = [
  { w: 360, h: 800, name: '360' },
  { w: 390, h: 844, name: '390' },
  { w: 430, h: 932, name: '430' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 2,
    });
    await page.goto('file:///' + HTML.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    // Wait for fonts and images to settle.
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT, `bidding-${vp.name}.png`),
      fullPage: false,
    });

    // Zoom shot of player hand (the row of cards near the bottom)
    const handBox = await page.locator('.hand').boundingBox().catch(() => null);
    if (handBox) {
      await page.screenshot({
        path: path.join(OUT, `hand-${vp.name}.png`),
        clip: handBox,
      });
    }
    await page.close();
  }
  await browser.close();
  console.log(`Wrote screenshots to ${OUT}`);
})();
