# Phone redesign — image prompt sheet

Generate each image and save it under **exactly** this path. WebP (or PNG where
transparency is needed), sRGB. Sizes are minimums; keep the aspect ratio. The
mockups in `docs/mobile-redesign/screens/` show a grey/wine block labelled
`img: <id>` wherever one of these goes.

Three families. Paste the family's style block before every prompt in that family.

---

## Family A — Risograph spots (`public/spot/`)

Small decorative illustrations that sit in the corner of a tile or card, in an
empty state, or beside a heading. They must read at 60px and at 200px.

**Style block (paste first):**

> Two-tone risograph print illustration: deep wine ink (#5E1D3E) on warm kraft
> exercise-book paper (#E8DFD0). Heavy halftone grain and dither, visible pencil
> line-work under flat printed shapes, slight screen-print misregistration, matte
> finish. Strictly duotone — wine as solid, as halftone tint and as thin line; paper
> as the only light. A single object or tiny scene, centred, generous empty paper
> around it, no background scenery, no frame, no text, no lettering, no logos.
> Ghanaian school objects: plain, worn, real.

| File | Size | Used on | Scene |
|---|---|---|---|
| `spot-register.webp` | 600×600 | Teacher home register card, Attendance tiles, Student home | An open attendance register book, lined pages, a pencil resting in the gutter, two tick marks visible. |
| `spot-add-student.webp` | 600×600 | Head home "Add a student" tile | A single blank school exercise book with a small crest shape on the cover, and a pen laid diagonally across it. |
| `spot-megaphone.webp` | 600×600 | "Message parents" tile, Announcements | A hand-held megaphone, three short sound lines, viewed three-quarter. |
| `spot-receipt.webp` | 600×600 | "Take a payment" tile, Fees office card | A paper receipt with a round rubber stamp impression, a few coins beside it. |
| `spot-report-card.webp` | 600×600 | Student "My results" tile, Scores | A folded report card with a small crest at the top and two signature lines, a gold-ish (halftone) star sticker. |
| `spot-homework-desk.webp` | 800×600 | Homework summary card | An exercise book open on a desk corner, a pencil and a wooden ruler, a mango on the desk edge. |
| `spot-staff-room.webp` | 600×600 | Staff "Who teaches what" tile | A corkboard with a pinned timetable sheet and two drawing pins. |
| `spot-leave.webp` | 600×600 | Staff "Leave requests" tile | A small desk calendar with three days crossed out in wine. |
| `spot-admissions-gate.webp` | 600×600 | Students page draft-admissions card, Admissions | A school gate, half open, with a small signboard shape (blank) above it. |
| `spot-momo-phone.webp` | 800×700 | Parent fees balance card (sits on INK — generate on kraft, we will knock out the paper) | A phone held in one hand with a plain lit screen, a folded cedi note tucked behind it. |
| `spot-phone-home.webp` | 600×600 | Account "Install" card | A phone face-up with a grid of blank app-icon squares and one highlighted square. |
| `spot-calendar.webp` | 600×600 | Calendar, events | A wall calendar on a nail, one page lifting at the corner. |
| `spot-bus.webp` | 600×600 | Transport | A yellow-less (wine) school bus, front three-quarter, "SCHOOL" sign area left blank. |
| `spot-library.webp` | 600×600 | Library | Three books leaning on a shelf, one lying flat. |
| `spot-inventory.webp` | 600×600 | Inventory | A stack of three cardboard boxes with a bundle of chalk on top. |
| `spot-help.webp` | 600×600 | Help page | A hand-drawn question mark on a torn exercise-book corner, with a coffee ring. |
| `spot-settings.webp` | 600×600 | School settings rows | A ring of keys on a wooden tag. |
| `spot-trophy.webp` | 600×600 | Inter-house sports / events | A small sports trophy with a ribbon. |

### Empty states (same family, wider)

| File | Size | Used on | Scene |
|---|---|---|---|
| `empty-students.webp` | 900×600 | Students empty | A row of four empty school desks and chairs in a classroom, morning light through louvres, no people. Inviting, not sad. |
| `empty-staff.webp` | 900×600 | Staff empty | An empty staff-room table with one mug and a kettle. |
| `empty-homework.webp` | 900×600 | Homework empty | A closed exercise book with a pencil on top, a sleeping cat beside it. |
| `empty-notices.webp` | 900×600 | Announcements empty | A corkboard with only drawing pins and one torn paper corner. |
| `empty-caught-up.webp` | 900×600 | "All caught up" | A teacher's chair tipped back, feet (sandals) up on the desk edge, a fan turning above. |
| `empty-offline.webp` | 900×600 | Offline page | A phone on a desk with a tiny paper aeroplane folded next to it, and a window with a cloud outside. |
| `empty-search.webp` | 900×600 | No results | A magnifying glass over a blank register page. |

---

## Family B — Portrait photographs (`public/hero/`)

Phone heroes crop landscape photos badly (faces disappear). We need portrait /
square re-cuts of the four role scenes plus two new scenes. Same look as the
existing `hero/*.jpg`: real-looking, warm, unposed, Ghanaian basic school.

**Style block (paste first):**

> Photorealistic editorial photograph, natural light, warm tones, shallow depth of
> field, 35mm look, no text or logos anywhere, no brand clothing. Ghanaian basic
> school: louvre windows, ceiling fans, plain uniforms, exercise books, a compound
> with a flagpole and a mango tree. Subject placed in the LOWER TWO THIRDS of the
> frame with calm space above (white text will sit over the top third). Faces
> natural, varied, nobody in distress.

| File | Size | Used on | Scene |
|---|---|---|---|
| `hero-admin-portrait.jpg` | 1200×1500 (4:5) | Head teacher home | A head teacher in her fifties at her office desk, early morning, register book open, phone face-up, looking out of a louvre window toward the compound. |
| `hero-teacher-portrait.jpg` | 1200×1500 | Teacher home | A young male teacher at the blackboard edge, chalk in hand, turning to the class with a slight smile; pupils softly out of focus. |
| `hero-parent-portrait.jpg` | 1200×1500 | Parent home | A mother on a veranda step at dusk reading her phone, a small child leaning on her shoulder; phone screen a plain lit rectangle. |
| `hero-student-portrait.jpg` | 1200×1500 | Student home | A JHS girl at her desk, exercise book open, pen to chin, looking up thoughtfully; window light from the left. |
| `hero-attendance-portrait.jpg` | 1200×1200 (1:1) | Attendance office board card | Over-the-shoulder of a teacher's hand holding a phone (plain lit screen) at chest height; rows of pupils at desks beyond, one hand raised. |
| `hero-pta-portrait.jpg` | 1200×1200 | Announcement / event picture cards | Parents seated on plastic chairs under a canopy on the school compound, a head teacher standing with a microphone, afternoon light. |
| `hero-campus-portrait.jpg` | 1200×900 (4:3) | School settings header (fallback when the school uploads none) | A single-storey classroom block with a veranda and pillars, flagpole, mango tree, children arriving in uniform, early morning. |

---

## Family C — Cut-outs (`public/door/`)

The three existing cut-outs already work on the phone sign-in. Only generate these
if you want variety; same look as `door/students.webp`.

**Style block (paste first):**

> Studio cut-out photograph on a fully transparent background (PNG), bust to
> waist, lit softly from below-front with a faint warm wine-coloured bounce,
> looking at the camera, relaxed and friendly. Ghanaian basic school, plain
> uniform or plain work clothes, no text, no logos. Leave transparent space above
> the head.

| File | Size | Scene |
|---|---|---|
| `door-parent.png` | 1400×1400 | A father in a work shirt holding a phone, and a small girl in uniform holding his other hand. |
| `door-head.png` | 1400×1400 | A head teacher in her fifties, glasses, a register book under her arm. |
| `door-kids.png` | 1400×1400 | Three KG children in uniform, one mid-laugh, one holding a slate. |

---

## Family D — Drawer header (`public/spot/`)

| File | Size | Used on | Scene |
|---|---|---|---|
| `drawer-campus.webp` | 1200×600 | Menu drawer header (on INK; wine lines on transparent) | Isometric line drawing in thin wine (#E9A9C9 on transparent) lines only, no fills: a classroom block with veranda, flagpole, mango tree, a water tank. Blueprint feel, some construction lines left. Transparent PNG. |

---

## Notes for the generator

- Strictly duotone for Family A. If a third colour creeps in, add "strictly wine on
  kraft, no other hues, tiny paper-white highlights only".
- Phones in photos are always a plain lit rectangle — never draw a UI.
- Keep the grain on Family A; it is the texture that makes the style and it
  compresses well.
- Target file sizes: spots under 40 KB, portraits under 180 KB, empties under 80 KB.
