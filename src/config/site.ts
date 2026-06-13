/* -----------------------------------------------------------------------
   SITE CONFIG — single source of truth for every page.
   Values extracted from the live site (reference/home-raw.html) and
   reference/_discovery.md on 2026-06-12.
   Never hard-code phone/email/address/social URLs in components.
   ----------------------------------------------------------------------- */

export const SITE_URL  = "https://www.philsellsbiz.com";
export const SITE_NAME = "Phil Reese, Arizona Business Broker";
export const LEGAL_NAME = "Phil Reese, Arizona Business Broker";
/** Legal entity shown in the live footer copyright line ("©2026 Phil Reese, PLC"). */
export const COPYRIGHT_NAME = "Phil Reese, PLC";

export const contact = {
  phone: "(480) 707-7721",
  /** Dashed display form used verbatim in the live header / footer. */
  phoneDashed: "480-707-7721",
  tel:   "+14807077721",
  telDashed: "+1-480-707-7721",
  // Live site exposes this via Cloudflare email-protection markup (decoded
  // from data-cfemail in reference/home-raw.html — top-hdr + all 4 footer offices).
  email: "phil@philsellsbiz.com",
  mapUrl: "https://maps.app.goo.gl/QnK7Zak7uVcRkRK2A", // Scottsdale HQ "View Map" link from live footer
  // Primary office = Scottsdale (listed first in the live footer, carries the
  // primary phone number).  Lat/lng from the live "Get Directions" maps URL.
  address: {
    street:     "14350 N. 87th St., Ste. 180",
    city:       "Scottsdale",
    region:     "AZ",
    postalCode: "85260",
    country:    "US",
    lat:        33.6153883,
    lng:        -111.8947693,
  },
} as const;

/* ---------- Offices (live footer lists 4 — multi-office local SEO) ---------- */
export interface Office {
  /** Heading text exactly as the live footer shows it */
  title: string;
  /** City landing page the footer heading links to */
  href: string;
  phone: string;       // display form (dashed, as on live)
  tel: string;         // E.164 for tel: links
  street: string;      // first address line incl. trailing comma where live has one
  cityLine: string;    // "City, AZ ZIP"
  viewMapUrl: string;
  directionsUrl: string;
}

