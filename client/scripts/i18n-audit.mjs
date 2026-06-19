#!/usr/bin/env node
/**
 * i18n audit — the objective gate for the translation effort.
 *
 *   npm run i18n:check
 *
 * Fails (exit 1) on BLOCKING issues:
 *   1. en/ar key parity broken (a key in one file but not the other).
 *   2. a t('dotted.key') used in code that is missing from the locale JSON
 *      (Arabic would fall back to English).
 * Reports as WARNINGS (non-fatal) the hardcoded toast strings still to wrap.
 *
 * Run from the client/ directory.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd(), 'src');
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]));

const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const ar = JSON.parse(fs.readFileSync('src/locales/ar.json', 'utf8'));
const enKeys = new Set(flat(en));
const arKeys = new Set(flat(ar));

const enMissing = [...arKeys].filter((k) => !enKeys.has(k)); // in ar, not en
const arMissing = [...enKeys].filter((k) => !arKeys.has(k)); // in en, not ar

// Collect all source files.
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, e.name);
    if (e.isDirectory()) walk(fp);
    else if (/\.(jsx?|tsx?)$/.test(e.name) && !fp.includes('locales')) files.push(fp);
  }
})(root);

const keyRe = /(?<![A-Za-z0-9_$.])t\(\s*'([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)'/g;
const toastRe = /toast\.(success|error|warning|info|loading)\(\s*'/g;

const usedKeys = new Set();
const hardcodedToasts = []; // { file, count }
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = keyRe.exec(src))) usedKeys.add(m[1]);
  const tCount = (src.match(toastRe) || []).length;
  if (tCount) hardcodedToasts.push({ file: path.relative(process.cwd(), f), count: tCount });
}

const missingFromJson = [...usedKeys].filter((k) => !enKeys.has(k)).sort();
const totalToasts = hardcodedToasts.reduce((n, x) => n + x.count, 0);

const line = '─'.repeat(60);
console.log(line);
console.log('i18n AUDIT');
console.log(line);
console.log(`Locale leaf keys:           en=${enKeys.size}  ar=${arKeys.size}`);
console.log(`Parity — in EN not AR:      ${arMissing.length}`);
console.log(`Parity — in AR not EN:      ${enMissing.length}`);
console.log(`t() keys used in code:      ${usedKeys.size}`);
console.log(`  missing from locale JSON: ${missingFromJson.length}   (BLOCKING)`);
console.log(`Hardcoded toast strings:    ${totalToasts} in ${hardcodedToasts.length} files   (warning)`);
console.log(line);

if (arMissing.length) {
  console.log(`\n✗ Keys in EN missing from AR (${arMissing.length}):`);
  console.log(arMissing.slice(0, 40).map((k) => '   ' + k).join('\n'));
}
if (enMissing.length) {
  console.log(`\n✗ Keys in AR missing from EN (${enMissing.length}):`);
  console.log(enMissing.slice(0, 40).map((k) => '   ' + k).join('\n'));
}
if (missingFromJson.length) {
  console.log(`\n✗ t() keys missing from locale JSON (${missingFromJson.length}):`);
  console.log(missingFromJson.slice(0, 60).map((k) => '   ' + k).join('\n'));
  if (missingFromJson.length > 60) console.log(`   … and ${missingFromJson.length - 60} more`);
}
if (totalToasts) {
  console.log(`\n⚠ Hardcoded toast strings to wrap (top files):`);
  console.log(hardcodedToasts.sort((a, b) => b.count - a.count).slice(0, 15).map((x) => `   ${x.count}\t${x.file}`).join('\n'));
}

const blocking = arMissing.length + enMissing.length + missingFromJson.length;
console.log('\n' + (blocking === 0 ? '✓ No blocking i18n issues.' : `✗ ${blocking} blocking i18n issue(s).`));
if (totalToasts === 0 && blocking === 0) console.log('✓ No hardcoded toast strings.');
process.exit(blocking === 0 ? 0 : 1);
