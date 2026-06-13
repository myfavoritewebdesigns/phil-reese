#!/usr/bin/env node
/**
 * Scan known files for unresolved TODO placeholders that must be replaced
 * before a production build. Fails (exit 1) if any are found.
 *
 * Override for staging deploys: ALLOW_TODOS=1 npm run build
 *
 * Files scanned:
 *   - src/config/site.ts       (SITE_URL, contact, address — TODO placeholders)
 *   - src/styles/global.css    (color tokens — #TODO placeholders)
 *
 * Add additional paths to FILES_TO_SCAN below if your project introduces more
 * TODO-flagged configuration surfaces.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const FILES_TO_SCAN = [
  'src/config/site.ts',
  'src/styles/global.css',
  'src/pages/rss.xml.ts',
];

// Match TODO in caps anywhere, or '#TODO' color slots, or 'TODO.com' style placeholders.
// Skip lines that mention TODO inside a comment about future work
// (e.g. "// TODO: this is a deferred task").
const TODO_PATTERNS = [
  { rx: /\bTODO\b(?!:)/, label: 'unresolved TODO' },
  { rx: /#TODO\b/, label: 'unresolved #TODO color token' },
  { rx: /TODO\.com/i, label: 'placeholder TODO.com domain' },
  { rx: /TODO@/i, label: 'placeholder TODO@ email' },
];

const allowTodos = process.env.ALLOW_TODOS === '1';
const findings = [];

for (const rel of FILES_TO_SCAN) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) continue;
  const content = readFileSync(path, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    for (const { rx, label } of TODO_PATTERNS) {
      if (rx.test(line)) {
        // Don't flag a line that's a deferred-work comment ("// TODO: ...")
        if (/^\s*(\/\/|\/\*|\*)\s*TODO:/.test(line)) continue;
        findings.push({ file: rel, line: i + 1, label, text: line.trim().slice(0, 120) });
        break;
      }
    }
  });
}

if (findings.length === 0) {
  console.log(`✓ No unresolved TODO placeholders in ${FILES_TO_SCAN.length} scanned file(s).`);
  process.exit(0);
}

if (allowTodos) {
  console.warn(`! ${findings.length} unresolved TODO placeholder(s) — allowed by ALLOW_TODOS=1`);
  for (const f of findings) console.warn(`  ${f.file}:${f.line}  ${f.label}: ${f.text}`);
  process.exit(0);
}

console.error(`✗ ${findings.length} unresolved TODO placeholder(s):`);
for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.label}: ${f.text}`);
console.error('');
console.error('These will deploy as literal placeholder strings in production.');
console.error('Replace them with real values, or set ALLOW_TODOS=1 for staging.');
process.exit(1);
