#!/usr/bin/env node
/**
 * Replace the generic `site-` CSS class prefix with a per-client abbreviation.
 *
 * Usage:
 *   node scripts/setup-prefix.mjs <new-prefix>
 *   npm run setup:prefix -- <new-prefix>
 *
 * Example:
 *   npm run setup:prefix -- jvg
 *
 * Walks src/ for .astro, .ts, .tsx, .css, .scss files. Replaces every literal
 * "site-" with "<new-prefix>-". Skips node_modules, dist, .astro, .wrangler.
 *
 * Idempotent — running it twice with the same prefix is a no-op.
 * Refuses to overwrite if the prefix has already been changed away from `site-`.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
// Scan project source surfaces. Deliberately excludes /reports, /reference,
// /node_modules etc., and root docs (CLAUDE.md / README.md keep the literal
// "site-" as the documented neutral prefix).
const SCAN_ROOTS = ['src', 'public', 'functions'].map(d => join(PROJECT_ROOT, d));

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: node scripts/setup-prefix.mjs <new-prefix>');
  console.error('Example: node scripts/setup-prefix.mjs jvg');
  process.exit(2);
}
const newPrefix = args[0].toLowerCase().replace(/[^a-z0-9]/g, '');
if (!newPrefix || newPrefix.length < 2 || newPrefix.length > 8) {
  console.error('Prefix must be 2-8 lowercase alphanumeric characters.');
  process.exit(2);
}
if (newPrefix === 'site') {
  console.log('Prefix is already "site". Nothing to do.');
  process.exit(0);
}

const OLD = 'site-';
const NEW = `${newPrefix}-`;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.wrangler', '.git', 'reports']);
const EXTENSIONS = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.css', '.scss', '.html']);

let filesChecked = 0;
let filesChanged = 0;
let replacements = 0;
const detectedOtherPrefix = new Set();

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (EXTENSIONS.has(extname(entry))) processFile(path);
  }
}

function processFile(path) {
  filesChecked++;
  const content = readFileSync(path, 'utf8');

  // Detect if someone has already run this with a different prefix.
  // Look for `XX-btn` / `XX-hero` / `XX-sh` patterns that aren't `site-`.
  const knownClasses = ['btn--primary', 'btn--surface', 'hero__inner', 'sh__title', 'sh__eyebrow'];
  for (const cls of knownClasses) {
    const re = new RegExp(`([a-z0-9]{2,8})-${cls.replace(/[-_$]/g, '\\$&')}`, 'g');
    let m;
    while ((m = re.exec(content)) !== null) {
      const prefix = m[1];
      if (prefix !== 'site' && prefix !== newPrefix) detectedOtherPrefix.add(prefix);
    }
  }

  if (!content.includes(OLD)) return;
  const updated = content.split(OLD).join(NEW);
  const count = (content.length - content.replace(new RegExp(OLD.replace(/[-]/g, '\\-'), 'g'), '').length) / OLD.length;
  writeFileSync(path, updated);
  filesChanged++;
  replacements += count;
  console.log(`  ${path.replace(PROJECT_ROOT, '.')}  (${count} replacement${count === 1 ? '' : 's'})`);
}

for (const root of SCAN_ROOTS) walk(root);

if (detectedOtherPrefix.size > 0) {
  console.error('');
  console.error(`WARNING: detected existing non-"site" prefix(es): ${[...detectedOtherPrefix].join(', ')}`);
  console.error('Files may now contain a mix of prefixes. Review with `git diff` before committing.');
  console.error('To revert: run `git restore src/` then re-run with the correct prefix.');
}

console.log('');
console.log(`Checked: ${filesChecked} file(s)`);
console.log(`Changed: ${filesChanged} file(s)`);
console.log(`Replacements: ${replacements} occurrences of "${OLD}" → "${NEW}"`);
if (filesChanged === 0) {
  console.log(`Nothing to do — no "${OLD}" prefix found.`);
}
