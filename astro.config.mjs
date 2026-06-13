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
  site: 'https://example.com',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});
