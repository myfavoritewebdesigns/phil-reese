#!/usr/bin/env node
/**
 * WordPress → Astro Content Collection importer.
 *
 *   npm run import:wp-blog -- --from https://www.live-site.com
 *     [--download-images]      copy featured images to public/images/blog/
 *     [--limit 50]             import only the N most recent posts (testing)
 *     [--include-drafts]       include status=draft (default: only "publish")
 *     [--dry-run]              print plan, write nothing
 *     [--seo-map]              append rows to reference/seo-map.csv as you go
 *
 * Pulls every post from the WP REST API (`/wp-json/wp/v2/posts?_embed=1`)
 * and writes one MDX file per post into src/content/blog/. The MDX frontmatter
 * matches the Zod schema in src/content/config.ts — a mismatch fails `astro check`
 * loudly, which is the point.
 *
 * Web-API-only — no extra deps. Uses Node 22's fetch + URL + writeFile.
 *
 * Limitations worth knowing before running:
 *
 *  - WP REST `embed` follows author + featured_media + terms (categories/tags),
 *    but NOT custom Yoast/RankMath fields. SEO title/desc are picked up from
 *    `yoast_head_json` if that plugin's REST exposure is enabled; otherwise
 *    falls back to the post's title/excerpt.
 *  - WP shortcodes (`[gallery]`, `[caption]`, theme-specific Builder blocks)
 *    are NOT expanded — they ship to MDX as-is and you'll need to manually
 *    replace or strip them. The importer warns when it finds them.
 *  - Image src URLs stay pointed at the WP origin unless --download-images.
 *    That obeys the template rule that hot-linking is single-session-only.
 *  - Author bios/avatars come from the WP user profile. If author bios are
 *    stored in a different field (e.g. ACF), they won't transfer.
 */

import { writeFile, mkdir, access, constants, appendFile } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { argv } from "node:process";
// parse5 implements the HTML5 tree-construction algorithm (same as a browser),
// so parsing + re-serializing a WP body fragment auto-repairs malformed nesting
// (unclosed <p>, mis-nested tags) that would otherwise break MDX/JSX parsing.
import { parseFragment, serialize } from "parse5";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const POSTS_DIR = join(ROOT, "src", "content", "blog");
const IMAGES_DIR = join(ROOT, "public", "images", "blog");
const SEO_MAP    = join(ROOT, "reference", "seo-map.csv");

const args = parseArgs(argv.slice(2));
if (!args.from) {
  console.error("Missing --from <wp-site-url>");
  process.exit(1);
}

const WP_SITE = args.from.replace(/\/+$/, "");
const API_ROOT = `${WP_SITE}/wp-json/wp/v2`;

const STATE = {
  imported: 0,
  skipped:  0,
  failed:   0,
  warnings: [],
};

await main();

async function main() {
  await mkdir(POSTS_DIR, { recursive: true });
  if (args["download-images"]) await mkdir(IMAGES_DIR, { recursive: true });

  console.log(`Importing posts from ${WP_SITE}`);

  const statusParam = args["include-drafts"] ? "publish,draft" : "publish";
  let page = 1;
  let totalPages = 1;
  const seen = new Set();

  while (page <= totalPages) {
    const url = `${API_ROOT}/posts?_embed=1&per_page=100&status=${statusParam}&page=${page}&orderby=date&order=desc`;
    console.log(`  → page ${page}`);

    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" } });
    } catch (err) {
      console.error(`Fetch failed: ${err.message}`);
      process.exit(1);
    }
    if (!res.ok) {
      console.error(`HTTP ${res.status} on ${url}`);
      if (res.status === 401 && !args["include-drafts"]) {
        console.error("Hint: drafts require authentication. Re-run without --include-drafts or set up an Application Password.");
      }
      process.exit(1);
    }

    totalPages = parseInt(res.headers.get("x-wp-totalpages") ?? "1", 10);
    const posts = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) break;

    for (const post of posts) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);

      if (args.limit && STATE.imported >= Number(args.limit)) {
        console.log(`Hit --limit ${args.limit}, stopping.`);
        page = totalPages + 1;
        break;
      }

      try {
        await importPost(post);
      } catch (err) {
        STATE.failed++;
        STATE.warnings.push(`Post ${post.id} (${post.slug}): ${err.message}`);
      }
    }
    page++;
  }

  console.log("");
  console.log(`Imported: ${STATE.imported}`);
  console.log(`Skipped:  ${STATE.skipped}`);
  console.log(`Failed:   ${STATE.failed}`);
  if (STATE.warnings.length) {
    console.log("");
    console.log("Warnings:");
    for (const w of STATE.warnings) console.log("  - " + w);
  }
}

