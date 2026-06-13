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
    const url = `${API_ROOT}/posts?_embed=1&per_page=50&status=${statusParam}&page=${page}&orderby=date&order=desc`;
    console.log(`  → page ${page}`);

    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": "wp-to-astro-importer/1.0" } });
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
  const wpAuthor = embed.author?.[0] ?? null;
  const featured = embed["wp:featuredmedia"]?.[0] ?? null;
  const terms    = embed["wp:term"] ?? [];

  // WP `_embed=1` returns wp:term as an array-of-arrays — one inner array per
  // taxonomy. Filter by taxonomy slug to pull categories vs tags.
  const categories = terms.flat().filter((t) => t.taxonomy === "category").map((t) => t.name).filter((n) => n && n.toLowerCase() !== "uncategorized");
  const tags       = terms.flat().filter((t) => t.taxonomy === "post_tag").map((t) => t.name);

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

  const author = wpAuthor ? {
    name: decodeEntities(wpAuthor.name),
    slug: wpAuthor.slug,
    bio:  wpAuthor.description ? stripHtml(wpAuthor.description) : undefined,
    avatar: wpAuthor.avatar_urls ? wpAuthor.avatar_urls["96"] : undefined,
    url:    wpAuthor.url || undefined,
  } : { name: "Editorial Team", slug: "editorial" };

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
  const body = htmlToMdx(post.content?.rendered ?? "");

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
    await appendSeoMap({
      old_url: new URL(legacyUrl).pathname,
      new_url: `/blog/${slug}/`,
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

  const res = await fetch(remoteUrl);
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
    row.old_url, row.new_url, "301",
    csvCell(row.title), csvCell(row.meta_description),
    csvCell(row.h1), row.new_url, row.schema_type, "wp-import",
  ];
  await appendFile(SEO_MAP, cells.join(",") + "\n", "utf-8");
}

/* ---------- HTML → MDX-safe transform ---------- */

function htmlToMdx(html) {
  if (!html) return "";
  return html
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
    .replace(/\}/g, "&#125;")
    .trim();
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
