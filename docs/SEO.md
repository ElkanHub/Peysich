# SchoolSpec — search and sharing

What each address does when a search engine crawls it or someone pastes it into
WhatsApp, Facebook, X or LinkedIn. Kept deliberately small: three public pages and
everything else private.

## The map

| Address | Indexed? | Title | Share card | Why |
|---|---|---|---|---|
| `schoolspec.com/` | **Yes** | SchoolSpec — school management software for basic schools in Ghana | og.jpg | The one page that sells |
| `schoolspec.com/signup` | **Yes** | Start your free trial · SchoolSpec | og.jpg | People search "SchoolSpec sign up" |
| `schoolspec.com/sign-in` | Yes | Sign in · SchoolSpec | og.jpg | People search "SchoolSpec login" |
| `www.schoolspec.com/*` | 308 → apex | | | One address, no duplicate copy |
| `<school>.schoolspec.com/*` | **No** (`X-Robots-Tag: noindex` on every response + meta) | | | Private |
| `admin.schoolspec.com/*` | **No** (header + meta) | Console · SchoolSpec | | Private |
| `/sign/<token>` | No (meta) | | | One-time phone signing link |
| `/offline` | No (meta) | | | App shell only |
| `/api/*`, `/t/*`, `/go` | robots disallow | | | Plumbing |

`robots.txt` and `sitemap.xml` are generated (`src/app/robots.ts`, `src/app/sitemap.ts`)
from `NEXT_PUBLIC_ROOT_DOMAIN`, so they carry the real domain in production.

## The share card

`public/og.jpg`, 1200×630, ~140 KB JPEG. The size is on purpose: WhatsApp, where
school owners actually share links, drops previews above about 300 KB. Its source is
`scripts/og-card.html`; `npm run brand:assets` regenerates it with the icons.
Every public page carries it with `og:image:width/height/alt` and a
`summary_large_image` Twitter card, via `pageMeta()` in `src/lib/seo.ts`.

## Structured data (the landing page)

One JSON-LD script with four things, all built from the same data the page shows:

- **Organization** — name, logo, email, area served (Ghana).
- **WebSite** — the site, in `en-GH`.
- **SoftwareApplication** — category EducationalApplication, feature list, and an
  `AggregateOffer` with the live plan prices in GHS per month (from `getPublicPlans`,
  so a price change on the Plans console changes the rich result too).
- **FAQPage** — the five questions on the page, word for word (same `FAQ` array).

## How to check it after a deploy

- Google: search.google.com/test/rich-results with `https://schoolspec.com/`.
- Facebook / WhatsApp: developers.facebook.com/tools/debug/ — paste the URL, press
  **Scrape again** after any change to the card (both cache old previews).
- LinkedIn: linkedin.com/post-inspector/.
- Search Console: add the property `schoolspec.com` (DNS record, since the domain's
  DNS is at Vercel), submit `https://schoolspec.com/sitemap.xml`.
- A school subdomain must answer with `x-robots-tag: noindex, nofollow`:
  `curl -sI https://stmarys.schoolspec.com/sign-in | grep -i x-robots`.

## Not done, on purpose

- No blog or city pages yet. When there is a second thing worth ranking for
  (e.g. "report card template Ghana"), it goes under `schoolspec.com/…` with its own
  `pageMeta()` and a sitemap entry.
- No social profile links in the Organization block, because there are none yet.
  Add `sameAs: [...]` when the WhatsApp Business, Facebook or LinkedIn pages exist.
