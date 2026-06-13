#!/usr/bin/env node
/**
 * Per-section visual diff between a live WordPress page and a local Astro rebuild.
 *
 * Approach (from GPT-5.2-Pro + Gemini-3-Pro 2026-05-26 consultation):
 *   1. Take full-page screenshots of live + local at 1920×1080 (and 390×844).
 *   2. Identify section boundaries by H2 anchors (each H2 → "section" from this
 *      heading to next H2).
 *   3. Crop each section into its own PNG on both sides.
 *   4. Match sections by normalized heading text. For each match, run odiff
 *      (perceptual diff ignoring anti-aliasing) → diff mask PNG.
 *   5. Stitch live | local | diff side-by-side per section.
 *
 * Why this exists: Claude's tool output displays screenshots at ~360px thumbnail
 * width, making fine detail invisible. The stitched + diff-mask files in
 * `reports/screenshots/<slug>/sections/` are at full resolution — the USER and
 * the AI can both review them properly. The diff mask in particular highlights
 * EXACTLY which pixels changed, eliminating "Gemini eyeballs raw screenshots
 * and makes confident wrong claims" failure mode.
 *
 * Usage:
 *   node scripts/audit-section-crops.mjs <live-url> <local-url> [--slug <name>] [--viewport 1920|390|both] [--anchors h2|h2h3|h2h3h4]
 *
 * Example:
 *   node scripts/audit-section-crops.mjs \
 *     https://www.example.com/page/ \
 *     http://localhost:4321/page/ \
 *     --slug example-page --viewport both
 */

import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { compare as odiff } from 'odiff-bin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, '..', 'reports', 'screenshots');

// ---------- Args ----------
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/audit-section-crops.mjs <live-url> <local-url> [--slug <name>] [--viewport 1920|390|both]');
  process.exit(2);
}
const [liveUrl, localUrl] = args;
const slugIdx = args.indexOf('--slug');
const vpIdx = args.indexOf('--viewport');
const anchorsIdx = args.indexOf('--anchors');
// Default to h2+h3 since WP pages often use H3 for section headings (Avada/Divi pattern)
const anchorsArg = anchorsIdx >= 0 ? args[anchorsIdx + 1] : 'h2h3';
const ANCHOR_SELECTOR = anchorsArg === 'h2'
  ? 'h2'
  : anchorsArg === 'h2h3h4'
    ? 'h2, h3, h4'
    : 'h2, h3';
let slug = slugIdx >= 0 ? args[slugIdx + 1] : new URL(liveUrl).pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'index';
slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'page';
const viewportArg = vpIdx >= 0 ? args[vpIdx + 1] : 'both';
const viewports = viewportArg === 'both'
  ? [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]
  : viewportArg === '390'
    ? [{ width: 390, height: 844 }]
    : [{ width: 1920, height: 1080 }];

const OUT_DIR = join(REPORTS_DIR, slug);
mkdirSync(join(OUT_DIR, 'sections'), { recursive: true });

// Realistic UA — Wordfence routinely 403s default Node fetches
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ---------- Helpers ----------
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'untitled';
}

/**
 * Get full-page screenshot + section anchors (H2 elements with their bounding rects)
 * from a given URL at a given viewport.
 */
async function captureAndAnchor(browser, url, viewport) {
  const page = await browser.newPage({
    viewport,
    userAgent: UA,
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  // Force lazy-load to eager
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach(el => { el.loading = 'eager'; });
  });
  await page.waitForTimeout(4000);

  // Get section anchors (H2/H3/H4 per --anchors arg) with absolute Y positions
  const anchors = await page.evaluate((selector) => {
    return Array.from(document.querySelectorAll(selector)).map((h, i) => {
      const rect = h.getBoundingClientRect();
      return {
        i,
        tag: h.tagName.toLowerCase(),
        text: h.textContent?.trim().replace(/\s+/g, ' ') ?? '',
        id: h.id || null,
        absoluteY: rect.top + window.scrollY,
      };
    }).filter(a => a.text);
  }, ANCHOR_SELECTOR);

  // Full-page dimensions
  const pageDims = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));

  // Full-page screenshot
  const fullPath = join(OUT_DIR, `${url.includes('localhost') ? 'local' : 'live'}-full-${viewport.width}.png`);
  await page.screenshot({ fullPage: true, path: fullPath, type: 'png' });

  await page.close();
  return { anchors, pageDims, fullPath };
}

