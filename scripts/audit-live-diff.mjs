#!/usr/bin/env node
/**
 * Live-diff audit — deterministic checks comparing a local page to its live original.
 *
 * Usage:
 *   node scripts/audit-live-diff.mjs <live-url> <local-url> [--slug <name>]
 *
 * Writes a markdown report to reports/<slug>-audit-<timestamp>.md.
 * Exits non-zero if any 🔴 must-fix items are found.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, '..', 'reports');

// Realistic UA — Wordfence / CF Bot Management routinely 403s default Node fetch.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_HEADERS = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };

const NETWORK_TIMEOUT_MS = 8000;
const CONCURRENCY = 10;

// ---------- Args ----------
const args = process.argv.slice(2);
if (args.length < 2 || args[0].startsWith('--') || args[1].startsWith('--')) {
  console.error('Usage: node scripts/audit-live-diff.mjs <live-url> <local-url> [--slug <name>]');
  process.exit(2);
}
const [liveUrl, localUrl] = args;

// Slug: validate user-provided value, sanitize derived value, never let it write outside reports/
const slugIdx = args.indexOf('--slug');
let slug;
if (slugIdx >= 0) {
  const v = args[slugIdx + 1];
  if (!v || v.startsWith('--')) {
    console.error('--slug requires a value');
    process.exit(2);
  }
  slug = v;
} else {
  // Derive from pathname; collapse to alnum+dash; trim length
  slug = new URL(liveUrl).pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'index';
}
slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
if (!slug) slug = 'page';

// (origins are derived per-page inside parsePage now — no module-level constants needed)

// ---------- Helpers ----------
async function fetchWithTimeout(url, init = {}) {
  return fetch(url, {
    ...init,
    headers: { ...FETCH_HEADERS, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    redirect: 'follow',
  });
}

async function fetchHtml(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
  return res.text();
}

/**
 * Concurrency-limited Promise.all. Caps in-flight network requests so one
 * audit can't hammer the origin or stall on hung connections.
 */
async function mapWithConcurrency(items, fn, limit = CONCURRENCY) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array(Math.min(limit, items.length)).fill(0).map(worker));
  return results;
}

/**
 * Resolve the real image URL for a lazy-loaded element. Checks data-src,
 * data-lazy-src, data-original, data-orig-src, plus srcset / data-srcset /
 * data-lazy-srcset. Skips transparent-pixel placeholders.
 */
function realImgSrc($, el) {
  const $el = $(el);
  const attrs = ['data-src', 'data-lazy-src', 'data-original', 'data-orig-src'];
  for (const a of attrs) {
    const v = $el.attr(a);
    if (v) return v;
  }
  for (const a of ['srcset', 'data-srcset', 'data-lazy-srcset']) {
    const v = $el.attr(a);
    if (v) {
      const first = v.split(',')[0]?.trim().split(/\s+/)[0];
      if (first) return first;
    }
  }
  const src = $el.attr('src') ?? '';
  if (/^data:image\/(gif|png);base64,/.test(src) || /(?:^|\/)(1x1|pixel|blank)\.(gif|png)$/i.test(src)) return '';
  return src;
}

/**
 * Resolve a possibly-relative URL against a page URL. Handles protocol-relative
 * URLs (//cdn.example.com/x), absolute paths (/foo), full URLs, and fragments.
 * Returns null for non-URL refs (javascript:, data:, etc.).
 */
function resolveUrl(ref, pageUrl) {
  if (!ref) return null;
  if (ref.startsWith('javascript:') || ref.startsWith('data:') || ref.startsWith('#') ||
      ref.startsWith('mailto:') || ref.startsWith('tel:') || ref.startsWith('sms:')) return null;
  try { return new URL(ref, pageUrl).href; }
  catch { return null; }
}

function parsePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const origin = new URL(pageUrl).origin;
  return {
    title: $('head > title').text().trim(),
    description: $('meta[name="description"]').attr('content')?.trim() ?? '',
    canonical: $('link[rel="canonical"]').attr('href') ?? '',
    headings: $('h1, h2, h3, h4, h5, h6').map((_, el) => ({
      tag: el.tagName.toLowerCase(),
      text: $(el).text().trim().replace(/\s+/g, ' '),
      id: $(el).attr('id') ?? null,
    })).get(),
    structuralBlocks: {
      section: $('section').length,
      article: $('article').length,
      main: $('main').length,
      fusionRow: $('.fusion-builder-row, .fusion-row').length,
      elementorSection: $('.elementor-section').length,
      awbToc: $('.awb-toc-el, .awb-toc').length,
    },
    // Runs of 2+ consecutive <figure> siblings — likely should be a gallery,
    // not stacked figures. Catches the JVG fender-SN bug class where image
    // COUNT matches but LAYOUT (single column vs grid) doesn't.
    figureRuns: countConsecutiveFigureRuns($),
    // Styled aside / callout / tip / notice wrappers. Catches the JVG fender-SN
    // bug class where the agent extracted prose paragraphs but skipped the
    // styled wrapper div, dropping 16 "Joe's Tip" boxes silently.
    callouts: countCallouts($),
    images: $('img').map((_, el) => {
      const raw = realImgSrc($, el);
      const resolved = resolveUrl(raw, pageUrl);
      return {
        raw,
        resolved,
        altMissing: $(el).attr('alt') === undefined,
        alt: $(el).attr('alt') ?? null,
        loading: $(el).attr('loading') ?? null,
        width: $(el).attr('width') ?? null,
        height: $(el).attr('height') ?? null,
      };
    }).get().filter(i => i.raw),
    // <picture><source srcset="..."> — separate from <img>
    pictureSources: $('picture source').map((_, el) => {
      const ss = $(el).attr('srcset') ?? '';
      const first = ss.split(',')[0]?.trim().split(/\s+/)[0];
      return resolveUrl(first, pageUrl);
    }).get().filter(Boolean),
    videos: $('video, video source').map((_, el) => ({
      tag: el.tagName.toLowerCase(),
      src: resolveUrl($(el).attr('src'), pageUrl),
      poster: resolveUrl($(el).attr('poster'), pageUrl),
    })).get().filter(v => v.src),
    videoPosters: $('video[poster]').map((_, el) => resolveUrl($(el).attr('poster'), pageUrl)).get().filter(Boolean),
    iframes: $('iframe').map((_, el) => ({
      src: resolveUrl($(el).attr('src'), pageUrl),
      title: $(el).attr('title') ?? null,
    })).get().filter(f => f.src),
    jsonLd: extractJsonLdTypes($),
    internalLinks: collectInternalLinks($, origin),
  };
}

/**
 * Count styled callout / tip / info-box / notice wrappers on both sides.
 *
 * The bug class: WP page builders (Avada, Divi, Elementor, Gutenberg) wrap
 * pro-tip / warning / aside content in semantically meaningful divs with
 * recognizable class names. When extracting prose from live HTML, it's easy
 * to grab the inner <p> content and lose the wrapper styling. The static
 * audit's heading/image/JSON-LD checks won't catch this — the prose still
 * renders, just not styled as an aside.
 *
 * JVG fender-SN page silently shipped with 16 missing "Joe's Tip" boxes
 * across 5 prior audit passes before the user spotted it visually.
 *
 * Regex matches:
 *   - WP / page-builder conventions:
 *     .tip, .callout, .info-box, .warn, .notice-box, .fusion-alert, .fn-notice
 *   - Local Astro project-prefix conventions:
 *     <prefix>-callout, <prefix>-tip, <prefix>-info-box,
 *     <prefix>-warn, <prefix>-aside, <prefix>-notice, <prefix>-notice-box
 */
function countCallouts($) {
  const re = /(?:^|\s)(?:tip|callout|info-box|warn|notice-box|fusion-alert|fn-notice)(?:\s|$)|(?:^|\s)[a-z0-9]+-(?:callout|tip|info-box|warn|aside|notice|notice-box)(?:\s|$)/;
  let count = 0;
  $('[class]').each((_, el) => {
    const cls = $(el).attr('class');
    if (cls && re.test(cls)) count++;
  });
  return count;
}

/**
 * Count runs of 2+ consecutive <figure> direct-siblings. Returns a histogram
 * keyed by run length, e.g. { 2: 4, 3: 1, 5: 1 } means "4 pairs, 1 triple,
 * 1 run of 5". This is the signal for "should this be a gallery?"
 *
 * If live's histogram is empty and local's isn't, the figures are stacked
 * when they shouldn't be. If both have runs but lengths differ, layout drift.
 */
