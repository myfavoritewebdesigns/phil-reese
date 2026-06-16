// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

// IMPORTANT: replace `site` with the live domain before building for production.
// `site` controls canonical URLs and sitemap.xml output. Wrong value = wrong canonicals.
//
// `trailingSlash: "always"` matches WordPress's default URL shape. Changing this
// after launch breaks every inbound link, so commit to it before you ship.
export default defineConfig({
  site: 'https://www.philsellsbiz.com',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  // Sitemap filter: exclude the paginated blog archives (/blog/page/2/, /3/, ...).
  // Yoast deliberately omits paginated archives — they're thin list-pages that
  // compete with /blog/ and dilute crawl budget; they stay crawlable via the
  // on-page pagination links. Keeps Yoast parity for the migration.
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !/\/blog\/page\/\d+\/?$/.test(page),
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