export const offices: readonly Office[] = [
  {
    title: "Phil Reese, Arizona Business Broker",
    href: "/scottsdale-business-broker/",
    phone: "480-707-7721",
    tel: "+14807077721",
    street: "14350 N. 87th St., Ste. 180",
    cityLine: "Scottsdale, AZ 85260",
    viewMapUrl: "https://maps.app.goo.gl/QnK7Zak7uVcRkRK2A",
    directionsUrl: "https://www.google.com/maps/place/Phil+Reese,+Arizona+Business+Broker/@33.6153927,-111.8973442,17z/data=!4m6!3m5!1s0x872b741555a9a769:0x777d85f1a062a70!8m2!3d33.6153883!4d-111.8947693!16s%2Fg%2F11b7qv8nb5?entry=ttu",
  },
  {
    title: "Phil Reese, Arizona Business Broker",
    href: "/phoenix-business-broker/",
    phone: "480-428-8010",
    tel: "+14804288010",
    street: "4505 E. Chandler Blvd. #170-A,",
    cityLine: "Phoenix, AZ 85048",
    viewMapUrl: "https://www.google.com/maps/place/Phil+Reese,+Arizona+Business+Broker/@33.304201,-111.986351,15z/data=!4m2!3m1!1s0x0:0xd59527a5c7d15195?sa=X&ved=0ahUKEwiJ7rHgnovTAhXJhFQKHXiNCcAQ_BIIUzAK",
    directionsUrl: "https://www.google.com/maps/dir//Phil+Reese,+Arizona+Business+Broker,+4505+E.+Chandler+Blvd.+%23170-A,+Phoenix,+AZ+85048/@33.304201,-111.9885397,17z/data=!4m15!1m6!3m5!1s0x872b046f30d349df:0xd59527a5c7d15195!2sPhil+Reese,+Arizona+Business+Broker!8m2!3d33.304201!4d-111.986351!4m7!1m0!1m5!1m1!1s0x872b046f30d349df:0xd59527a5c7d15195!2m2!1d-111.986351!2d33.304201?hl=en-US",
  },
  {
    title: "Phil Reese, Arizona Business Broker",
    href: "/mesa-business-broker/",
    phone: "480-702-3606",
    tel: "+14807023606",
    street: "1640 S Stapley Dr #124,",
    cityLine: "Mesa, AZ 85204",
    viewMapUrl: "https://maps.app.goo.gl/4LFyoJZJhWnvUtgH9",
    directionsUrl: "https://www.google.com/maps/dir//Phil+Reese,+Arizona+Business+Broker,+1640+S+Stapley+Dr+%23124,+Mesa,+AZ+85204,+Estados+Unidos/@33.383213,-111.810877,17z/data=!4m17!1m7!3m6!1s0x872ba9667a2eb073:0x5050683fa73067b5!2sPhil+Reese,+Arizona+Business+Broker!8m2!3d33.3832085!4d-111.8083021!16s%2Fg%2F11n414kh8q!4m8!1m0!1m5!1m1!1s0x872ba9667a2eb073:0x5050683fa73067b5!2m2!1d-111.8083021!2d33.3832085!3e4?entry=ttu&g_ep=EgoyMDI2MDIyNS4wIKXMDSoASAFQAw%3D%3D",
  },
  {
    title: "Phoenix Business Broker",
    href: "/phoenix-business-broker/",
    phone: "480-493-4751",
    tel: "+14804934751",
    street: "2355 E Utopia Rd Ste #100,",
    cityLine: "Phoenix, AZ 85027",
    viewMapUrl: "https://maps.app.goo.gl/ZJnXdtEL4YGrsRMW7",
    directionsUrl: "https://www.google.com/maps/dir//2355+E+Utopia+Rd+%23100,+Phoenix,+AZ+85024,+EE.+UU./@33.6634477,-112.0351289,16z/data=!4m17!1m7!3m6!1s0x872b71ccefeb2fad:0x923837f5369dfba1!2s2355+E+Utopia+Rd+%23100,+Phoenix,+AZ+85024,+EE.+UU.!3b1!8m2!3d33.6624922!4d-112.031642!4m8!1m0!1m5!1m1!1s0x872b71ccefeb2fad:0x923837f5369dfba1!2m2!1d-112.031642!2d33.6624922!3e4?entry=ttu&g_ep=EgoyMDI2MDIyNS4wIKXMDSoASAFQAw%3D%3D",
  },
] as const;

/** BBB profile the live footer's accreditation badge links to. */
export const bbbProfileUrl =
  "https://www.bbb.org/us/az/scottsdale/profile/business-brokers/phil-reese-arizona-business-broker-1126-1000041576";

/* ---------- Inline-SVG icon paths (24×24 viewBox) ---------- */
export const phoneIconPath = "M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.36 2.32.55 3.57.55a1 1 0 011 1v3.5a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.19 2.45.55 3.57a1 1 0 01-.24 1.02l-2.19 2.2z";
export const mailIconPath  = "M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z";
export const smsIconPath   = "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-4 11H8v-2h8v2zm0-4H8V7h8v2z";
export const pinIconPath   = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z";

/* ---------- Derived hrefs ---------- */
export const hrefs = {
  tel:    `tel:${contact.tel}`,
  sms:    `sms:${contact.tel}`,
  mailto: `mailto:${contact.email}`,
} as const;

/* ---------- Form reply methods (live CF7 "Best Way to Reply" radios) ---------- */
export const replyMethods = ["Email", "Phone", "Text"] as const;

/* ---------- Social profiles ---------- */
interface SvgSocial { label: string; href: string; useImg?: false; path: string; viewBox?: string; }
interface ImgSocial { label: string; href: string; useImg: true; imgSrc: string; path?: never; viewBox?: never; }
export type SocialLink = SvgSocial | ImgSocial;

// The live header shows NO social icons (only certification badges + phone CTA).
export const headerSocials: SocialLink[] = [];