async function importPost(post) {
  const slug = post.slug;
  const outPath = join(POSTS_DIR, `${slug}.mdx`);

  if (await fileExists(outPath)) {
    STATE.skipped++;
    console.log(`    skipped (exists): ${slug}`);
    return;
  }

  const embed = post._embedded ?? {};
  // When the WP /wp/v2/users route is disabled, the embedded author resolves to
  // an error object ({ code: "rest_no_route", … }) rather than null. Treat any
  // author entry that lacks a real `name`/`slug` (or carries an error `code`) as
  // missing, so the single-author fallback (Phil Reese) kicks in.
  const rawAuthor = embed.author?.[0] ?? null;
  const wpAuthor = (rawAuthor && !rawAuthor.code && rawAuthor.name && rawAuthor.slug) ? rawAuthor : null;
  const featured = embed["wp:featuredmedia"]?.[0] ?? null;
  const terms    = embed["wp:term"] ?? [];

  // WP `_embed=1` returns wp:term as an array-of-arrays — one inner array per
  // taxonomy. Filter by taxonomy slug to pull categories vs tags.
  const categoryTerms = terms.flat().filter((t) => t.taxonomy === "category");
  const categories = categoryTerms.map((t) => t.name).filter((n) => n && n.toLowerCase() !== "uncategorized");
  const tags       = terms.flat().filter((t) => t.taxonomy === "post_tag").map((t) => t.name);

  // PERMALINK-PRESERVING ROUTING (Phil Reese): posts live at /<category>/<slug>/,
  // not /blog/<slug>/. The URL-prefix category is the FIRST path segment of the
  // live permalink — NOT necessarily the first term in the (possibly multi-)
  // category list. Derive it from post.link so multi-category posts route to the
  // exact URL WP served.
  const linkPath = new URL(post.link).pathname.split("/").filter(Boolean);
  const urlCategorySlug = linkPath[0];   // e.g. "buying-or-selling"
  // Human-readable name for the URL category (for display), matched from terms.
  const urlCategoryName = categoryTerms.find((t) => t.slug === urlCategorySlug)?.name
    ?? urlCategorySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Yoast / RankMath REST output, if exposed
  const yoast = post.yoast_head_json ?? null;
  const rankMath = post.rank_math ?? null;

  let seoTitle, seoDescription;
  if (yoast) {
    seoTitle       = yoast.title       ?? undefined;
    seoDescription = yoast.description ?? undefined;
  } else if (rankMath) {
    seoTitle       = rankMath.title       ?? undefined;
    seoDescription = rankMath.description ?? undefined;
  }

  const title       = decodeEntities(post.title?.rendered ?? "(untitled)");
  const description = sanitizeDescription(seoDescription ?? post.excerpt?.rendered ?? "");

  if (description.length < 20) {
    STATE.warnings.push(`${slug}: description shorter than 20 chars after stripping — placeholder used. Hand-edit the .mdx file.`);
  }

  // Phil Reese's WP exposes no /wp/v2/users route (REST author embed 404s), so
  // wpAuthor is null. This is a single-author site — force Phil Reese rather than
  // falling back to the generic "Editorial Team". (Note: the live site shows no
  // public author-archive pages; author is used only for byline + Article schema.)
  const author = wpAuthor ? {
    name: decodeEntities(wpAuthor.name),
    slug: wpAuthor.slug,
    bio:  wpAuthor.description ? stripHtml(wpAuthor.description) : undefined,
    avatar: wpAuthor.avatar_urls ? wpAuthor.avatar_urls["96"] : undefined,
    url:    wpAuthor.url || undefined,
  } : { name: "Phil Reese", slug: "phil-reese", url: `${WP_SITE}/about/` };

  let featuredImage;
  if (featured) {
    const remoteSrc = featured.source_url;
    const localSrc  = args["download-images"]
      ? await downloadImage(remoteSrc, slug)
      : remoteSrc;
    featuredImage = {
      src: localSrc,
      alt: decodeEntities(featured.alt_text || title),
      width:  featured.media_details?.width,
      height: featured.media_details?.height,
      caption: featured.caption?.rendered ? stripHtml(featured.caption.rendered) : undefined,
    };
  }

  const legacyUrl = post.link ?? `${WP_SITE}/${slug}/`;
  let rawBody = post.content?.rendered ?? "";
  // Download every in-body image to public/images/blog/ and rewrite the src to
  // the local path BEFORE the HTML→MDX transform. Zero hot-links is a hard rule.
  if (args["download-images"]) {
    rawBody = await downloadBodyImages(rawBody, slug);
  }
  const body = htmlToMdx(rawBody);

  // Surface shortcode usage as a warning — the importer doesn't expand them.
  const shortcodes = [...body.matchAll(/\[([a-z][a-z0-9_-]*)/gi)].map((m) => m[1]);
  if (shortcodes.length) {
    const unique = [...new Set(shortcodes)];
    STATE.warnings.push(`${slug}: ${shortcodes.length} unexpanded shortcode(s) [${unique.slice(0, 5).join(", ")}${unique.length > 5 ? "..." : ""}] — hand-edit the .mdx file.`);
  }

  const frontmatter = buildFrontmatter({
    title,
    description: description.length >= 20 ? description : `${description} (TODO: write a 20-300 char description)`,
    pubDate:       post.date_gmt ? `${post.date_gmt}Z` : post.date,
    modifiedDate:  post.modified_gmt ? `${post.modified_gmt}Z` : undefined,
    draft:        post.status === "draft",
    author,
    category:     urlCategorySlug,   // URL-prefix slug for /<category>/<slug>/ routing
    categoryName: urlCategoryName,   // human-readable display name (informational)
    categories,
    tags,
    featuredImage,
    seoTitle:       seoTitle && seoTitle !== title ? seoTitle : undefined,
    seoDescription: seoDescription && seoDescription !== description ? seoDescription : undefined,
    legacyUrl,
    legacyId: post.id,
  });

  const mdx = `${frontmatter}\n\n{/*\n  Imported from: ${legacyUrl}\n  WP post ID:    ${post.id}\n*/}\n\n${body}\n`;

  if (args["dry-run"]) {
    console.log(`    (dry-run) would write ${outPath}`);
  } else {
    await writeFile(outPath, mdx, "utf-8");
    console.log(`    + ${slug}.mdx`);
  }

  if (args["seo-map"]) {
    // Permalinks are PRESERVED: new_url === old_url (/<category>/<slug>/), so
    // these rows are status 200 (live route), not 301 redirects.
    const preservedPath = new URL(legacyUrl).pathname;
    await appendSeoMap({
      old_url: preservedPath,
      new_url: preservedPath,
      status: "200",
      title,
      meta_description: description,
      h1: title,
      schema_type: "BlogPosting",
    });
  }

  STATE.imported++;
}

async function downloadImage(remoteUrl, slug) {
  const ext = extname(new URL(remoteUrl).pathname) || ".jpg";
  const fileBase = `${slug}-featured${ext}`;
  const localPath = join(IMAGES_DIR, fileBase);
  const publicPath = `/images/blog/${fileBase}`;

  if (await fileExists(localPath)) return publicPath;
  if (args["dry-run"]) return publicPath;

  const res = await fetch(remoteUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
  if (!res.ok) {
    STATE.warnings.push(`${slug}: featured image fetch failed (${res.status}) — kept remote URL.`);
    return remoteUrl;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(localPath, buf);
  return publicPath;
}

async function appendSeoMap(row) {
  if (args["dry-run"]) return;
  const cells = [
    row.old_url, row.new_url, row.status ?? "301",
    csvCell(row.title), csvCell(row.meta_description),
    csvCell(row.h1), row.new_url, row.schema_type, "wp-import",
  ];
  await appendFile(SEO_MAP, cells.join(",") + "\n", "utf-8");
}

/**
 * Download every <img src> in a post body to public/images/blog/ and rewrite the
 * src to the local path. Returns the rewritten HTML. WordPress responsive markup
 * (srcset / sizes) is stripped — we ship one local copy per image, so srcset
 * (which points at multiple remote sizes) would re-introduce hot-links. Also
 * removes width/height-less lazy-load wrapper noise via a light pass.
 */
async function downloadBodyImages(html, slug) {
  if (!html) return html;
  // Collect unique src URLs first (some images repeat).
  // NOTE: WP source occasionally omits the space before src (e.g. style="…"src="…"),
  // so we DON'T require leading whitespace — `[\s"']src=` would miss those. Match a
  // src= attribute anywhere inside the tag.
  const srcRe = /<img\b[^>]*?src="([^"]+)"[^>]*>/gi;
  const matches = [...html.matchAll(srcRe)];
  const urlMap = new Map();   // remote URL -> local path
  let idx = 0;
  for (const m of matches) {
    const remote = m[1];
    if (urlMap.has(remote)) continue;
    if (!/^https?:\/\//i.test(remote)) { urlMap.set(remote, remote); continue; }
    idx++;
    const local = await downloadOneImage(remote, slug, idx);
    urlMap.set(remote, local);
  }
  // Rewrite: replace each src, and strip srcset/sizes (would re-hot-link).
  let out = html.replace(srcRe, (tag, src) => {
    const local = urlMap.get(src) ?? src;
    return tag
      .replace(src, local)
      .replace(/\ssrcset="[^"]*"/gi, "")
      .replace(/\ssizes="[^"]*"/gi, "");
  });
  return out;
}

async function downloadOneImage(remoteUrl, slug, idx) {
  let pathname;
  try { pathname = new URL(remoteUrl).pathname; } catch { return remoteUrl; }
  const ext = extname(pathname) || ".jpg";
  const fileBase = `${slug}-body-${idx}${ext}`;
  const localPath  = join(IMAGES_DIR, fileBase);
  const publicPath = `/images/blog/${fileBase}`;
  if (await fileExists(localPath)) return publicPath;
  if (args["dry-run"]) return publicPath;
  let res;
  try {
    res = await fetch(remoteUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
  } catch (err) {
    STATE.warnings.push(`${slug}: body image fetch threw (${err.message}) for ${remoteUrl} — kept remote URL.`);
    return remoteUrl;
  }
  if (!res.ok) {
    STATE.warnings.push(`${slug}: body image fetch failed (${res.status}) for ${remoteUrl} — kept remote URL.`);
    return remoteUrl;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(localPath, buf);
  return publicPath;
}

/* ---------- HTML → MDX-safe transform ---------- */

function htmlToMdx(html) {
  if (!html) return "";
  // Repair malformed nesting first (unclosed/mis-nested <p>, etc.) via the HTML5
  // parser, so the downstream regex transforms + MDX compiler see balanced markup.
  // While we have the parsed tree, also rewrite WP "Lyte" lazy-YouTube embeds —
  // deeply nested <div itemtype=VideoObject>…<noscript>…</noscript></div> blocks
  // with non-standard attributes that MDX can't parse — into a clean responsive
  // <iframe>. (Relaxed fidelity: the video is preserved, the brittle markup isn't.)
  // Pre-clean BEFORE parse5: WP authors wrapped headings in inline formatting
  // (`<strong><h2>…</h2></strong>`). A block heading can't live inside an inline
  // element, so the HTML5 parser splits the <strong> around it and strands an
  // orphan `</strong>` — which then breaks MDX. Headings render bold already, so
  // just drop the inline wrapper. Run a couple passes for nested cases.
  let pre = html;
  for (let i = 0; i < 3; i++) {
    pre = pre.replace(/<(strong|em|b|i)>\s*(<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>)\s*<\/\1>/gi, "$2");
  }

  let normalized;
  try {
    const frag = parseFragment(pre);
    replaceLyteEmbeds(frag);
    // Serialize each TOP-LEVEL child onto its own single line (internal whitespace
    // collapsed), joined by blank lines. parse5 has already balanced all nesting,
    // so this guarantees no blank line appears INSIDE a block element — the exact
    // condition that makes MDX/micromark abandon an HTML block mid-element and
    // then fail on the (correctly-placed) closing tag.
    normalized = serializeTopLevel(frag);
  } catch {
    normalized = pre;   // fall back to pre-cleaned raw if parse5 ever throws
  }
  const transformed = normalized
    // WordPress wraps inline images in <a href="…/wp-content/uploads/…fullsize.jpg">
    // (the "link to full-size image" option). Those hrefs hot-link the WP origin
    // and would 404 post-migration. Since the <img> inside is already localized,
    // unwrap the anchor and keep only the image. (Zero hot-links rule.)
    .replace(/<a\b[^>]*\bhref="https?:\/\/[^"]*\/wp-content\/uploads\/[^"]*\.(?:jpe?g|png|gif|webp|svg)"[^>]*>(\s*<img\b[^>]*>\s*)<\/a>/gi, "$1")
    // Convert absolute same-origin links to relative so internal navigation works
    // on the new domain and doesn't bounce through the old WP origin. Handles both
    // pathful (…com/foo/) and bare-root (…com or …com/) hrefs.
    .replace(/(href|src)="https?:\/\/(?:www\.)?philsellsbiz\.com(\/[^"]*)"/gi, '$1="$2"')
    .replace(/(href|src)="https?:\/\/(?:www\.)?philsellsbiz\.com\/?"/gi, '$1="/"')
    // The WP posts embed a Google Maps iframe via an expired 2016 `pb=` token
    // (…!4v1465356524452) that 404s. It's a tangential office-location map, not
    // article content, and every keyless replacement embed only 301-redirects.
    // Drop it from the body (relaxed blog fidelity) — the office map already
    // lives in the site footer + the dedicated /scottsdale-business-broker/ page.
    .replace(/<iframe\b[^>]*\bsrc="https:\/\/www\.google\.com\/maps\/embed\?pb=[^"]*"[^>]*><\/iframe>/gi, "")
    // Sanitize malformed <img> tags. WP's editor occasionally emitted bare,
    // valueless attributes (e.g. `… height="200"  size-medium wp-image-419 />`)
    // — invalid JSX that breaks MDX parsing. Drop any bare word token inside an
    // <img> tag that isn't a key="value" pair or the self-closing slash.
    .replace(/<img\b[^>]*?>/gi, sanitizeImgTag)
    // Strip WP block editor comment markers — `<!-- wp:paragraph -->` etc.
    .replace(/<!--\s*\/?wp:[^>]*-->/g, "")
    // Strip MDX-incompatible HTML comments (MDX 3 supports JSX-style comments
    // but not HTML-style at the top level). Most WP body content has no comments,
    // so this is usually a no-op.
    .replace(/<!--[\s\S]*?-->/g, "")
    // Self-close void elements (img, br, hr, input, source) — JSX requires it.
    .replace(/<(img|br|hr|input|source|meta|link)([^>]*?)(?<!\/)>/gi, "<$1$2 />")
    // Curly braces in text are interpreted by MDX as JSX expressions. Escape them.
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
  return transformed.trim();
}

/**
 * Serialize a parse5 fragment so each DIRECT (top-level) child renders on its own
 * single line, with internal whitespace collapsed, children joined by blank lines.
 *
 * Why this exact shape: MDX/micromark abandons a raw-HTML block the moment it
 * sees a blank line inside it, then fails when it later meets the (correct)
 * closing tag — "Expected a closing tag for `<ul>` before the end of paragraph."
 * parse5 already guarantees balanced nesting, so collapsing each top-level
 * element to a single line removes every interior blank line while preserving
 * nested structure (lists, tables) verbatim.
 */
function serializeTopLevel(frag) {
  const parts = [];
  for (const child of frag.childNodes ?? []) {
    // Wrap the single child in a throwaway fragment to serialize it alone.
    const holder = { childNodes: [child] };
    let html = serialize(holder);
    // Collapse all whitespace runs (incl. newlines) inside this element to single
    // spaces so it occupies exactly one line.
    html = html.replace(/\s+/g, " ").trim();
    if (html) parts.push(html);
  }
  return parts.join("\n\n");
}

/* ---------- parse5 tree helpers: Lyte YouTube embed → clean iframe ---------- */

function getAttr(node, name) {
  return node.attrs?.find((a) => a.name === name)?.value;
}

/** Extract an 11-char YouTube video ID from any URL-ish string. */
function ytIdFrom(str) {
  if (!str) return null;
  const m = str.match(/(?:embed\/|vi?\/|v=|youtu\.be\/|watch\?)([A-Za-z0-9_-]{11})/)
        ?? str.match(/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * Walk the parse5 fragment; for each element that is a WP "Lyte" lazy-YouTube
 * embed container (itemtype …VideoObject, or class lyte-wrapper/lyMe, or a
 * lyte_* id), find the video ID and replace the element's children with a single
 * responsive <iframe>. Mutates the tree in place.
 */
function replaceLyteEmbeds(root) {
  const isLyte = (node) => {
    if (!node.tagName) return false;
    const itemtype = getAttr(node, "itemtype") ?? "";
    const cls = getAttr(node, "class") ?? "";
    const id = getAttr(node, "id") ?? "";
    return /VideoObject/i.test(itemtype) || /\blyte-wrapper\b/.test(cls) || /^lyte_/.test(id);
  };

  const findYtId = (node) => {
    // Search this subtree for embedURL meta, data-src, or any youtube URL/id.
    let found = null;
    const visit = (n) => {
      if (found) return;
      if (n.tagName === "meta") {
        const prop = getAttr(n, "itemprop");
        if (prop === "embedURL" || prop === "contentURL" || prop === "thumbnailUrl") {
          const id = ytIdFrom(getAttr(n, "content"));
          if (id) { found = id; return; }
        }
      }
      const dataSrc = getAttr(n, "data-src");
      if (dataSrc) { const id = ytIdFrom(dataSrc); if (id) { found = id; return; } }
      const href = getAttr(n, "href");
      if (href && /youtu/.test(href)) { const id = ytIdFrom(href); if (id) { found = id; return; } }
      for (const c of n.childNodes ?? []) visit(c);
    };
    visit(node);
    return found;
  };

  const makeIframe = (videoId) => {
    const wrapper = parseFragment(
      `<div class="pr-video"><iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
    );
    return wrapper.childNodes[0];
  };

  const walk = (node) => {
    const kids = node.childNodes ?? [];
    for (let i = 0; i < kids.length; i++) {
      const child = kids[i];
      if (isLyte(child)) {
        const id = findYtId(child);
        const replacement = id ? makeIframe(id) : null;
        if (replacement) {
          replacement.parentNode = node;
          kids[i] = replacement;
          continue;  // don't descend into the removed subtree
        }
      }
      walk(child);
    }
  };
  walk(root);
}

/**
 * Rebuild an <img> tag keeping only well-formed key="value" / key='value'
 * attributes. Strips bare valueless tokens (mangled WP class fragments like
 * `size-medium wp-image-419`) that are valid in lenient HTML but break MDX/JSX.
 * Ensures the tag is self-closing.
 */
function sanitizeImgTag(tag) {
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*')/g;
  const attrs = [];
  let m;
  while ((m = attrRe.exec(tag)) !== null) {
    attrs.push(`${m[1]}=${m[2]}`);
  }
  return `<img ${attrs.join(" ")} />`;
}

function stripHtml(html) {
  return decodeEntities((html || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

function sanitizeDescription(html) {
  return stripHtml(html).slice(0, 300);
}

function decodeEntities(s) {
  if (!s) return "";
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/* ---------- YAML frontmatter builder ---------- */

function buildFrontmatter(data) {
  const lines = ["---"];

  pushString(lines, "title",         data.title);
  pushString(lines, "description",   data.description);
  pushString(lines, "pubDate",       data.pubDate);
  if (data.modifiedDate) pushString(lines, "modifiedDate", data.modifiedDate);
  if (data.draft)        lines.push("draft: true");

  lines.push("author:");
  lines.push(`  name: ${yamlInline(data.author.name)}`);
  lines.push(`  slug: ${yamlInline(data.author.slug)}`);
  if (data.author.bio)    lines.push(`  bio: ${yamlInline(data.author.bio)}`);
  if (data.author.avatar) lines.push(`  avatar: ${yamlInline(data.author.avatar)}`);
  if (data.author.url)    lines.push(`  url: ${yamlInline(data.author.url)}`);

  // URL-prefix category slug — drives /<category>/<slug>/ routing.
  if (data.category)     pushString(lines, "category", data.category);
  if (data.categoryName) pushString(lines, "categoryName", data.categoryName);

  pushArray(lines, "categories", data.categories);
  pushArray(lines, "tags",       data.tags);

  if (data.featuredImage) {
    lines.push("featuredImage:");
    lines.push(`  src: ${yamlInline(data.featuredImage.src)}`);
    lines.push(`  alt: ${yamlInline(data.featuredImage.alt)}`);
    if (data.featuredImage.width)   lines.push(`  width: ${data.featuredImage.width}`);
    if (data.featuredImage.height)  lines.push(`  height: ${data.featuredImage.height}`);
    if (data.featuredImage.caption) lines.push(`  caption: ${yamlInline(data.featuredImage.caption)}`);
  }

  if (data.seoTitle)       pushString(lines, "seoTitle",       data.seoTitle);
  if (data.seoDescription) pushString(lines, "seoDescription", data.seoDescription);
  if (data.legacyUrl)      pushString(lines, "legacyUrl",      data.legacyUrl);
  if (data.legacyId)       lines.push(`legacyId: ${data.legacyId}`);

  lines.push("---");
  return lines.join("\n");
}

function pushString(lines, key, val) {
  if (val == null || val === "") return;
  lines.push(`${key}: ${yamlInline(String(val))}`);
}

function pushArray(lines, key, arr) {
  if (!arr || arr.length === 0) {
    lines.push(`${key}: []`);
    return;
  }
  lines.push(`${key}:`);
  for (const item of arr) lines.push(`  - ${yamlInline(item)}`);
}

function yamlInline(v) {
  const s = String(v);
  if (/[:#\n\r"'\\[\]{}|>*&!%@`]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ---------- argv helpers ---------- */

function parseArgs(argList) {
  const out = {};
  for (let i = 0; i < argList.length; i++) {
    const a = argList[i];
    if (!a.startsWith("--")) continue;
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

async function fileExists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
