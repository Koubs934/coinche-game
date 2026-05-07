/**
 * Render svg-cards-2.0.svg to a high-resolution PNG using Chromium.
 *
 * The master SVG is 2178.18 × 1216.19 in source units. We scale up
 * to 4× (8712 × 4864) for crisp downscaling later — even though the
 * cards we'll save are 600×870, the high-res master means we can
 * resample with antialiasing instead of pixel-aligning to a grid.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Render the cream-modified SVG (no black border, cream body).
const SRC = path.resolve(__dirname, 'sources/svg-cards-cream.svg');
const OUT = path.resolve(__dirname, 'sources/master-cream.png');

const SCALE = 4;
const WIDTH = Math.round(2178.18 * SCALE);   // 8713
const HEIGHT = Math.round(1216.19 * SCALE);  // 4865

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  // Inline the SVG into a minimal HTML page so we control the
  // rendered size. Background is transparent — the card "base" rect
  // already paints white card bodies.
  const svgText = fs.readFileSync(SRC, 'utf8');
  const html = `<!doctype html>
<html lang="fr"><head><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  svg { display: block; width: ${WIDTH}px; height: ${HEIGHT}px; }
</style></head><body>${svgText}</body></html>`;

  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({
    path: OUT,
    type: 'png',
    fullPage: false,
    omitBackground: true,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });
  await browser.close();

  const stat = fs.statSync(OUT);
  console.log(`Rendered ${WIDTH}x${HEIGHT} -> ${OUT} (${stat.size} bytes)`);
})();
