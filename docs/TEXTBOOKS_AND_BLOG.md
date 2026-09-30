# SchoolSpec Textbooks and the blog — the plan

Status: **idea, agreed in principle, not yet built.** The mock-up of the textbook
(cover, shelf, reader with scroll and book views, in-page video) is the artifact
"SchoolSpec Textbooks". This file holds the decisions, the open questions, and the
blog list so nothing is lost between now and the build.

---

## 1 · What the textbooks are

- Online learning resources written by SchoolSpec to the Ghana Education Service /
  NaCCA curriculum: the Standards-Based Curriculum for KG and B1–B6, and the Common
  Core Programme for JHS 1–3. Creche and nursery follow the early-years guidance.
- Every subject, every level, Creche to JHS 3. Start with **Basic 4 Mathematics and
  English** (the biggest cohort, the clearest curriculum), then widen.
- Written by us, drawing on the books schools already use, in our own words and
  pictures. Every chapter ends with the curriculum reference (strand, sub-strand),
  the edition and the revision number, so a teacher can cite it and see it changed.
- **Updated, never out of print.** When a GES directive changes, the chapter changes
  and the revision number goes up. A change log per book.
- **Read-only.** Nothing to fill in or submit. The exercise book stays paper.
- **Printed-book feel.** A proper cover (bold title, level, subject colour, our
  mark, "Online learning resource" on the cover and the footer), running heads, page
  numbers, figures with captions, worked examples in boxes, "Try it" panels,
  exercises at the end of each section.
- **Pictures where the printed books have pictures; video where a picture is not
  enough.** The video plays inside the page where its thumbnail sits. No leaving the
  book, no YouTube adverts. We host the files (Cloudflare R2, same as photos) and
  serve a low-quality rendition for 2G.
- **Two views, the reader's choice, remembered on the device:** *Scroll* (pages top
  to bottom, like a PDF) and *Book* (a two-page spread that turns with a page-flip,
  left to right). The flip is the fun one for pupils; scroll is the fast one.

### The "online resource" framing

Printed textbooks used in schools go through NaCCA approval. Ours are published as
online learning resources, stated plainly on every cover, and never described as
approved or prescribed. Two cautions to keep in mind so the framing holds:

- Say "written to the GES curriculum", never "GES textbook" or "approved by GES".
- Own the words and pictures. Drawing on existing books for scope and sequence is
  fine; copying their text, exercises or figures is not.

---

## 2 · Free or paid — the brainstorm

**Decision leaning: the books are free to read, for everyone, always.** Reasons:

1. They are the reason parents and teachers open the app on a day nothing happened.
2. They are the SEO engine: hundreds of pages of real curriculum content that
   Google can rank for "Basic 4 fractions", "JHS 2 integrated science notes",
   "BECE past questions". Nothing else we could write ranks like that.
3. A free book on every parent's phone is the sales pitch walking into schools we
   have never visited.

**What we charge for: the parts only one kind of person needs, at the moment they
need them.** Candidates, strongest first:

| Paid thing | Who pays | Why they would | Where it plugs in |
|---|---|---|---|
| **Teacher's edition per chapter**: lesson notes and a scheme of work aligned to the chapter, the marked answers to every exercise, and printable worksheets | The school, as part of the Standard plan and up (or a "Learning" add-on) | Lesson notes are the most procrastinated paperwork a teacher has; GES inspectors ask for them | The teacher's Scores and Homework pages link the chapter they are on |
| **BECE prep for JHS 3**: past questions by topic with worked video solutions, timed mocks, a readiness view for the parent | The parent, per child, per term | It is the one thing parents already pay for elsewhere (extra classes, past-question books) | The child's card: "BECE readiness" |
| **The school's own edition**: crest and colour on every cover and page, PDF download for printing | The school, a Standard-plan perk | Makes the book feel like theirs; a printed copy for the library | School settings → Branding |
| **Offline downloads of whole books** | Free in the app; PDF export paid | The PDF is what people share and print | Reader → Download |
| **Video solutions to every exercise** | Parent, per child, or in the teacher's edition | The question after every exercise is "how did they get that?" | Under each exercise |

**Do not charge for:** reading, the in-book lesson videos (they are what make the
book better than paper), or anything a pupil needs to follow the class. Charging a
pupil to read is the fastest way to kill the retention loop.

**How the retention loop closes:** the school's timetable knows which chapter each
class is on this week. The parent's child card gets a line "This week in Basic 4:
Fractions →" that opens the chapter. The teacher's lesson tile gets the same link.
The book is never more than one tap from the thing that brought them in.

---

## 3 · Open questions (need Elkanah's answer)

