// Copy backend/src/training/reasonTags.json into the frontend mock path so
// the mock harness (`?mock=training-panel`) displays the current vocabulary
// without a manual re-copy on every schema bump. Runs via `predev` and
// `prebuild` in frontend/package.json — cross-platform, no build-tool coupling.
//
// The mock file (_mockReasonTags.json) is git-tracked; this script keeps it
// in lockstep with the backend JSON each time the frontend is started or
// built, so the committed snapshot never drifts beyond one dev cycle.

const fs   = require('fs');
const path = require('path');

const here   = __dirname;
const source = path.resolve(here, '..', '..', 'backend', 'src', 'training', 'reasonTags.json');
const target = path.resolve(here, '..', 'src', 'training', '_mockReasonTags.json');

if (!fs.existsSync(source)) {
  console.error(`[sync-mock-tags] source missing: ${source}`);
  process.exit(1);
}
fs.copyFileSync(source, target);
// eslint-disable-next-line no-console
console.log(`[sync-mock-tags] ${path.relative(process.cwd(), source)} → ${path.relative(process.cwd(), target)}`);
