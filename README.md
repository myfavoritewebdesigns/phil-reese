# wp-to-astro

A production-tested template for rebuilding WordPress sites as static **Astro 6 + Tailwind 4** sites on **Cloudflare Pages**, with **Mailgun** for forms. Distilled from a real WP→Astro migration (Joe's Vintage Guitars).

> 🤖 **If you're an AI agent (Claude / GPT / Gemini), read [`CLAUDE.md`](./CLAUDE.md) first, then [`CLAUDE-PROMPT.md`](./CLAUDE-PROMPT.md).** Those files are the operating manual. This README is for humans.

## What this template gives you

- Astro 6 + Tailwind 4 (via `@tailwindcss/vite`, no config file)
- Pre-built primitives: `Button`, `SectionHeader`, `PageHero`
- Full SEO `<head>` (12 OG tags, Twitter Card, canonical, JSON-LD slot)
- Sitemap generation via `@astrojs/sitemap`
- `trailingSlash: 'always'` to match WordPress URL shape
- Cloudflare Pages-ready: `public/_redirects`, `public/_headers`, `functions/api/contact.ts` (Mailgun stub)
- A single source of truth: `src/config/site.ts`
- A comprehensive [`CLAUDE.md`](./CLAUDE.md) playbook with page archetypes, visual audit checklist, and known Astro gotchas

## First-run setup

```bash
# Use Node 22 (see .nvmrc)
nvm use

# Fresh install
npm install
# (After the first install, on shared machines / CI, use `npm ci` for repeatable builds.)

# Dev server → http://localhost:4321/
npm run dev
```

## Per-client setup checklist

Work through these before writing any page code. The template fails loud — most TODOs are in files Astro/TS will flag.

1. **`src/config/site.ts`** — replace every `TODO`. Phone, email, address, nav, socials. Never hard-code these elsewhere.
2. **`src/styles/global.css`** — extract real hex values from the live site's DevTools, replace every `#TODO`. Don't eyeball colors.
3. **`astro.config.mjs`** — set `site: 'https://realdomain.com'`. This drives canonical URLs and the sitemap.
4. **`public/fonts/`** — drop in `.woff2` files; update `@font-face` in `global.css`; uncomment the `<link rel="preload">` in `Layout.astro`.
5. **`public/images/favicon.png`** and **`public/images/og-default.jpg`** (1200×630).
6. **Rename the CSS prefix:** `npm run setup:prefix -- <abbr>` (e.g. `jvg`, `mfwd`). Idempotent; warns if a previous prefix is detected mid-rename.
7. **`reference/`** — `curl -sL <live-url> > reference/<slug>-raw.html` for every page you'll rebuild. This is your ground truth.

## SEO migration (do not skip)

For a WordPress migration, ranking preservation lives or dies on this step.

1. **Export WP URLs.** From the WP admin or sitemap, get the list of every indexed URL.
2. **Populate `reference/seo-map.csv`.** One row per URL. Columns: `old_url, new_url, status, title, meta_description, h1, canonical, schema_type, notes`.
3. **Write 301s to `public/_redirects`.** Every `old_url` from the CSV that has a different `new_url` needs a redirect. Cloudflare's `_redirects` file limit is 2,100 lines — for larger maps use [Bulk Redirects](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/).
4. **Preserve titles + meta descriptions** unless the user explicitly approves rewrites.
5. **Verify canonicals match `trailingSlash: 'always'`** — every internal link and canonical URL should end in `/`.

## Cross-model visual review via Zen MCP

The `live-diff-auditor` agent now calls `mcp__zen__consensus` with Gemini + GPT as a required step. This is the difference between Claude self-auditing the page it just built (anchoring bias) and getting genuine adversarial review from different model families. See the [`Cross-model visual review` section in CLAUDE.md](./CLAUDE.md) for the rationale.

**Setup:**

1. Install [zen-mcp-server](https://github.com/BeehiveInnovations/zen-mcp-server). One-time per machine.
2. Configure API keys in zen's `.env`:
   ```
   GEMINI_API_KEY=...
   OPENAI_API_KEY=...
   ```
3. Verify Claude Code has the MCP loaded: in a session, run a Claude prompt like "list zen tools" — you should see `mcp__zen__chat`, `mcp__zen__consensus`, `mcp__zen__listmodels`, etc.

**Cost:** ~$0.02-0.05 per page audit (4 screenshots × 2 models). Negligible against the cost of shipping a regression.

**If Zen MCP isn't loaded** the auditor agent will skip cross-model review and flag the gap in its punch list — it won't silently no-op. You'll know which review layer was missing.

## Required env vars (Cloudflare Pages)

Set these in the CF Pages dashboard under Settings → Environment Variables when wiring Mailgun:

| Variable | Purpose |
|---|---|
| `MAILGUN_API_KEY` | Auth for the Mailgun POST in `functions/api/contact.ts` |
| `MAILGUN_DOMAIN` | Mailgun sending domain (e.g. `mg.example.com`) |
| `NOTIFY_TO_EMAIL` | Where contact-form submissions are delivered |

Local development of the function needs a `.dev.vars` file (gitignored automatically) with the same keys.

## Local Cloudflare Functions testing

The contact form POSTs to `/api/contact`, served in production by `functions/api/contact.ts`. To test locally with Wrangler:

```bash
npm run build
npm run cf:preview
# Wrangler serves dist/ + functions/ on http://localhost:8788/
```

`npm run dev` (vanilla Astro) does **not** serve the `functions/` directory — submissions return 404 (the contact-form script handles this as a dev stub). Use `cf:preview` whenever you need to test the real endpoint.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Astro dev server at `http://localhost:4321/` (no CF Functions) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the built site (static only, no Functions) |
| `npm run check` | TypeScript + Astro type check — must be 0 errors |
| `npm run validate` | `check && build` — **run this before declaring any page done** |
| `npm run cf:preview` | Wrangler local Pages preview (serves `dist/` + `functions/`) |
| `npm run check:site` | Fail loudly if `astro.config.mjs` `site` is still `example.com` / localhost / staging. Runs as part of `validate`. |
| `npm run check:todos` | Fail loudly if `TODO` placeholders remain in `src/config/site.ts` / `src/styles/global.css` / `src/pages/rss.xml.ts`. Override: `ALLOW_TODOS=1`. |
| `npm run audit:pre-launch` | Run every deterministic pre-launch check in sequence. Stub today; will expand over time. |
| `npm run audit:live-diff -- <live> <local>` | Deterministic live-vs-local diff (headings, images, videos, iframes, JSON-LD, broken hot-links) |
| `npm run audit:hero-luminance -- <img>` | Sharp-based brightness check for hero bgImages (header readability) |
| `npm run setup:prefix -- <abbr>` | Rename `site-` CSS prefix across `src/` to a client abbreviation |

## Deployment checklist

Before pointing the live domain at Cloudflare Pages:

- [ ] `npm run validate` passes with 0 errors (includes `check:site` gate that fails on `example.com` / staging URLs)
- [ ] **Cloudflare SSL/TLS mode = Full (Strict)**, NOT Flexible. Flexible + `trailingSlash: 'always'` = infinite redirect loop within minutes of going live.
- [ ] `astro.config.mjs` `site` is the production domain (not `example.com`)
- [ ] No `TODO` placeholders left in `src/config/site.ts` or `src/styles/global.css`
- [ ] Every row in `reference/seo-map.csv` either has a 301 in `public/_redirects` or resolves to a live route
- [ ] `/wp-content/uploads/` PDFs and indexed images have redirect coverage in `public/_redirects`
- [ ] All images are local (no hot-links to the WordPress origin)
- [ ] Every hero `bgImage` passes `npm run audit:hero-luminance -- <path>`
- [ ] `public/_headers` has cache rules for `/_astro/*`, `/fonts/*`, `/images/*`
- [ ] `src/pages/404.astro` exists, uses the same chrome as the rest of the site, and includes a search/contact prompt
- [ ] `src/pages/rss.xml.ts` is wired to real blog content; `/feed/ → /rss.xml` redirect in place
- [ ] `reference/form-map.csv` is filled in for every form; the field allowlist in `functions/api/contact.ts` covers all expected fields
- [ ] Honeypot field present in every form (`<input name="_honeypot">`)
- [ ] CF Pages env vars set: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `NOTIFY_TO_EMAIL`, `ALLOWED_ORIGIN`
- [ ] Optional: `TURNSTILE_SECRET_KEY` set and Turnstile widget added to forms
- [ ] Sitemap exists at `dist/sitemap-index.xml` after `npm run build`
- [ ] `robots.txt` points at the sitemap and allows indexing
- [ ] Custom JSON-LD pages pass [Google's Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Run [`CLAUDE-PROMPT.md`](./CLAUDE-PROMPT.md) "Release auditor" prompt against the repo

## File layout

```
src/
  layouts/Layout.astro          # site shell: <head>, JSON-LD slot
  pages/index.astro             # homepage (starter)
  components/primitives/        # Button, SectionHeader, PageHero
  config/site.ts                # single source of truth — fill TODOs first
  scripts/contact-form.ts       # POST handler for /api/contact
  styles/global.css             # @theme tokens — replace #TODO with real hex
public/
  _redirects                    # WP URL → new URL (301s) — populate before launch
  _headers                      # cache + security headers
  fonts/                        # drop .woff2 files here
  images/                       # favicon, OG default, raw image paths
functions/
  api/contact.ts                # Mailgun Pages Function — wire up before launch
reference/
  README.md                     # convention for live-site snapshots
  seo-map.csv                   # WP URL → new URL inventory (fill this in)
CLAUDE.md                       # full WP→Astro playbook
CLAUDE-PROMPT.md                # copy/paste prompt to start a new AI session
```

## Do not edit directly

- `dist/` — generated by `npm run build`
- `node_modules/` — generated by `npm install`
- `.astro/` — Astro's internal type cache

## Why the `vite` override in `package.json`?

`@tailwindcss/vite@4.3.0` is incompatible with Vite 8's rolldown backend. The override pins Vite to 7.x. When `@tailwindcss/vite` adds Vite 8 support, delete the `overrides` block.

## See also

- [`CLAUDE.md`](./CLAUDE.md) — the playbook (page archetypes, visual audit checklist, Astro gotchas, decision log)
- [`CLAUDE-PROMPT.md`](./CLAUDE-PROMPT.md) — copy/paste prompt for AI sessions
- [`reference/README.md`](./reference/README.md) — how to save and use live-site snapshots