1. Free to read, paid teacher's edition and BECE prep — agreed as the starting
   shape? Or bundle everything into plans and charge nothing per child?
2. Who writes? One subject at a time by you with a subject teacher reviewing, or
   commission teachers per subject and edit? (Budget and time decide the first year's
   shelf.)
3. Videos: record our own (a teacher, a whiteboard, a phone) or license? Our own
   keeps the "no adverts, plays in the page" promise.
4. Start with Basic 4 Mathematics and English, or with JHS 3 where BECE gives the
   clearest paid product?

---

## 4 · How it gets built, when it is time

- **Content lives as data, not code.** One folder per book (`content/books/b4-maths/`),
  one Markdown file per chapter with front matter (title, strand, sub-strand,
  revision), figures as SVG or WebP alongside, videos as R2 keys. A build step turns
  it into pages. Writers never touch the app.
- **Routes:** `/textbooks` (the shelf, public, indexed) → `/textbooks/b4/mathematics`
  (the book, public) → `/textbooks/b4/mathematics/3-fractions` (a chapter, public,
  the SEO unit). Inside the app the same pages render in the shell with the
  "This week" links and the paid layers unlocked by plan.
- **SEO per chapter:** title "Fractions — Basic 4 Mathematics · SchoolSpec
  Textbooks", description from the objectives box, `LearningResource` +
  `Course` structured data with `educationalLevel` and `teaches`, the chapter in the
  sitemap, a share card per book (cover) generated the same way as `og.jpg`.
- **The reader** is the mock-up made real: scroll view is plain HTML; book view is
  the CSS flip in the mock-up (two faces on one leaf, `rotateY`), with keyboard and
  swipe. Video is a plain `<video>` with two renditions and a poster.

---

## 5 · The blog — first twenty posts

The blog is the second engine. Rules: every post answers a question a head, teacher
or parent actually types into Google or asks in a WhatsApp group; plain English;
one useful thing per post; screenshots from the real app where the app is the
answer; never a sales pitch above the fold. Route `/blog/<slug>`, indexed, with
`Article` structured data and the author named.

| # | Title | Who searches for it | The one useful thing |
|---|---|---|---|
| 1 | How to mark a class register in 30 seconds | Teachers, heads | The default-present method, on paper or phone |
| 2 | The GES report card, explained line by line | Parents, new teachers | What each box means, A1–F9, "position", class work vs exam |
| 3 | How Ghanaian basic schools compute class scores and exam scores (and the 30/70 split) | Teachers | The arithmetic, with one worked pupil |
| 4 | A term-by-term calendar for a Ghanaian private school, with the dates that matter | Heads | Term dates, when to bill, when to publish |
| 5 | Sending fee reminders that parents actually pay: what to write and when | Heads, bursars | Three SMS templates, timing, tone |
| 6 | How to run a school with mobile money and never lose a receipt | Heads, bursars | The MoMo-to-the-school flow, confirm-the-name rule, receipting |
| 7 | Why parents ignore school notices, and the three that get read | Heads | Length, timing, one ask per notice |
| 8 | Setting up your school's first timetable without a clash | Heads | Periods first, subject teachers second, class teachers last |
| 9 | Class teacher or subject teacher: how to run JHS 1 to 3 | Heads | The two modes and what each changes |
| 10 | What a head teacher should check every morning before assembly | Heads | The 90-second list |
| 11 | How to import 300 pupils from an exercise book into a computer in one afternoon | Heads, office | The sheet, the four columns, the pitfalls |
| 12 | BECE 2027: the timeline every JHS 3 parent should know | Parents | Registration, mocks, results, what to do each month |
| 13 | How much should a private basic school charge in fees? A worked example | Proprietors | Cost lines, class size, the arithmetic |
| 14 | Keeping a GES-style attendance record book: what inspectors look for | Heads, teachers | The columns, the weekly totals, the common mistakes |
| 15 | The difference between an absence, a late and an excused absence, and what parents should be told | Teachers, parents | The SMS rule |
| 16 | How to write a teacher's lesson notes in half the time | Teachers | The template, tied to the curriculum strand |
| 17 | Fractions in Basic 4: how to teach it so they get it (with the pictures) | Teachers, parents | The first free chapter, repurposed |
| 18 | Scholarships, discounts and part payments: keeping the fee ledger honest | Bursars | How to record each without losing the balance |
| 19 | Promotion, repeating and graduating: how to close the school year cleanly | Heads | The order of operations, the JHS 3 leavers |
| 20 | Registering a private school in Ghana: the steps and the offices | Proprietors | GES registration, DPC, what to keep on file |

Posts 1, 2, 5, 6 and 10 first: they are the pitch, and they are what a head
searches for the week before term.