function countConsecutiveFigureRuns($) {
  const hist = {};
  $('figure').each((_, el) => {
    // Only count the FIRST figure of each run (the one with no figure prev)
    const prev = $(el).prev();
    if (prev.length && prev[0].tagName?.toLowerCase() === 'figure') return;
    // Count how many figures follow consecutively
    let run = 1;
    let next = $(el).next();
    while (next.length && next[0].tagName?.toLowerCase() === 'figure') {
      run++;
      next = next.next();
    }
    if (run >= 2) hist[run] = (hist[run] ?? 0) + 1;
  });
  return hist;
}

function extractJsonLdTypes($) {
  const types = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    let data;
    try { data = JSON.parse($(el).text()); }
    catch { types.push('UNPARSEABLE'); return; }
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node['@graph'])) node['@graph'].forEach(walk);
      if (node['@type']) types.push(Array.isArray(node['@type']) ? node['@type'].join('+') : node['@type']);
      if (Array.isArray(node)) node.forEach(walk);
      else Object.values(node).forEach(walk);
    };
    walk(data);
  });
  return types;
}

function collectInternalLinks($, ownOrigin) {
  const out = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    // Skip non-page protocols + protocol-relative URLs (treated as external)
    if (/^(javascript|mailto|tel|sms|data):/i.test(href)) return;
    if (href.startsWith('//')) return;
    if (href.startsWith('#')) return;
    // Same-origin absolute → strip to path
    if (ownOrigin && href.startsWith(ownOrigin + '/')) {
      out.push(href.substring(ownOrigin.length));
      return;
    }
    // External absolute → skip
    if (/^https?:\/\//i.test(href)) return;
    // Relative path
    if (href.startsWith('/')) out.push(href);
  });
  return out;
}

/**
 * Liveness check with fallback. HEAD first; on 403/405/501 fall back to GET
 * with a tiny Range header so we get a real status without downloading.
 */
