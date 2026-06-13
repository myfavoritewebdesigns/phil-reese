#!/usr/bin/env node
/**
 * HTML-first section extractor.
 *
 * For chrome-heavy WP sections (carousels, parallax heroes, custom interactive
 * widgets, page-builder layouts with brittle pixel positioning) where
 * re-implementing in Tailwind would take 5-10 revisions, this script captures:
 *
 *   1. The section's outerHTML, with absolute asset URLs preserved (so it
 *      renders correctly on first load against the live origin's images).
 *   2. ONLY the CSS rules that actually styled an element inside the section,
 *      via Chrome's CSS Coverage API. Cuts a 2 MB Avada/Elementor stylesheet
 *      down to the ~30 KB that matters for one section.
 *   3. Pre-scoped CSS — every selector prefixed with `.<wrapper-class>` so
 *      injecting the CSS via `<style is:global>` won't leak into other pages.
 *      Handles `@media`, `@supports`, `@keyframes`, `@font-face` correctly
 *      (the wrapper prefix applies to selectors INSIDE @media but not to
 *      @keyframes / @font-face which are global by spec).
 *   4. A copy-pasteable Astro integration snippet.
 *
 * Output layout:
 *
 *   reference/extracted/<slug>/
 *     <slug>.html              outerHTML of the captured section
 *     <slug>.css               pre-scoped CSS (only-the-rules-it-uses)
 *     <slug>.snippet.astro     copy-pasteable Astro component
 *     <slug>.assets.json       inventory of img/bg-image URLs (for asset migration)
 *     <slug>.report.md         human-readable summary
 *
 * Usage:
 *
 *   npm run extract:html-first -- <live-url> --selector ".meet-joe" --slug meet-joe
 *
 *   Options:
 *     --selector "<css>"     REQUIRED. CSS selector for the section to extract.
 *     --slug <name>          REQUIRED. Output dir name AND wrapper class.
 *     --viewport <w>         Browser viewport width (default 1920).
 *     --wait-selector <css>  Extra selector to wait for (e.g., a carousel slide).
 *     --scroll               Scroll the section into view (default: true).
 *
 * Why scope by wrapper class instead of using <iframe> or shadow DOM?
 *
 *   - <iframe>: SEO-invisible (Google won't crawl iframe contents reliably)
 *     and breaks accessibility (focus, ARIA, screen readers).
 *   - Shadow DOM: requires custom-element boilerplate and breaks CSS variables
 *     defined on :root.
 *   - Wrapper-class scoping: ugly but bullet-proof. Every selector inside
 *     the section becomes `.wp-extracted-<slug> <original-selector>`, which
 *     cannot match anything outside the wrapper div.
 */

import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { argv } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const OUT_ROOT  = join(ROOT, "reference", "extracted");

const args = parseArgs(argv.slice(2));
const URL_ARG = args._[0];
if (!URL_ARG || !args.selector || !args.slug) {
  console.error("Usage: npm run extract:html-first -- <live-url> --selector <css> --slug <name> [--viewport 1920] [--wait-selector <css>] [--no-scroll]");
  process.exit(1);
}

const VIEWPORT = Number(args.viewport ?? 1920);
const SELECTOR = args.selector;
const SLUG     = args.slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
const WRAPPER  = `wp-extracted-${SLUG}`;
const OUT_DIR  = join(OUT_ROOT, SLUG);
const ORIGIN   = new URL(URL_ARG).origin;
const SHOULD_SCROLL = args["no-scroll"] !== true;

await mkdir(OUT_DIR, { recursive: true });

