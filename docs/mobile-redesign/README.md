# Phone redesign — analysis and proposal

Open `index.html` in a browser for the mockups (every screen in a phone frame with
notes). `IMAGE_PROMPTS.md` is the file for Codex. Nothing in the app has been changed.

## 1. What your friend saw, and why

I read the Pinterest screenshots (Screenshots 14–21) and the app's phone code. The
diagnosis is simple and it is not taste: **the app owns good photographs and a whole
illustration style, and the phone never shows any of them.**

- `WelcomeHero` draws the dashboard photo with `hidden sm:block`. Below 640px: no image.
- `Door` draws the three sign-in scenes with `hidden lg:flex`. Below 1024px: an empty ink band.
- Every list is a `DataTable`, and `globals.css` turns it into "Header: value" text cards
  below 768px. That is the "everything has collapsed" look on Students, Staff, Parents, Homework.
- Class and view chips are `flex-wrap`, so twelve classes become a three-line cluster on Scores,
  Timetable and Fees.
- Filters are native `<select>`s in a wrapping row next to a 224px search box.
- Two bars of chrome on every page (ink band 52px + breadcrumb bar 48px) before any content.
- The welcome card and the term strip both say the date, the term and the week. Students
  shows 4 stat tiles, 4 grey link buttons and two warning boxes before the list starts.

So the phone is text on white cards on grey, 5px corners, and the list people came for is a
screen and a half down. Nothing is wrong with the information. It is the packaging.

## 2. What the reference screens have in common

Across the ~40 app shots in your screenshots, the same five moves repeat:

1. **A hero with a person or a picture**, greeting, one big number or one big action.
2. **Tonal tiles** (soft fills, not outlined boxes) with a small illustration in a corner.
3. **Rows, not tables**: avatar / icon tile on the left, title, one subtitle, value or chevron.
4. **One horizontal row of chips** for days, classes or categories; the active one is filled.
5. **Big corners** (16–24px) on surfaces, generous but not airy spacing, a short page.

None of these require abandoning the SchoolSpec language. Wine, ink, paper, the mono
eyebrow labels, Geist, the fixed status colours — all kept. The changes are to packaging on
phones only.

## 3. The proposal — eight shared changes

These eight changes do most of the work; the per-screen mockups are mostly these applied.

| # | Change | Where it lives |
|---|---|---|
| 1 | **Images on phones.** Un-hide the hero photo (as a full-bleed background with a dark gradient and white text) and the door scene (top 46% of sign-in). | `welcome-hero.tsx`, `door.tsx` |
| 2 | **One top bar on phones** (56px, ink): school, role, bell, avatar. Inner pages: back arrow + title + one action, on paper. Breadcrumbs become desktop-only. | `shell.tsx`, `nav.tsx` |
| 3 | **Rows instead of collapsed tables.** A `Row` primitive (avatar, title, subtitle, trailing) that every list uses below `md`; `DataTable` keeps the table above `md`. Delete the "Header: value" CSS. | `kit.tsx`, `globals.css`, each list page |
| 4 | **Chips never wrap.** One horizontal snap-scrolling row; active chip is ink-filled. Applies to classes, children, days, terms. | `kit.tsx` (new `ChipRow`) |
| 5 | **Filter sheet.** Search + one Filter button (with a count badge) opening a bottom sheet; the native selects go. | `list-controls.tsx` |
| 6 | **Segmented control** for 2–4 way views (By student / By subject, Profile / Academics / …, Owing / Paid). | `kit.tsx` (`Tabs` on phones) |
| 7 | **Stats as a swipe strip** and **tiles with spot art** for actions. Fewer cards: sections are a header + a list or a sheet; cards only where something is lifted (hero, balance, summary). | `kit.tsx` (`Stat`, new `Tile`), dashboards |
| 8 | **Phone radius.** Surfaces 18px, controls 12–14px, chips full. Desktop keeps 5px. One variable in `globals.css` under a `max-md` query. | `globals.css` |

Plus: merge the term strip into the hero chips (kills the redundancy), empty states as a
kraft card with a risograph illustration, and a floating Save bar on marking screens.

## 4. Images — the strategy

You already have **three image families**. I recommend using exactly those, not a fourth.

| Family | Looks like | Use on phones |
|---|---|---|
| **Photographs** (`public/hero/*.jpg`) | real Ghanaian classroom / home scenes, warm light | Home heroes, Attendance headline card, Settings header. Portrait re-cuts needed (phones crop landscape badly). |
| **Cut-outs** (`public/door/*.webp`) | people cut out on transparent, lit from below in wine | Sign-in scene, student/staff file hero fallback. Already usable. |
| **Risograph duotone** (`public/marketing/*.webp`) | wine ink on kraft paper, halftone grain | Everything small and decorative: spot art on tiles and cards, empty states, the drawer header, the balance card. Tiny files, hides compression, reads in dark mode, and it is *yours* — nobody else's app looks like it. |

The Pinterest shots lean on glossy 3D objects. I would not chase that: it is everyone's look
this year and it fights wine-and-kraft. The risograph spots give the same "there is a picture
here" effect with the brand's own voice. Every prompt is in `IMAGE_PROMPTS.md` with
filename, size and where it is used.

## 5. Decisions I need from you

1. **Phone radius 18px on surfaces** — yes, or keep 5px everywhere? (Mockups use 18.)
2. **One top bar** — this drops breadcrumbs on phones. The back arrow + title replaces them. OK?
3. **Risograph spots vs. 3D objects** for tile art. My recommendation is risograph; say if you want the 3D look instead and I will rewrite the prompts.
4. **Setup checklist** on a brand-new school's home: keep as a progress card under the hero (mockup assumes yes).
5. **Register marking screen** — build the mockup's P/L/A rows, or keep the current widget and only restyle? I did not open the current one in a browser (no dev server running).
6. **Child photos on the parent home** — show the school's photo of the child on the card, or keep initials for privacy?

## 6. Build order (once you say go)

1. `globals.css` phone radius + delete the collapsed-table CSS. `kit.tsx`: `Row`, `ChipRow`, `Tile`, segmented `Tabs`, strip `Stat`. `list-controls.tsx`: filter sheet. *(one day)*
2. Shell: single phone top bar, drawer header, page-title bar for inner pages. *(half a day)*
3. Door + the four homes. *(one day)*
4. Lists: Students, Staff, Parents, Scores, Attendance, Fees, Homework, Announcements. *(two days)*
5. Files, settings, account, calendar, timetable, empties. *(one day)*
6. Drop in generated images as they land; placeholders render as wine blocks until then.

Everything is phone-only (`max-md`) so the desktop is untouched.
