const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1200 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8000/scripts/candidates_view.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, 'candidates_view.png'), fullPage: true });
  await browser.close();
})();
