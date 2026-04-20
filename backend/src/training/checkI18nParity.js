// Verifies that every tag/group/action key in reasonTags.json has a label
// in BOTH frontend/src/i18n/fr.js and en.js — and that neither locale has
// stray labels for keys that no longer exist in the tag file.
//
// Run: node backend/src/training/checkI18nParity.js
// Exit code: 0 = OK, 1 = missing or stray labels (details on stderr).

const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const tags = require('./reasonTags.json');

  const frUrl = pathToFileURL(path.join(__dirname, '../../../frontend/src/i18n/fr.js'));
  const enUrl = pathToFileURL(path.join(__dirname, '../../../frontend/src/i18n/en.js'));
  const fr = (await import(frUrl.href)).default;
  const en = (await import(enUrl.href)).default;

  let errors = 0;
  const log = (locale, msg) => { console.error(`  [${locale}] ${msg}`); errors++; };

  // Groups
  for (const groupKey of Object.keys(tags.groups)) {
    if (!fr.training?.tags?.groups?.[groupKey]) log('fr', `missing group label: ${groupKey}`);
    if (!en.training?.tags?.groups?.[groupKey]) log('en', `missing group label: ${groupKey}`);
  }

  // Action-type labels + per-action tag labels
  for (const [action, spec] of Object.entries(tags.actions)) {
    if (!fr.training?.actions?.[action]) log('fr', `missing action label: ${action}`);
    if (!en.training?.actions?.[action]) log('en', `missing action label: ${action}`);
    for (const tag of spec.tags) {
      if (!fr.training?.tags?.[action]?.[tag.key]) log('fr', `missing tag label: ${action}.${tag.key}`);
      if (!en.training?.tags?.[action]?.[tag.key]) log('en', `missing tag label: ${action}.${tag.key}`);
    }
  }

  // Stray labels (in i18n but not in reasonTags.json)
  function checkStray(locale, tree) {
    const tagsTree = tree?.training?.tags || {};
    for (const action of Object.keys(tagsTree)) {
      if (action === 'groups') {
        const validGroups = new Set(Object.keys(tags.groups));
        for (const g of Object.keys(tagsTree.groups)) {
          if (!validGroups.has(g)) log(locale, `stray group label: ${g}`);
        }
        continue;
      }
      const spec = tags.actions[action];
      if (!spec) { log(locale, `stray action label: ${action}`); continue; }
      const validKeys = new Set(spec.tags.map(t => t.key));
      for (const key of Object.keys(tagsTree[action])) {
        if (!validKeys.has(key)) log(locale, `stray tag label: ${action}.${key}`);
      }
    }
    const actionTree = tree?.training?.actions || {};
    for (const a of Object.keys(actionTree)) {
      if (!tags.actions[a]) log(locale, `stray action-type label: ${a}`);
    }
  }
  checkStray('fr', fr);
  checkStray('en', en);

  // Summary
  let slots = Object.keys(tags.groups).length + Object.keys(tags.actions).length;
  for (const spec of Object.values(tags.actions)) slots += spec.tags.length;

  console.log(`Checked ${slots} label slots per locale (${slots * 2} total).`);
  if (errors === 0) {
    console.log('i18n parity: OK');
    process.exit(0);
  } else {
    console.error(`i18n parity: ${errors} issue(s)`);
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
