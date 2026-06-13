#!/usr/bin/env node
/**
 * Accessibility audit using axe-core via Playwright.
 *
 * Why this exists: every other audit script in this repo verifies parity with
 * the LIVE site (heading inventory, image counts, JSON-LD, section pixels).
 * None of them catch a *new* a11y regression introduced by the rebuild itself
 * — e.g., text color set to dark-brown on a dark-rust section background.
 * The exact regression that motivated this script: caption text on JVG's
 * sell-my-fender testimonials section rendered #3e2a14 on #682412 (3:1
 * contrast, fails WCAG AA which requires 4.5:1 for normal text).
 *
 * Coverage: axe-core's default rule set ≈ WCAG 2.1 A + AA. Includes:
 *   - color-contrast (the one that motivated this)
 *   - aria-* attribute validity
 *   - landmark structure
 *   - heading-order
 *   - link-name / button-name / label
 *   - duplicate-id / unique-id-aria
 *   - image-alt / svg-img-alt
 *   - target-size (tap targets, AAA-best-practice — still useful)
 *
 * Usage:
 *   npm run audit:a11y -- <url> [--viewport 1920|390|both] [--include-tags <list>] [--out <path>]
 *
 *   --viewport     "1920" (default), "390" (mobile only), or "both"
 *   --include-tags Comma-separated axe tag list to scope the run.
 *                  Default: wcag2a,wcag2aa,wcag21a,wcag21aa,best-practice
 *                  Pass e.g. `wcag2aa` alone for a strict-AA-only run.
 *   --out          Path to write the JSON+MD report (default: reports/a11y/<host>-<timestamp>.{json,md})
 *
 * Exit codes:
 *   0 — no violations of the included tags
 *   1 — at least one violation found
 *   2 — script error (network, missing dep, etc.)
 *
 * Cost: free + offline. axe-core ships its rule set; no third-party calls.
 */

import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const URL_ARG = args._[0];
if (!URL_ARG) {
  console.error("Usage: npm run audit:a11y -- <url> [--viewport 1920|390|both] [--include-tags <list>] [--out <path>]");
  process.exit(2);
}

const VIEWPORTS = args.viewport === "390"
  ? [{ name: "mobile-390",  w: 390,  h: 844 }]
  : args.viewport === "both"
  ? [{ name: "desktop-1920", w: 1920, h: 1080 }, { name: "mobile-390",  w: 390,  h: 844  }]
  : [{ name: "desktop-1920", w: 1920, h: 1080 }];

const TAGS = (args["include-tags"] ?? "wcag2a,wcag2aa,wcag21a,wcag21aa,best-practice")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Severity grouping — axe-core's `impact` field is `critical | serious | moderate | minor`.
const SEVERITY_ICON = {
  critical: "🔴",
  serious:  "🔴",
  moderate: "🟡",
  minor:    "🟢",
};

const reports = [];
let totalViolations = 0;

const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: viewport.w, height: viewport.h },
      userAgent: "wp-to-astro-a11y-audit/1.0 (compatible; axe-core/playwright)",
    });
    const page = await ctx.newPage();
    console.log(`[${viewport.name}] navigating to ${URL_ARG}`);
    await page.goto(URL_ARG, { waitUntil: "networkidle", timeout: 60_000 });

    // Force lazy-load eager so axe can evaluate alt text + image dimensions.
    await page.evaluate(() => {
      document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = "eager"; });
    });
    // Give late-loading widgets a beat (IG embeds, lite-youtube, etc.).
    await page.waitForTimeout(1500);

    const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    reports.push({ viewport, result });
    totalViolations += result.violations.length;
    console.log(`[${viewport.name}] ${result.violations.length} violation rule(s) hit`);

    await ctx.close();
  }
} finally {
  await browser.close();
}