console.log(`Extracting ${SELECTOR} from ${URL_ARG}`);
console.log(`Viewport ${VIEWPORT}px, wrapper class: .${WRAPPER}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: VIEWPORT, height: 1080 },
  userAgent: "wp-to-astro-extractor/1.0 (compatible; Mozilla/5.0)",
});
const page = await ctx.newPage();

try {
  // Start CSS coverage BEFORE navigation — captures rules used by initial layout too.
  await page.coverage.startCSSCoverage({ resetOnNavigation: false });

  await page.goto(URL_ARG, { waitUntil: "networkidle", timeout: 60_000 });

  // Force lazy-load images to fetch immediately so coverage includes their rules.
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = "eager"; });
  });

  if (args["wait-selector"]) {
    await page.waitForSelector(args["wait-selector"], { timeout: 15_000 });
  }

  // Scroll the section into view + bottom of page + back, so any
  // intersection-observer-driven CSS class additions fire.
  if (SHOULD_SCROLL) {
    await page.evaluate(async (sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
      await new Promise((r) => setTimeout(r, 800));
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 600));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
      await new Promise((r) => setTimeout(r, 800));
    }, SELECTOR);
  }

  // Make sure section exists
  const exists = await page.$(SELECTOR);
  if (!exists) {
    console.error(`Selector ${SELECTOR} not found on page.`);
    process.exit(1);
  }

  // Capture inner HTML + collect every element inside it (for CSS filtering)
  const { html, descriptorList, assetUrls } = await page.evaluate(({ sel, origin }) => {
    function abs(url) {
      try { return new URL(url, location.href).href; } catch { return url; }
    }
    const root = document.querySelector(sel);
    if (!root) return { html: "", descriptorList: [], assetUrls: [] };

    // Rewrite asset URLs in the HTML so the extracted snippet still works.
    // (Cleaner to do it at HTML-string level after outerHTML.)
    const html = root.outerHTML;

    // For every element in the subtree, capture tag + classes + id so the
    // CSS filtering step can match selectors against it.
    const list = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = root;
    do {
      list.push({
        tag: n.tagName.toLowerCase(),
        id: n.id || null,
        classes: [...n.classList],
      });
    } while ((n = walker.nextNode()));

    // Collect image / picture / background-image asset URLs for the manifest.
    const assets = new Set();
    root.querySelectorAll("img, source").forEach((el) => {
      if (el.src)    assets.add(abs(el.src));
      if (el.srcset) el.srcset.split(",").forEach((s) => assets.add(abs(s.trim().split(/\s+/)[0])));
    });
    root.querySelectorAll("*").forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== "none") {
        [...bg.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].forEach((m) => assets.add(abs(m[1])));
      }
    });

    return { html, descriptorList: list, assetUrls: [...assets] };
  }, { sel: SELECTOR, origin: ORIGIN });

  // Stop coverage AFTER we've captured everything we want.
  const coverage = await page.coverage.stopCSSCoverage();

  console.log(`  ${descriptorList.length} elements in subtree`);
  console.log(`  ${coverage.length} stylesheets covered`);

  // For each covered stylesheet, extract only the rules whose selectors match
  // at least one element in our subtree. Chrome's CSS Coverage `.ranges` track
  // BYTE OFFSETS of used declarations, NOT full CSSRule boundaries — slicing
  // them directly produces malformed CSS at the edges (half-open braces, a
  // single declaration without its selector, etc.). Instead, parse the FULL
  // sheet text into rules with offsets, then keep every rule whose byte span
  // overlaps any coverage range.
  const usedCss = [];
  for (const sheet of coverage) {
    if (!sheet.text || sheet.ranges.length === 0) continue;
    const fullRules = splitTopLevelRulesWithOffsets(sheet.text);
    for (const rule of fullRules) {
      const used = sheet.ranges.some((rg) => rule.start < rg.end && rule.end > rg.start);
      if (used) usedCss.push(sheet.text.slice(rule.start, rule.end));
    }
  }
  const combined = usedCss.join("\n");

  // Now do a structural pass: split into rules, keep only those whose
  // selector list matches our descriptor set, and scope-prefix them.
  const filtered = filterAndScope(combined, descriptorList, WRAPPER);

  // Rewrite relative asset URLs in the HTML to absolute (live origin), so the
  // extracted snippet works immediately when injected. The hot-link rule still
  // applies: replace these with local copies before the end of the session.
  const htmlAbs = rewriteRelativeUrls(html, URL_ARG);

  // Write outputs
  await writeFile(join(OUT_DIR, `${SLUG}.html`), htmlAbs, "utf-8");
  await writeFile(join(OUT_DIR, `${SLUG}.css`),  filtered.css, "utf-8");
  await writeFile(join(OUT_DIR, `${SLUG}.assets.json`), JSON.stringify(assetUrls, null, 2), "utf-8");
  await writeFile(join(OUT_DIR, `${SLUG}.snippet.astro`), buildSnippet(SLUG, WRAPPER), "utf-8");
  await writeFile(join(OUT_DIR, `${SLUG}.report.md`), buildReport({
    url: URL_ARG, selector: SELECTOR, slug: SLUG, wrapper: WRAPPER,
    elementCount: descriptorList.length,
    stylesheetsTouched: coverage.length,
    rulesKept: filtered.kept, rulesDropped: filtered.dropped,
    assetCount: assetUrls.length,
  }), "utf-8");

  console.log(`✓ Wrote ${join("reference", "extracted", SLUG)}/`);
  console.log(`  Kept ${filtered.kept} rules, dropped ${filtered.dropped} unused/unmatched`);
  console.log(`  ${assetUrls.length} asset URLs captured`);
  console.log("");
  console.log(`Next: review ${SLUG}.snippet.astro and paste into a page.`);
} finally {
  await browser.close();
}

/* ---------- CSS rule walker ---------- */

/**
 * Parse `cssText` into a list of rules (handling braces) and keep only those
 * whose selectors match at least one element in `descriptors`. Then prefix
 * every kept selector with `.<wrapper>`.
 *
 * Handles:
 *   - Plain selector rules:     .a, h2 > .b { ... }       → scoped
 *   - @media / @supports:       @media (min-width: 600px) { .a { } }  → inner scoped
 *   - @keyframes / @font-face:  kept as-is (global by spec)
 *   - @import:                  dropped (would re-fetch external sheets)
 *
 * Selector matching is intentionally lax — it splits by `,` then by combinator
 * tokens and just checks if any token references something present. False
 * positives keep harmless rules in the output; false negatives would silently
 * lose style. Tilted toward false-positives.
 */
function filterAndScope(css, descriptors, wrapper) {
  const tagSet   = new Set(descriptors.map((d) => d.tag));
  const idSet    = new Set(descriptors.filter((d) => d.id).map((d) => "#" + d.id));
  const classSet = new Set(descriptors.flatMap((d) => d.classes.map((c) => "." + c)));

  const rules = splitTopLevelRules(css);
  const out = [];
  let kept = 0, dropped = 0;

  for (const rule of rules) {
    if (rule.kind === "at") {
      // @media / @supports / @container: recurse into inner block
      if (/^@(media|supports|container)/i.test(rule.prelude)) {
        const inner = filterAndScope(rule.body, descriptors, wrapper);
        if (inner.kept > 0) {
          out.push(`${rule.prelude} {\n${inner.css}\n}`);
          kept += inner.kept;
          dropped += inner.dropped;
        } else {
          dropped += inner.kept + inner.dropped;
        }
      } else if (/^@(keyframes|-webkit-keyframes|font-face)/i.test(rule.prelude)) {
        // global by spec — keep as-is (no wrapper scoping makes sense)
        out.push(`${rule.prelude} {${rule.body}}`);
        kept++;
      } else if (/^@import/i.test(rule.prelude)) {
        // drop — would re-fetch the entire upstream sheet
        dropped++;
      } else {
        out.push(`${rule.prelude} {${rule.body}}`);
        kept++;
      }
      continue;
    }

    // Plain rule — split selector list by top-level commas
    const selectors = splitSelectorList(rule.prelude);
    const keptSelectors = [];
    for (const sel of selectors) {
      if (selectorMatchesAny(sel, tagSet, idSet, classSet)) {
        keptSelectors.push(scopeSelector(sel, wrapper));
      }
    }
    if (keptSelectors.length > 0) {
      out.push(`${keptSelectors.join(", ")} {${rule.body}}`);
      kept++;
    } else {
      dropped++;
    }
  }
  return { css: out.join("\n"), kept, dropped };
}

/** Split top-level CSS into rules; respect nested braces. */
function splitTopLevelRules(css) {
  return splitTopLevelRulesWithOffsets(css).map((r) => ({ kind: r.kind, prelude: r.prelude, body: r.body }));
}

/** Same as splitTopLevelRules but also returns each rule's [start, end] byte offset in the source text. */
function splitTopLevelRulesWithOffsets(css) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    // skip whitespace + comments
    while (i < css.length && /\s/.test(css[i])) i++;
    if (i >= css.length) break;
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    const ruleStart = i;
    const isAt = css[i] === "@";
    // read prelude up to '{' or ';'
    let p = i;
    while (p < css.length && css[p] !== "{" && css[p] !== ";") p++;
    const prelude = css.slice(i, p).trim();
    if (p >= css.length) break;
    if (css[p] === ";") {
      // standalone @-rule like @import, @charset
      rules.push({ kind: "at", prelude, body: "", start: ruleStart, end: p + 1 });
      i = p + 1;
      continue;
    }
    // body block
    let depth = 1, b = p + 1;
    while (b < css.length && depth > 0) {
      if (css[b] === "{") depth++;
      else if (css[b] === "}") depth--;
      if (depth > 0) b++;
    }
    const body = css.slice(p + 1, b);
    rules.push({ kind: isAt ? "at" : "rule", prelude, body, start: ruleStart, end: b + 1 });
    i = b + 1;
  }
  return rules;
}

/** Split selector list by commas, respecting parens (for :is(), :where(), :not()). */
function splitSelectorList(prelude) {
  const parts = [];
  let depth = 0, last = 0;
  for (let i = 0; i < prelude.length; i++) {
    const ch = prelude[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(prelude.slice(last, i).trim());
      last = i + 1;
    }
  }
  parts.push(prelude.slice(last).trim());
  return parts.filter(Boolean);
}

/**
 * Does this selector reference something in our subtree? Tokenize and match
 * any class/id/tag against the descriptor sets. Pseudo-classes/elements,
 * attribute selectors, and combinators are stripped before matching.
 */
function selectorMatchesAny(sel, tagSet, idSet, classSet) {
  // Universal selector — assume it could match
  if (sel === "*") return true;
  // Strip pseudos, attribute brackets, and combinators
  const tokens = sel
    .replace(/::?[a-z-]+(\([^)]*\))?/gi, "")
    .replace(/\[[^\]]*]/g, "")
    .split(/[\s>+~]+/)
    .filter(Boolean);

  // Common WP "global" selectors that we should keep even though they target
  // ancestors we don't have inside the section (e.g. html.has-X .foo).
  for (const tok of tokens) {
    if (tok === "html" || tok === "body" || tok === ":root") return true;
  }

  for (const tok of tokens) {
    // simple compound: split by . and # inside the token
    const ids     = tok.match(/#[a-zA-Z0-9_-]+/g)     ?? [];
    const classes = tok.match(/\.[a-zA-Z0-9_-]+/g)    ?? [];
    const tagMatch = tok.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
    const tag = tagMatch ? tagMatch[0].toLowerCase() : null;

    for (const id of ids)     if (idSet.has(id))         return true;
    for (const c  of classes) if (classSet.has(c))       return true;
    if (tag && tagSet.has(tag))                          return true;
  }
  return false;
}

/**
 * Prefix selector with `.wrapper `. Special handling:
 *   body                          → .wrapper                   (apply body defaults to wrapper)
 *   html                          → .wrapper
 *   :root                         → .wrapper
 *   body.theme-x                  → .wrapper                   (theme-class qualifier dropped — we have no <body>)
 *   html .bar                     → .wrapper .bar
 *   body.theme-x .baz             → .wrapper .baz
 *   .wrapper .foo                 → idempotent (don't double-prefix)
 *   .foo                          → .wrapper .foo
 */
function scopeSelector(sel, wrapper) {
  const trimmed = sel.trim();
  if (trimmed.startsWith(`.${wrapper}`)) return trimmed;

  // Standalone body/html/:root (possibly with qualifier classes/IDs/pseudos
  // but no descendant) → map directly to the wrapper, since the wrapper IS
  // the document body within its scope.
  if (/^(?:html|body|:root)(?:[.#:][a-zA-Z0-9_-]+(?:\([^)]*\))?)*$/i.test(trimmed)) {
    return `.${wrapper}`;
  }

  // body.theme-x .foo  → .wrapper .foo
  const stripped = trimmed.replace(/^(?:html|body|:root)(?:[.#:][a-zA-Z0-9_-]+(?:\([^)]*\))?)*\s+/i, "");
  return `.${wrapper} ${stripped}`;
}

/* ---------- HTML asset URL rewriter ---------- */

function rewriteRelativeUrls(html, pageUrl) {
  // Rewrite src=, href=, srcset=, and url() inside style="" to absolute against pageUrl
  const base = new URL(pageUrl);
  return html
    .replace(/(\b(?:src|href)=["'])(?!https?:|data:|#|\/\/|mailto:|tel:|javascript:)([^"']+)(["'])/gi,
      (_, p, url, q) => `${p}${new URL(url, base).href}${q}`)
    .replace(/(srcset=["'])([^"']+)(["'])/gi, (_, p, list, q) => {
      const rewritten = list.split(",").map((entry) => {
        const trimmed = entry.trim();
        const [url, descriptor] = trimmed.split(/\s+/, 2);
        if (/^https?:|^data:|^\/\//.test(url)) return trimmed;
        const abs = new URL(url, base).href;
        return descriptor ? `${abs} ${descriptor}` : abs;
      }).join(", ");
      return `${p}${rewritten}${q}`;
    })
    .replace(/url\((['"]?)(?!https?:|data:|#|\/\/)([^'")]+)\1\)/g,
      (_, q, url) => `url(${q}${new URL(url, base).href}${q})`);
}

/* ---------- output builders ---------- */

function buildSnippet(slug, wrapper) {
  return `---
// Copy-paste the lines below into the page that needs the extracted section.
// The wrapper class scopes the CSS so it cannot leak to other pages.
//
// Paths are relative to the page file — adjust as needed.

import sectionHtml from "../../reference/extracted/${slug}/${slug}.html?raw";
import sectionCss  from "../../reference/extracted/${slug}/${slug}.css?raw";
---

<div class="${wrapper}" set:html={sectionHtml} />
<style is:global set:html={sectionCss}></style>

{/*
  Pre-launch checklist for this extracted section:

  1. Replace hot-linked asset URLs in ${slug}.html with local copies. The
     extractor writes absolute live-origin URLs by default — hot-linking is
     single-session-only per the template's image migration rule.
  2. Run npm run audit:live-diff against this page once it's wired up.
  3. If the section needs to be interactive, also import the section's JS
     bundle as a static asset under public/scripts/.
  4. Test with the live site in DevTools first — sometimes WordPress builders
     emit @import statements pulling in additional sheets, which the
     extractor drops by default (would re-fetch from the WP origin).
*/}
`;
}

function buildReport(d) {
  return `# HTML-first extraction — ${d.slug}

| Field | Value |
|---|---|
| Live URL | ${d.url} |
| Selector | \`${d.selector}\` |
| Output slug | \`${d.slug}\` |
| Wrapper class | \`.${d.wrapper}\` |
| Elements in subtree | ${d.elementCount} |
| Stylesheets touched | ${d.stylesheetsTouched} |
| CSS rules kept | ${d.rulesKept} |
| CSS rules dropped | ${d.rulesDropped} |
| Asset URLs captured | ${d.assetCount} |

## Files

- \`${d.slug}.html\` — outerHTML of the section, with absolute asset URLs
- \`${d.slug}.css\` — pre-scoped CSS (only rules touching the section)
- \`${d.slug}.assets.json\` — every image / background-image URL the section references
- \`${d.slug}.snippet.astro\` — copy-pasteable Astro integration

## Caveats

- Hot-linked asset URLs MUST be swapped to local before the end of the session.
  Use \`${d.slug}.assets.json\` as the download list.
- The extractor drops \`@import\` statements. If the section visibly degrades,
  check the live page's HEAD for additional stylesheets referenced via @import
  and either inline them or re-extract with their selectors merged.
- Interactive behavior (JS) is NOT captured. If the section needs hover/click
  behavior, copy the original \`<script>\` tags into public/scripts/ and load
  them with \`<script src="/scripts/${d.slug}.js" is:inline></script>\`.
`;
}

/* ---------- argv helpers ---------- */

function parseArgs(argList) {
  const out = { _: [] };
  for (let i = 0; i < argList.length; i++) {
    const a = argList[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argList[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}
