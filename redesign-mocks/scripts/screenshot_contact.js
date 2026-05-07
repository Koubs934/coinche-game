const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8000/assets/cards/contact-sheet.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, '..', 'screenshots', 'contact-sheet.png'), fullPage: true });
  await browser.close();
})();
