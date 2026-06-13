# Phil Reese — WP→Astro Discovery Brief

> Captured 2026-06-12 at project kickoff. Read this first; it's the lay of the land.
> Live site: https://www.philsellsbiz.com/  ·  Repo: https://github.com/myfavoritewebdesigns/phil-reese

## Business identity

- **Phil Reese, Arizona Business Broker** — helps owners buy/sell Arizona businesses. CBI (Certified Business Intermediary).
- Brand strings in use: page title "Phil Reese, Arizona Business Broker | Offices In Scottsdale & Phoenix"; og:site_name "Phil Reese Sells Arizona Businesses".
- Multi-office across the Phoenix metro (drives the 12 city landing pages).

## Platform / tech stack

- **WordPress**, custom theme `wp-content/themes/newtheme` — NO Avada/Elementor/Divi/Gutenberg page-builder soup. Cleaner HTML than the JVG (Avada) rebuild.
- Fronted by **Cloudflare** (Server: cloudflare). Origin is WP.
- Yoast SEO (robots.txt + `/sitemap_index.xml`).
- **WP Rocket 3.21.3** — lazy-load images (expect `data-src`/`data-lazy`), delay/defer JS, remove-unused-CSS (rendered CSS is a "used-CSS" blob), lazy iframes. Curl'd HTML ≠ fully-rendered DOM; verify rendered state in a browser when extracting.
- Key plugins: **Contact Form 7** (forms → field naming `your-name`/`your-email`-style, map in form-map.csv), **wp-customer-reviews** (testimonials → Review/AggregateRating), **wp-youtube-lyte** (lazy YouTube → maps cleanly to template's lite-youtube), **content-views-query-and-display-post-page** (blog/post grids).

## Content inventory (from Yoast sitemaps)

- **25 pages** (`page-sitemap.xml`): home, about, business-sellers, business-buyers, listings, testimonials, awards, what-is-a-cbi, faq, contact, blog, sitemap (HTML), + **12 city pages** (phoenix/scottsdale/tempe/mesa/chandler/gilbert/peoria/glendale/queen-creek/sun-city/fountain-hills/paradise-valley)-business-broker + 1 niche page (landscaping-business-broker).
- **32 blog posts** (`post-sitemap.xml`) under category-prefixed permalinks: `/buying-or-selling/`, `/sell-your-business/`, `/business-broker/`, `/guest-blog/`.
- Full URL list seeded in `reference/seo-map.csv`. Raw sitemaps saved as `reference/_sm-*.xml`.

## Contact / NAP / socials

- **Phone (primary):** (480) 707-7721 — `tel:+14807077721`. Other numbers seen on page (480-428-8010, 480-493-4751, 480-702-3606) may be per-office DIDs — verify in context.
- **Offices** (from embedded Google Maps — confirm which is HQ for primary LocalBusiness schema):
  - Scottsdale: 14350 N 87th St #180, Scottsdale, AZ 85260
  - Phoenix: 2355 E Utopia Rd #100, Phoenix, AZ 85024/85027
  - Mesa: 1640 S Stapley Dr #124, Mesa, AZ 85204
  - Chandler-area: 4505 E Chandler Blvd #170-A, Phoenix, AZ 85048
- **Socials:** Facebook https://www.facebook.com/philsellsbiz (main; also philreesePh, philreeseSco, /pages/Phil-Reese-Arizona-Business-Broker), Twitter/X https://twitter.com/philsellsbiz. (Google+ `/+PhilReeseAZ` is dead — drop.)
- Email: none exposed in homepage HTML (no `mailto:`). Likely the CF7 contact form only — confirm a destination email with Josh for `NOTIFY_TO_EMAIL`.

## Key migration considerations

1. **URL preservation (SEO).** City pages + posts likely hold local rankings/backlinks. Default plan = **preserve every URL exactly** (new_url == old_url in seo-map.csv). The blog's `/<category>/<slug>/` permalink does NOT match the template's default `/blog/<slug>/` routing — preserving it needs custom Astro routing OR per-post 301s. **DECISION for Josh (see below).**
2. **Multi-office local SEO.** One Person/ProfessionalService + multiple LocalBusiness location nodes (or per-city Service schema). Don't collapse to a single address.
3. **Forms = CF7.** Populate `reference/form-map.csv` from the contact form's field names before rebuilding it; wire to `/api/contact` (Mailgun). Need destination email.
4. **WP Rocket rendering.** Lazy-load + delayed-JS means images/embeds may be `data-src`. Force eager-load before any screenshot/audit (already in the playbook).
5. **Testimonials** via wp-customer-reviews — decide static render vs. preserve markup; AggregateRating only if it reflects real reviews (avoid the JVG self-serving-rating trap).
6. **City pages are likely near-duplicate templates** with the city name swapped — good candidate for one Astro component + per-city data, but PRESERVE the live copy/quirks per playbook rule #5.

## Proposed build order (for discussion)

1. Foundation: `site.ts` (NAP, nav, socials), design tokens from live CSS → `global.css`, fonts, favicon, Header/Footer.
2. Homepage (Archetype A).
3. Core conversion pages: about, business-sellers, business-buyers, contact, listings, testimonials, what-is-a-cbi, faq, awards.
4. City landing pages (componentized) + landscaping niche page.
5. Blog (Archetype C): import 32 posts via WP REST API, resolve the permalink decision, wire RSS.
6. SEO/redirects/forms + launch audit.

## Open decisions for Josh

- **Blog URLs:** preserve `/<category>/<slug>/` (custom routing) vs. consolidate to `/blog/<slug>/` (301s)? Recommend preserve.
- **CSS prefix:** set to `pr-` (re-run `npm run setup:prefix -- <abbr>` to change).
- **Design:** pixel-faithful clone of `newtheme` vs. design-normalized rebuild in the MFWD system? (JVG was faithful with approved deviations.)
- **Forms:** destination email for contact submissions.
- **Listings page:** static snapshot vs. live/external listing feed?
- **COVID-era post** + any stale content: keep / refresh / retire?