/**
 * Compute section bounds (top → next H2's top, or full page bottom).
 * Returns [{ section: anchor, top: px, bottom: px, height: px }, ...]
 */
function computeSectionBounds(anchors, pageHeight) {
  const sections = [];
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const next = anchors[i + 1];
    // Top: slight margin above the heading so the section header isn't crammed
    const top = Math.max(0, a.absoluteY - 40);
    const bottom = next ? Math.max(top + 100, next.absoluteY - 40) : pageHeight;
    sections.push({ ...a, top, bottom, height: bottom - top });
  }
  return sections;
}

/**
 * Crop a section out of a full-page screenshot using `sharp`.
 * Returns the crop path.
 */
async function cropFromFullPage(sharp, fullPath, viewport, section, side) {
  const cropPath = join(
    OUT_DIR,
    'sections',
    `${String(section.i + 1).padStart(2, '0')}-${slugify(section.text)}`,
    `${side}-${viewport.width}.png`
  );
  mkdirSync(dirname(cropPath), { recursive: true });
  // Cap crop height to avoid sharp's "image height exceeds limit"
  const maxCropHeight = 8000;
  const cropHeight = Math.min(section.height, maxCropHeight);
  await sharp(fullPath)
    .extract({
      left: 0,
      top: Math.round(section.top),
      width: viewport.width,
      height: Math.round(cropHeight),
    })
    .toFile(cropPath);
  return cropPath;
}

/**
 * Stitch three images side-by-side (live | local | diff) horizontally.
 */