// Live footer .social-links order: YouTube, LinkedIn, Facebook, Yelp, Google Maps.
// SVG path data copied verbatim from reference/home-raw.html (footer icons).
export const footerSocials: SocialLink[] = [
  {
    label: "YouTube",
    href: "https://www.youtube.com/c/Philsellsbiz",
    viewBox: "0 0 512 512",
    path: "m224.113281 303.960938 83.273438-47.960938-83.273438-47.960938zm0 0 M256 0c-141.363281 0-256 114.636719-256 256s114.636719 256 256 256 256-114.636719 256-256-114.636719-256-256-256zm159.960938 256.261719s0 51.917969-6.585938 76.953125c-3.691406 13.703125-14.496094 24.507812-28.199219 28.195312-25.035156 6.589844-125.175781 6.589844-125.175781 6.589844s-99.878906 0-125.175781-6.851562c-13.703125-3.6875-24.507813-14.496094-28.199219-28.199219-6.589844-24.769531-6.589844-76.949219-6.589844-76.949219s0-51.914062 6.589844-76.949219c3.6875-13.703125 14.757812-24.773437 28.199219-28.460937 25.035156-6.589844 125.175781-6.589844 125.175781-6.589844s100.140625 0 125.175781 6.851562c13.703125 3.6875 24.507813 14.496094 28.199219 28.199219 6.851562 25.035157 6.585938 77.210938 6.585938 77.210938zm0 0",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/philreeseaz",
    viewBox: "0 0 512 512",
    path: "m256 0c-141.363281 0-256 114.636719-256 256s114.636719 256 256 256 256-114.636719 256-256-114.636719-256-256-256zm-74.390625 387h-62.347656v-187.574219h62.347656zm-31.171875-213.1875h-.40625c-20.921875 0-34.453125-14.402344-34.453125-32.402344 0-18.40625 13.945313-32.410156 35.273437-32.410156 21.328126 0 34.453126 14.003906 34.859376 32.410156 0 18-13.53125 32.402344-35.273438 32.402344zm255.984375 213.1875h-62.339844v-100.347656c0-25.21875-9.027343-42.417969-31.585937-42.417969-17.222656 0-27.480469 11.601563-31.988282 22.800781-1.648437 4.007813-2.050781 9.609375-2.050781 15.214844v104.75h-62.34375s.816407-169.976562 0-187.574219h62.34375v26.558594c8.285157-12.78125 23.109375-30.960937 56.1875-30.960937 41.019531 0 71.777344 26.808593 71.777344 84.421874zm0 0",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/pages/Phil-Reese-Arizona-Business-Broker/417372185078780",
    viewBox: "0 0 512 512",
    path: "m512 256c0-141.4-114.6-256-256-256s-256 114.6-256 256 114.6 256 256 256c1.5 0 3 0 4.5-.1v-199.2h-55v-64.1h55v-47.2c0-54.7 33.4-84.5 82.2-84.5 23.4 0 43.5 1.7 49.3 2.5v57.2h-33.6c-26.5 0-31.7 12.6-31.7 31.1v40.8h63.5l-8.3 64.1h-55.2v189.5c107-30.7 185.3-129.2 185.3-246.1z",
  },
  {
    label: "Yelp",
    href: "https://www.yelp.com/biz/phil-reese-arizona-business-broker-scottsdale-3",
    viewBox: "0 0 176 176",
    path: "m88 0a88 88 0 1 0 88 88 88 88 0 0 0 -88-88zm-41 103.82a50.7 50.7 0 0 1 .07-10.21c.4-4.1 1.18-9.85 5.19-9.61 1 0 14.42 5.65 24.22 9.69 3.68 1.49 4 7.82-.32 9.14-.21.07-23.47 7.8-24.88 7.8-3.28-.19-4-3.53-4.28-6.81zm40.94 36.65a3.81 3.81 0 0 1 -3.07 2.44q-3.25.56-11-2.33c-4.73-1.77-12.19-4.7-10.6-9.28.6-1.5 11.05-13.71 16.61-20.43 2.58-3.31 8.56-1.2 8.38 3.08.03 1.05.07 25.4-.34 26.52zm-9.5-59.37-22.85-36.67a3.92 3.92 0 0 1 1.14-3.79c3.35-3.64 21.36-8.64 26.11-7.44a3.71 3.71 0 0 1 3 2.75c.28 1.81 2.47 36.53 2.77 42 .39 8.37-5.5 10.61-10.17 3.15zm18.26 6.13c.79-.8 14.16-20.16 15.64-21.16a3.72 3.72 0 0 1 3.93-.14c4 1.92 11.85 13.77 12.34 18.47a4.08 4.08 0 0 1 -1.61 3.84c-1.21.8-23.82 6.15-25.38 6.68l.06-.13c-3.86 1.02-7.58-4.04-4.98-7.56zm32.48 29.53c-.58 4.5-9.56 16-13.71 17.68a3.54 3.54 0 0 1 -3.8-.44c-1.08-.76-13.28-21.19-14-22.32-2.35-3.53 1.46-8.69 5.5-7.25 0 0 23.75 7.8 24.65 8.6a3.73 3.73 0 0 1 1.36 3.73z",
  },
  {
    label: "Google Maps",
    href: "https://maps.google.com/?cid=538136583464168048",
    viewBox: "0 0 32 32",
    path: "m16 0c-8.837 0-16 7.164-16 16s7.163 16 16 16c8.836 0 16-7.164 16-16s-7.163-16-16-16zm.173 24.596c-4.749 0-8.596-3.847-8.596-8.596s3.847-8.596 8.596-8.596c2.321 0 4.261.855 5.748 2.24l-2.423 2.423v-.005c-.902-.86-2.047-1.3-3.325-1.3-2.836 0-5.141 2.396-5.141 5.232s2.305 5.238 5.141 5.238c2.573 0 4.325-1.472 4.685-3.492h-4.685v-3.353h8.085c.107.574.166 1.177.166 1.805 0 4.912-3.288 8.404-8.251 8.404z",
  },
];

