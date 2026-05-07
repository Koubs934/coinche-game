const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 6600, height: 3700 },
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8000/scripts/render_source_master.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const out = path.join(__dirname, 'source_master.png');
  await page.screenshot({ path: out, fullPage: true, omitBackground: false });
  await browser.close();
  console.log('saved', out);
})();
