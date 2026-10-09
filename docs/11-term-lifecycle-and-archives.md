# 11 — Term lifecycle, Archives and the dormant school

The cycle of use. A school lives in terms; the app must open them, close them, keep what
they produced, and go quiet gracefully when the school stops paying. This document is the
plan we implement from. It records what the code does today, the model we agreed, the
decisions taken, the build in order, and the help entries that teach it.

---

## 1. What the code does today (October 2026)

- **The current term is a guess.** `getCurrentTerm()` in `src/core/school-context.ts` picks
  the term whose dates contain today; failing that, the one flagged `isCurrent`; then the
  next upcoming; then the last one. For the demo school every term ended by July 2026, so it
  lands on the flagged Term 2, which ended in April.
- **Writes keep flowing into the ended term.** Attendance, score sheets, skills ratings, fee
  items and invoices all stamp that term's id. No action checks that the date falls inside
  the term's window or that the term is still open. `scoresLocked` is the only lock, and it
  flips when report cards are published, not when the term ends.
- **No open or close action exists.** Term state is three things that nobody owns together:
  dates in Settings, the `isCurrent` flag set by year-setup actions, `scoresLocked` from
  publishing. Year-end promotion (`settings/promotion-actions.ts`) creates the next year with
  hard-coded 1 Sep to 31 Jul dates cut into three equal thirds.
- **Past data is reachable piecemeal.** Reports takes `?t=` and shows a "viewing past term"
  banner; the record book has term chips; `enrollments` records each student's class per
  year. Nothing else looks back, and no page lists the years.
- **Billing is a separate clock.** `src/core/billing.ts` sets school status (trial, active,
  past_due, suspended) from `trialEndsAt`, `periodEnd` and a grace window. Suspended blocks
  the whole school in `s/[school]/layout.tsx`. Terms and billing do not know each other.
- **The demo seed hard-codes 2025/2026**, so the demo looks stale every few months.

---

## 2. The model

### 2.1 A term has a lifecycle

| State | How it gets there | What it means |
|---|---|---|
| **upcoming** | start date is in the future | visible in Settings and on the dashboard countdown; no writes |
| **open** | today is inside the dates, or the admin opened it early | the working term; everything writes here |
| **ended** | end date has passed, not yet closed | corrections allowed for the correction window (21 days); dashboard says so and offers **Close the term** |
| **closed** | admin ran **Close the term** | archived, read-only; appears in Archives |

`closedAt` and `closedBy` are recorded. A closed term can be **reopened** by an admin (logged),
which moves it back to *ended* until it is closed again. That is the only route to correct a
published report card.

### 2.2 A year has a lifecycle

A year is **open** while any of its terms is not closed. **Close the year** is the existing
promotion flow, renamed and tightened: it refuses to run while a term is open, asks for the
next year's real term dates instead of inventing thirds, moves every student (promote, repeat,
graduate), writes the promotion record, and marks the year closed. A closed year is in
Archives with its three terms under it.

### 2.3 The working term is a state, not a guess

`getWorkingTerm(schoolId)` returns the single term in state *open*, or null. It replaces the
date heuristic for every write. The date heuristic survives only to *suggest*: when no term is
open and a term's start date has arrived, the dashboard offers **Open Term N**, and a daily
job opens it automatically so a school that never visits Settings still gets its register
on the first morning. During a break the dashboard reads:

> Term 2 ended 2 April. Term 3 starts 20 April. · **Close Term 2** · **Open Term 3 early**

### 2.4 The date is the guard

- Attendance refuses a date outside the working term's window.
- New score sheets, skills ratings, fee items, invoices, announcements, homework and
  timetable changes require an open term.
- **Fee payments against an existing invoice are always allowed**, in any term state and in
  any school state. Arrears are real. A payment belongs to its invoice, not to the current
  term.
- Every refusal happens in the server action, not only in the UI.

### 2.5 Viewing term versus working term

Every module page reads from a **viewing term**: by default the working term, otherwise the
term chosen in the URL (`?t=<termId>`, the convention Reports already uses). When the viewing
term is not open, the page carries one banner and hides every write control:

> Term 1, 2025/2026 · closed 20 December 2025 · read only

Write actions always use the working term and refuse if the viewing term is closed. This is
what makes Archives cheap: it is a list page plus the banner.

