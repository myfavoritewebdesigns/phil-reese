/**
 * Post sitemap at /post-sitemap.xml — every published blog post, read from the
 * `blog` content collection through getPublishedPosts() (the single draft gate
 * shared with the RSS feed and listing pages). URLs use the PRESERVED WP
 * permalink shape /<category>/<slug>/ via postUrl().
 *
 * <lastmod> = the post's modifiedDate, falling back to pubDate.
 */

import type { APIRoute } from "astro";
import { getPublishedPosts, postUrl } from "../lib/blog";
import { abs, renderUrlset, sitemapDate, XML_HEADERS } from "../lib/sitemap";

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();

  const entries = posts.map((post) => ({
    loc: abs(postUrl(post)),
    lastmod: sitemapDate(post.data.modifiedDate ?? post.data.pubDate),
  }));

  return new Response(renderUrlset(entries), { headers: XML_HEADERS });
};
