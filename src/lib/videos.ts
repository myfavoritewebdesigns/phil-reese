/* -----------------------------------------------------------------------
   VideoObject schema — YouTube embeds across the site.

   Phil's pages and several blog posts embed his own YouTube videos (the
   @Philsellsbiz channel) via the lite-youtube facade (pages) or a plain
   iframe (blog posts). `Layout.astro` takes a `videoId` prop and, when set,
   emits a Google-valid VideoObject JSON-LD node for that video so the clip is
   eligible for video rich results / the video thumbnail in search.

   ⚠️ uploadDate + duration are the REAL values pulled from each video's
   YouTube watch page (2026-06-18). Do NOT fabricate or guess these — an
   invented uploadDate is invalid structured data and a Search Console error.
   Re-pull from https://www.youtube.com/watch?v=<id> if a video is replaced.

   Descriptions are trimmed, faithful summaries of each video's real YouTube
   description. Specific dated stat-claims from the originals ("over 100 sales",
   "17 years", etc.) are intentionally omitted — the schema only needs to
   describe the video's subject, and re-asserting aging numbers we don't
   maintain is a risk we don't need to take.

   NOTE: the Valcon General "Commercial Tenant Improvement Services" video
   (OrkFtQ6Jhgs, embedded in one blog post) is deliberately absent — it is a
   third-party video, not Phil's content, so we don't claim VideoObject for it.
   ----------------------------------------------------------------------- */

import { SITE_URL } from "../config/site";

export interface VideoMeta {
  /** Real YouTube title. */
  name: string;
  /** Faithful, trimmed summary of the real YouTube description. */
  description: string;
  /** Real publish date from YouTube (YYYY-MM-DD). Never fabricate. */
  uploadDate: string;
  /** Real runtime from YouTube, ISO-8601 duration. Never fabricate. */
  duration: string;
}

/** Keyed by YouTube video id. */
export const VIDEOS: Record<string, VideoMeta> = {
  ajTOke4_h9A: {
    name: "How I Perform Business Valuations | Phil Reese",
    description:
      "Arizona business broker Phil Reese explains how he performs business valuations for owners preparing to sell their company.",
    uploadDate: "2026-03-06",
    duration: "PT32S",
  },
  "75l7CluKwIg": {
    name: "Phil Reese CBI - Arizona Business Broker",
    description:
      "Phil Reese, Arizona Business Broker, markets the sale of your business efficiently and discreetly, using confidentiality agreements with every prospective buyer.",
    uploadDate: "2015-04-01",
    duration: "PT1M14S",
  },
  b8wO04kmk9M: {
    name: "Mesa Business Broker Phil Reese",
    description:
      "Mesa business broker Phil Reese works to protect his clients' interests and, through West USA Realty, offers wide exposure for a prospective business sale.",
    uploadDate: "2015-06-01",
    duration: "PT1M18S",
  },
  te_eUAp9Itg: {
    name: "Tempe Business Broker | Phil Reese",
    description:
      "Thinking about selling or buying a Tempe, Arizona business? Phil Reese shares how a business broker's connections and experience benefit clients.",
    uploadDate: "2015-07-20",
    duration: "PT1M9S",
  },
  CQp4Vt6o8Js: {
    name: "Thinking of Selling or Buying a Business?",
    description:
      "Thinking of selling or buying a business in Arizona? Phil Reese, Arizona Business Broker, explains how he can help.",
    uploadDate: "2020-04-09",
    duration: "PT1M39S",
  },
  WV6cfXTL6xI: {
    name: "Phoenix Business Broker Phil Reese",
    description:
      "Phoenix business broker Phil Reese explains why owners selling a Phoenix business benefit from a broker who understands valuation and the sale process.",
    uploadDate: "2015-04-24",
    duration: "PT1M8S",
  },
  UUeMTFThLqY: {
    name: "Scottsdale Business Broker Phil Reese",
    description:
      "Scottsdale business broker Phil Reese explains how working with a broker keeps a business sale discreet and professional, with confidentiality agreements for prospective buyers.",
    uploadDate: "2015-04-24",
    duration: "PT1M7S",
  },
  LF6UYy3r0yg: {
    name: "Sell your Scottsdale Business with Phil Reese CBI",
    description:
      "Phil Reese, Certified Business Intermediary, shares guidance on recognizing the right time to sell your Scottsdale business and what to expect from the process.",
    uploadDate: "2016-05-06",
    duration: "PT40S",
  },
};

export interface VideoObjectOptions {
  /** Absolute URL of the page the video is embedded on (for @id + mainEntityOfPage). */
  pageUrl?: string;
  /** Fragment id for the node's @id; defaults to "video". */
  anchorId?: string;
}

/**
 * Build a Google-valid VideoObject JSON-LD node for a known YouTube id.
 * Returns null for an unknown id so callers can safely spread/filter.
 */
export function videoObject(
  id: string | undefined,
  opts: VideoObjectOptions = {},
): Record<string, unknown> | null {
  if (!id) return null;
  const v = VIDEOS[id];
  if (!v) return null;
  const { pageUrl, anchorId = "video" } = opts;

  return {
    "@type": "VideoObject",
    ...(pageUrl ? { "@id": `${pageUrl}#${anchorId}` } : {}),
    name: v.name,
    description: v.description,
    // hqdefault always exists for every public video (maxres is missing on
    // older uploads, so we don't reference it — a 404 thumb fails validation).
    thumbnailUrl: [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
    uploadDate: v.uploadDate,
    duration: v.duration,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    contentUrl: `https://www.youtube.com/watch?v=${id}`,
    ...(pageUrl ? { mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl } } : {}),
    // Reference the global LocalBusiness/Organization node Layout already emits.
    publisher: { "@id": `${SITE_URL}/` },
  };
}
