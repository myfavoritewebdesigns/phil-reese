#!/usr/bin/env node
/**
 * Hero-image luminance check.
 *
 * The site Header is `position: absolute` with white text. Any image used as
 * a <PageHero> bgImage MUST be dark across the top ~120px or the header text
 * becomes unreadable even with the default vignette.
 *
 * This script measures the average luminance of the top 120px of an image
 * and fails (exit 1) if it's too bright.
 *
 * Usage:
 *   node scripts/check-hero-luminance.mjs <image-path> [--threshold <0-255>] [--strip <px>]
 *   npm run audit:hero-luminance -- public/images/hero-fender.jpg
 *
 * Defaults:
 *   --threshold 80   (header text breaks above this)
 *   --strip 120      (top px to sample)
 */

import sharp from 'sharp';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/check-hero-luminance.mjs <image-path> [--threshold N] [--strip N]');
  process.exit(2);
}

const imagePath = args[0];
const thresholdIdx = args.indexOf('--threshold');
const stripIdx = args.indexOf('--strip');
const THRESHOLD = thresholdIdx >= 0 ? parseInt(args[thresholdIdx + 1], 10) : 80;
const STRIP_HEIGHT = stripIdx >= 0 ? parseInt(args[stripIdx + 1], 10) : 120;

if (!existsSync(imagePath)) {
  console.error(`File not found: ${imagePath}`);
  process.exit(2);
}

try {
  const meta = await sharp(imagePath).metadata();
  const stripHeight = Math.min(STRIP_HEIGHT, meta.height ?? STRIP_HEIGHT);

  // Extract top strip → convert to greyscale → get raw pixel data
  const { data, info } = await sharp(imagePath)
    .extract({ left: 0, top: 0, width: meta.width ?? 0, height: stripHeight })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Average luminance across the strip
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const avg = sum / data.length;

  const status = avg <= THRESHOLD ? '✓ OK' : '✗ TOO BRIGHT';
  console.log(`${status}  ${imagePath}`);
  console.log(`  top ${stripHeight}px avg luminance: ${avg.toFixed(1)} (threshold: ${THRESHOLD})`);
  console.log(`  source dimensions: ${info.width}×${meta.height}`);

  if (avg > THRESHOLD) {
    console.error('');
    console.error('Header text will be unreadable on this background.');
    console.error('Options:');
    console.error('  1. Use a different image (dim interior shot, dark sky, etc.)');
    console.error('  2. Use this image as ogImage only, not as a hero bgImage');
    console.error('  3. Crop to a darker region before using');
    process.exit(1);
  }
  process.exit(0);
} catch (err) {
  console.error(`Failed to analyze ${imagePath}: ${err.message}`);
  process.exit(2);
}
