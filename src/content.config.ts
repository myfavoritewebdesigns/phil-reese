/* -----------------------------------------------------------------------
   CONTENT COLLECTIONS — schema-validated blog/page content.

   Astro 6 uses the loader-based Content Collections API. This file lives at
   `src/content.config.ts` (NOT `src/content/config.ts` — that's the legacy
   location, removed in Astro 6). Each collection declares a `loader` (where
   the files live) and a `schema` (Zod validation).

   Why this matters for a WP migration:

   WordPress's database has fixed fields (post_title, post_date, post_author,
   meta_description from Yoast/RankMath, featured image attachment, categories,
   tags). When we extract posts to MDX via scripts/import-wp-blog.mjs, each
   post's YAML frontmatter MUST match one of these schemas or the build fails
   loudly — which is what we want. Silent drift between expected and actual
   shape is what causes "the blog migration looks fine but Search Console is
   showing 200 invalid Article schemas" disasters.

   Two collections:
     - blog   : Article posts under /blog/<id>/ with full archive support
     - pages  : Long-form prose pages under /<id>/  (e.g. Privacy Policy,
                About) where the body is MDX-authored rather than hand-coded
                in /src/pages/. Optional — many sites don't need this.

   If you have other WP post types (CPTs: case studies, FAQs, testimonials,
   products), copy the `blog` collection definition and add a new key. Each
   collection gets its own Zod schema and its own dir under src/content/.

   `entry.id` (Astro 6) replaces what was `entry.slug` in Astro 5 — it's the
   filename without extension, used to build the URL path.
   ----------------------------------------------------------------------- */

import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "zod";

/* ---------- shared field validators ---------- */

const isoDate = z.coerce.date();

const wpFeaturedImage = z.object({
  src: z.string(),                     // local path "/images/blog/foo.jpg" or remote URL
  alt: z.string(),                     // accessibility — required, not optional
  width:  z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  caption: z.string().optional(),
  credit:  z.string().optional(),
});

const wpAuthor = z.object({
  name: z.string(),
  slug: z.string(),                    // /author/<slug>/ URL — must be unique per author
  bio: z.string().optional(),
  avatar: z.string().optional(),       // local path or URL
  url: z.url().optional(),             // optional author website
});

/* ---------- collections ---------- */

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: z.object({
    title:       z.string(),
    description: z.string().min(20).max(300),  // also used as <meta description> + OG.
                                                // 20–300 char range matches Google snippet limits.
                                                // The hard floor catches "Hello world" stubs and
                                                // forces an actual human-written summary.
    pubDate:      isoDate,
    modifiedDate: isoDate.optional(),
    draft:        z.boolean().default(false),

    author:     wpAuthor,

    // URL-prefix category slug — the single category that forms this post's
    // permalink `/<category>/<slug>/`. Derived from the live WP permalink, NOT
    // from the term list (WP posts can have multiple categories, but only one
    // appears in the URL). This is the routing key for src/pages/[category]/.
    category:     z.string(),
    categoryName: z.string().optional(),  // human-readable display name for the URL category

    categories: z.array(z.string()).default([]),  // all human-readable category names (for display/schema articleSection)
    tags:       z.array(z.string()).default([]),

    featuredImage: wpFeaturedImage.optional(),

    // YouTube video id embedded in the post body — when set, the post emits a
    // VideoObject JSON-LD node (real metadata in src/lib/videos.ts).
    videoId: z.string().optional(),

    // SEO ad-hoc overrides — use ONLY when WP had a Yoast/RankMath override
    // that differs from the post title/description.
    seoTitle:       z.string().optional(),
    seoDescription: z.string().optional(),
    canonical:      z.string().optional(),
    noindex:        z.boolean().default(false),

    ogImage:    z.string().optional(),
    ogImageAlt: z.string().optional(),

    // Legacy continuity — original WP URL + post ID, populated by importer.
    legacyUrl: z.string().optional(),
    legacyId:  z.number().int().optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/pages" }),
  schema: z.object({
    title:       z.string(),
    description: z.string().min(20).max(300),
    pubDate:      isoDate.optional(),
    modifiedDate: isoDate.optional(),
    draft:        z.boolean().default(false),
    seoTitle:        z.string().optional(),
    seoDescription:  z.string().optional(),
    canonical:       z.string().optional(),
    noindex:         z.boolean().default(false),
    ogImage:         z.string().optional(),
    ogImageAlt:      z.string().optional(),
    legacyUrl:       z.string().optional(),
    legacyId:        z.number().int().optional(),
  }),
});

export const collections = { blog, pages };
