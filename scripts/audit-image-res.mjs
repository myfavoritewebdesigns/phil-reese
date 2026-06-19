/* -----------------------------------------------------------------------
   audit-image-res.mjs — flags low-resolution / upscaled images site-wide.

   WHY: images migrated from the old WordPress site (or hand-added) can be far
   smaller than the slot they render into. A 234x176 source shown at 365x275 is
   already soft, and on a 2x/retina screen it is a ~3x blow-up — visibly blurry.
   Counting pixels by eye misses this; this script checks every <img>'s real
   intrinsic resolution against its rendered size at retina density.

   WHAT IT DOES: loads each page (default: every URL in dist/sitemap-0.xml) in a
   2x-DPR / 1920-wide browser, force-loads lazy images, then for every <img>
   compares naturalWidth to renderedWidth x DPR.

     🔴 BLURRY     naturalWidth < renderedWidth         (upscaled even at 1x)
     🟡 SUB-RETINA naturalWidth < renderedWidth x DPR    (ok at 1x, soft at 2x)
     ✓  OK         naturalWidth >= renderedWidth x DPR

   Exits non-zero if any 🔴 is found, so it can gate a build.

   USAGE:
     node scripts/audit-image-res.mjs <base-url> [--dpr 2] [--width 1920] [path ...]
     e.g. node scripts/audit-image-res.mjs http://localhost:4330
          node scripts/audit-image-res.mjs https://www.philsellsbiz.com /chandler-business-broker/
   ----------------------------------------------------------------------- */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--dpr") flags.dpr = +args[++i];
  else if (args[i] === "--width") flags.width = +args[++i];
  else positional.push(args[i]);
}
const base = (positional.shift() || "http://localhost:4321").replace(/\/$/, "");
const DPR = flags.dpr || 2;
const WIDTH = flags.width || 1920;

// Path list: explicit args, else every <loc> in the built sitemap.
let paths = positional.map((p) => new URL(p, base).pathname);
if (paths.length === 0) {
  try {
    const xml = readFileSync("dist/sitemap-0.xml", "utf8");
    paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  } catch {
    console.error("No paths given and dist/sitemap-0.xml not found. Run `npm run build` first or pass paths.");
    process.exit(2);
  }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 1080 }, deviceScaleFactor: DPR });
const page = await ctx.newPage();

const byImage = new Map(); // src -> worst-case record

for (const path of paths) {
  const url = base + path;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    // Force lazy images to load, then settle.
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = "eager")));
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 400));
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const imgs = await page.evaluate(() =>
      [...document.querySelectorAll("img")].map((i) => {
        const r = i.getBoundingClientRect();
        return {
          src: i.currentSrc || i.src,
          natW: i.naturalWidth,
          natH: i.naturalHeight,
          dispW: Math.round(r.width),
          dispH: Math.round(r.height),
        };
      })
    );
    for (const im of imgs) {
      if (!im.src || im.src.startsWith("data:") || /\.svg(\?|$)/i.test(im.src)) continue;
      if (im.dispW < 2 || im.dispH < 2) continue; // hidden / not laid out
      const required = im.dispW * DPR;
      let level = "ok";
      if (im.natW === 0) level = "broken";
      else if (im.natW < im.dispW) level = "blurry";
      else if (im.natW < required) level = "subretina";
      // keep the worst (largest display) occurrence per image
      const prev = byImage.get(im.src);
      if (!prev || im.dispW > prev.dispW) byImage.set(im.src, { ...im, level, page: path, required });
    }
  } catch (e) {
    console.error(`! ${path}: ${String(e).split("\n")[0]}`);
  }
}
await browser.close();

const rank = { broken: 0, blurry: 1, subretina: 2, ok: 3 };
const rows = [...byImage.values()].sort((a, b) => rank[a.level] - rank[b.level] || b.dispW - a.dispW);
const icon = { broken: "💥", blurry: "🔴", subretina: "🟡", ok: "✓" };
const counts = { broken: 0, blurry: 0, subretina: 0, ok: 0 };
rows.forEach((r) => counts[r.level]++);

const lines = [];
lines.push(`# Image resolution audit`);
lines.push(`\nBase: ${base} · DPR: ${DPR} · width: ${WIDTH} · pages: ${paths.length} · unique images: ${rows.length}`);
lines.push(`\n💥 broken: ${counts.broken} · 🔴 blurry: ${counts.blurry} · 🟡 sub-retina: ${counts.subretina} · ✓ ok: ${counts.ok}\n`);
lines.push(`| | image | natural | displayed | need@${DPR}x | page |`);
lines.push(`|---|---|---|---|---|---|`);
for (const r of rows) {
  if (r.level === "ok") continue;
  const name = r.src.split("/").pop().split("?")[0];
  lines.push(`| ${icon[r.level]} | ${name} | ${r.natW}×${r.natH} | ${r.dispW}×${r.dispH} | ${r.required}px | ${r.page} |`);
}
const report = lines.join("\n");
mkdirSync("reports", { recursive: true });
writeFileSync("reports/image-res-audit.md", report + "\n");
console.log(report);
console.log(`\nReport written to reports/image-res-audit.md`);

if (counts.blurry || counts.broken) {
  console.error(`\nFAIL: ${counts.blurry} blurry + ${counts.broken} broken image(s).`);
  process.exit(1);
}