// Org JSON-LD sameAs: all known live profiles (footer icons + the brand's
// Facebook/Twitter handles from reference/_discovery.md).
export const socialSameAs: readonly string[] = [
  "https://www.facebook.com/philsellsbiz",
  "https://www.facebook.com/pages/Phil-Reese-Arizona-Business-Broker/417372185078780",
  "https://twitter.com/philsellsbiz",
  "https://www.youtube.com/c/Philsellsbiz",
  "https://www.linkedin.com/in/philreeseaz",
  "https://www.yelp.com/biz/phil-reese-arizona-business-broker-scottsdale-3",
];

/* ---------- Navigation ---------- */
export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface NavGroup {
  label: string;
  href?: string;
  children: NavLink[];
}

// Exact live header menu (menu-menu-remodel-2026) — flat, no dropdowns.
export const primaryNav: NavLink[] = [
  { label: "Home",           href: "/" },
  { label: "About Phil",     href: "/about/" },
  { label: "What Is A CBI?", href: "/what-is-a-cbi/" },
  { label: "For Sellers",    href: "/business-sellers/" },
  { label: "For Buyers",     href: "/business-buyers/" },
  { label: "Testimonials",   href: "/testimonials/" },
  { label: "Listings",       href: "/listings/" },
  { label: "Blog",           href: "/blog/" },
  { label: "FAQ",            href: "/faq/" },
  { label: "Contact Phil",   href: "/contact/" },
];

// Live footer menu band (menu-menu-remodel-2027) — identical 10 items.
export const footerMainMenu: NavLink[] = [...primaryNav];

export const footerLegal = {
  copyrightYear: new Date().getFullYear(),
  // Live: ©2026 Phil Reese, PLC | All Rights Reserved | Privacy Policy | Sitemap | Design and SEO by My Favorite Web Designs
  links: [
    { label: "Privacy Policy", href: "/privacy-policy/" },
    { label: "Sitemap",        href: "/sitemap/" },
    { label: "Design and SEO by My Favorite Web Designs", href: "https://myfavoritewebdesigns.com/", external: true },
  ] as NavLink[],
};
