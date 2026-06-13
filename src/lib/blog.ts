/* -----------------------------------------------------------------------
   BLOG HELPERS — taxonomy aggregation, slugify, and post sorting.

   Used by:
     - src/pages/blog/[...page].astro      (paginated index at /blog/)
     - src/pages/[category]/[slug].astro   (single post, PRESERVED /<category>/<slug>/)
     - src/pages/[category]/index.astro    (category archive at /<category>/)
     - src/pages/rss.xml.ts

   NOTE (Phil Reese): permalinks are preserved at /<category>/<slug>/ — NOT the
   template default /blog/<slug>/. Canonical post URLs come from postUrl(). The
   site is single-author with no tags, so the template's /tag/ and /author/
   routes were removed; getAllTags/getAllAuthors remain as unused helpers.
   ----------------------------------------------------------------------- */

import { getCollection, type CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

/**
 * Standard slugify — matches WordPress's sanitize_title() behavior closely
 * enough that category and tag slugs derived from human-readable names line
 * up with the URLs WP was previously serving.
 *
 * WP collapses Unicode-normalized text → ASCII, lowercases, replaces non-
 * alphanumeric with `-`, collapses repeated `-`, and strips leading/trailing.
 * We don't do the full Unicode normalization, but the ASCII-fast-path covers
 * 99% of WP English-language sites. If the source site has e.g. accented
 * category names, run them through `String.prototype.normalize("NFKD")` first
 * — but verify the exact output matches the live URL.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")     // strip combining diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Fetch all NON-DRAFT posts sorted newest-first. The single place draft
 * filtering happens — every listing page, the RSS feed, and the sitemap
 * read posts via this function so a `draft: true` post is uniformly
 * excluded from all of them.
 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/**
 * Build categories[] from all posts. Each entry tracks the human-readable
 * name, the derived slug, and the post count — what an archive sidebar
 * needs without re-iterating posts on every page.
 */
export interface TermBucket {
  name: string;
  slug: string;
  count: number;
  posts: BlogPost[];
}

function bucketByTaxonomy(
  posts: BlogPost[],
  field: "categories" | "tags",
): Map<string, TermBucket> {
  const buckets = new Map<string, TermBucket>();
  for (const post of posts) {
    for (const name of post.data[field]) {
      const slug = slugify(name);
      let bucket = buckets.get(slug);
      if (!bucket) {
        bucket = { name, slug, count: 0, posts: [] };
        buckets.set(slug, bucket);
      }
      bucket.count++;
      bucket.posts.push(post);
    }
  }
  return buckets;
}

export async function getAllCategories(): Promise<TermBucket[]> {
  const posts = await getPublishedPosts();
  return [...bucketByTaxonomy(posts, "categories").values()]
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Buckets posts by their URL-prefix category slug (`data.category`) — the
 * routing taxonomy for `/<category>/` archives and `/<category>/<slug>/` posts.
 * Unlike getAllCategories (which buckets by the multi-value `categories[]` name
 * list), this assigns each post to exactly ONE bucket: the category in its URL.
 * `name` is the human-readable display name (frontmatter `categoryName`).
 */
export async function getUrlCategories(): Promise<TermBucket[]> {
  const posts = await getPublishedPosts();
  const buckets = new Map<string, TermBucket>();
  for (const post of posts) {
    const slug = post.data.category;
    let bucket = buckets.get(slug);
    if (!bucket) {
      const name = post.data.categoryName
        ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      bucket = { name, slug, count: 0, posts: [] };
      buckets.set(slug, bucket);
    }
    bucket.count++;
    bucket.posts.push(post);
  }
  return [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAllTags(): Promise<TermBucket[]> {
  const posts = await getPublishedPosts();
  return [...bucketByTaxonomy(posts, "tags").values()]
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface AuthorBucket {
  slug: string;
  name: string;
  bio?: string;
  avatar?: string;
  url?: string;
  count: number;
  posts: BlogPost[];
}

export async function getAllAuthors(): Promise<AuthorBucket[]> {
  const posts = await getPublishedPosts();
  const map = new Map<string, AuthorBucket>();
  for (const post of posts) {
    const { slug, name, bio, avatar, url } = post.data.author;
    let bucket = map.get(slug);
    if (!bucket) {
      bucket = { slug, name, bio, avatar, url, count: 0, posts: [] };
      map.set(slug, bucket);
    }
    bucket.count++;
    bucket.posts.push(post);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Canonical post URL — PRESERVES the live WordPress permalink shape
 * `/<category>/<slug>/` (NOT the template default `/blog/<slug>/`). The
 * category is the URL-prefix slug stored in frontmatter (`data.category`),
 * derived at import time from the live permalink. Every link to a post — cards,
 * RSS, adjacent nav, archives — must go through this so the 32 indexed URLs are
 * reproduced exactly.
 */
export function postUrl(post: BlogPost): string {
  return `/${post.data.category}/${post.id}/`;
}

/**
 * Related posts for a single post — same URL-category first, then padded with
 * the most-recent other posts, excluding the current one. Mirrors the live WP
 * "Related posts:" block at the bottom of each article (internal-linking + the
 * heading/section the live-diff audit expects).
 */
export function getRelatedPosts(all: BlogPost[], current: BlogPost, limit = 4): BlogPost[] {
  const others = all.filter((p) => p.id !== current.id);
  const sameCat = others.filter((p) => p.data.category === current.data.category);
  const rest = others.filter((p) => p.data.category !== current.data.category);
  return [...sameCat, ...rest].slice(0, limit);
}

/**
 * Adjacent-post navigation — newer/older links at the bottom of every post.
 * Posts are already pubDate-DESC, so `posts[i-1]` is newer, `posts[i+1]` is older.
 */
export function getAdjacentPosts(
  all: BlogPost[],
  current: BlogPost,
): { newer?: BlogPost; older?: BlogPost } {
  const i = all.findIndex((p) => p.id === current.id);
  if (i === -1) return {};
  return {
    newer: i > 0              ? all[i - 1] : undefined,
    older: i < all.length - 1 ? all[i + 1] : undefined,
  };
}

/**
 * Build the canonical /blog/page/N/ URL. Astro's paginate() puts page 1 at
 * the bare /blog/ and page 2+ at /blog/page/2/.
 *
 * Used to populate <link rel="next"> / <link rel="prev"> in the head of
 * each listing page — Google's pagination signal. Mis-paginating without
 * these links splits link equity across pages instead of consolidating it.
 */
export function paginationUrl(base: string, page: number): string {
  // base is the archive root, e.g. "/blog" or "/category/news"
  const clean = base.replace(/\/+$/, "");
  return page <= 1 ? `${clean}/` : `${clean}/page/${page}/`;
}

/** Format a Date for human display ("May 25, 2026"). */
export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
