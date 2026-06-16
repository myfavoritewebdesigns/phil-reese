# WP → Astro Rebuild Playbook

Handoff doc for any WordPress → Astro static-site rebuild project.
**Read this first in every new session.**

---

## ⚠️ Must-follow rules (read before writing code)

These are non-negotiable without explicit user approval. If you find yourself about to break one, stop and ask.

1. **`src/config/site.ts` is the only place contact info, nav, socials, and hrefs live.** Never hard-code these in a component.
2. **`reference/` is ground truth.** When memory or existing code disagrees with `reference/<slug>-raw.html`, trust the reference file.
3. **Identify the [page archetype](#page-archetypes) before scaffolding.** Wrong archetype = structural rework.
4. **Count sections on the live URL before writing local sections.** Missing whole sections is the #1 cause of "looks way different" feedback.
5. **Preserve every design quirk from the live site** unless the user explicitly approves a change. Do not normalize inconsistent spacing/colors/layouts.
6. **Maintain SEO parity.** Every indexed WP URL needs a 301 in `public/_redirects` (or a matching live route). Update `reference/seo-map.csv` as you go.
7. **Images must be local before the end of the same session.** Hot-linking to the WordPress origin is allowed *only* for first-pass layout, and only inside a single session. Replace with local before moving to the next page. Normalizing broken hot-links across sessions hides real failures (broken URLs, missing alt text, CLS) that should fail loudly.
8. **`npm run validate` (= `check && build`) must pass with zero errors before any page is "done."**
9. **`npm run audit:live-diff -- <live-url> <local-url>` must show zero 🔴 must-fix items before any page is "done."** This is non-negotiable for SEO/structural parity. The script checks heading inventory, image counts, broken external image URLs (catches lazy-load + 404 issues), JSON-LD parity, and title/meta diff.
10. **For qualitative visual review, invoke the [`live-diff-auditor` agent](#live-diff-auditor-agent) — don't self-audit.** A model auditing its own work is anchored on what it built and misses what's missing. Spawn the auditor as a subagent and act on its punch list.
11. **Cross-model visual review via Zen MCP is required for every page, not just stuck ones.** The `live-diff-auditor` agent calls `mcp__zen__consensus` with Gemini + GPT after taking screenshots (step c4). If Zen MCP isn't loaded, the agent must flag that cross-model coverage was skipped — never silently. After 2+ failed attempts at the same visual problem, also engage the Gemini-second-opinion workflow with screenshots + the specific element/property in question.
12. **Append every intentional deviation to the [Decision log](#decision-log).** Future sessions will revert it otherwise.
13. **Every page must extend `Layout.astro`.** Tailwind v4 (`@tailwindcss/vite`) only injects CSS into routes that reach the import via the module graph. A page that skips Layout silently renders unstyled in production — sometimes only on prerendered routes, and often masked locally by browser CSS caching. There is no situation in this template where a page should render its own `<html>` directly.
14. **Pages Functions (`functions/api/*`) use Web APIs only — no Node SDKs.** Cloudflare Workers / Pages Functions run in V8 isolates, not full Node. `mailgun.js`, `form-data`, `aws-sdk`, anything depending on `fs` / `stream` / native `Buffer` — all silently fail at deploy despite working locally with `wrangler pages dev`. Use native `fetch`, `URLSearchParams`, `FormData`, `btoa`, `crypto.subtle`. The existing `functions/api/contact.ts` is the reference implementation.

---

## What this template is

A production-tested **Astro 6 + Tailwind 4** static site template, battle-hardened on a real WP→Astro migration (Joe's Vintage Guitars). Deploys to **Cloudflare Pages**. Forms use **Mailgun** via a CF Pages Function.

**Stack:**
- Astro 6 — island architecture, TypeScript strict, scoped CSS
- Tailwind 4 — `@theme` design tokens, no config file, via `@tailwindcss/vite`
- Cloudflare Pages — static hosting + serverless Functions
- Mailgun — transactional email for contact forms

**Goal of each rebuild:** exact visual parity with the live site. Do not normalize design quirks without asking the user.

---

## Source of truth hierarchy

When two sources disagree about how something should look, resolve in this order:

1. **User's stated preference.** Check the project memory file (`~/.claude/projects/*/memory/`) and the [Decision log](#decision-log) in this file. Users often intentionally deviate — don't revert without asking.
2. **The live site's rendered behavior.** Open the live URL. What visitors see is the spec.
3. **The live site's source HTML/CSS** (saved in `reference/`). Use for exact pixel values, JSON-LD, copy.
4. **Existing project code.** Useful but possibly wrong — half-finished sessions happen. Don't treat it as authoritative just because it compiles.

Before "fixing" something that already exists in code, ask: did a prior session do it deliberately? Check the decision log + `git log` first.

---

## Project setup — start here for a new client

### 1. Fill in `src/config/site.ts`

Every TODO in that file must be replaced before you build anything else. This is the single source of truth for phone, email, address, nav, and social URLs. **Never hard-code contact info or URLs directly in components.**

### 2. Extract design tokens from the live site

Open browser DevTools on the live WordPress site. Under Computed Styles on `body` / `h1` / `a`, find the real hex values. Replace every `#TODO` in `src/styles/global.css`.

Common places WP/Avada themes define their palette:
- CSS custom properties on `:root` (look for `--awb-*` or `--fusion-*` variables)
- The theme customizer output (often an inline `<style>` tag in `<head>`)
- Individual element styles inspected in DevTools

### 3. Drop in fonts

Place `.woff2` files in `public/fonts/`. Update `@font-face` in `src/styles/global.css`. Uncomment the `<link rel="preload">` in `Layout.astro`.

### 4. Add favicon + default OG image

- `public/images/favicon.png`
- `public/images/og-default.jpg` (1200×630)

### 5. Rename the CSS class prefix

The template uses `site-btn`, `site-hero`, `site-sh` etc. as neutral prefixes. Replace with a 2-4 letter abbreviation for the client (e.g. `jvg`, `mfwd`, `ap`):

```bash
npm run setup:prefix -- <abbr>
```

The script scans `src/`, `public/`, and `functions/` (NOT docs — `CLAUDE.md` / `README.md` keep `site-` as the documented neutral name). It's idempotent and detects mid-rename conflicts. Do not use a raw `Get-ChildItem` / `sed` replace — those don't catch partial-rename state and have caused mixed-prefix bugs in the past.

---

## File layout

```
src/
  layouts/Layout.astro          # site shell: <head>, Header, Footer, structured-data slot
  pages/
    index.astro                 # homepage
  components/
    Header.astro                # build per-project (no generic placeholder provided)
    Footer.astro                # build per-project
    FloatingCTAs.astro          # optional: fixed phone/SMS/email icons on side
    primitives/
      Button.astro              # CTA button: variant, size, pill — renders <a> or <button>
      SectionHeader.astro       # eyebrow + H2 + subhead + optional rule
      PageHero.astro            # non-homepage page hero (with bgImage, vignette, cta slot)
  config/
    site.ts                     # single source of truth: contact, hrefs, nav, socials
  scripts/
    contact-form.ts             # shared submit handler → POST /api/contact
  styles/
    global.css                  # @theme tokens, @font-face, base layer
  assets/images/                # imported by Astro <Image> → auto-WebP at build
public/
  _redirects                    # WP→Astro 301 map (populate from reference/seo-map.csv)
  _headers                      # cache + security headers
  fonts/                        # woff2 files (referenced by @font-face)
  images/                       # CSS background paths, favicons, OG
  scripts/                      # widget IIFEs served as static assets
reference/
  README.md                     # convention for live-site snapshots
  seo-map.csv                   # WP URL → new URL inventory (fill in as you go)
  form-map.csv                  # legacy form field → new payload key mapping
  <slug>-raw.html               # curl'd from live site, per page
functions/
  api/
    contact.ts                  # Cloudflare Pages Function for Mailgun
scripts/
  audit-live-diff.mjs           # deterministic live-vs-local diff (heading/img/picture/video/iframe/JSON-LD + multiset)
  audit-pre-launch.mjs          # stub: chains every deterministic pre-launch check; expand over time
  check-site-config.mjs         # gate: fails if astro.config.mjs `site` is example.com / staging
  check-todos.mjs               # gate: fails if TODO placeholders remain in site.ts / global.css / rss
  check-hero-luminance.mjs      # sharp-based brightness check on hero bgImages
  setup-prefix.mjs              # rename `site-` CSS prefix across src/ public/ functions/
  kill-chrome-zombies.ps1       # cleanup orphan chrome-devtools-mcp processes
.claude/
  agents/
    live-diff-auditor.md        # subagent for qualitative visual review
reports/                        # audit punch lists land here (gitignored writes)
CLAUDE.md                       # this file — operating playbook
CLAUDE-PROMPT.md                # copy/paste starter prompt for new AI sessions
```

---

## Page archetypes

**Identify the archetype before scaffolding.** This site has two distinct templates — wrong one means structural rework.

### Archetype A: Conversion pages

`/`, `/about/`, `/contact/`, `/service-pages/`, etc.

- Big `<PageHero>` with photo background, full-width
- Site Header is `position: absolute` over the hero (header text reads as white-on-dark-vignette)
- Heavy CTA placement (call/text/form CTAs every 2–3 sections)
- Designed to convert: form, trust signals, testimonials

**Hero image rule:** `bgImage` MUST be dark across the top ~120px for the white header text to remain readable. Bright photos (sky, reflections, glossy surfaces in the upper portion) fail this even with the vignette. Use them as `ogImage` only. Safe default: a dim interior photo.

**Scaffold (Archetype A — see Archetype B below, and the Blog Migration section for Archetype C):**
```astro
---
import Layout from "../layouts/Layout.astro";
import PageHero from "../components/primitives/PageHero.astro";
import Button from "../components/primitives/Button.astro";
import ContactSection from "../components/ContactSection.astro";
import { contact, hrefs } from "../config/site";
---
<Layout
  title="Page Title | Site Name"
  description="..."
  canonical="/page-slug/"
  ogImage="https://SITEURL/wp-content/uploads/.../featured.jpg"
  structuredData={...}
>
  <PageHero
    eyebrow="Short Label"
    title="Main Page Heading"
    subhead="Supporting subheadline"
    bgImage="/images/hero-background.jpg"
  >
    <Button slot="cta" href={hrefs.tel} variant="surface" size="lg">{contact.phone}</Button>
    <Button slot="cta" href="/contact/" variant="surface" size="lg">Contact Now</Button>
  </PageHero>

  <!-- page-specific sections -->

  <ContactSection />
</Layout>
```

### Archetype B: Reference / SEO pages

`/brand-serial-number-guide/`, `/how-to-read-X/`, blog posts

- **NO `<PageHero>`.** Page goes straight from header to content.
- **Header backdrop:** two solid bands the absolute header sits on — dark primary color for the nav row (~54px), white/light for secondary row (~56px + border).
- **Override secondary-nav link color** from white → dark via a body class + `<script is:inline>document.body.classList.add("page-X");</script>`.
- **Two-column layout at ≥1281px:** content max-width ~860px + fixed-position TOC sidebar (right: `max(24px, calc(50vw - 430px - 320px))`, width: 280px, top: 140px).
- Interactive widgets (decoder tool) appear above the H1 lede.
- Heavy tables, accordions, FAQ schema. Light CTAs (one near bottom, then ContactSection).

**How to decide:** open the live URL and look at the top 600px.
- Big photo hero + overlaid title → Archetype A
- No hero, page header on solid color band, tool or article body up top → Archetype B
- WP `/blog/`, `/blog/<slug>/`, `/category/<slug>/`, `/author/<slug>/` URLs → Archetype C (Content Collections — see [Blog migration](#blog-migration--content-collections--zod-archetype-c))

---

## Adding a new page — checklist

1. **Identify archetype** (see above). If unsure, open live URL.
2. Save live HTML: `curl -sL <url> > reference/<slug>-raw.html`
3. Count sections on the live page before writing any code.
4. Create `src/pages/<slug>.astro`.
5. Use `<SectionHeader>` for standard heading blocks (Archetype A) or inline H2 + 80px rule (Archetype B).
6. **Never hard-code** phone/email/address in components — always `import { contact, hrefs } from "../config/site"`.
7. Run through the [Visual audit + ship checklist](#visual-audit--ship-checklist) before declaring done.

---

## HTML-first section extraction — for chrome-heavy bespoke sections

For sections you'd otherwise spend 5–10 revisions re-implementing in Tailwind (parallax heroes, complex carousels, page-builder layouts with brittle pixel positioning, custom interactive widgets) the cheaper path is to capture the live section's rendered HTML and the CSS rules that actually styled it, then inject both into Astro via `set:html` + `<style is:global>` with wrapper-class scoping.

**When to use it instead of re-implementing:**

- You've already spent 2+ revisions on the section and the layout is still off.
- The section uses 50+ Avada/Fusion/Elementor wrapper divs and you can't trace which one owns the visual quirk.
- The section is decorative-only (no interactive state to maintain in Astro components).
- The client expects pixel parity, not a normalized redesign.

**When NOT to use it:**

- Sections that need to share design tokens with the rest of the site (the wrapper-scoped CSS won't pick up your Tailwind theme).
- Forms — they need to POST to `/api/contact`, which the extracted HTML won't do.
- Anything mobile-first or responsive in a way that depends on body-level CSS variables not present inside the wrapper.

**Usage:**

```bash
npm run extract:html-first -- <live-url> --selector "<css>" --slug <name>
```

Options:
- `--selector "<css>"` — REQUIRED. The CSS selector identifying the section to extract.
- `--slug <name>` — REQUIRED. Used as both the output directory name and the wrapper class (`.wp-extracted-<slug>`).
- `--viewport 1920` — Browser width. Use 390 if you only care about mobile layout.
- `--wait-selector "<css>"` — Wait for this selector before capturing (useful for carousels that mount on scroll).
- `--no-scroll` — Skip the auto-scroll pass (default scrolls section into view, then to page bottom, then back, so intersection-observer-driven CSS classes fire).

**What it produces in `reference/extracted/<slug>/`:**

| File | Purpose |
|---|---|
| `<slug>.html` | The section's outerHTML with absolute live-origin asset URLs |
| `<slug>.css` | Only the rules that actually styled the section, each prefixed with `.wp-extracted-<slug>` |
| `<slug>.snippet.astro` | Copy-paste integration: imports both files via `?raw`, wraps in the scoped div |
| `<slug>.assets.json` | Inventory of every `<img>` and `background-image:` URL — feed to the image migration step |
| `<slug>.report.md` | Summary (rules kept/dropped, asset count, caveats) |

**How the CSS scoping works (and what edge cases it handles):**

- Every plain selector gets `.wp-extracted-<slug> ` prefixed. Comma-separated lists are split first, then prefixed individually.
- Standalone `body` / `html` / `:root` selectors (with optional class qualifiers) map directly to the wrapper — since the wrapper IS the document root within its scope.
- `body.theme-x .foo` → `.wrapper .foo` (theme-class qualifier dropped — we have no `<body>` in our scope).
- `@media` / `@supports` / `@container` rules preserve their at-rule prelude; only inner selectors get scoped. Empty groups (all inner rules dropped) are themselves dropped.
- `@keyframes` and `@font-face` stay global (spec-required).
- `@import` is dropped — would re-fetch the entire upstream sheet at runtime.
- Rule filtering uses Chrome's CSS Coverage API to identify *used* rules, then a structural pass to keep only rules whose selectors reference an element in the section's subtree.

**Pre-launch checklist for any extracted section:**

1. Download every asset from `<slug>.assets.json` into `public/images/<slug>/` (or wherever your image migration lives) and rewrite the absolute URLs in `<slug>.html` to the local paths. **Hot-linking is single-session-only per the template's image migration rule** — extracted HTML defaults to absolute live-origin URLs for first-paint convenience, not as a permanent state.
2. Run `npm run audit:live-diff` against the page hosting the extracted section.
3. If the section needs JS interactivity (carousels, accordions, modal triggers), copy the original `<script>` tags into `public/scripts/<slug>.js` and load them with `<script src="/scripts/<slug>.js" is:inline></script>` in the page.
4. **Visually spot-check at 1920 / 390** — the section can still drift if the upstream WP site relied on viewport-rooted CSS variables (`--awb-*`, `--fusion-*`) defined in a `<style>` block that wasn't crawled by Coverage. If the section looks wrong, open the live page's HEAD for additional inline `<style>` and either copy those rules into `<slug>.css` manually or re-extract with a broader `--selector`.

**Limitations:**

- Cannot capture JS-driven layouts that mutate the DOM after page load (e.g., a slider that builds its own clones via `appendChild`). The extractor sees the initial DOM; clones added by JS later won't be in the captured HTML.
- Cannot capture computed-style overrides applied via `el.style.X = ...` (inline-style mutations from JS). Only stylesheet-driven CSS is extracted.
- `@import`-pulled stylesheets are dropped — if the section depends on one, inline its content manually.

---

## Porting WordPress widgets (interactive components)

The live site may have interactive decoder tools, calculators, etc. Follow this pattern:

**File convention:**
```
reference/
  <page>-raw.html              # Full live-site HTML (curl)
  _extract-<page>.cjs          # Node extraction script (strips Fusion/Avada wrappers)
  <page>-content.md            # Output of extract script (article body text)
  <widget>-html.html           # Just the widget's <div>...</div> markup
  <widget>.css                 # Widget's original CSS (reference only)
public/scripts/
  <widget>.js                  # Widget's IIFE script (static asset)
```

**Astro integration pattern:**
```astro
---
import widgetHtml from "../../reference/widget-html.html?raw";
---
<div set:html={widgetHtml} />
<script src="/scripts/widget.js" is:inline></script>

<style is:global>
  /* Widget CSS with original class names — NOT scoped, because set:html
     markup won't have Astro's scoped hash attribute. */
</style>
```

**Fix-ups before integrating:**
- Absolute URLs `href="https://www.site.com/..."` → relative `href="/..."`
- Anchor IDs that don't match your section IDs
- Image `src=` hot-link to live WP uploads on first pass, swap to local later

**Always add a `WebApplication` JSON-LD schema** so the tool is discoverable in search.

**Verify end-to-end** by entering known test inputs and confirming the decoder routes correctly.

---

## Page-builder source HTML — what to ignore

The live site's HTML in `reference/` is wrapped in builder chrome. Strip these:

**Avada / Fusion Builder:**
- `awb-toc-el`, `fusion-builder-row`, `fusion-layout-column`, `fusion-column-inner`, `fusion-builder-container`
- CSS custom properties prefixed `--awb-*` or `--fusion-*`

**Elementor:**
- `elementor-section`, `elementor-container`, `elementor-row`, `elementor-column`, `elementor-widget-wrap`, `elementor-element`
- CSS classes prefixed `elementor-`; massive amounts of inline `style="..."` on wrapper divs
- Inline `<style>` blocks injected per-section by Elementor's CSS-in-PHP renderer

**Divi:**
- `et_pb_section`, `et_pb_row`, `et_pb_column`, `et_pb_module`
- CSS prefixed `et_pb_` / `et-pb-`

**Gutenberg (block editor):**
- `wp-block-*` classes are usually safe to keep or transform — they're semantic enough
- `is-layout-flow`, `is-layout-constrained` flex/grid wrappers can usually be dropped in favor of Tailwind

Extract the **inner content** — headings, paragraphs, images, widget HTML — and discard wrapper chrome. The `_extract-*.cjs` scripts in `reference/` strip the worst of it.

### Featured Image duplication

WordPress stores the post's Featured Image as a separate database field but most themes render it at the top of the post body. Authors, unsure of the theme behavior, often paste the same image into the rich-text editor too. Result: the same image appears twice in the rendered HTML.

If your migration script pulls Featured Image + post body separately and renders both, you double-render. If extracting from live HTML (this template's approach), you replicate whatever the live site shows — usually fine, but worth a sanity check when migrating any blog: open a few posts on live, check whether the first body image is the same file as the Featured Image. If so, strip it from the body during extraction or you'll ship visible duplicates.

---

## Visual audit + ship checklist

**The side-by-side comparison is the step that catches headline mistakes.** Don't skip it.

### Sequence

1. **Section count first.** Scroll the live URL top-to-bottom, list every section. Scroll your local page. Numbers don't match → stop and find what's missing before any pixel work.

2. **Side-by-side screenshots at 1920px** (matches a typical full-HD user screen — see `feedback_viewport_standard.md` in user memory). Full-page captures of both live and local. Read them as images. Scan for: sections present, color rhythm, heading hierarchy, image positions. **Always cross-check disputed visual claims with `browser_evaluate` querying `getComputedStyle` on the live page** — image thumbnails in agent context downscale enough that B&W photos can read as "rust gradient noise."
   ```js
   // Via Playwright MCP (preferred — handles full 1920px viewport cleanly)
   await browser_navigate({ url: "https://www.LIVE-SITE.com/page/" });
   await browser_take_screenshot({ filename: "audit-live-1440.png", fullPage: true });
   await browser_navigate({ url: "http://localhost:4321/page/" });
   await browser_take_screenshot({ filename: "audit-local-1440.png", fullPage: true });
   ```

3. **Test every interactive widget on both sites.** Decoder tools, accordions, video embeds, forms. One happy-path click-through each.

4. **Header / footer contrast check.** At 1920px, is every nav link readable against whatever's behind it?

5. **Responsive at 4 viewports:** 1920 / 1280 / 768 / 390. Watch for:
   - Mobile overflow (content off-screen)
   - Missing `flex-wrap` on nav rows
   - Tables that need horizontal scroll wrappers
   - Sidebars not collapsing cleanly
   - Fixed floating CTAs overlapping body text

6. **Type check + console:** `npm run validate` → 0 errors, browser console → 0 errors.

7. **Run the static audit** (deterministic — catches things human eyes miss):
   ```bash
   npm run audit:live-diff -- <live-url> <local-url> --slug <slug>
   ```
   Fix every 🔴 must-fix item. Re-run until the report shows 0 🔴 items.

8. **Spawn the `live-diff-auditor` agent** for the qualitative pass. Pass it both URLs and the static audit report path. The agent will internally call `mcp__zen__consensus` (Gemini + GPT) on the screenshots as its step c4 — cross-model coverage is built into the agent, not a separate step. Act on its combined punch list.

9. **Force-load lazy images before any screenshot.** `<img loading="lazy">` images don't fetch until near viewport. Anchor jumps mid-page bypass that, making them appear missing. Before screenshotting:
   ```js
   await browser_evaluate({ function: `() => document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager')` });
   await browser_wait_for({ time: 5 });
   ```

10. **Sanity:** if anything looks different from live and you can't explain it in one sentence, it's a real bug. Don't ship.

---

## Tooling decisions (hard-won)

### Screenshot tool choice

**Use Playwright MCP (`mcp__plugin_playwright_playwright__*`) for visual audits.** It handles real viewport sizes up to 1920 and captures full-page screenshots correctly.

**Do NOT use chrome-devtools-mcp for screenshots** — it caps viewport at ~1280–1540 even when you request 1920. It hides desktop bugs.

**Do NOT use Claude Preview's screenshot tool for full-page captures** — it only captures the top of the page.

Chrome DevTools MCP is still useful for Lighthouse audits and DOM inspection.

**Name screenshots descriptively:** `audit-<page>-live-1440.png`, `audit-<page>-local-390.png`. Generic names like `screenshot.png` are useless 5 tool calls later.

### Stale Chrome processes

Chrome DevTools MCP tends to leave zombie Chrome processes. If it complains "browser already running," kill stale processes whose CommandLine matches `chrome-devtools-mcp`.

---

## My known limitations — be honest about these

- I sometimes mis-read screenshots, especially side-by-side comparisons. Subtle spacing/color differences don't always register.
- I can't perceive hover states, transitions, scroll-triggered behavior, or font rendering from a static screenshot.
- I over-anchor on what the code "says it does" instead of what's actually rendered.
- When self-audits return "matches" after a structural change, I might be wrong.

### When to stop and ask the user

- 2+ rounds of fixes haven't resolved the same issue.
- The user has said "still wrong" twice in a row.
- I'm about to make a third structural change to the same component.
- The same element keeps surfacing in feedback.

### How to ask well

Don't ask "what do you want?" — that punts work back. Ask specifically:

> "I've made [N] attempts. Here's what I see: [describe in plain words]. Here's what I think the fix is: [describe]. Can you:
> (a) screenshot the problem and annotate what's wrong, or
> (b) describe the difference more specifically (element, property, viewport), or
> (c) screenshot both to Gemini/another AI and paste back the prompt it generates?"

### The Gemini second-opinion workflow

When stuck after 2+ attempts:
1. User screenshots live vs. local
2. Uploads both to Gemini: "What differences do you see? Generate a Claude Code prompt with the exact element, property, and value to fix."
3. User pastes Gemini's prompt back.

This works because the other AI sees the problem fresh without your anchoring bias. **Suggest this proactively** when you've made 2+ unsuccessful attempts.

### Same-model parallel review is NOT independent

It's tempting to spawn a second Claude subagent and treat consensus between the two as confirmation. **Don't.** Two instances of the same Claude model share weights, training data, and biases — they will make **correlated errors** on the same input. If model #1 misses a missing pill button due to a training artifact, model #2 likely misses it too. Consensus from same-model parallel review is false confidence.

Use same-model parallel review for **breadth** (covering more checks in less wall time). Use **cross-model review** (Gemini, GPT, a larger Claude reviewing a smaller one) for **depth** (catching things this model is systematically blind to). They are different tools for different problems — don't conflate them.

### Cross-model visual review via Zen MCP — required, not optional

The `live-diff-auditor` agent now calls `mcp__zen__consensus` with Gemini and GPT as a required step (c4) after taking screenshots. The rationale is operationalized in step c4 of `.claude/agents/live-diff-auditor.md`:

- Claude doing its own visual comparison after building a page = anchoring bias. It sees what it built, not what's missing.
- Two different model families looking at the same image pair catch what Claude misses, especially:
  - Subtle color drift
  - Missing UI elements positioned where Claude expects something else to be
  - Visual hierarchy errors (heading weight, button styling) that look "close enough" to Claude
  - Mobile-specific layout breakage at 390px

**Required environment:**
- Zen MCP (`zen-mcp-server`) loaded in the Claude Code session
- Gemini API key configured in zen's `.env` (`GEMINI_API_KEY`)
- OpenAI API key configured (`OPENAI_API_KEY`)
- Models accessible: at minimum `gemini-2.5-pro` and one GPT vision model (`gpt-5`, `gpt-4o`, or whatever's current — call `mcp__zen__listmodels` to discover)

**Cost expectation:** ~$0.02-0.05 per page audit (4 screenshots × 2 models). A 15-page site rebuild ≈ $0.30 in API spend, which is negligible against the cost of shipping a visual regression.

**Graceful degradation:** if Zen MCP isn't loaded in a given session, the agent must add a 🟡 item flagging that cross-model coverage was skipped. It must not silently no-op — the main agent needs to know which review layer was missing before deciding whether to ship.

**Iterative loop integration:** the consensus output becomes part of the punch list the main agent acts on. After the main agent fixes the items, re-invoke `live-diff-auditor` and re-run cross-model review on the updated screenshots. Loop until 🔴 is empty across all three layers (static, Claude qualitative, cross-model consensus).

---

## live-diff-auditor agent

There's a dedicated subagent at `.claude/agents/live-diff-auditor.md` whose only job is to compare a finished local page to its live original and produce a punch list. **Invoke it before declaring any page done.**

Workflow:
1. Build the page.
2. Run `npm run audit:live-diff -- <live-url> <local-url> --slug <slug>`. This runs the deterministic checks (heading inventory, image counts, broken external URLs via HEAD, JSON-LD parity, title/meta diff, trailing-slash sanity). It writes a report to `reports/<slug>-audit-<timestamp>.md` and exits non-zero if any 🔴 must-fix items exist.
3. Spawn the `live-diff-auditor` agent. Pass it the live URL, the local URL, and the path to the report from step 2. It adds the qualitative visual layer: forced eager-load image checks, side-by-side screenshots at 1440 and 390, interactive widget inventory, anchor-jump tests.
4. Act on the merged punch list. Don't ship until the 🔴 bucket is empty.

**Why this exists:** the JVG fender-SN page shipped with one broken hot-linked image (`fender-back-of-headstock-serial-number-scaled.jpg`, 404) and a perceived "missing images" bug at `#custom-shop-serials` caused by lazy-load + anchor jump. The main agent's self-audit missed both because (a) it never asserted images actually loaded, and (b) it never HEAD-checked hot-link URLs. The auditor agent + script combination catches both classes of bug because they're explicit deterministic checks, not "look and see."

---

## Image gallery primitive — use for ANY group of 2+ comparison images

WordPress reference pages (serial-number guides, "how to spot fakes," dating guides) almost always group multiple figures into a CSS-grid gallery. The default per-figure render stacks them vertically — **which is the wrong layout** and silently passes every check based on image count, because the count matches; only the grouping is off.

This bit JVG's fender-SN page hard: 15 image groups (40 figures total) shipped as vertical stacks before the user spotted it visually. The static audit's image-count diff was 0. The lesson: count-equal != layout-equal.

### When to use it

If you're about to write 2+ `<figure>` elements as direct siblings, you almost certainly want them in a grid. Use the primitive in `src/styles/global.css`:

```astro
<div class="site-img2 site-img--uniform">
  <figure class="site-imgwc">
    <img src="..." alt="..." width="800" height="600">
    <figcaption class="site-cap">76-prefix example</figcaption>
  </figure>
  <figure class="site-imgwc">
    <img src="..." alt="..." width="800" height="600">
    <figcaption class="site-cap">S-prefix example</figcaption>
  </figure>
</div>
```

| Class | Use when |
|---|---|
| `.site-img2` | 2 figures, or 4 figures (renders 2×2), or 6 figures (renders 2×3) |
| `.site-img3` | 3 figures (renders as a row); 5 figures (3+2); 6 figures (2×3). Collapses to 2-col at <950px, 1-col at <600px |
| `.site-img--uniform` | Add to the wrapper when comparing like-for-like (serial-number prefix variations, headstock styles). Forces 220px image height + `object-fit: cover` so eye scans across without size noise. Skip for non-comparison galleries (mixed-aspect-ratio photos) |
| `.site-imgwc` | Required on each `<figure>` — gives flex-column layout for image + caption |
| `.site-cap` | Caption styling (italic, muted, centered) |

For >6 figures: split into multiple galleries with subheadings.

### Detection rule (run before declaring any page done)

The static audit script now reports consecutive `<figure>` runs. If `🟡 Should fix` shows "figure-run pattern differs" or "🔴 Must fix" shows "N figure(s) in consecutive run(s) on local but live has none," fix the grouping with the primitive above. Or grep manually:

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('src/pages/<page>.astro','utf-8');const r=/<figure[^>]*>[\s\S]*?<\/figure>\s*<figure/g;console.log('consecutive figure runs:', (h.match(r)||[]).length)"
```

If that prints anything but 0, every run needs to either be wrapped in `.site-img2` / `.site-img3` or verified against the live site as intentionally-stacked.

### Why a project-wide primitive instead of per-page styles

Each WP reference page tends to have many image groups (JVG fender-SN had 15). Per-page styles result in duplicated grid CSS, drift between pages, and silent regressions. The primitive in `global.css` is one source of truth — every page on the site gets the same grid behavior with one class change.

---

## Astro gotchas (hard-won)

### Scoped CSS vs. `set:html` content

Astro's default scoped `<style>` block rewrites selectors with a hash (`.foo` → `.foo[data-astro-cid-xyz]`). Markup injected via `set:html` won't have that attribute, so scoped rules won't match. **Use `<style is:global>` for any styles targeting `set:html` content** (e.g., imported widget HTML).

### Injected widget CSS — wrap or it bleeds

WordPress page builders (Avada/Fusion, Elementor, Divi) generate CSS with heavy `!important` usage and broad selectors (`.elementor-button`, `.fusion-row`, raw `h2`, etc.). When you `<style is:global>{widgetCss}</style>`, those rules apply site-wide — they will override your Tailwind tokens and your primitives on other pages.

**Always scope injected widget CSS to a wrapper class** on the importing page:

```astro
---
import widgetHtml from "../../reference/fsn-tool-html.html?raw";
import widgetCss from "../../reference/fsn-tool.css?raw";
// Prepend the page wrapper to every selector at build time:
const scoped = widgetCss.replace(/(^|\})\s*([^{}@]+)\s*\{/g, '$1 .fsn-scope $2 {');
---
<div class="fsn-scope" set:html={widgetHtml} />
<style is:global set:html={scoped}></style>
```

The wrapper class (e.g. `.fsn-scope`) appears once on the imported widget's outer div. Every injected rule is then prefixed with it, so the widget's CSS can't escape its container. Use a different wrapper class for each imported widget.

For widgets where the regex prefix is too fragile (deeply nested @media queries, comma-separated selectors), copy the CSS into a `<style is:global>` block manually and add the wrapper prefix by hand.

### Astro `<Image>` with aspect-ratio CSS — audit may false-positive

`scripts/audit-live-diff.mjs` flags `<img>` tags without `width` + `height` as a CLS risk. Astro `<Image>` components normally set both attributes automatically. But a developer can use `aspect-ratio` CSS instead and omit the attributes — visually equivalent, no CLS, but the audit will still flag it.

Treat the audit output as advisory for these cases. If a flagged image is intentionally controlled via `aspect-ratio` CSS, add `data-audit-ignore-cls="true"` to the tag and the auditor will skip it in a future revision. For now, just verify visually that there's no actual layout shift.

### Stale Vite CSS cache

Astro's dev server sometimes caches a component's CSS from a previous version even after edits. If styles aren't applying despite the source being correct, add a no-op comment inside the `<style>` block to force Vite to re-parse. Restarting the server alone doesn't always clear it.

### `margin` shorthand vs. Tailwind classes

If you set `margin` in a scoped `<style>` block using the shorthand (e.g., `margin: 0 auto 48px`), it overrides any Tailwind `mt-*` class. Use individual properties (`margin-top`, `margin-left`, etc.) if you need Tailwind classes to control one side independently.

### `background-size: cover` on small source images

A low-resolution source image stretches and pixelates with `background-size: cover`. Opt for a solid color fallback or source a higher-resolution replacement.

### JSON-LD on every page

`Layout.astro` injects the global Organization + WebSite schemas. Pages pass `structuredData={...}` for page-specific schemas (FAQPage, Article, WebApplication, etc.). **Don't duplicate the global schemas in page-level JSON-LD.**

### Hero image contrast

The Header is `position: absolute` with white text. Any `bgImage` passed to `<PageHero>` must be dark across the top ~120px. Test at 1920px — this is the most common breakage point for new page heroes.

### Avada/Fusion page source

Live HTML in `reference/` is wrapped in Fusion Builder divs. Ignore: `awb-toc-el`, `fusion-builder-row`, `fusion-layout-column`, `fusion-column-inner`, `--awb-*` CSS vars. Extract the inner markup.

---

## SEO migration — first-class workflow

WP migrations live or die on ranking preservation. The template gives you two files; **fill them in as you go, not at the end.**

### `reference/seo-map.csv`

One row per indexed WordPress URL. Columns: `old_url, new_url, status, title, meta_description, h1, canonical, schema_type, notes`.

How to populate:
1. Pull every URL from the WP sitemap (`<live-site>/sitemap_index.xml`) or WP admin export.
2. For each row, decide: does this URL move (`new_url` differs) or stay (`new_url` same)?
3. Preserve the WP `title` and `meta_description` unless the user approves a rewrite.
4. Record the page's H1 and intended JSON-LD `@type` so future sessions don't drift.

### `public/_redirects`

For every row in `seo-map.csv` where `old_url ≠ new_url`, add a 301:
```
/old-slug/    /new-slug/    301
```
Wildcards work: `/wp-content/uploads/*  /images/legacy/:splat  301`.

`_redirects` has a 2,100-line limit. Larger maps go in [Cloudflare Bulk Redirects](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/) at the account level.

### `/wp-content/uploads/` — don't abandon asset URLs

`seo-map.csv` and `_redirects` should cover **PDFs, docs, and indexed images** too, not just HTML pages. WP uploads accumulate backlinks (linked from emails, social posts, partner sites) and Google indexes them as standalone results. Skipping them = silently losing every link to a download or image asset.

Two strategies:
1. **Preserve filenames** (recommended): copy uploads to `public/documents/` and `public/images/legacy/` keeping the original filenames; map `/wp-content/uploads/*` → `/images/legacy/:splat`.
2. **Renamed**: only if you're consolidating. Map each old → new explicitly in `_redirects`.

### RSS feed continuity

WordPress serves `/feed/` automatically. Aggregators, email tools (Mailchimp/Klaviyo RSS-to-Email), and directory submissions depend on it. **Breaking the feed silently breaks downstream automation.**

The template includes `src/pages/rss.xml.ts` (uses `@astrojs/rss`) and a `/feed/ → /rss.xml` 301 in `public/_redirects`. Wire the feed up to your blog content (the file has TODO comments). Don't skip this for any site that has a blog.

### Structured data depth

`@type` presence checks (which the live-diff audit script does) catch the worst regressions, but they don't catch *invalid* schemas. An `Article` missing `publisher` or `dateModified`, a `LocalBusiness` missing `geo`, etc., still passes type-presence but triggers Google Search Console errors.

Before launch, paste production URLs into [Google's Rich Results Test](https://search.google.com/test/rich-results) for any page with custom JSON-LD. Fix anything it flags.

### Blog migration — Content Collections + Zod (Archetype C)

Sites with a WP blog use a third archetype that lives entirely in Astro Content Collections. Posts are MDX files in `src/content/blog/`; archives and taxonomy pages are generated from the collection. Schema is validated at build time via Zod (`src/content/config.ts`) — a malformed post (missing description, bad date, unknown author) fails `astro check` loudly, which is the entire point.

**Routes generated:**

| Pattern | File | Purpose |
|---|---|---|
| `/blog/`, `/blog/page/N/` | `src/pages/blog/[...page].astro` | Paginated archive (10 posts per page) |
| `/blog/<slug>/` | `src/pages/blog/[slug].astro` | Single post — Article JSON-LD, prev/next nav |
| `/category/<slug>/`, `/category/<slug>/page/N/` | `src/pages/category/[slug]/[...page].astro` | Category archive |
| `/tag/<slug>/`, `/tag/<slug>/page/N/` | `src/pages/tag/[slug]/[...page].astro` | Tag archive |
| `/author/<slug>/`, `/author/<slug>/page/N/` | `src/pages/author/[slug]/[...page].astro` | Author archive — Person JSON-LD |
| `/rss.xml` | `src/pages/rss.xml.ts` | Reads from the same collection |

All archives inject `<link rel="prev">` / `<link rel="next">` into `<head>` via Layout's `head` named slot — the SEO signal that consolidates link equity across paginated pages.

**The three load-bearing files:**

1. **`src/content/config.ts`** — Zod schema. Defines what every post's frontmatter MUST contain (title, description, pubDate, author, etc.). Add fields here when you need them; the importer will populate them.
2. **`src/lib/blog.ts`** — Shared helpers (`getPublishedPosts`, `getAllCategories`, `getAllTags`, `getAllAuthors`, `getAdjacentPosts`, `slugify`, `formatDate`). The single place draft filtering happens — listing pages, RSS, and sitemap all read posts through `getPublishedPosts()`.
3. **`scripts/import-wp-blog.mjs`** — WP REST API → MDX importer. Run with `npm run import:wp-blog -- --from https://live-site.com [--download-images] [--seo-map]`. Pulls every published post via `/wp-json/wp/v2/posts?_embed=1`, paginates correctly via `X-WP-TotalPages`, and writes one MDX file per post.

**Workflow:**

1. Run `npm run import:wp-blog -- --from <wp-site> --download-images --seo-map` against the live WP site. This writes MDX into `src/content/blog/`, downloads featured images into `public/images/blog/`, and appends rows to `reference/seo-map.csv`.
2. Inspect a sample of generated MDX files. The importer **warns about** (a) descriptions shorter than 20 chars and (b) unexpanded WP shortcodes — both require hand-edits.
3. Run `npm run check`. The Zod schema validates every post; anything malformed fails loudly with a per-field error message.
4. Spot-check a few posts in the browser (`npm run dev` → `/blog/<slug>/`) for body content, featured image, schema, and prev/next nav.
5. Run `npm run audit:live-diff -- <live-blog-url> <local-blog-url>` against the blog index and a sample post.
6. If the WP site used a non-default permalink (`/<year>/<month>/<slug>/`, `/<category>/<slug>/`, etc.), the live URLs won't match the new `/blog/<slug>/` shape — every legacy URL needs a 301 in `_redirects`. The `--seo-map` flag populates this; verify it manually.

**WP shortcodes the importer doesn't expand:** `[gallery]`, `[caption]`, `[embed]`, theme-specific Builder blocks (Visual Composer / Elementor / Avada page-builder shortcodes). These ship to MDX as-is; the importer warns when it finds them. Hand-edit each affected file, replacing the shortcode with a real HTML/MDX equivalent or a custom component.

**Author profile completeness matters for SEO.** Author archive pages with only a name and a list of posts are flagged by Google as "thin content." When the importer can pull bio/avatar/URL from the WP user profile (`description`, `avatar_urls`, `url`), it does. If your client's site stored bios in ACF custom fields, you'll need to either extend the importer to read those fields or hand-edit the frontmatter post-import.

**Custom Post Types (CPTs):** If the source site has case studies, FAQs, products, etc., add a new collection in `src/content/config.ts` following the `blog` shape, then add a corresponding archive page. The importer currently only pulls `wp/v2/posts`; extend it to also pull `wp/v2/<cpt_slug>` if needed.

### Pre-launch SEO verification

Before deploy, confirm each item:
- Every `old_url` in `seo-map.csv` returns 200 (it's a live route) or 301 (redirected).
- Asset URLs in `/wp-content/uploads/` have redirect coverage (not just HTML pages).
- Titles and meta descriptions match the WP originals unless intentionally rewritten.
- No duplicate H1s on any page.
- Canonicals end in `/` (matches `trailingSlash: 'always'`) and use the production domain.
- FAQ JSON-LD only appears on pages with a visible FAQ section.
- Every page with custom JSON-LD passes [Google's Rich Results Test](https://search.google.com/test/rich-results).
- `dist/sitemap-index.xml` exists after `npm run build` and lists every public route.
- `dist/rss.xml` exists and is valid (paste into [W3C feed validator](https://validator.w3.org/feed/)).
- `robots.txt` points at the sitemap and allows indexing.
- 404 page exists at `src/pages/404.astro` and uses the same chrome as the rest of the site. Include the site nav and a search/contact prompt — WP 404 pages often contain custom search forms; preserve that traffic-recovery affordance.

---

## Form migration — payload continuity

Rebuilding a form visually is not enough. CF7, Gravity Forms, and Ninja Forms each have their own field-naming schemes (`your-name`, `input_3`, etc.) that downstream systems (CRMs, Zapier hooks, autoresponders) are wired to.

**Before scaffolding any form:** populate `reference/form-map.csv`. Columns: `legacy_form_id, legacy_field_name, new_payload_key, type, required, notes`. This is the spec for what the new form must send to keep downstream integrations working.

If the client's CRM expects `your-email`, send `your-email`, not `email`. If their Zapier hook listens for `input_5`, name your new field `subject` and add a server-side rename in `functions/api/contact.ts` before POSTing to Mailgun/the CRM.

---

## Image migration — hot-link is single-session-only

The "hot-link then swap" pattern is allowed for first-pass layout, but **every image must be swapped to local before the end of the same session.** Carrying hot-links across sessions normalizes broken images and you stop noticing failures.

Hot-linking is dangerous because:
- The WordPress origin may be torn down post-migration → every image 404s.
- Hot-linked images bypass Cloudflare's cache → slow page loads.
- Cross-origin images can't have width/height inferred → CLS (Cumulative Layout Shift).
- Astro's `<Image>` component refuses unauthorized remote domains by default.
- **Lazy-loaded hot-links + anchor jumps = silent missing-image bugs.** If a user clicks a link to `/page/#section-mid-page`, `<img loading="lazy">` images in that section haven't started fetching yet. They appear blank for 1–2 seconds. Visual audits miss this unless the auditor explicitly forces eager loading before screenshotting (see the [live-diff-auditor agent](#live-diff-auditor-agent)).
- **Broken hot-links survive every visual check** unless you HEAD-request each image URL. JVG's `fender-back-of-headstock-serial-number-scaled.jpg` (404) survived 4 prior audit passes because no check actually verified the URL responded 200.

Pre-launch image checklist (per image):
- [ ] Downloaded to `public/images/<page>/` or `src/assets/images/<page>/`
- [ ] Compressed (use [Squoosh](https://squoosh.app/) or `sharp` if scripting)
- [ ] Renamed descriptively (not `IMG_4523.jpg`)
- [ ] `width` and `height` attributes set (or used via Astro's `<Image>`)
- [ ] `alt` text matches what's on the live site, or improves it where missing
- [ ] If used as a hero `bgImage`, dark across top ~120px (header contrast rule)
- [ ] **`npm run audit:live-diff` reports 0 broken external image URLs**

---

## Contact form endpoint — security checklist

`functions/api/contact.ts` ships hardened by default. Before deploy, verify all of these:

### Required env vars (set in CF Pages dashboard)

| Variable | Purpose |
|---|---|
| `MAILGUN_API_KEY` | Auth for the Mailgun send |
| `MAILGUN_DOMAIN` | Sending domain (e.g. `mg.example.com`) |
| `NOTIFY_TO_EMAIL` | Where submissions are delivered |
| `ALLOWED_ORIGIN` | **Required.** Production origin (e.g. `https://www.example.com`). Reject submissions from anywhere else. |

### Optional but recommended

| Variable | Purpose |
|---|---|
| `TURNSTILE_SECRET_KEY` | Enable Cloudflare Turnstile bot challenge. When set, the endpoint requires a `cf-turnstile-response` field in the payload and verifies it server-side. |
| `RATE_LIMIT_KV` | KV namespace binding for per-IP rate limiting (5 requests / 60 seconds). **Advisory only** — see below. |

### Form-side requirements

Every form on the site must include:

```html
<!-- Honeypot — invisible to humans, irresistible to bots. Endpoint silently
     drops any submission with this field non-empty. -->
<input type="text" name="_honeypot" tabindex="-1" autocomplete="off"
       style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
```

If using Turnstile, also include the widget per [CF docs](https://developers.cloudflare.com/turnstile/get-started/) and ensure the `cf-turnstile-response` field gets included in the POST payload.

### What the endpoint already enforces

- CORS locked to `ALLOWED_ORIGIN` (no wildcard); production fails closed if env var is missing or `Origin` is `null`/unexpected
- 50 KB payload cap enforced on the actual body (not just `Content-Length` header — chunked / header-less bodies are still capped)
- Per-field 5,000 char cap
- Field allowlist (anything not in `ALLOWED_FIELDS` is dropped — extend the set in `contact.ts` for client-specific fields)
- **Required-field rule per `formId`** — endpoint rejects empty/near-empty submissions even if they pass the allowlist
- Email format validation
- CRLF stripping (prevents Mailgun header injection)
- Generic error responses (no internal config / stack traces leaked to client)

### ⚠️ Rate-limiting: KV is advisory only

The `RATE_LIMIT_KV` binding implements a per-IP counter via `get`/`put`. **This is non-atomic** — concurrent submissions can race through the check. It is a defense-in-depth layer only.

The **primary rate-limit must be a Cloudflare WAF rate-limiting rule** on `/api/contact`, configured at the zone or account level. WAF rules are atomic, run at the edge before the function executes, and don't burn function CPU on attacker traffic.

CF Dashboard → Security → WAF → Rate-limiting rules → "If incoming requests match: URI path equals `/api/contact` and method equals `POST`, then block for 60s when exceeding 10 requests in 60s per IP."

### ⚠️ Don't add sensitive fields to ALLOWED_FIELDS without redaction

The Mailgun text body is constructed by joining every entry in `clean` (the field-allowlisted payload). Any field added to `ALLOWED_FIELDS` lands verbatim in the outbound email. If a client form ever adds genuinely sensitive data (SSN, full card number, internal customer IDs), either keep it OUT of `ALLOWED_FIELDS` or add explicit redaction before the `text` body join.

### Mailgun setup (when ready)

1. Existing forms should have `data-site-contact-form` and `data-form-id="<source>"`.
2. `src/scripts/contact-form.ts` POSTs to `/api/contact`.
3. Set the env vars above in CF Pages dashboard.
4. Configure Mailgun domain DNS: MX, SPF, DKIM records.

---

## Deploying to Cloudflare Pages

1. Push project to GitHub.
2. CF Dashboard → Pages → Connect Git → select repo.
3. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output: `dist`
4. Add env vars (Mailgun keys etc.) under Settings → Environment Variables.
5. Configure routing files in `public/` (each has a distinct purpose — don't confuse them):
   - **`public/_redirects`** — URL redirects. Use for WP→Astro 301s. Limit: 2,100 lines. For larger maps, use [Cloudflare Bulk Redirects](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/) at the account level.
   - **`public/_headers`** — HTTP headers (cache rules, security headers like X-Frame-Options, CSP).
   - **`functions/_routes.json`** — *only* for controlling which Pages Functions execute on which paths. Not for redirects or cache.
6. `@astrojs/sitemap` is already wired in `astro.config.mjs` — `npm run validate` will fail the build if `site` is still `example.com`.
7. **Verify Cloudflare SSL/TLS mode = "Full (Strict)"** under Dashboard → SSL/TLS → Overview (see below).

### ⚠️ Cloudflare SSL mode — "Flexible" + `trailingSlash: 'always'` = infinite redirect loop

This is a launch-day brick. If Cloudflare SSL is set to **Flexible**, it terminates HTTPS at the edge and forwards HTTP to the origin. Pages then 301s the HTTP request to the trailing-slash version, Cloudflare wraps the response in HTTPS, browser re-requests, Cloudflare strips HTTPS again, origin redirects again → `ERR_TOO_MANY_REDIRECTS`. The site is dead within minutes of going live and crawlers permanently lose access.

**Fix:** CF Dashboard → SSL/TLS → Overview → set encryption mode to **Full (Strict)**. This makes Cloudflare connect to the origin over HTTPS with cert validation, breaking the recursive loop. Do this BEFORE pointing the production domain at Pages.

This is true for any Astro site with `trailingSlash: 'always'`, which this template defaults to (matching WordPress's URL shape — non-negotiable for SEO continuity).

### Query parameters in `_redirects`

Cloudflare Pages `_redirects` **strips query parameters during matching and forwarding**. For most WP migrations this is fine, but for clients with significant paid-ad traffic (UTM, gclid, fbclid, custom tracking) it silently destroys attribution.

If the client runs paid ads or relies on parameterized URLs for analytics:
- Use [Cloudflare Transform Rules](https://developers.cloudflare.com/rules/transform/url-rewrite/) (Dashboard → Rules → Transform Rules) for redirects that need to preserve query strings.
- Or use [Bulk Redirects](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/) at the account level, which support query forwarding and scale to 20,000+ rules.
- `_redirects` is fine for static path-only mappings (the majority of WP migrations).

### Sitemap path continuity

`@astrojs/sitemap` outputs `/sitemap-index.xml`. WordPress historically exposed `/sitemap.xml`. The template includes a `/sitemap.xml → /sitemap-index.xml` 301 in `public/_redirects` so crawlers and Search Console submissions expecting the WP path don't 404. Verify your `robots.txt` points at `sitemap-index.xml` (not `sitemap.xml`).

### Image scale (when >200 images)

Astro uses Sharp to optimize images at build time. Generating 5 sizes × 2 formats (WebP + AVIF) across hundreds of images can blow past CF Pages's build memory/timeout limits. For large media libraries, offload to [Cloudflare Image Resizing](https://developers.cloudflare.com/images/transform-images/) or [Cloudflare Images](https://developers.cloudflare.com/images/) and skip Astro's optimization for those assets. Below ~200 images, Sharp at build time is fine.

---

## Launch audit checklist — DO NOT START UNTIL CLOSE TO LAUNCH

Run this only at the end of a project, not during page-building. Page-by-page checks (`audit:live-diff`, `audit:a11y` with default tags, `audit:section-crops`) handle the build phase; this is the launch-prep sweep that confirms the site as a whole is shippable.

- [ ] **Accessibility — WCAG 2.2 AA**. Default `audit:a11y` scopes to WCAG 2.1 AA. For launch, broaden: `npm run audit:a11y -- <prod-url> --include-tags wcag22a,wcag22aa --viewport both`. WCAG 2.2 adds 9 success criteria over 2.1 — the most likely to surface real issues on a rebuild are **Focus Appearance** (2.4.13, AAA), **Target Size (Minimum)** (2.5.8, AA, ≥24×24px CSS pixels), **Dragging Movements** (2.5.7, AA, single-pointer alternatives), **Consistent Help** (3.2.6, A), **Redundant Entry** (3.3.7, A), and **Accessible Authentication** (3.3.8, AA, no cognitive function tests). `@axe-core/playwright` v4.10+ supports these tags.
- [ ] **Accessibility — ATAG 2.0**. ATAG governs *authoring tools*, not published sites — most static rebuilds touch it lightly. It applies to: (a) any custom editing/admin UI shipped with the site (Content Collections are file-based by default, so usually nothing to audit here), (b) the contact form's per-user feedback flow (status announcements via `aria-live`, accessible validation errors, focus management on submit), and (c) the upstream authoring workflow if the client continues authoring in WordPress post-launch (in which case ATAG is WP-Core's responsibility, not the rebuild's). Decide which parts apply to the project and document the rest as non-applicable rather than silently skipping.
- [ ] **SEO sweep** — full [Pre-launch SEO verification](#pre-launch-seo-verification) checklist.
- [ ] **Performance** — Lighthouse on top 5 URLs. Targets per project category in [Pre-launch SEO verification](#pre-launch-seo-verification).
- [ ] **Cloudflare config** — SSL/TLS = Full (Strict), WAF rate-limit rule on `/api/contact`, Bot Fight Mode on.
- [ ] **Cloudflare Polish = Lossy + WebP** (Speed → Optimization → Image Optimization). This site serves raw JPG/PNG from `public/images/` (not via Astro `<Image>`), so **edge conversion to WebP/AVIF is the image-optimization path** — zero markup change, no faithful-clone deviation, all modern browsers. This is the correct fix for the "images aren't next-gen format" finding; do NOT rewrite 400+ `<img src>` refs (many live inside verbatim `reference/*.html` injected via `set:html`).
- [ ] **Forms end-to-end** — every form submits via `/api/contact`, Mailgun delivers, honeypot is in place, Turnstile configured if needed.
- [ ] **Anchor parity** — every indexed live URL with a fragment still resolves post-migration. Spot-check top inbound-link fragments from the client's Search Console.
- [ ] **Image local-only** — `audit:live-diff` reports 0 hot-linked external image URLs (or each remaining one is intentional + load-balanced via Worker→R2).
- [ ] **404 page** — exists, has site chrome + nav + search/contact prompt.
- [ ] **Analytics + Search Console** — verified, sitemap submitted, GMB profile updated if domain or URL shape changed.

The user-facing rule: bring this list up at the *start* of a project (so the client knows what "done" means), but don't actually run the audits until ~1 week before launch. Page-build phase iterates on per-page audits; the launch-audit list is the gate before the production domain flips.

---

## Scope — what this template does NOT cover

This template treats WordPress as the **source for one-time extraction**, not as an ongoing headless CMS. The migration produces a static Astro site; the WordPress install is decommissioned (or kept for archive only) after launch.

If the client wants to **keep WordPress as the authoring CMS** with the new Astro site as the headless frontend, that is a fundamentally different architecture:

- Requires bidirectional sync (build webhooks, draft preview, content revalidation).
- The "Preview" button breaks unless you build an HMAC-signed preview route on Astro that bypasses cache and pulls draft payloads from the WP REST API live.
- Build queue saturation becomes a real concern (every autosave can trigger a deploy without debouncing).
- ISR / SSR architecture decisions that this template's pure-static approach sidesteps.

**Flag this at project kickoff.** If the client expects to log into WP-admin after launch to publish new posts and see them in the new design, you need a different methodology. Don't promise WP-as-CMS continuity with this template.

---

## Dev / build commands

```bash
npm install          # install deps (first time)
npm ci               # use this on shared machines / CI for reproducible installs
npm run dev          # Astro dev server → http://localhost:4321/  (no CF Functions)
npm run build        # production build → dist/
npm run preview      # preview built output (static only, no Functions)
npm run check        # TypeScript + Astro type check
npm run validate     # check && build — REQUIRED before declaring a page done
npm run cf:preview   # Wrangler local Pages preview (serves dist/ + functions/)
```

`npm run dev` does **not** serve the `functions/` directory. To test `/api/contact` locally, build first then run `cf:preview`.

### About the `vite` override in `package.json`

`@tailwindcss/vite@4.3.0` is incompatible with Vite 8's rolldown backend (it errors with "Missing field `tsconfigPaths` on BindingViteResolvePluginConfig.resolveOptions"). The `overrides.vite` block pins Vite to 7.x to work around this. Delete the override when `@tailwindcss/vite` adds Vite 8 support.

---

## Decision log

Living record of intentional design choices that deviate from the live site or from default patterns.

**This table is append-only.** When the user approves a design deviation, add a row. Date it `YYYY-MM`. Check this before "fixing" anything.

| Date | Page / Area | Decision | Why |
|---|---|---|---|
| 2026-06 | Fidelity policy (Josh, kickoff) | Nav/main pages = 100% faithful; city/landing pages = "close enough"; blog = relaxed | Josh's direction 2026-06-12. Per-page fidelity bar, not uniform. |
| 2026-06 | Header | Text/SMS link wired to the real number (480-707-7721) | Live's `sms:+12223334444` is a dev-placeholder bug. Fixed per rule #1. CONFIRM w/ Josh he wants it corrected (not preserved). |
| 2026-06 | Homepage — video | `lite-youtube` (CDN) instead of the live `wp-youtube-lyte` | Playbook lite-youtube pattern; visually equivalent click-to-load, no heavy iframe. |
| 2026-06 | Homepage — contact form | Submit is `<button>` not live's `<input type="submit">` | Lets the shared `contact-form.ts` disable it on submit; CSS covers both, identical look. Honeypot + `data-form-id="home"` wired. |
| 2026-06 | Homepage — schema | Replicated live FinancialService JSON-LD verbatim, INCLUDING the malformed `@id` `https://www.philsellsbiz/#Phoenix` typo | Faithful clone. FLAGGED to Josh as a live-site bug to fix at source (then update ours). **Also in this same verbatim schema: `aggregateRating` is emitted on every importing page incl. review-less ones (about/awards/etc.). Low real risk (standard local-business pattern; Google ignores it where no reviews show), but cleanest to scope to review-showing pages — fold into the same source-fix.** |
| 2026-06-13 | Maps iframes (phoenix/tempe/testimonials) | Added a location-specific `title=` to the 9 WP-origin Google-Maps iframes (e.g. `title="Phil Reese Scottsdale office location map"`) + dropped the duplicate `src="about:blank"`. Edited the `set:html` source files. | On-site SEO audit: the live iframes had no accessible name (WCAG 4.1.2 fail); a keyword-bearing map title is a small local-SEO signal. 20/29 → 29/29. |
| 2026-06-13 | WP upload image URLs | Mirrored the 11 referenced `/wp-content/uploads/*` images to `public/images/legacy/` (original paths) + activated the `/wp-content/uploads/* → /images/legacy/:splat 301` catch-all in `_redirects`. | On-site SEO audit: og:image + schema logo/image + 2 blog body images pointed at WP upload URLs that would 404 at domain cutover; this keeps them resolving + preserves backlinked-upload equity (the template's own SEO-migration workflow). |
| 2026-06-13 | set:html bodies (4 city content files, faq, testimonials) | Relativized **188 internal links** from absolute `https://www.philsellsbiz.com/X` → `/X` (hrefs only). Left absolute: canonical/prev/next (must be), the schema/og URLs, and the review→Google `rvw-link`s. | Review-link audit: the injected `set:html` bodies kept the live site's absolute internal links, so clicking nav / "Read More" / CTAs on the new site bounced the user to the OLD WordPress site. Per CLAUDE.md's set:html fix-up rule. Verified: 0 absolute internal `<body>` hrefs in dist; 64 testimonials + 1 home review→Google links intact; 0 hot-linked `src` actually render (the rest are in commented dead sections). |
| 2026-06-15 | `.rvw-link` (review-title links — /testimonials/ + homepage reviews) | **Deliberate departure from the faithful clone (Josh's call):** added a persistent underline (`text-decoration: underline; text-underline-offset: 3px`) + red hover (`:hover { color: var(--red) }`) in `global.css`. The live theme styles these as plain dark-bold headings with no underline, so visitors can't tell they're clickable. | Review-link audit follow-up: links/URLs/style were verified **pixel-identical to live** (64 links → same 63 Google URLs; no regression), but Josh wanted them to *read* as links. Scoped to `.rvw-link` only (class > element `a`), so non-linked review titles stay un-underlined. Verified in-browser: linked titles underline, plain titles `none`, both rules in the dist bundle. |
| 2026-06-15 | `_redirects` — AMP + per-page feeds | Added `301 /amp/ → /` and `/*/amp/ → /:splat/`; `/comments/feed/` + `/*/feed/ → /rss.xml`. | Pre-launch SEO audit (4-angle workflow): live WP runs the AMP plugin — every page/post has an indexed `/{path}/amp/` twin (all 200) that would 404 at cutover; the rebuild emits no AMP, so 301 the old AMP URLs to canonical to keep their signals/links. Same for per-page/comments feeds (root `/feed/` rule only matched the exact root). Rules sit above the `/wp-content/uploads/*` catch-all. |
| 2026-06-15 | Sitemap — exclude paginated archives | Added `@astrojs/sitemap` `filter` to drop `/blog/page/N/` from the XML sitemap (65 → 62 locs). | Pre-launch SEO audit: Yoast deliberately omits paginated archives; they're thin list-pages that compete with `/blog/` and dilute crawl budget, and stay crawlable via on-page pagination. Restores Yoast parity. Page coverage verified COMPLETE first (all 57 live URLs present; the 8 backend-only pages are all Yoast-noindex test/legacy dupes). |
| 2026-06-15 | `/thank-you-for-contacting-us/` (old CF7 confirmation page) | **DECISION (Josh): let it 404.** No redirect, not rebuilt. | Pre-launch audit: GSC says "unknown to Google" (never indexed), 0 inbound links, and the rebuild's forms show inline confirmation (no thank-you URL). A 404 is harmless; a 301 would only legitimize a dead URL. Do not re-add. |
| 2026-06-15 | `aggregateRating` on review-less pages (about/awards/what-is-a-cbi/business-sellers/business-buyers/contact/faq) | **DECISION (Josh): leave on all pages — do NOT strip.** Closes the parked item from row above (the verbatim FinancialService `@id` row). | Low real-world risk: Google ignores `aggregateRating` where no reviews render. Faithful to the live schema. It will throw a benign Rich Results *warning* (not an error) on review-less pages — expected, accepted. |
| 2026-06-15 | `contact-form.ts` — hCaptcha load timing | **Defer hCaptcha until first form interaction.** `init()` no longer calls `loadHcaptcha()` on `DOMContentLoaded`; instead each form arms it via `focusin` + `pointerdown` (`{ once: true }`). | Josh's call (applied to JVG too): keep the hCaptcha `api.js` off the initial-load critical path (CWV win). Safe because filling any field fires `focusin` first, so the widget loads well before submit; `loadHcaptcha()` is idempotent. Do NOT revert to eager load-on-DOMready. |

### Template-level lessons learned (from earlier projects)

These are not project deviations — they're recurring failures that shaped this playbook.

| Source | Lesson | Codified as |
|---|---|---|
| JVG 2026-05 | Hot-linked image returned 404, survived 4 visual audits | `npm run audit:live-diff` does HEAD-check on every external image URL |
| JVG 2026-05 | `<img loading="lazy">` made `#custom-shop-serials` look empty after anchor jump | `live-diff-auditor` agent must force `loading="eager"` before screenshotting; documented in [Image migration](#image-migration--hot-link-is-single-session-only) |
| JVG 2026-05 | Self-audit anchored on what was built, missed what was missing | New `live-diff-auditor` subagent with fresh eyes |
| Multi-AI reviews 2026-05 | "Prose vs. tooling" — playbook described rules but didn't enforce them | `npm run validate`, `npm run audit:live-diff`, `reference/seo-map.csv`, `public/_redirects` are now real artifacts, not paragraphs |
| Gemini adversarial review 2026-05 | Audit script flagged `alt=""` as missing alt (false positive — WCAG-valid for decorative) | Script now only flags missing `alt` attribute, not empty value |
| Gemini adversarial review 2026-05 | Audit script read `src` directly, missing lazy-load URLs in `data-src` / `srcset` | Script now resolves real src through lazy-load attr cascade |
| Gemini adversarial review 2026-05 | Audit script's `fetch()` blocked by Wordfence / CF Bot Management | All fetches now send a realistic browser User-Agent |
| Gemini adversarial review 2026-05 | Audit script ignored `<video>` and `<iframe>` — hero videos and YouTube embeds disappeared silently | Script now diffs video sources and iframe sources |
| Gemini adversarial review 2026-05 | `contact.ts` had wildcard CORS, no honeypot, no rate limit, leaked errors | Hardened: `ALLOWED_ORIGIN` lock, honeypot field, optional Turnstile, optional KV rate-limit, generic error responses, field allowlist, email validation, CRLF stripping |
| Gemini adversarial review 2026-05 | CSS prefix rename was a prose snippet in README ("tooling-not-prose" violation) | Now `npm run setup:prefix -- <abbr>` |
| Gemini adversarial review 2026-05 | RSS feed continuity not addressed; aggregators silently break on migration | `@astrojs/rss` default-installed, `src/pages/rss.xml.ts` stub, `/feed/ → /rss.xml` redirect in template |
| Gemini adversarial review 2026-05 | `/wp-content/uploads/` PDF + image backlinks abandoned | `_redirects` template now includes uploads patterns; `seo-map.csv` workflow extended to assets |
| Gemini adversarial review 2026-05 | Form field-name continuity ignored (CF7/Gravity payload keys → CRM/Zapier integrations break) | New `reference/form-map.csv` workflow documented |
| Gemini deep-research 2026-05 | `site = "https://example.com"` left in `astro.config.mjs` silently deploys broken canonicals (Google de-index risk) | New `npm run check:site` build-time gate; runs first in `validate` |
| Gemini deep-research 2026-05 | Cloudflare "Flexible" SSL mode + `trailingSlash: 'always'` = infinite redirect loop | Documented prominently in Cloudflare deployment section + checklist |
| Gemini deep-research 2026-05 | `_redirects` strips query params; UTM/gclid attribution silently lost | Documented; pointer to Transform Rules / Bulk Redirects for ad-heavy clients |
| Gemini deep-research 2026-05 | `@astrojs/sitemap` outputs `sitemap-index.xml` but crawlers expect WP's `/sitemap.xml` | `/sitemap.xml → /sitemap-index.xml` 301 added to `_redirects` by default |
| Gemini deep-research 2026-05 | Pages without Layout.astro silently render unstyled (Tailwind v4 module-graph CSS injection) | New must-follow rule #13: every page must extend Layout.astro |
| Gemini deep-research 2026-05 | Node SDKs (mailgun.js, form-data, aws-sdk) silently fail in V8 isolates despite passing local wrangler tests | New must-follow rule #14: Pages Functions use Web APIs only |
| Gemini deep-research 2026-05 | Methodology only addressed Avada/Fusion wrapper stripping; Elementor/Divi/Gutenberg unmentioned | Page-builder section now covers all four explicitly |
| Gemini deep-research 2026-05 | WP Featured Image often double-rendered (theme + manual paste in body) | Sanity-check note added to page-builder source section |
| Gemini deep-research 2026-05 | Scope of template ambiguous — could be misread as supporting WP-as-headless-CMS | New "Scope — what this template does NOT cover" section makes the static-extraction approach explicit |
| GPT line-level + Gemini round 3 2026-05 | `contact.ts` CORS failed open when `ALLOWED_ORIGIN` env var unset; `Origin: null` not handled | New `checkOrigin()` requires env var in production (fails closed), explicitly rejects `null` Origin |
| GPT line-level 2026-05 | `Content-Length` cap bypassable via chunked / missing header | Body is now read as text first, capped on actual length, then JSON-parsed |
| GPT line-level 2026-05 | `functions/` excluded from `tsconfig.json` — security-critical endpoint never typechecked | `@cloudflare/workers-types` installed; `functions/` now part of `astro check`; inline type stubs removed |
| GPT line-level 2026-05 | Empty/near-empty form submissions could pass allowlist and reach Mailgun | New per-`formId` required-fields rule (`REQUIRED_FIELDS`) |
| GPT line-level 2026-05 | Audit script's `diffSets()` was Set-based; duplicate-loss invisible | Replaced with `multisetDiff()` (Map+count) — catches "live had 2, local has 1" |
| GPT line-level 2026-05 | Audit only escalated structural mismatches to 🔴 above `abs(diff) > 2` (against CLAUDE.md rule) | Any missing-on-local block now 🔴; only extra-on-local is 🟡 |
| GPT line-level 2026-05 | Canonical mismatches always marked 🟢 acceptable | Now: host-only diff is 🟢, path/slash/placeholder/staging mismatches are 🔴 |
| GPT line-level 2026-05 | Audit only HEAD-checked absolute `http(s)://` image URLs — local `/images/foo.jpg` 404s slipped through | Every image/picture/poster/iframe URL is now resolved via `new URL(ref, pageUrl)` and liveness-checked |
| GPT line-level 2026-05 + Gemini round 3 | Audit had no network timeout or concurrency cap | `AbortSignal.timeout(8s)` + 10-way concurrency pool |
| GPT line-level 2026-05 + Gemini round 3 | Trailing-slash check flagged `/api/*` + protocol-relative URLs + asset paths | Filter extended: skips `/api/`, protocol-relative `//`, `tel:`/`mailto:`, paths with `.ext`, strips query+fragment before checking |
| GPT line-level 2026-05 | KV rate-limit non-atomic + disabled by default; effectively no limit in many configs | Doc-only fix: explicit "KV is advisory, primary defense MUST be a CF WAF rate-limit rule" — instructions added to security section |
| GPT line-level 2026-05 | Mailgun text body blindly includes anything in `clean` — extending `ALLOWED_FIELDS` could silently leak sensitive fields | Doc warning in source header + CLAUDE.md security section |
| GPT line-level 2026-05 + Gemini round 3 | `/feed/ → /rss.xml` was commented out in `_redirects` despite docs claiming it active | Activated by default |
| Gemini round 3 2026-05 | TODO placeholders in `src/config/site.ts` + `global.css` had no build-time gate (only `astro.config.mjs` did) | New `npm run check:todos` scans known files; wired into `validate` |
| Gemini round 3 2026-05 | `setup:prefix` only scanned `src/` — widget CSS in `public/` and any class refs in `functions/` were skipped | Now scans `src/`, `public/`, `functions/` (excludes docs intentionally) |
| Gemini round 3 2026-05 | `live-diff-auditor` agent silently no-ops when Playwright MCP isn't loaded | Agent definition includes fallback: run static audit only + flag the gap to main agent |
| GPT line-level + Gemini round 3 2026-05 | No single pre-launch gate; many checks acknowledged as "still prose" | New `npm run audit:pre-launch` stub that chains current deterministic checks + lists future additions in the file header |
| JVG fender-SN 2026-05 | 15 image groups (40 figures) shipped as vertical stacks instead of CSS-grid galleries. Static audit's image-COUNT check passed because counts matched; layout grouping was wrong | New project-wide `.site-img2` / `.site-img3` / `.site-imgwc` / `.site-cap` / `.site-img--uniform` primitive in `global.css`; new "Image gallery primitive" section in CLAUDE.md; audit script now counts consecutive `<figure>` runs and flags them as 🔴 when live has none (likely-stacked-where-grouped); live-diff-auditor agent explicitly checks figure-run grouping against live |
| JVG fender-SN 2026-05 | 16 "Joe's Tip" callout boxes silently dropped during prose extraction (live had 27, local had 12); survived 5 audit passes because heading/image/JSON-LD checks all passed | New `countCallouts()` in audit script: matches WP/page-builder conventions (`.tip`, `.callout`, `.info-box`, `.warn`, `.notice-box`, `.fusion-alert`, `.fn-notice`) AND project-prefixed Astro conventions (`<prefix>-callout`/`-tip`/`-info-box`/`-warn`/`-aside`/`-notice`). Threshold: `|diff| ≥ 3 = 🔴`, `≥ 1 = 🟡`. Plus new agent step c3 — positional spot-check per callout (static count = necessary but not sufficient — can miss position shifts) |
| GPT-5.2-Pro consultation 2026-05-26 | Strategic gaps in our visual-audit toolchain. Top finding: "Stop using AI vision for structure recognition." | Initial recommendations (since revised by Gemini cross-check below): style-signature diff, section crops, axe-core, schema-dts, linkinator, Lighthouse CI, HTML-first for chrome-heavy sections. |
| Top-priority action shipped 2026-05-26 | `scripts/audit-section-crops.mjs` built and verified working on JVG sell-fender (15 sections audited). Uses Playwright + `odiff-bin` (Rust-based perceptual diff). Per-H2/H3-anchored section crops at 1920+390, side-by-side stitched (live \| local \| diff-mask) PNGs in `reports/screenshots/<slug>/sections/<n>-<heading-slug>/`. Diff mask highlights ONLY pixels that actually differ, ignoring anti-aliasing. Output `summary.json` lists every section + diff %. Exits non-zero on any >20% diff. **The "Gemini misread raw screenshots" failure mode is now structurally impossible** — agent reads the deterministic diff mask, not raw screenshots. CLI: `npm run audit:section-crops -- <live> <local> --slug <slug> [--viewport 1920\|390\|both] [--anchors h2\|h2h3\|h2h3h4]`. Both projects (template + JVG) have `playwright` + `odiff-bin` as devDeps; chromium installed via `npx playwright install chromium`. | Highest-leverage improvement from the GPT/Gemini consultations. ~300 lines, runs in ~45s for a 15-section page. Replaces "AI vision on thumbnail" for structural questions. |
| Gemini-3-Pro cross-check 2026-05-26 | Critical pushback on several GPT picks + 5 categories GPT missed entirely. Both consultations together → revised priority roadmap. | **REVISED ROADMAP (post-both-consultations):** **HIGH priority:** (1) `audit-section-crops.mjs` + **odiff** mask pipeline — perceptual diff tool that generates a diff mask between two PNGs ignoring anti-aliasing; feed the MASK to AI, not raw screenshots. Biggest visual-audit improvement. (2) **Astro Content Collections + Zod** for blog migration — script WP REST API → `.mdx` files with YAML frontmatter → type-safe archives/taxonomy/pagination. Closes the "Pagination/archives TODO" gap. (3) **HTML-first extraction script** for bespoke sections — use Chrome Coverage API via Playwright OR `purifycss` to extract only relevant CSS rules → dump into `set:html` + `<style is:global>` wrapper-scoped → ship. Would have prevented Meet Joe's 8 revisions. **MEDIUM priority:** (4) **R2 + CF Worker for `/wp-content/uploads/`** — for sites with >500MB media. Route a Worker to intercept `/wp-content/uploads/*` and fetch from R2; add CF Image Resizing for WebP/AVIF. Keeps Astro repo lean. (5) `@axe-core/playwright` a11y check in auditor flow. (6) Use **Zod** (NOT `schema-dts`) for JSON-LD validation — 3-4 schemas only, lighter weight. **DEFERRED:** (7) `audit-style-signature.mjs` — Gemini's "computed-style normalization is a trap" warning is real; requires strict normalization layer (px-only, single color format, 1px rounding). Skip until cheaper wins land. **SKIPPED:** Lighthouse CI (flaky on static sites, better served by hard image-payload limits in audit script). `linkinator` (already covered by audit-live-diff; if needed later, `muffet` Go-based is faster). `schema-dts` (Zod sufficient). **Strategic critique from Gemini:** "Your goal contains a fundamental contradiction — Tailwind 4 + AI + pixel-perfect-parity is incompatible at scale." Two paths: (a) want exact parity fast → use `wget`/`HTTrack` deploy literal WP HTML/CSS; (b) want Astro+Tailwind → change client contract from 'pixel-perfect clone' to 'design normalization' — build a CLI that maps WP Blocks/Shortcodes to predefined Astro components for 80% of pages, sandboxes 20% bespoke into HTML-first scoped fallback. Worth a future architectural conversation, not a near-term refactor. **Clean-DOM-middleware** (Gemini idea, not yet logged: use `Readability.js` + un-nester to flatten WP's `<div>` soup BEFORE the AI sees it). |
| User-driven 2026-05 | Claude's own visual screenshot comparison has anchoring bias — sees what it built, misses what's missing. Same-model parallel review is correlated, not independent | Required step c4 in `live-diff-auditor.md`: invoke `mcp__zen__consensus` with Gemini 2.5 Pro + GPT-5 (or current GPT vision model) on every screenshot pair. Synthesis rules: both-flag = 🔴 high confidence, one-flag = 🟡 single-model, agent-disagreed-with-both = trust consensus over self. Graceful degradation when Zen MCP isn't loaded (agent must flag the gap, not no-op). Cost ~$0.02-0.05 per page; ~$0.30 per full site rebuild |
| 2026-05-25 | "HTML-first" extraction was on the priority roadmap (#2 of 3 from the GPT/Gemini consultations) — chrome-heavy bespoke sections were costing 5–10 revisions each | Shipped `scripts/extract-html-first.mjs` + `npm run extract:html-first`. Playwright + Chrome CSS Coverage captures a section's outerHTML and ONLY the rules that styled it; then a structural pass pre-scopes every selector with `.wp-extracted-<slug>` so injection via `<style is:global>` cannot leak out of the wrapper. Handles `@media`/`@supports`/`@container` (inner selectors scoped), `@keyframes`/`@font-face` (kept global per spec), `@import` (dropped — would re-fetch), standalone `body`/`html`/`:root` (mapped to wrapper). Uses rule-overlap (not raw byte-slice) against Coverage ranges to avoid mid-rule cuts. Outputs `<slug>.html`, `<slug>.css`, `<slug>.snippet.astro`, `<slug>.assets.json`, `<slug>.report.md` to `reference/extracted/<slug>/`. Verified on JVG's Avada/Fusion header (82 elements, 22 stylesheets covered → 233 rules kept, 396 dropped, valid scoped CSS). New CLAUDE.md section "HTML-first section extraction" documents when to use vs not, the pre-launch checklist, and the known limitations (JS-mutated DOM and inline-style overrides aren't captured). This is the tool that would have prevented JVG's Meet Joe 8-revision saga |
| 2026-05-26 | A11y check was a medium-priority roadmap item that hadn't shipped; a real contrast bug on JVG sell-fender testimonials (dark-brown text on dark-rust bg = 3:1, failed WCAG AA) shipped because no script gated it | Shipped `scripts/audit-a11y.mjs` + `npm run audit:a11y` in both template + JVG project. `@axe-core/playwright` (industry-standard scanner) runs WCAG 2.1 A+AA rule set including `color-contrast`. Supports `--viewport 1920\|390\|both` and `--include-tags` (default scope: `wcag2a,wcag2aa,wcag21a,wcag21aa,best-practice`). Outputs JSON + Markdown reports to `reports/a11y/`. Exits non-zero on any violation (CI-gate ready). Retroactively verified by re-introducing the JVG contrast bug — script flagged `🔴 SERIOUS color-contrast (10 nodes)`. After fix, only 4 pre-existing footer-link violations remain (matches-live-design decisions). Closes the medium-priority `@axe-core/playwright` item from the GPT/Gemini consultations. |
| 2026-05-25 | Pagination/archives/taxonomy methodology was an explicit TODO — sites with WP blogs had no path | Shipped Archetype C: Astro Content Collections (`src/content/config.ts` Zod-validated `blog` + `pages` collections) + shared helpers (`src/lib/blog.ts` — `getPublishedPosts`, `getAllCategories`, `getAllTags`, `getAllAuthors`, `getAdjacentPosts`, `slugify`, `paginationUrl`, `formatDate`) + paginated routes (`/blog/[...page]`, `/blog/[slug]`, `/category/[slug]/[...page]`, `/tag/[slug]/[...page]`, `/author/[slug]/[...page]`) with `<link rel="prev"/next>` injected via Layout's new `head` slot + WP REST API importer (`scripts/import-wp-blog.mjs` — paginates via `X-WP-TotalPages`, embeds author/featured-media/terms, optional `--download-images` + `--seo-map`, warns on short descriptions + unexpanded shortcodes) + RSS feed wired to collection. New `BlogPostCard` + `Pagination` primitives. `@astrojs/mdx` added to deps. Closes the gap flagged in earlier Gemini deep-research review |

---

## Useful references

- [Astro script directives](https://docs.astro.build/en/guides/client-side-scripts/) — `is:inline`, `is:raw`, `set:html` semantics
- [Astro styling guide](https://docs.astro.build/en/guides/styling/) — scoped vs. global, `:global()` and `is:global` escape hatches
- [Vite `?raw` and `?url` query imports](https://vitejs.dev/guide/assets.html) — loading reference HTML at build time
- [Tailwind v4 `@theme` directive](https://tailwindcss.com/docs/theme) — how this project defines design tokens
- [Avada/Fusion Builder docs](https://theme-fusion.com/documentation/) — recognizing wrapper classes to skip in `reference/` HTML
- [Cloudflare Pages Functions docs](https://developers.cloudflare.com/pages/functions/)
- [Mailgun API docs](https://documentation.mailgun.com/en/latest/api-sending.html)

The best playbook for any specific project IS this CLAUDE.md, the project memory file, and the reference/ folder. Build it up as you go.
