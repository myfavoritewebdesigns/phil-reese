/**
 * Sitemap INDEX at /sitemap-index.xml — Yoast-style fan-out to the per-type
 * child sitemaps. robots.txt + the /sitemap.xml and /sitemap_index.xml
 * redirects (public/_redirects) all point here.
 *
 *   /sitemap-index.xml
 *     ├── /post-sitemap.xml   (blog posts, from the content collection)
 *     └── /page-sitemap.xml   (static pages)
 */

import type { APIRoute } from "astro";
import { getPublishedPosts } from "../lib/blog";
import { abs, latest, PAGES, XML_HEADERS } from "../lib/sitemap";

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();

  const children = [
    {
      loc: abs("/post-sitemap.xml"),
      lastmod: latest(posts.map((p) => p.data.modifiedDate ?? p.data.pubDate)),
    },
    {
      loc: abs("/page-sitemap.xml"),
      lastmod: latest(PAGES.map((p) => p.lastmod)),
    },
  ];

  const sitemaps = children
    .map(
      (c) =>
        `  <sitemap>\n    <loc>${c.loc}</loc>\n    <lastmod>${c.lastmod}</lastmod>\n  </sitemap>`,
    )
    .join("\n");

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${sitemaps}\n` +
    `</sitemapindex>\n`;

  return new Response(body, { headers: XML_HEADERS });
};