async function urlLiveness(url) {
  try {
    const head = await fetchWithTimeout(url, { method: 'HEAD' });
    if (head.ok) return { url, status: head.status, ok: true, via: 'HEAD' };
    if ([403, 405, 501].includes(head.status)) {
      const ranged = await fetchWithTimeout(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
      return { url, status: ranged.status, ok: ranged.ok || ranged.status === 206, via: 'GET-Range' };
    }
    return { url, status: head.status, ok: false, via: 'HEAD' };
  } catch (err) {
    return { url, status: 0, ok: false, error: err.message };
  }
}

/**
 * Multiset-aware difference. Unlike Set-based diff, counts duplicates so a
 * live page with two identical headings vs a local page with one shows up
 * as "1 missing on local."
 */
function multisetDiff(arrA, arrB) {
  const countA = new Map(), countB = new Map();
  for (const x of arrA) countA.set(x, (countA.get(x) ?? 0) + 1);
  for (const x of arrB) countB.set(x, (countB.get(x) ?? 0) + 1);
  const onlyInLive = [], onlyInLocal = [];
  for (const [k, n] of countA) {
    const diff = n - (countB.get(k) ?? 0);
    for (let i = 0; i < diff; i++) onlyInLive.push(k);
  }
  for (const [k, n] of countB) {
    const diff = n - (countA.get(k) ?? 0);
    for (let i = 0; i < diff; i++) onlyInLocal.push(k);
  }
  return { onlyInLive, onlyInLocal };
}

// ---------- Main ----------
console.log(`[audit] Live:  ${liveUrl}`);
console.log(`[audit] Local: ${localUrl}`);
console.log(`[audit] Slug:  ${slug}`);
console.log();

const [liveHtml, localHtml] = await Promise.all([
  fetchHtml(liveUrl).catch(e => { console.error(`Live fetch failed: ${e.message}`); process.exit(1); }),
  fetchHtml(localUrl).catch(e => { console.error(`Local fetch failed: ${e.message}`); process.exit(1); }),
]);

const live = parsePage(liveHtml, liveUrl);
const local = parsePage(localHtml, localUrl);

// ---- Diffs ----
const headingSig = h => `${h.tag}#${h.id || '-'} ${h.text}`;
const liveHeadingSigs = live.headings.map(headingSig);
const localHeadingSigs = local.headings.map(headingSig);
const headingDiff = multisetDiff(liveHeadingSigs, localHeadingSigs);

const liveImgUrls = live.images.map(i => i.resolved).filter(Boolean);
const localImgUrls = local.images.map(i => i.resolved).filter(Boolean);
const localImgsMissingAlt = local.images.filter(i => i.altMissing);
const localImgsWithoutDims = local.images.filter(i => !i.width || !i.height);

const liveVideoSrcs = live.videos.map(v => v.src);
const localVideoSrcs = local.videos.map(v => v.src);
const videoDiff = multisetDiff(liveVideoSrcs, localVideoSrcs);

const liveIframeSrcs = live.iframes.map(f => f.src);
const localIframeSrcs = local.iframes.map(f => f.src);
const iframeDiff = multisetDiff(liveIframeSrcs, localIframeSrcs);

const livePictureSrcs = live.pictureSources;
const localPictureSrcs = local.pictureSources;
const pictureDiff = multisetDiff(livePictureSrcs, localPictureSrcs);

// Asset liveness: check ALL resolved image URLs on local (both relative + external)
const localAssetUrls = [...new Set([...localImgUrls, ...localPictureSrcs, ...local.videoPosters, ...localIframeSrcs])]
  .filter(u => u && /^https?:\/\//.test(u));
console.log(`[audit] Liveness-checking ${localAssetUrls.length} asset URL(s) on local (img/picture/poster/iframe)...`);
const liveResults = await mapWithConcurrency(localAssetUrls, urlLiveness);
const brokenAssets = liveResults.filter(r => !r.ok);

const jsonLdDiff = multisetDiff(live.jsonLd, local.jsonLd);

// Callout / tip / aside count diff — catches the JVG bug class where the
// agent extracted prose but dropped the styled wrapper div.
const calloutDiff = live.callouts - local.callouts;
const calloutFindings = [];
if (Math.abs(calloutDiff) >= 3) {
  calloutFindings.push({
    sev: 'mustFix',
    msg: `**Callout / tip / aside wrapper count mismatch:** live=${live.callouts}, local=${local.callouts} (diff ${calloutDiff > 0 ? '+' : ''}${calloutDiff}). Live pages typically wrap pro-tip / warning content in styled aside boxes (\`.tip\`, \`.callout\`, \`.info-box\`, \`.fusion-alert\`, etc.). If local is short, the agent likely extracted prose but skipped wrapper styling. Grep the live HTML for the relevant class and add corresponding \`<div class="<prefix>-callout">\` / \`<prefix>-tip\` blocks on local.`
  });
} else if (Math.abs(calloutDiff) >= 1) {
  calloutFindings.push({
    sev: 'shouldFix',
    msg: `Callout / tip / aside count differs slightly: live=${live.callouts}, local=${local.callouts} (diff ${calloutDiff > 0 ? '+' : ''}${calloutDiff}). May be a single overlooked aside, or acceptable noise (e.g. a live \`.warn\` rendered as a bullet list on local).`
  });
}

// Figure-run analysis — detects "live groups figures into a gallery, local stacks them"
const liveFigureRuns = live.figureRuns;
const localFigureRuns = local.figureRuns;
const liveTotalGroupedFigures = Object.entries(liveFigureRuns).reduce((s, [k, n]) => s + (Number(k) * n), 0);
const localTotalGroupedFigures = Object.entries(localFigureRuns).reduce((s, [k, n]) => s + (Number(k) * n), 0);
const figureRunFindings = [];
// If local has consecutive figure runs that live doesn't, layout grouping is suspect.
const localRunCount = Object.values(localFigureRuns).reduce((a, b) => a + b, 0);
const liveRunCount = Object.values(liveFigureRuns).reduce((a, b) => a + b, 0);
if (localRunCount > 0) {
  const summary = Object.entries(localFigureRuns).sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([len, n]) => `${n}×run-of-${len}`).join(', ');
  if (liveRunCount === 0) {
    // Live has no consecutive figure runs — they're probably wrapped in grid divs.
    // Local has runs — figures are stacked. Almost certainly the JVG bug class.
    figureRunFindings.push({
      sev: 'mustFix',
      msg: `**${localTotalGroupedFigures} figure(s) in ${localRunCount} consecutive run(s) on local (${summary}), but live has none** — live likely wraps them in a grid container (e.g. \`.img2\`/\`.img3\`/\`.comp-grid\`). Wrap in \`<div class="site-img2">\` / \`<div class="site-img3">\` (see CLAUDE.md "Image gallery primitive"). Stacking vertical figures where the live site groups them is the JVG fender-SN bug class.`
    });
  } else {
    // Both have runs; report for verification.
    const liveSummary = Object.entries(liveFigureRuns).sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([len, n]) => `${n}×run-of-${len}`).join(', ');
    if (JSON.stringify(liveFigureRuns) !== JSON.stringify(localFigureRuns)) {
      figureRunFindings.push({
        sev: 'shouldFix',
        msg: `**Figure-run pattern differs:** live=[${liveSummary}], local=[${summary}] — verify gallery layout matches.`
      });
    }
  }
}

