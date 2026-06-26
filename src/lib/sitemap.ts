/* -----------------------------------------------------------------------
   SITEMAP HELPERS — Yoast-style split sitemap (index + post + page).

   The live WP site (Yoast SEO) exposed a sitemap INDEX that fanned out to
   per-type child sitemaps:
     /sitemap-index.xml  → /post-sitemap.xml + /page-sitemap.xml
   We reproduce that exact shape with three hand-rolled endpoints under
   src/pages/ (sitemap-index.xml.ts, post-sitemap.xml.ts, page-sitemap.xml.ts)
   instead of @astrojs/sitemap's single combined sitemap-0.xml. Same URLs the
   search engines already indexed → no sitemap-structure churn at cutover.

   Used by:
     - src/pages/sitemap-index.xml.ts
     - src/pages/post-sitemap.xml.ts
     - src/pages/page-sitemap.xml.ts
   ----------------------------------------------------------------------- */

import { SITE_URL } from "../config/site";

/** Absolute URL for a site-relative path. */
export function abs(path: string): string {
  return new URL(path, SITE_URL).href;
}

/** Yoast-style sitemap date: ISO 8601 in UTC with a `+00:00` offset. */
export function sitemapDate(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

/** Newest date in a list — used for a child sitemap's <lastmod>. */
export function latest(dates: Array<Date | string>): string {
  const max = dates
    .map((d) => (typeof d === "string" ? new Date(d) : d).getTime())
    .reduce((a, b) => Math.max(a, b), 0);
  return sitemapDate(new Date(max));
}

/** Static-page entry: a route and its last-modified date. */
export interface PageEntry {
  path: string;
  lastmod: string;
}

/* -----------------------------------------------------------------------
   STATIC PAGES — in the order Yoast emitted them on the live site.

   EXCLUDES, to match the live page-sitemap exactly:
     - /privacy-policy/      (Yoast-noindex on live → absent from the sitemap)
     - /404/                 (error page)
     - /[category]/ archives (live Yoast had no category-sitemap in its index)
     - /blog/page/N/         (paginated archives — Yoast omits these)
   Blog POSTS are in post-sitemap.xml (generated from the content collection).

   lastmod values are PRESERVED from the live Yoast page-sitemap (2026-06-12
   crawl, reference/_sm-page-sitemap.xml) so the migration doesn't falsely
   signal "every page changed at cutover". Bump a page's date here when you
   make a real content change to it.
   ----------------------------------------------------------------------- */
/* lastmod reflects the most recent genuine content change.
   2026-06-26 = this session's edits (BBB wording, the-the typo, Peoria map,
   sellers/buyers area links, city-page business-district cards).
   2026-06-18 = the post-launch optimization wave (VideoObject schema, internal
   links). Pages with no post-launch edit keep their original migration date. */
export const PAGES: PageEntry[] = [
  { path: "/",                                 lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/sitemap/",                         lastmod: "2026-04-23T20:54:05+00:00" },
  { path: "/awards/",                          lastmod: "2026-04-24T17:36:00+00:00" },
  { path: "/blog/",                            lastmod: "2026-04-28T21:51:50+00:00" },
  { path: "/tempe-business-broker/",           lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/faq/",                             lastmod: "2026-05-21T16:28:41+00:00" },
  { path: "/about/",                           lastmod: "2026-05-21T16:35:53+00:00" },
  { path: "/business-sellers/",                lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/what-is-a-cbi/",                   lastmod: "2026-06-18T18:00:00+00:00" },
  { path: "/business-buyers/",                 lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/testimonials/",                    lastmod: "2026-05-28T20:10:39+00:00" },
  { path: "/contact/",                         lastmod: "2026-06-02T19:24:16+00:00" },
  { path: "/listings/",                        lastmod: "2026-06-12T18:03:12+00:00" },
  { path: "/scottsdale-business-broker/",      lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/mesa-business-broker/",            lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/chandler-business-broker/",        lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/gilbert-business-broker/",         lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/peoria-business-broker/",          lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/glendale-business-broker/",        lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/queen-creek-business-broker/",     lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/sun-city-business-broker/",        lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/fountain-hills-business-broker/",  lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/paradise-valley-business-broker/", lastmod: "2026-06-26T15:30:00+00:00" },
  { path: "/landscaping-business-broker/",     lastmod: "2026-06-18T18:00:00+00:00" },
  { path: "/phoenix-business-broker/",         lastmod: "2026-06-18T18:00:00+00:00" },
];

/** Render a <urlset> sitemap body from {loc, lastmod} entries. */
export function renderUrlset(entries: Array<{ loc: string; lastmod: string }>): string {
  const urls = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`
  );
}

/** Standard XML response headers for a sitemap endpoint. */
export const XML_HEADERS = { "Content-Type": "application/xml; charset=utf-8" };
