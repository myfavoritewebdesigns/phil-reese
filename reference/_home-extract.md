# Homepage Extract — philsellsbiz.com (spec for the homepage build task)

> Source: `reference/home-raw.html` (curl'd 2026-06; WP Rocket lazy-load means many
> `src` live in `data-lazy-src` / `<noscript>`). Section class names below are the
> live theme's — the used-CSS for every one of them is in `reference/_css-wpr-usedcss.css`,
> and the live-theme CSS vars (`--primary`, `--secondary`, `--red`, type scale) are
> already aliased in `src/styles/global.css`. Shared scaffolding (`.section`,
> `.section-wrap`, `.one-col`, `.btns`/`.btns-alt`, `.h*-style`, `.strs`) is already
> in `global.css`. Header (`top-hdr` + `hdr-main`) and footer are already built as
> components — do NOT rebuild them per-page.
>
> NOTE: this homepage has **no photo hero** — the "hero" is a light (#f9f9f9) text
> banner. The fixed header sits on white, not over an image. (Archetype A page set,
> but hero-image contrast rules don't apply here.)

## Section order (DOM order, inside `#content > #leftcolumn`)

### 1. `banner-sctn` — Hero banner (light gray #f9f9f9, box-shadow, centered text)
- **H1** `.maintitle.h1-style`: "Thinking About Selling Your AZ Business?" (uppercase via CSS, color `--primary`, clamp(34px,4vw,54px))
- **H2** `.subtitle.h5-style`: "Find Out What It's Really Worth. Confidentially & At No Cost."
- **P** (max-width 800px, justified): "I help Arizona business owners sell their companies quietly, at the right time, and for the best possible price. I have over 20 years of experience working directly with business owners. When you work with me, I can assure you there will be no pressure, no gimmicks, and no surprises"
- **H3** `.sbtext.h4-style`: "I Have Personally Closed Over 97 Million Dollars in Business Sales Across 100+ Transactions"
- `.bnr-inn` row: Google "G logo" inline SVG (multicolor, 156×51 viewBox) + ★★★★★ (`.strs` #ffb300, 25px) + BBB image `https://www.philsellsbiz.com/wp-content/uploads/2018/03/BBB.png` (187×47) — local copy already at `/images/bbb-accredited.png`
- `.badgess-inn > .certified-badges`: same 5 badges as header (IBBA inline SVG `reference/ibba-badge-html.html`, AZBBA, CBI, Top1%, MultiMillion) — CSS shows this block only ≤1024px (desktop hides `.banner-sctn .certified-badges`)
- Layout: single centered column; no CTA button in this section.

### 2. `phil-sctn` — Meet Phil (white bg, 2-col: image 37% / text 63%)
- **Image** (preloaded, fetchpriority=high): `https://www.philsellsbiz.com/wp-content/uploads/2026/03/MrPhil-1.png` (417×588; srcset has `MrPhil-1-213x300.png`)
- **H3** `.maintitle.h3-style` (color `--red`): "Phil Reese"
- Two paragraphs (text justified at desktop), verbatim:
  1. "Selling a business is personal. I know because I've been in your shoes. In 1995, I co-founded First Impression Security Doors out of my garage in Mesa, growing it to a full manufacturing facility in Gilbert with 13 employees before a successful exit in 2001. That company has since grown into Arizona's largest ornamental iron firm."
  2. "Today, I use my over 20 years of Business Brokering expertise to help owners navigate their own exits. I am one of only four business brokers in the state to hold the Master Certified Business Intermediary (MCBI) designation. As the former Ethics Chairman for the Arizona Business Brokers Association (AZBBA), I prioritize confidentiality and integrity throughout the whole sales process, ensuring your legacy is protected."
- **CTA** `.btns.btns-alt`: "Learn More About Phil" → `/about/`
- Mobile (≤900px): image stacks on top, max-width 306px, 4px `--red` bottom border.

### 3. `sold-sctn` — Businesses sold (dark `--secondary` #353535 bg, white text, 3 cols)
- **H3** `.maintitle.h3-style` (full-width title col): "Some of the Businesses I have sold"
- 3 `.sold-col` columns (33% each), each headed by an H4 `.subtitle.h4-style` ("$X <span>Business type</span>", $ figure 45px / label 18px block) + a plain `<ul>`:
  - Col 1: **$31,500,000 Precision Metal Fabricator** + $3,355,000 Auto Body Shop / $2,700,000 Telecom Company / $2,700,000 Third Party MVD Office / $2,450,000 Packaging & Shipping Co. / $1,865,000 Commercial Property Maint Co. / $1,700,000 Architecture Firm / $1,500,000 Grief Support Co. / $1,100,000 Showerhead Manufacturer
  - Col 2: **$7,100,000 Landscape Company** + $1,100,000 Sign Manufacturer / $1,050,000 Magazine Publisher / $1,000,000 Auto Glass Products / $963,000 High-End Wig Boutique / $950,000 Pharmacy / $900,000 Fire Equipment Company / $880,000 Construction Clean Up / $861,500 Truck Accessories Retailer
  - Col 3: **$3,720,000 Grocery Store** + $850,000 HVAC Company / $810,000 Electrical Contractor / $800,000 Party & Event Rental Co. / $750,000 Niche Wood Product Co. / $675,000 Landscape Company / $535,000 Cabinet Manufacturer / $500,000 Metal Manufacturing Company / $499,000 Scale Dealer/Calibration Lab
- No CTA.

### 4. `infogrhp-sctn` — Selling process infographic (white bg, 2-col: title 44% / image 55%)
- **H3** `.maintitle.h3-style` (color `--secondary`): "The Process Of Selling Your Arizona Business <span>Step-By-Step</span>" (span = 1.45em, `--red`, block)
- Decorative `.spt` horizontal rule with dot (pure CSS).
- Desktop: `<a class="desk-imgcol" href="/contact/">` wrapping `<span class="stpone">Step One</span>` + infographic SVG image `https://www.philsellsbiz.com/wp-content/uploads/2026/03/infographic-3.svg` (834×875, lazy-loaded).
- Mobile (≤500px): `.desk-imgcol` hidden; `ul.mob-steps` pill boxes instead — "Step One Contact Phil" / "He'll Determine the Value of Your Business" / "List Your Business" / "Go To Market" / "Screen Business Buyer Candidates" / "Buyer & Seller Meeting" / "Buyer Makes An Offer" / "Buyer Does Due Diligence" / "Close on The Sale" / "Buyer Starts the Training Process", separated by small angled-divider SVGs (`#spt-dt`, inline, fill `--red`), ending with **CTA** `.btns.btns-alt`: "Contact Phil" → `/contact/`.

### 5. `vid-sctn` — Valuation video (light gray #d3d3d3 bg, 5px `--red` bottom border; 2-col: video 43% / title 56%)
- Video col pulls UP out of the section (margin-top:-61px desktop) with drop-shadow.
- **YouTube** via wp-youtube-lyte (lazy embed): video id `ajTOke4_h9A`, poster `https://i.ytimg.com/vi/ajTOke4_h9A/hqdefault.jpg` (noscript fallback `https://i.ytimg.com/vi/ajTOke4_h9A/0.jpg`), player width 853. → Use the template's lite-youtube pattern.
- **H3** `.maintitle.h3-style` (color `--secondary`): "Watch this Video to See How I Go About Determining the Value of Your Business"

### 6. `test-sctn` — Testimonials (bg: linear-gradient 360deg #e8e8e8 0, #e7e7e7 30%, #e7e7E700 100%)
- **H3** `.subtitle.h3-style` (color `--secondary`): "Read What My Past Clients Have Said" (a commented-out `.maintitle` "Arizona Business Broker With 5-Star Rated Reviews" exists in source — keep commented/omit)
- `.google-col` white card (right side, margin-right:-40px): Google "G logo" SVG + "Over 60 reviews" + "5.0 ★★★★★"
- `.main-rvw` featured review (3 paragraphs, full text in home-raw.html lines ~686-688) — **Rickey Woolfolk** ★★★★★, *Empower Academy*, link "Reposted from Google" → `https://maps.app.goo.gl/gQ4DHB1MjVPDqCKB9`
- 3 `.rvw-box` white cards (33% each; full review text in source lines ~694-721):
  1. **Liz Majerczyk**, *Vent Masters* — avatar `https://www.philsellsbiz.com/wp-content/uploads/2026/03/avatar.png` (72×72) — Google link `https://maps.app.goo.gl/PravqkfmGsH2HM3d8`
  2. **Debbie Thompson**, *First Impressions Dental Lab* — avatar `https://www.philsellsbiz.com/wp-content/uploads/2026/03/avatar-2.png` — `https://maps.app.goo.gl/NWEg4mgR83xtb9rn7`
  3. **Vicki Hanna**, *Hope Through Healing Publications* — avatar `https://www.philsellsbiz.com/wp-content/uploads/2026/03/avatar-3.png` — `https://maps.app.goo.gl/gWbt8AKWLFNoT63p8`
- A "Load More" `.btns.btns-alt` exists but is commented out in source — omit.

### 7. `why-sctn` — Five reasons (white bg, 5 icon boxes, 33% each w/ connecting lines)
- **H3** `.maintitle.h3-style` (color `--red`, centered, max-width 800px): "Five of Many Reasons Why You Should Choose Phil Reese to Sell Your Business!"
- 5 `.icon-box` items — circular-bordered icon (`.icons-why`, 112px circle, `--primary` border, connecting lines via ::before/::after) + H4 `.subtitle.h5-style` + paragraph:
  1. **"Former Business Owner"** (inline SVG icon, briefcase/handshake, fill #a82211 via `.icons-why svg{fill:#a82211}`) — "There's a difference between studying business and running one, Phil has done both. He has owned and operated several businesses throughout his career. This first-hand experience allows him to represent sellers with true empathy and insight."
  2. **"Master Certified Business Intermediary"** (inline SVG icon) — "Phil is one of only four business brokers in Arizona to hold the prestigious MCBI designation from the International Business Brokers Association (IBBA). This elite credential represents the gold standard in business brokerage, ensuring your sale is handled with the highest level of expertise."
  3. **"Over 20 Years Experience, Proven Award Winning Agent"** (IMG: `https://www.philsellsbiz.com/wp-content/uploads/2021/05/20-years-2.png`, 83×78, alt "20 years"; circular crop via `.why-sctn .icon-box:nth-child(3) .icons-why img{border-radius:100px}`) — "Since 2001, Phil has closed over $97M in business sales across 100+ transaction. As a top 1% producer at West USA Realty and a multi-year IBBA Chairman's Circle award winner, he combines decades of business brokering knowledge with a consistent, proven track record of results."
  4. **"Free No-Obligation Valuations"** (inline SVG icon, dollar/strikethrough, fill #ba0b18 hard-coded in paths) — "Understanding your business's true market value is the first step to a successful exit. Phil provides confidential, real-world valuations at no cost. Get an honest assessment of what your business could sell for based on current buyer demand and industry-specific data."
  5. **"BBB Member A+Rated"** (inline SVG icon, BBB-style) — "Anyone can claim integrity—very few can prove it. BBB accreditation and an A+ rating reflect a verified track record of trust, ethical business practices, and accountability. Paired with Phil's experience as former AZBBA Ethics Chairman, it ensures your transaction is handled with integrity, discretion, and unwavering professionalism."
- Icon SVGs are large inline blocks in home-raw.html (lines ~736, ~745-907, ~926-936, ~946-956) — extract verbatim like the IBBA badge (`reference/ibba-badge-html.html` pattern).
- No CTA.

### 8. `cta-sctn` — WARNING strip (dark `--secondary` bg, 1-row CTA band)
- **H3** `.maintitle.h3-style` (white): "WARNING!"
- **P** (white, 22px): "Do Not Make These 9 Mistakes When It Comes Time To Sell Your Arizona Business!"
- **CTA** `.btns` (white pill, `--red` text): "Read The List" → `/business-sellers/`

### 9. `map-sctn` — Offices + maps (gradient bg like test-sctn; title + 4 map columns 25% each)
- **H3** `.maintitle.h3-style` (color `--red`): "Serving All of the Phoenix Metro Area"
- **H4** `.subtitle.h5-style` (color `--primary`): "Multiple Offices to Serve You"
- 4 `.mapcol` (each: H3 `.adr-title` office link + lazy Google Maps `<iframe>` 600×450 + "View Map | Get Directions" `.btns.btns-alt` pair, `--secondary` buttons):
  1. "Phil Reese, Arizona Business Broker" → `/scottsdale-business-broker/` — embed `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d252854.69177846215!2d-111.91494006759478!3d33.62451456905646!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x872b741555a9a769%3A0x777d85f1a062a70!2sPhil%20Reese%2C%20Arizona%20Business%20Broker!5e0!3m2!1sen!2spe!4v1773771645825!5m2!1sen!2spe` — View Map `https://maps.app.goo.gl/9H9j9Ei951JDmru69`
  2. "Phil Reese, Arizona Business Broker" → `/phoenix-business-broker/` — embed `...!1d179334.6109529341!2d-111.98946367357986!3d33.363724584715875...!4v1773771680939...` — View Map `https://maps.app.goo.gl/K3cK9ofuJs2KTaiV7`
  3. "Phil Reese, Arizona Business Broker" → `/mesa-business-broker/` — embed `...!1d126785.32359175486!2d-111.86428758295082!3d33.379774947667826...!4v1773771518323...` — View Map `https://maps.app.goo.gl/yQWzAk1gq1yL4qEt6`
  4. "Phoenix <br>Business Broker" → `/phoenix-business-broker/` — embed `...!1d252976.70164133824!2d-112.16530657552893!3d33.5815996356273...!4v1774302238563...` — View Map `https://maps.app.goo.gl/ZJnXdtEL4YGrsRMW7`
  (Full embed URLs + Get Directions URLs verbatim in home-raw.html lines 986-1002. Note: the map-sctn "View Map"/directions links differ slightly from the footer's — use each verbatim in place.)
- A `.img-col` with `maps-mobile.jpg` exists but is commented out in source — omit.

### 10. `ctc-sctn` — Contact form (dark `--secondary` bg; white translucent card `#ffffffc9`)
- **H3** `.maintitle.h3-style` (color `--red`): "Contact Phil for Your Free Confidential Valuation"
- `<hr>` 4px `--primary` rule.
- **CF7 form** (id 4486) → rebuild against `/api/contact`, keep legacy payload keys (fill `reference/form-map.csv`):
  | live field name | type | required | placeholder/notes |
  |---|---|---|---|
  | `your-name-bt` | text | yes | "Name*" (label visually hidden) |
  | `your-email-bt` | email | yes | "Email*" |
  | `your-phone-bt` | tel | no | "Phone" |
  | `your-message-bt` | textarea | yes | "Your Message*", maxlength 2000 minlength 20 |
  | `bst-way-bt` | radio | — | "Best Way to Reply:" Email (default checked) / Phone / Text |
  | submit | — | — | value "Send" (red pill `--red`→`--primary` bg, uppercase) |

### Footer (already componentized — see `src/components/Footer.astro`)
Maroon menu band (10 items) → charcoal area: full logo + YouTube/LinkedIn/Facebook/Yelp/Google icons + BBB badge link, 4 office address blocks (each with own phone, shared `phil@philsellsbiz.com`), copyright "©2026 Phil Reese, PLC | All Rights Reserved | Privacy Policy | Sitemap | Design and SEO by My Favorite Web Designs".

## SEO head facts (preserve)
- `<title>`: "Phil Reese, Arizona Business Broker | Offices In Scottsdale & Phoenix"
- og:site_name (live): "Phil Reese Sells Arizona Businesses"
- Favicon: `https://www.philsellsbiz.com/wp-content/uploads/2025/09/favicon.png` (local: `/images/favicon.png`)
- GA tag `G-N1LP9PDFMD`; Facebook/Bing/ClickCease pixels present on live (decide with Josh whether to carry over).

## Every homepage image URL (absolute, live)
| URL | Used in | Local copy |
|---|---|---|
| https://www.philsellsbiz.com/wp-content/uploads/2026/05/Logo-Phill-Reese-MCBI-1.svg | header logo | /images/logo-phil-reese-mcbi.svg ✓ |
| https://www.philsellsbiz.com/wp-content/uploads/2021/04/top-banner-logo-2.png | header + banner badges (AZBBA) | /images/badge-azbba.png ✓ |
| https://www.philsellsbiz.com/wp-content/uploads/2026/03/CBI-logo-2.png (+ CBI-logo-2-120x120.png srcset) | header + banner badges | /images/badge-cbi.png ✓ |
| https://www.philsellsbiz.com/wp-content/uploads/2026/03/Top1Percent_Badge_2025-3.png | header + banner badges | /images/badge-top1percent-2025.png ✓ |
| https://www.philsellsbiz.com/wp-content/uploads/2026/03/MultiMillionDollarProducers_Badge_2025-3.png | header + banner badges | /images/badge-multimillion-2025.png ✓ |
| https://www.philsellsbiz.com/wp-content/uploads/2026/05/west-usa.png | header badges | /images/badge-west-usa.png ✓ |
| https://www.philsellsbiz.com/wp-content/uploads/2018/03/BBB.png | banner + footer | /images/bbb-accredited.png ✓ |
| https://www.philsellsbiz.com/wp-content/uploads/2026/03/MrPhil-1.png (+ MrPhil-1-213x300.png srcset) | phil-sctn | TODO (homepage task) |
| https://www.philsellsbiz.com/wp-content/uploads/2026/03/infographic-3.svg | infogrhp-sctn | TODO |
| https://i.ytimg.com/vi/ajTOke4_h9A/hqdefault.jpg (+ /0.jpg noscript) | vid-sctn poster | TODO |
| https://www.philsellsbiz.com/wp-content/uploads/2026/03/avatar.png | test-sctn review 1 | TODO |
| https://www.philsellsbiz.com/wp-content/uploads/2026/03/avatar-2.png | test-sctn review 2 | TODO |
| https://www.philsellsbiz.com/wp-content/uploads/2021/05/20-years-2.png | why-sctn icon 3 | TODO |
| https://www.philsellsbiz.com/wp-content/uploads/2026/03/avatar-3.png | test-sctn review 3 | TODO |
| https://www.philsellsbiz.com/wp-content/uploads/2026/05/Full-Logo-Phill-Reese-MCBI-1-1.svg | footer logo | /images/logo-phil-reese-mcbi-full.svg ✓ |
| https://www.philsellsbiz.com/wp-content/uploads/2025/09/favicon.png (+ favicon-120x120.png) | favicons | /images/favicon.png ✓ |
| https://www.philsellsbiz.com/wp-content/uploads/2026/03/maps-mobile.jpg (+ -300x243) | map-sctn — **commented out on live** | omit |

Inline SVGs (no URL — extract verbatim from home-raw.html): IBBA badge (header+banner; saved at `reference/ibba-badge-html.html`), Google G logo ×2 (banner, test-sctn), mobile-steps divider `#spt-dt` ×4, why-sctn icons 1/2/4/5, top-hdr mail + phone icons (already in Header.astro).
