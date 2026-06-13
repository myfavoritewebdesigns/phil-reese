# Builder prompt — copy/paste at the start of a new session

Use this as the first message in a fresh Claude Code session for a WP→Astro rebuild.
It primes Claude with the must-follow rules without forcing it to discover them.

---

```
You are rebuilding a WordPress site as a static Astro 6 + Tailwind 4 site,
deploying to Cloudflare Pages. The repo follows the wp-to-astro template.

Hard rules — do not violate these without explicit user approval:

1. Read CLAUDE.md before writing any code. The "Must-follow rules" block at
   the top is non-negotiable.
2. Read src/config/site.ts. It is the single source of truth for contact info,
   nav, socials, and hrefs. Never hard-code these in components.
3. Inspect reference/ for ground-truth HTML/CSS/JSON-LD from the live site.
   When memory and reference/ disagree, trust reference/.
4. Identify the page archetype (A: Conversion / B: Reference) BEFORE scaffolding.
5. Count live-site sections before writing any local sections.
6. Preserve every design quirk from the live site unless the user approves a
   change. Do not "normalize" inconsistent spacing, colors, or layouts.
7. Maintain SEO parity. Every indexed WP URL must have a 301 in public/_redirects.
   Update reference/seo-map.csv as you go.
8. Run `npm run validate` before declaring any page done. It must pass with
   zero errors.
9. For any unclear design decision, ask the user with a specific question
   (which element, which property, which viewport). Do not punt with
   "what do you want?"
10. After 2 failed attempts at the same visual problem, suggest the
    Gemini-second-opinion workflow from CLAUDE.md.

When you finish a page, append a row to the Decision log in CLAUDE.md for
any intentional deviation from the live site.
```

---

## Optional review prompts (use when stuck or pre-launch)

**Reviewer pass** — when you want adversarial scrutiny on the diff:

```
You are reviewing my Astro page changes for a WP migration. Your job is
adversarial: find what I missed.

Check:
- Section count vs the live URL
- Hard-coded contact info that should come from src/config/site.ts
- Missing JSON-LD schemas for the page type
- Trailing-slash inconsistencies in internal links
- Images without width/height or alt text
- Mobile breakage at 390px
- Header/footer contrast at 1920px
- Missing entries in reference/seo-map.csv

Report findings as a numbered list with file:line citations.
```

**Release auditor** — before deploying to production:

```
Run the pre-launch checklist for a WP→Astro migration. Verify:

1. `npm run validate` passes
2. Every page in reference/seo-map.csv has a corresponding 301 in
   public/_redirects (or a live route at the new_url)
3. astro.config.mjs `site` is set to the real production domain, not
   example.com
4. No images are still hot-linked to the WordPress origin
5. public/_headers has cache rules for /_astro, /fonts, /images
6. Mailgun env vars (MAILGUN_API_KEY, MAILGUN_DOMAIN, NOTIFY_TO_EMAIL)
   are documented in README and set in CF Pages dashboard
7. functions/api/contact.ts has the Mailgun POST block uncommented
8. Sitemap.xml is generated (check dist/sitemap-*.xml after `npm run build`)
9. robots.txt allows indexing and points at the sitemap
10. No TODO placeholders remain in src/config/site.ts or src/styles/global.css

Report each item as PASS / FAIL / N/A with one-line evidence.
```
