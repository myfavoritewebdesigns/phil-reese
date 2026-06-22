/**
 * Page sitemap at /page-sitemap.xml — the static (non-blog) pages, matching the
 * live Yoast page-sitemap. The page list + preserved lastmod values live in
 * src/lib/sitemap.ts (PAGES). See that file for what's intentionally excluded
 * (/privacy-policy/, category archives, paginated blog pages).
 */

import type { APIRoute } from "astro";
import { abs, PAGES, renderUrlset, sitemapDate, XML_HEADERS } from "../lib/sitemap";

export const GET: APIRoute = () => {
  const entries = PAGES.map((p) => ({
    loc: abs(p.path),
    lastmod: sitemapDate(p.lastmod),
  }));

  return new Response(renderUrlset(entries), { headers: XML_HEADERS });
};
