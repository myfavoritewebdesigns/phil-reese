// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

// IMPORTANT: replace `site` with the live domain before building for production.
// `site` controls canonical URLs (and the sitemap loc/lastmod values built in
// src/lib/sitemap.ts). Wrong value = wrong canonicals.
//
// `trailingSlash: "always"` matches WordPress's default URL shape. Changing this
// after launch breaks every inbound link, so commit to it before you ship.
//
// SITEMAP: not @astrojs/sitemap. The live WP site (Yoast) served a sitemap INDEX
// fanning out to per-type child sitemaps (post-sitemap.xml + page-sitemap.xml),
// so we reproduce that exact shape with hand-rolled endpoints under src/pages/
// (sitemap-index.xml.ts, post-sitemap.xml.ts, page-sitemap.xml.ts). Those already
// exclude paginated /blog/page/N/ archives, so Yoast parity is preserved.
export default defineConfig({
  site: 'https://www.philsellsbiz.com',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [
    mdx(),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
