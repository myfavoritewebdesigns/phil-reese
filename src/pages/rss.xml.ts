/**
 * RSS feed at /rss.xml — preserves WordPress's /feed/ for aggregators,
 * email tools, and directories that subscribe to the site.
 *
 * Cloudflare _redirects also maps `/feed/` → `/rss.xml` (see public/_redirects).
 *
 * Reads from the `blog` Content Collection. Drafts are filtered via
 * getPublishedPosts(), so a post marked `draft: true` in frontmatter never
 * leaks into the feed — same gate as the listing pages and sitemap.
 */

import rss from "@astrojs/rss";
import { SITE_URL, SITE_NAME } from "../config/site";
import { getPublishedPosts } from "../lib/blog";

export async function GET() {
  const posts = await getPublishedPosts();
  return rss({
    title: SITE_NAME,
    description: `Latest articles from ${SITE_NAME}.`,
    site: SITE_URL,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/blog/${post.id}/`,
      author: post.data.author.name,
      categories: post.data.categories,
    })),
    customData: "<language>en-us</language>",
    stylesheet: "/rss-styles.xsl", // optional — remove if you don't ship a stylesheet
  });
}
