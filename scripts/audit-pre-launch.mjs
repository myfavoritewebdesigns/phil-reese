#!/usr/bin/env node
/**
 * Pre-launch audit — runs every deterministic check the template enforces,
 * in one shot, before deploying to production.
 *
 * Usage:
 *   npm run audit:pre-launch
 *
 * STUB STATUS: this script is a placeholder. It currently runs the existing
 * sub-checks in sequence. Future work should add:
 *
 *   - reference/seo-map.csv coverage vs public/_redirects (every old_url
 *     should have a matching 301 OR a live local route)
 *   - reference/form-map.csv keys ⊆ ALLOWED_FIELDS in functions/api/contact.ts
 *   - Duplicate H1 scan across all generated dist/*.html
 *   - robots.txt exists in dist/ and points at sitemap-index.xml
 *   - dist/sitemap-index.xml exists and lists every public route
 *   - dist/rss.xml exists and validates (parse, check items.length > 0
 *     if blog routes exist)
 *   - 404 page exists at src/pages/404.astro
 *   - Every hero bgImage path runs check-hero-luminance.mjs
 *
 * Run me alongside `npm run audit:live-diff -- <urls>` on every page that's
 * been built, then invoke the live-diff-auditor agent for qualitative review.
 *
 * Exit non-zero on any failure so CI / release scripts can gate on this.
 */

import { spawnSync } from 'node:child_process';

const checks = [
  { name: 'site config', cmd: 'npm', args: ['run', 'check:site'] },
  { name: 'TODO scan',   cmd: 'npm', args: ['run', 'check:todos'] },
  { name: 'type check',  cmd: 'npm', args: ['run', 'check'] },
];

let failed = 0;
for (const c of checks) {
  console.log(`\n=== ${c.name} ===`);
  const res = spawnSync(c.cmd, c.args, { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    failed++;
    console.error(`✗ ${c.name} failed (exit ${res.status})`);
  }
}

console.log('');
console.log('---');
console.log('TODO checks not yet implemented (see file header for the list).');
console.log('When the future-work items are added, this stub will become the');
console.log('single pre-launch gate.');
console.log('');

if (failed > 0) {
  console.error(`${failed} check(s) failed.`);
  process.exit(1);
}
console.log('✓ All currently-implemented pre-launch checks passed.');
process.exit(0);
