const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const target = process.argv[2] || '01-bidding-table-v2.html';
  const browser = await chromium.launch();
  const viewports = [
    { w: 360, h: 640, name: '360' },
    { w: 390, h: 844, name: '390' },
    { w: 430, h: 950, name: '430' },
  ];
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    const url = `http://localhost:8000/${target}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(__dirname, '..', 'screenshots', `current-${vp.name}.png`),
      fullPage: false,
    });
    await ctx.close();
    console.log(`shot ${vp.name}`);
  }
  await browser.close();
})();