async function stitchSideBySide(sharp, livePath, localPath, diffPath, outPath) {
  const liveMeta = await sharp(livePath).metadata();
  const localMeta = await sharp(localPath).metadata();
  const diffMeta = await sharp(diffPath).metadata();
  const totalW = liveMeta.width + localMeta.width + diffMeta.width + 24; // 12px gaps between
  const maxH = Math.max(liveMeta.width ? liveMeta.height : 0, localMeta.height, diffMeta.height);
  await sharp({
    create: {
      width: totalW,
      height: maxH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      { input: livePath, left: 0, top: 0 },
      { input: localPath, left: liveMeta.width + 12, top: 0 },
      { input: diffPath, left: liveMeta.width + localMeta.width + 24, top: 0 },
    ])
    .toFile(outPath);
}

// ---------- Main ----------
console.log(`[crops] Live:  ${liveUrl}`);
console.log(`[crops] Local: ${localUrl}`);
console.log(`[crops] Slug:  ${slug}`);
console.log(`[crops] Output: ${OUT_DIR}`);
console.log();

// Dynamic import of sharp (it's already a dep via Astro)
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (err) {
  console.error('sharp not installed. Run: npm install sharp');
  process.exit(1);
}

const browser = await chromium.launch();
const summary = [];

for (const viewport of viewports) {
  console.log(`\n=== Viewport: ${viewport.width}×${viewport.height} ===`);

  const live = await captureAndAnchor(browser, liveUrl, viewport);
  const local = await captureAndAnchor(browser, localUrl, viewport);

  console.log(`  Live H2s: ${live.anchors.length} (page height: ${live.pageDims.height}px)`);
  console.log(`  Local H2s: ${local.anchors.length} (page height: ${local.pageDims.height}px)`);

  const liveSections = computeSectionBounds(live.anchors, live.pageDims.height);
  const localSections = computeSectionBounds(local.anchors, local.pageDims.height);

  // Match sections by normalized heading text
  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const localByText = new Map(localSections.map(s => [norm(s.text), s]));

  for (const live_s of liveSections) {
    const key = norm(live_s.text);
    const local_s = localByText.get(key);
    if (!local_s) {
      summary.push({ viewport: viewport.width, section: live_s.text, status: 'missing-on-local' });
      console.log(`  ⚠ "${live_s.text.slice(0, 60)}..." — MISSING on local`);
      continue;
    }
    // Crop both sides
    const livePath = await cropFromFullPage(sharp, live.fullPath, viewport, live_s, 'live');
    const localPath = await cropFromFullPage(sharp, local.fullPath, viewport, local_s, 'local');
    // Resize local to match live's height if they differ (so odiff works)
    // We DON'T resize — keep aspect, let odiff report it as a diff
    const diffPath = join(dirname(livePath), `diff-${viewport.width}.png`);
    let diffResult = { match: true, diffPercentage: 0 };
    try {
      const odiffOpts = { antialiasing: true, threshold: 0.1, outputDiffMask: true };
      // odiff requires same dimensions — pad both to match each other
      const liveMeta = await sharp(livePath).metadata();
      const localMeta = await sharp(localPath).metadata();
      const maxH = Math.max(liveMeta.height, localMeta.height);
      const maxW = Math.max(liveMeta.width, localMeta.width);
      const livePadded = livePath.replace('.png', '-padded.png');
      const localPadded = localPath.replace('.png', '-padded.png');
      await sharp(livePath).resize({ width: maxW, height: maxH, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } }).toFile(livePadded);
      await sharp(localPath).resize({ width: maxW, height: maxH, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } }).toFile(localPadded);
      diffResult = await odiff(livePadded, localPadded, diffPath, odiffOpts);
    } catch (err) {
      console.error(`  odiff failed for "${live_s.text.slice(0, 40)}":`, err.message);
      continue;
    }
    // Stitch side-by-side (live | local | diff)
    const sxsPath = join(dirname(livePath), `sxs-${viewport.width}.png`);
    try { await stitchSideBySide(sharp, livePath, localPath, diffPath, sxsPath); } catch (err) {
      console.error(`  stitch failed for "${live_s.text.slice(0, 40)}":`, err.message);
    }
    const diffPct = diffResult.diffPercentage ?? 0;
    const status = diffResult.match ? '✓ match' : (diffPct < 5 ? '~ minor' : diffPct < 20 ? '⚠ moderate' : '✗ major');
    summary.push({
      viewport: viewport.width,
      section: live_s.text.slice(0, 60),
      diffPct: Number(diffPct.toFixed(2)),
      status: diffResult.match ? 'match' : (diffPct < 5 ? 'minor' : diffPct < 20 ? 'moderate' : 'major'),
      sxs: sxsPath.replace(OUT_DIR + '\\', '').replace(OUT_DIR + '/', ''),
    });
    console.log(`  ${status}  ${diffPct.toFixed(2)}%  "${live_s.text.slice(0, 60)}"`);
  }
}

await browser.close();

// Write a summary JSON
const summaryPath = join(OUT_DIR, 'summary.json');
writeFileSync(summaryPath, JSON.stringify({
  slug,
  liveUrl,
  localUrl,
  generatedAt: new Date().toISOString(),
  sections: summary,
}, null, 2));

console.log(`\n[crops] Summary: ${summaryPath}`);
const majorOrMissing = summary.filter(s => s.status === 'major' || s.status === 'missing-on-local').length;
const moderate = summary.filter(s => s.status === 'moderate').length;
console.log(`[crops] Sections: ${summary.length} total | ${majorOrMissing} major/missing | ${moderate} moderate | ${summary.length - majorOrMissing - moderate} minor/match`);

process.exit(majorOrMissing > 0 ? 1 : 0);
