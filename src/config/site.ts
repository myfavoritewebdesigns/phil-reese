/* -----------------------------------------------------------------------
   SITE CONFIG — single source of truth for every page.
   Replace all TODO values before going live.
   Never hard-code phone/email/address/social URLs in components.
   ----------------------------------------------------------------------- */

export const SITE_URL  = "https://TODO.com";           // TODO: live domain
export const SITE_NAME = "TODO Site Name";              // TODO
export const LEGAL_NAME = "TODO Legal Name";            // TODO

export const contact = {
  phone: "(TODO) 000-0000",                             // TODO
  tel:   "+10000000000",                                // TODO E.164 format
  telDashed: "+1-000-000-0000",                         // TODO dashed (for JSON-LD)
  email: "TODO@example.com",                            // TODO
  mapUrl: "https://g.page/TODO?share",                  // TODO Google Maps share link
  address: {
    street:     "TODO",
    city:       "TODO",
    region:     "AZ",                                   // TODO 2-letter state
    postalCode: "00000",                                // TODO
    country:    "US",
    lat:        0,                                      // TODO
    lng:        0,                                      // TODO
  },
} as const;

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

/* ---------- Form reply methods ---------- */
export const replyMethods = ["Call", "Text", "Email"] as const;

/* ---------- Social profiles ---------- */
interface SvgSocial { label: string; href: string; useImg?: false; path: string; }
interface ImgSocial { label: string; href: string; useImg: true; imgSrc: string; path?: never; }
export type SocialLink = SvgSocial | ImgSocial;

// TODO: populate social URLs and SVG paths
export const headerSocials: SocialLink[] = [];
export const footerSocials: SocialLink[] = [];
export const socialSameAs: readonly string[] = [];

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

// TODO: replace with actual nav structure
export const primaryNav: NavLink[] = [
  { label: "Home",    href: "/" },
  { label: "About",   href: "/about/" },
  { label: "Contact", href: "/contact/" },
];

export const footerMainMenu: NavLink[] = [
  { label: "Home",    href: "/" },
  { label: "About",   href: "/about/" },
  { label: "Contact", href: "/contact/" },
];

export const footerLegal = {
  copyrightYear: new Date().getFullYear(),
  links: [
    { label: "Privacy Policy",      href: "/privacy-policy/" },
    { label: "Designed by MFWD",    href: "https://myfavoritewebdesigns.com/", external: true },
  ] as NavLink[],
};