// Write JSON + MD report
const host = new URL(URL_ARG).host.replace(/[^a-z0-9.-]/gi, "_");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outBase = args.out ?? join(ROOT, "reports", "a11y", `${host}-${stamp}`);
await mkdir(dirname(outBase), { recursive: true });

await writeFile(`${outBase}.json`, JSON.stringify({ url: URL_ARG, reports }, null, 2), "utf-8");
await writeFile(`${outBase}.md`, buildMarkdown({ url: URL_ARG, reports }), "utf-8");

// Console summary
console.log("");
console.log(`URL: ${URL_ARG}`);
console.log(`Report: ${outBase}.md`);
console.log("");
const allViolations = reports.flatMap((r) => r.result.violations.map((v) => ({ vp: r.viewport.name, ...v })));
if (allViolations.length === 0) {
  console.log("✓ No violations across all viewports");
} else {
  const grouped = groupByImpact(allViolations);
  for (const impact of ["critical", "serious", "moderate", "minor"]) {
    const list = grouped[impact] ?? [];
    if (list.length === 0) continue;
    console.log(`${SEVERITY_ICON[impact]} ${impact.toUpperCase()} (${list.length})`);
    for (const v of list) {
      console.log(`  [${v.vp}] ${v.id} — ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`);
    }
  }
}

process.exit(totalViolations > 0 ? 1 : 0);

/* ---------- helpers ---------- */

function groupByImpact(violations) {
  return violations.reduce((acc, v) => {
    const k = v.impact ?? "minor";
    (acc[k] ??= []).push(v);
    return acc;
  }, {});
}

function buildMarkdown({ url, reports }) {
  const all = reports.flatMap((r) => r.result.violations.map((v) => ({ vp: r.viewport.name, ...v })));
  const grouped = groupByImpact(all);

  const lines = [
    `# Accessibility audit — ${url}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    `Tags scoped: \`${TAGS.join(", ")}\``,
    `Viewports: ${reports.map((r) => `${r.viewport.name} (${r.viewport.w}×${r.viewport.h})`).join(", ")}`,
    "",
    "## Summary",
    "",
    "| Severity | Count |",
    "|---|---|",
    `| 🔴 critical | ${grouped.critical?.length ?? 0} |`,
    `| 🔴 serious  | ${grouped.serious?.length  ?? 0} |`,
    `| 🟡 moderate | ${grouped.moderate?.length ?? 0} |`,
    `| 🟢 minor    | ${grouped.minor?.length    ?? 0} |`,
    "",
  ];

  for (const impact of ["critical", "serious", "moderate", "minor"]) {
    const list = grouped[impact];
    if (!list || list.length === 0) continue;
    lines.push(`## ${SEVERITY_ICON[impact]} ${impact}`);
    lines.push("");
    for (const v of list) {
      lines.push(`### \`${v.id}\` — ${v.help}  *(viewport: ${v.vp})*`);
      lines.push("");
      lines.push(v.description);
      lines.push("");
      lines.push(`Tags: ${v.tags.join(", ")}`);
      lines.push(`Help: <${v.helpUrl}>`);
      lines.push("");
      lines.push(`Affected nodes (${v.nodes.length}):`);
      lines.push("");
      for (const node of v.nodes.slice(0, 10)) {
        lines.push("```");
        lines.push(`Selector: ${node.target.join(" ")}`);
        if (node.failureSummary) lines.push(node.failureSummary);
        if (node.html) lines.push(`HTML: ${node.html.slice(0, 200)}`);
        lines.push("```");
        lines.push("");
      }
      if (v.nodes.length > 10) lines.push(`...and ${v.nodes.length - 10} more.`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

function parseArgs(argList) {
  const out = { _: [] };
  for (let i = 0; i < argList.length; i++) {
    const a = argList[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const key = a.slice(2);
    const next = argList[i + 1];
    if (!next || next.startsWith("--")) { out[key] = true; } else { out[key] = next; i++; }
  }
  return out;
}
