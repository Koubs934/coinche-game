const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const svgContent = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'cards-source', 'Svg-cards-2.0.fr.svg'),
    'utf8'
  );

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 6600, height: 3700 },
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  });
  const page = await ctx.newPage();

  // Inject SVG inline at fixed size; setting xml:lang/lang to French and width/height to scale up
  // We strip width/height from the root and apply our own.
  let svg = svgContent.replace(/<svg /, '<svg xml:lang="fr" lang="fr" ');
  // Force display size
  svg = svg.replace(/<svg ([^>]*)width="[^"]*"/, '<svg $1');
  svg = svg.replace(/<svg ([^>]*)height="[^"]*"/, '<svg $1');
  svg = svg.replace(/<svg /, '<svg width="6537" height="3650" ');

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#fff;}svg{display:block;}</style>
</head><body>${svg}</body></html>`;

  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const out = path.join(__dirname, 'source_master.png');
  await page.screenshot({ path: out, fullPage: true, omitBackground: false });
  await browser.close();
  console.log('saved', out);
})();