### 2.6 Archives

**When something appears**

- A term appears the moment it is closed. Ended-but-not-closed terms stay in the live app.
- A year appears as a full entry once **Close the year** has run. Before that it shows only as
  a heading over its closed terms, marked *in progress*.
- The current year's closed terms sit at the top under *This year so far*.

**Top level.** Years, newest first. Each row: the year name, its term chips with dates, and
three facts computed at close: students on roll, report cards issued, fees collected versus
outstanding. A year expands to its terms; a term opens.

**Inside a term.** The same app, frozen. The sidebar stays; each module opens on that term,
read-only:

- *Overview*: dates, weeks taught, attendance rate, report cards issued, fees collected and
  outstanding at close, who closed it and when.
- *Classes and roll*: from `enrollments`, so a student who has since left still sits where
  they sat.
- *Registers*: the record book per class and per student.
- *Scores and report cards*: sheets locked, published report cards exactly as sent,
  downloadable again.
- *Fees*: the term's invoices and every payment against them, including payments made after
  close; the pay button stays.
- *Announcements, calendar, timetable*: as they ran.

**The snapshot (research, October 2026).** Of the 80-odd tables, 13 carry a term id
(registers, score sheets, component scores, publications, skills, report cards, fee
structures and items, adjustments, invoices, analytics); the rest carry only a timestamp
(messages, outbox, homework, events, applicants, loans, ledger, payments, audit) or nothing
at all (timetable, staff, inventory, transport). Reading a closed term from the live tables
would therefore need a term id here, a date window there and "whatever it is now" for the
rest, and it would drift as names and classes change. So a closed term is **materialised**:
`term_archives` holds one row per section with the names already written in (child, class,
teacher, fee, book), built the moment the term closes and rebuilt if it is reopened and
closed again. Sections: class roll, registers, scores, preschool skills, report cards, fee
amounts, bills, payments (every payment on the term's bills, whenever made, plus every payment
made in the term), discounts and scholarships, money ledger, notices and announcements, SMS
and messages sent, homework, timetable as it ran, calendar, admissions, staff and leave,
library loans, transport riders, inventory and items held, and the changes log. Terms closed
before snapshots existed are snapshotted on first sight. Each row keeps the id it needs to
open the live bill, receipt, report card or student, which are never deleted.

**The term page** (`/archives/[termId]`): the close summary, one chip per section with its
count, a search box across the section, pages of 150 rows, **Open →** on each row, and
**Export this term**, one workbook with a sheet per section. Teachers see the teaching
sections (roll, registers, scores, skills, report cards, homework, timetable, calendar,
notices) for their own classes only.

**Inside a year.** Adds what only makes sense across terms: the promotion record, the year's
fee totals, cumulative report cards where used. The leaving certificate and transcript pull
from here.

**Who sees what**

- Admin and head: every year and term.
- Teachers: the classes they taught that term, from the term's teaching assignments.
- Parents and students: no Archives page; a *Past terms* list on the child's page, each with
  report card, attendance summary and fee statement.

### 2.7 The dormant school

Two conditions make the app read-only, and they share one frozen mode:

- **No open term** (last term closed, next not started).
- **No active subscription** (trial over, or paid period plus grace passed).

In frozen mode: sign-in works; the sidebar stays; every module opens on the last closed term
with the banner; write controls are removed, not disabled; the server refuses writes; SMS is
not sent. The one exception is fee payments against existing invoices.

The dashboard shows a single status card with one sentence and one button:

- subscription ended: *Your subscription ended 12 August. Everything is kept and readable.
  Renew to open Term 1.* · **Renew**
- year closed, subscription live: *2025/2026 is closed. Open Term 1 when school resumes.* ·
  **Open Term 1**

By role: admin sees the card, Billing unlocked, Archives, and a prominent **Export
everything**. Teachers see their last classes read-only and a one-line notice without billing
language. Parents see the child's page, last report card, attendance, fee statement and the
pay button if anything is owed. Students the same minus money.

**Retention.** Dormant and readable for 12 months after the subscription ends. Warnings to
the admin at 90, 30 and 7 days; then the data is exported to them and deleted. This period
and the warnings go into the privacy policy and the refunds page.