// Trailing-slash sanity — filter out things that legitimately don't need a slash
const internalLinksMissingSlash = local.internalLinks.filter(h => {
  if (!h.startsWith('/')) return false;                // already excluded externals/protocol-relative
  if (h.startsWith('/api/')) return false;             // API routes
  if (h.endsWith('/')) return false;
  // Strip query+fragment for the check (e.g. /foo?bar=baz → /foo)
  const path = h.split(/[?#]/)[0];
  if (path.endsWith('/')) return false;
  if (/\.[a-z0-9]{2,5}$/i.test(path)) return false;    // asset extension (.jpg, .pdf, .xml)
  return true;
});

const titleMatch = live.title === local.title;
const descMatch = live.description === local.description;

// Canonical: only host-only diff is acceptable (local dev vs prod). Path / slash / wrong-domain are flags.
let canonicalFinding = null;
if (live.canonical && local.canonical) {
  try {
    const lu = new URL(live.canonical);
    const lo = new URL(local.canonical);
    if (lu.pathname !== lo.pathname) {
      canonicalFinding = { sev: 'mustFix', msg: `**Canonical path differs:** live=\`${live.canonical}\` local=\`${local.canonical}\`` };
    } else if (/example\.com|staging|\.pages\.dev/i.test(local.canonical)) {
      canonicalFinding = { sev: 'mustFix', msg: `**Canonical points at placeholder/staging:** \`${local.canonical}\`` };
    } else if (lu.host !== lo.host) {
      canonicalFinding = { sev: 'acceptable', msg: `Canonical host differs (expected for local dev): live=\`${lu.host}\` local=\`${lo.host}\`` };
    }
  } catch {
    canonicalFinding = { sev: 'shouldFix', msg: `Canonical URL unparseable on one side: live=\`${live.canonical}\` local=\`${local.canonical}\`` };
  }
} else if (live.canonical && !local.canonical) {
  canonicalFinding = { sev: 'mustFix', msg: `**Canonical missing on local** (live has \`${live.canonical}\`)` };
}

// Structural block diff — escalate any missing live section to mustFix
const blockDiff = [];
for (const k of Object.keys(live.structuralBlocks)) {
  const liveCount = live.structuralBlocks[k];
  const localCount = local.structuralBlocks[k];
  const d = liveCount - localCount;
  if (d !== 0) blockDiff.push({ kind: k, live: liveCount, local: localCount, diff: d });
}

// ---------- Report ----------
const now = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(REPORTS_DIR, { recursive: true });
const reportPath = join(REPORTS_DIR, `${slug}-audit-${now}.md`);

const mustFix = [];
const shouldFix = [];
const acceptable = [];

// Headings
if (headingDiff.onlyInLive.length) {
  mustFix.push(`**${headingDiff.onlyInLive.length} heading(s) on live but missing on local:**\n` +
    headingDiff.onlyInLive.map(s => `  - ${s}`).join('\n'));
}
if (headingDiff.onlyInLocal.length) {
  shouldFix.push(`**${headingDiff.onlyInLocal.length} heading(s) on local but not on live (extra):**\n` +
    headingDiff.onlyInLocal.map(s => `  - ${s}`).join('\n'));
}

// Structural blocks: any missing live section is must-fix
for (const b of blockDiff) {
  // If local has MORE than live (e.g. Astro added <article>), it's only shouldFix
  if (b.diff > 0) {
    mustFix.push(`**Structural block mismatch — \`${b.kind}\`:** live=${b.live}, local=${b.local} (missing ${b.diff} on local)`);
  } else {
    shouldFix.push(`Structural block extra on local — \`${b.kind}\`: live=${b.live}, local=${b.local} (+${-b.diff})`);
  }
}

// Image counts
const imgCountDiff = liveImgUrls.length - localImgUrls.length;
if (imgCountDiff > 0) {
  mustFix.push(`**Image count mismatch:** live=${liveImgUrls.length}, local=${localImgUrls.length} (missing ${imgCountDiff} on local)`);
} else if (imgCountDiff < 0) {
  shouldFix.push(`Image count extra on local: live=${liveImgUrls.length}, local=${localImgUrls.length} (+${-imgCountDiff})`);
}

// Picture / source diff
if (pictureDiff.onlyInLive.length) {
  mustFix.push(`**${pictureDiff.onlyInLive.length} <picture><source> URL(s) on live but missing on local:**\n` +
    pictureDiff.onlyInLive.map(s => `  - ${s}`).join('\n'));
}

// Videos + posters
if (videoDiff.onlyInLive.length) {
  mustFix.push(`**${videoDiff.onlyInLive.length} <video> source(s) on live but missing on local** (hero video?):\n` +
    videoDiff.onlyInLive.map(s => `  - ${s}`).join('\n'));
}

// Iframes (YouTube, Vimeo, maps)
if (iframeDiff.onlyInLive.length) {
  mustFix.push(`**${iframeDiff.onlyInLive.length} <iframe> source(s) on live but missing on local** (YouTube/Vimeo/maps?):\n` +
    iframeDiff.onlyInLive.map(s => `  - ${s}`).join('\n'));
}

// Broken assets (now includes relative URLs resolved to absolute)
if (brokenAssets.length) {
  mustFix.push(`**${brokenAssets.length} broken asset URL(s) on local (returned non-200):**\n` +
    brokenAssets.map(r => `  - ${r.status}${r.via ? ` via ${r.via}` : ''} → ${r.url}`).join('\n'));
}

// Alt — only flag truly missing, not empty (alt="" is WCAG-valid decorative)
if (localImgsMissingAlt.length) {
  shouldFix.push(`**${localImgsMissingAlt.length} image(s) on local missing alt attribute entirely** (use alt="" for decorative):\n` +
    localImgsMissingAlt.slice(0, 10).map(i => `  - ${i.raw}`).join('\n') +
    (localImgsMissingAlt.length > 10 ? `\n  - ... and ${localImgsMissingAlt.length - 10} more` : ''));
}

// Width/height — may false-positive on Astro <Image> with aspect-ratio CSS;
// see CLAUDE.md note. Future: respect data-audit-ignore-cls="true" opt-out.
const localImgsWithoutDimsActionable = localImgsWithoutDims;
if (localImgsWithoutDimsActionable.length) {
  shouldFix.push(`**${localImgsWithoutDimsActionable.length} image(s) on local missing width/height (CLS risk):**\n` +
    localImgsWithoutDimsActionable.slice(0, 5).map(i => `  - ${i.raw}`).join('\n') +
    (localImgsWithoutDimsActionable.length > 5 ? `\n  - ... and ${localImgsWithoutDimsActionable.length - 5} more` : '') +
    `\n  _(False-positive risk on Astro <Image> with aspect-ratio CSS — see CLAUDE.md.)_`);
}

// Figure-run findings
for (const f of figureRunFindings) {
  (f.sev === 'mustFix' ? mustFix : shouldFix).push(f.msg);
}

// Callout findings
for (const f of calloutFindings) {
  (f.sev === 'mustFix' ? mustFix : shouldFix).push(f.msg);
}

// JSON-LD
if (jsonLdDiff.onlyInLive.length) {
  mustFix.push(`**JSON-LD @type(s) on live but missing on local:** ${jsonLdDiff.onlyInLive.join(', ')}`);
}
if (jsonLdDiff.onlyInLocal.length) {
  acceptable.push(`JSON-LD @type(s) on local but not live (extra): ${jsonLdDiff.onlyInLocal.join(', ')}`);
}

// Meta
if (!titleMatch) {
  shouldFix.push(`**<title> differs:**\n  - live:  \`${live.title}\`\n  - local: \`${local.title}\``);
}
if (!descMatch) {
  shouldFix.push(`**meta description differs:**\n  - live:  \`${live.description}\`\n  - local: \`${local.description}\``);
}
if (canonicalFinding) {
  if (canonicalFinding.sev === 'mustFix') mustFix.push(canonicalFinding.msg);
  else if (canonicalFinding.sev === 'shouldFix') shouldFix.push(canonicalFinding.msg);
  else acceptable.push(canonicalFinding.msg);
}

// Trailing slash
if (internalLinksMissingSlash.length) {
  shouldFix.push(`**${internalLinksMissingSlash.length} internal link(s) on local missing trailing slash** (breaks \`trailingSlash: 'always'\`):\n` +
    [...new Set(internalLinksMissingSlash)].slice(0, 10).map(h => `  - ${h}`).join('\n'));
}

const lines = [];
lines.push(`# Live-diff audit — ${slug}`);
lines.push(``);
lines.push(`- Live:  ${liveUrl}`);
lines.push(`- Local: ${localUrl}`);
lines.push(`- When:  ${new Date().toISOString()}`);
lines.push(``);

const renderBucket = (title, items) => items.length
  ? [`## ${title}\n`, ...items.map(i => `- ${i}\n`), '']
  : [`## ${title}\n\n_None._\n`];

lines.push(...renderBucket('🔴 Must fix', mustFix));
lines.push(...renderBucket('🟡 Should fix', shouldFix));
lines.push(...renderBucket('🟢 Acceptable / informational', acceptable));

lines.push(`## Summary`);
lines.push(``);
lines.push(`- Live headings: ${live.headings.length} | Local: ${local.headings.length}`);
lines.push(`- Live images:   ${liveImgUrls.length} | Local: ${localImgUrls.length}`);
lines.push(`- Live <picture><source>: ${livePictureSrcs.length} | Local: ${localPictureSrcs.length}`);
lines.push(`- Live videos:   ${liveVideoSrcs.length} | Local: ${localVideoSrcs.length}`);
lines.push(`- Live iframes:  ${liveIframeSrcs.length} | Local: ${localIframeSrcs.length}`);
lines.push(`- Asset URLs on local checked: ${localAssetUrls.length}, broken: ${brokenAssets.length}`);
lines.push(`- Consecutive <figure> runs — live: ${liveRunCount} (total ${liveTotalGroupedFigures} figures) | local: ${localRunCount} (total ${localTotalGroupedFigures} figures)`);
lines.push(`- Callout / tip / info-box blocks — live: ${live.callouts} | local: ${local.callouts}`);
lines.push(`- Structural blocks (live vs local):`);
for (const k of Object.keys(live.structuralBlocks)) {
  lines.push(`  - ${k}: ${live.structuralBlocks[k]} vs ${local.structuralBlocks[k]}`);
}
lines.push(`- JSON-LD types — live: [${live.jsonLd.join(', ') || '∅'}] | local: [${local.jsonLd.join(', ') || '∅'}]`);
lines.push(``);
lines.push(`---`);
lines.push(``);
lines.push(`> Deterministic checks only. For qualitative visual review (screenshots,`);
lines.push(`> color rhythm, missing UI blocks), invoke the **live-diff-auditor** agent`);
lines.push(`> and pass it this report as context.`);

writeFileSync(reportPath, lines.join('\n'));

const counts = { mustFix: mustFix.length, shouldFix: shouldFix.length, acceptable: acceptable.length };
console.log();
console.log(`[audit] Report: ${reportPath}`);
console.log(`[audit] 🔴 must-fix: ${counts.mustFix}  🟡 should-fix: ${counts.shouldFix}  🟢 acceptable: ${counts.acceptable}`);

process.exit(counts.mustFix > 0 ? 1 : 0);
