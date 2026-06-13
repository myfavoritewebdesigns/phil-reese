#!/usr/bin/env node
/**
 * Pre-build sanity check on astro.config.mjs `site` setting.
 *
 * Fails (exit 1) if `site` is missing, still set to the example placeholder,
 * or points at a staging/localhost URL. This prevents the worst SEO failure
 * mode of a WP→Astro launch: deploying with canonicals pointing at
 * example.com or staging.client.pages.dev, which causes Google to de-index
 * the live site as a duplicate.
 *
 * Wired into `npm run validate` so it runs before every build.
 *
 * Override for staging deploys: set ALLOW_STAGING_SITE=1 in the env.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'astro.config.mjs');

const BAD_PATTERNS = [
  { rx: /example\.com/i,           reason: '`site` is still the example placeholder' },
  { rx: /localhost/i,              reason: '`site` points at localhost' },
  { rx: /127\.0\.0\.1/,            reason: '`site` points at 127.0.0.1' },
  { rx: /\.pages\.dev/i,           reason: '`site` points at a Cloudflare Pages preview URL' },
  { rx: /staging\./i,              reason: '`site` looks like a staging subdomain' },
];

let config;
try {
  config = readFileSync(CONFIG_PATH, 'utf8');
} catch (err) {
  console.error(`✗ Could not read astro.config.mjs: ${err.message}`);
  process.exit(1);
}

// Extract `site: 'https://...'` (handles single OR double quotes)
const match = config.match(/\bsite\s*:\s*['"]([^'"]+)['"]/);
if (!match) {
  console.error('✗ astro.config.mjs has no `site` property.');
  console.error('  Add `site: "https://your-production-domain.com"` so canonicals + sitemap work.');
  process.exit(1);
}
const site = match[1].trim();

const allowStaging = process.env.ALLOW_STAGING_SITE === '1';
const failures = BAD_PATTERNS.filter(p => p.rx.test(site));

if (failures.length && !allowStaging) {
  console.error(`✗ astro.config.mjs site = "${site}"`);
  for (const f of failures) console.error(`  → ${f.reason}`);
  console.error('');
  console.error('Deploying with this `site` value will:');
  console.error('  • Generate sitemap URLs pointing at the wrong domain');
  console.error('  • Emit canonical <link> tags that signal duplicate-content to Google');
  console.error('  • Potentially de-index the real production site');
  console.error('');
  console.error('Fix: set `site` in astro.config.mjs to the live production domain.');
  console.error('Override (for intentional staging deploys): ALLOW_STAGING_SITE=1 npm run build');
  process.exit(1);
}

if (failures.length && allowStaging) {
  console.warn(`! astro.config.mjs site = "${site}" (${failures[0].reason}) — allowed by ALLOW_STAGING_SITE=1`);
  process.exit(0);
}

if (!site.startsWith('https://')) {
  console.error(`✗ astro.config.mjs site = "${site}" must use https://`);
  process.exit(1);
}

console.log(`✓ astro.config.mjs site = ${site}`);
process.exit(0);