**Reactivation.** Paying flips status to active and nothing else. The admin then opens the
next term, or runs **Close the year** if they left before promotion.

### 2.7a Who gets told

Calendar events ping **the admins and their team only**: every admin login that has a
staff record, through the normal routing (the app and Telegram free; paid channels by the
school's own rules). Parents, teachers and students are never told about the calendar.

| Event | Ping |
|---|---|
| a term opens (by the sweep or early) | `term_opened` |
| a term is closed | `term_closed`, with the report-card count |
| a term is reopened | `term_reopened`, naming who did it |
| a term is still open 21 days after its last day | `term_close_due`, once |
| a lapsed school is 90, 30 or 7 days from deletion | `retention_warning` |

### 2.8 Billing and the calendar stay separate

- The subscription gates *writing*, never *reading*. Past due becomes read-only after grace;
  the full "Account suspended" wall goes.
- **Opening a term is the paywall.** Reading is always free; opening a new term requires an
  active subscription.
- Renewal reminders are timed to the next term's start date. The "per term" plan is sold as
  four months; the paid period is not chained to the academic calendar because schools pay
  late and terms shift.

---

## 3. Decisions taken

| # | Decision | Chosen |
|---|---|---|
| 1 | Correction window after a term ends | 21 days, then the dashboard nags to close; never auto-closes |
| 2 | Where Archives lives | its own sidebar item for admin and teachers; parents get *Past terms* on the child's page |
| 3 | Past due after grace | read-only, not suspended |
| 4 | What the paywall gates | opening a term; reading is always free |
| 5 | Retention after subscription ends | 12 months readable; warnings at 90/30/7 days; export then delete |
| 6 | Reopening a closed term | admin only, logged, the term leaves Archives until closed again |
| 7 | Payments on closed terms | always allowed, against existing invoices only |
| 8 | Auto-open on the first day | yes, by a daily job, so the register works without a visit to Settings |

---

## 4. Data model changes

```
terms
  + state        text  not null default 'upcoming'   -- upcoming|open|ended|closed
  + opened_at    timestamp, opened_by text
  + closed_at    timestamp, closed_by text
  + close_summary jsonb   -- {students, reportCards, feesCollected, feesOutstanding, attendanceRate, weeks}
  - is_current   (dropped after the migration sets state from it)

academic_years
  + state        text  not null default 'open'       -- open|closed
  + closed_at    timestamp, closed_by text
  - is_current   (dropped after migration)

schools
  + dormant_since  timestamp   -- set when status leaves active; cleared on renewal
  + delete_after   timestamp   -- dormant_since + 12 months

audit_log (exists)   -- term.open, term.close, term.reopen, year.close rows
```

Migration: for each school, the term `getCurrentTerm()` resolves to becomes *open* if today
is inside its dates, else *ended*; every term with `endsAt < today` and `scoresLocked`
becomes *closed* with `closedAt = endsAt`; later terms become *upcoming*. Years with all
terms closed become *closed*.

---

## 5. The build, in order

Each step ships on its own and leaves the app working.

### Step 1 — Lifecycle in the core
- Schema and migration above.
- `src/core/terms.ts`: `getWorkingTerm`, `getViewingTerm(searchParams)`, `openTerm`,
  `closeTerm`, `reopenTerm`, `closeYear`, `termStateOf(term, today)`, `assertOpen(term)`.
- `closeTerm` writes `close_summary`, locks scores, and refuses if report cards are
  unpublished for any class with scores (with an override checkbox, logged).
- `closeYear` wraps `runPromotion`, takes next year's real dates, refuses while a term is open.
- Daily job (`/api/cron/terms`, same place billing's `reconcile` runs): open terms whose
  start date has arrived when the school is active and no term is open; set `dormant_since`
  and `delete_after`; send the 90/30/7 warnings.
- Demo seed: dates relative to today so one term is always open.

### Step 2 — The guard in every write action
- `assertOpen` in attendance, assessment, skills, fees (items and invoices only), comms,
  homework, timetable actions. Attendance also checks the date window.
- Payments untouched.
- One check script, `src/core/terms.check.mts`, in the pattern of `billing.check.mts`:
  state transitions, the date window, payment-on-closed allowed, write-on-closed refused.

### Step 3 — Dashboard and Settings
- `TermPulse` strip grows the actions: **Close Term N**, **Open Term N early**, and the
  countdown during a break.
- Settings → Academic calendar shows the state badge from `state`, not from dates, and hosts
  **Reopen** (admin, with a reason).
- **Close the year** replaces *Promotion* in Settings with the dates step added.

### Step 4 — Viewing term everywhere
- Every module page resolves `getViewingTerm` and renders the read-only banner and no write
  controls when the term is not open. Reports already does this; generalise its banner into
  `src/ui/term-banner.tsx`.
- A term switcher in the topbar (admin and teachers) that sets `?t=` on the current page.

### Step 5 — Archives
- Sidebar item *Archives* (admin, teacher) → `s/[school]/archives/page.tsx`: the year list.
- `archives/[yearId]/page.tsx`: the year's terms, promotion record, fee totals.
- A term row links into the normal module pages with `?t=`.
- Child's page: *Past terms* list for parents and students.

### Step 6 — The dormant school
- `s/[school]/layout.tsx`: replace the suspended wall with frozen mode; compute
  `frozen = !workingTerm || school.status not in (trial, active)`; pass it through context so
  pages hide write controls and actions refuse.
- Dashboard status card per role.
- **Export everything** on Billing (CSV bundle: students, guardians, enrollments, attendance,
  scores, report card PDFs index, invoices, payments).
- Privacy policy and refunds page: the 12-month retention and the warnings.

### Step 7 — Help entries (section 6 below) and `docs/SIMPLE_STEPS.md`.

---

## 6. Help entries to add to `src/help/steps.ts`

New section `terms` (pages `/`, `/settings`, `/archives`) plus entries in existing sections.
Written in the house style: short lines, the exact button words in bold, one line of why.

```ts
{ key: "terms", title: "Terms and the year", pages: ["/", "/settings", "/archives", "/archives/[id]"],
  items: [
    { id: "tm-open", title: "Start a term", why: "Registers, scores and fees write into the open term. Nothing writes until one is open.", who: A,
      where: "Home, the term strip at the top (or School settings → Academics → Academic calendar)",
      steps: ["On the first day of term the app opens it by itself — you will see **Week 1 of N** on Home.",
        "To start early, tap **Open Term N early** on the term strip.",
        "Check the first and last day. Change them in **Academic calendar** if the school's dates moved."],
      then: "The strip reads Week 1. Teachers can mark the register.",
      note: "Opening a term needs an active subscription. Reading never does." },

    { id: "tm-close", title: "Close a term", why: "Closing locks the term and moves it to Archives, exactly as it was.", who: A,
      where: "Home, the term strip, once the last day has passed",
      steps: ["Tap **Close Term N**.",
        "The app checks that report cards went out for every class with scores. If some did not, send them first, or tick **close anyway**.",
        "Read the summary: children on roll, report cards sent, fees collected and still owed.",
        "Tap **Close the term**."],
      then: "The term appears in Archives. Fees still owed can still be paid.",
      note: "You have 21 days after the last day for corrections before Home starts reminding you." },

    { id: "tm-reopen", title: "Reopen a closed term", why: "A report card or a register from a closed term must change.", who: A,
      where: "School settings → Academics → Academic calendar → the closed term",
      steps: ["Tap **Reopen** beside the term and say why.",
        "Make the correction. Resend the report card if one changed.",
        "Tap **Close Term N** on Home again."],
      note: "Every reopen is recorded with your name and reason." },

    { id: "tm-year", title: "Close the year and move everyone up", why: "One screen moves every class up, holds back who should repeat, and graduates JHS 3.", who: A,
      where: "School settings → Academics → Close the year",
      steps: ["Close Term 3 first. The button stays grey until every term is closed.",
        "Enter next year's name and the first and last day of each term.",
        "For each class choose where it goes: the next class, **stay**, or **graduate**.",
        "Tick any child who repeats.",
        "Tap **Close the year**."],
      then: "The year is in Archives. Next year's Term 1 is upcoming and opens on its first day." },

    { id: "tm-break", title: "What Home shows between terms", why: "So the quiet weeks never look like something is broken.", who: AT,
      where: "Home",
      steps: ["The term strip reads **Term N ended** and the date the next one starts.",
        "Registers and scores are read-only until the next term opens.",
        "Fees still owed can be recorded and paid."] },
  ] },
```

Add to the `archives` section:

```ts
{ key: "archives", title: "Archives", pages: ["/archives", "/archives/[id]"],
  items: [
    { id: "ar-open", title: "Find a past term", why: "Every closed term, exactly as it was sent to parents.", who: AT,
      where: "Archives, in the sidebar",
      steps: ["Tap the year.", "Tap the term.",
        "Use the sidebar as usual: **Attendance**, **Scores**, **Report cards**, **Fees** all open on that term."],
      then: "A banner at the top says which term you are reading and that it is read only." },
    { id: "ar-report", title: "Reprint an old report card", why: "A parent lost it, or a school asks for it.", who: AT,
      where: "Archives → the year → the term → Report cards",
      steps: ["Find the class, then the child.", "Tap **Download**."] },
    { id: "ar-arrears", title: "Collect fees owed from a past term", why: "Old balances stay payable after the term closes.", who: A,
      where: "Archives → the year → the term → Fees, or the child's page → Past terms",
      steps: ["Open the invoice.", "Tap **Record a payment** as usual."],
      note: "This is the one thing a closed term still accepts." },
    { id: "ar-child", title: "See my child's past terms", why: "Report cards, attendance and fees for every term they have been here.", who: P,
      where: "My children → the child → Past terms",
      steps: ["Tap a term.", "Tap **Report card** to download it."] },
  ] },
```

Add to the `billing` section:

```ts
{ id: "bi-dormant", title: "What happens when the subscription ends", why: "Nothing is lost. The school becomes read-only.", who: A,
  where: "Home",
  steps: ["Everyone can still sign in and read every term, including parents.",
    "Nothing new can be written and no SMS goes out. Fees owed can still be paid.",
    "Tap **Renew** on the Home card, then **Open Term N** to start the next cycle.",
    "**Export everything** on Billing gives you every record as files, any time."],
  note: "Records stay readable for 12 months after the subscription ends. We write to you at 90, 30 and 7 days before anything is removed." },
```

---

## 7. Shipped (October 2026)

Steps 1 to 7 are in, with these deliberate shortcuts, each marked `ponytail:` in code:

- The viewing term (`?t=`) is honoured by Reports, the record book and Fees; the other
  modules still read the working term. Archives links only to those three.
- Parents and students get their past terms from the child's page as it already stood
  (report cards by term, bills by term); no separate *Past terms* list was added.
- Frozen mode hides nothing in the UI beyond the one card; every write is refused on the
  server with a plain sentence instead.
- Deletion after the retention year is not automated: the warnings go out, the deletion is
  a decision taken by hand.
- An admin without a staff record gets no ping; the Staff page creates one.
- Migration: of the terms that had already run, the latest stays live for the admin to
  close; earlier ones are closed as they ended, so Archives is full from day one.

## 8. What done looks like

- The demo school opens on an open term the day it is seeded, with earlier terms in Archives.
- Marking a register for a date outside the term is refused with a plain sentence.
- Closing a term produces a summary and the term appears in Archives; a payment on one of its
  invoices still records.
- A school whose subscription lapses can still read everything and pay arrears, and sees one
  card with one button.
- `src/core/terms.check.mts` passes; the help pages show the new entries on the right screens.

---

## 9. The channel rules (October 2026)

One door, `notify()` in `src/messaging/notify.ts`, and one rule for every message:

| Channel | Role | Cost |
|---|---|---|
| Push | the app's own notification, for anyone with the app installed | free |
| **Telegram** | **the default for everything**, papers included: a receipt or invoice arrives as the PDF with a caption | free |
| Email | the papers (PDF attached) and anything written for email; platform mail to the school owner | free |
| WhatsApp | the ping: the kind's sentence, saying something has arrived or needs attention; needs Meta's approved template | paid, wallet |
| SMS | the same ping when WhatsApp is off, unconsented or unapproved; held when the wallet is empty, except absence and emergencies | paid, wallet |

A message carries `doc` (invoice or receipt, built from the live record at send time) and/or
`email` (subject and body). Email stays quiet without one of those. Results, report cards,
homework and admission offers now go through the door like everything else.
