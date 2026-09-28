# SchoolSpec — the simplicity build: what was done, what got in the way

**Scope.** Every bug and every change listed in `SIMPLICITY_AUDIT.md`, implemented
against the steps in `SIMPLE_STEPS.md`. Date: 28 September 2026.

**Size.** 82 tracked files changed, 13 files added, 2 deleted. About 3,150 lines in,
2,690 out. No database migrations were needed: every new piece of state fits an
existing column or the school's settings JSON.

**Verification.**

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` on every changed file | clean (0 errors, 0 warnings) |
| `eslint` on the whole tree | 41 errors, all in 11 files this build did not touch (listed in §6) |
| `next build` | passes, after fixing a Windows-only bug in the build script (§4.10) |
| Live smoke test | 21 pages rendered signed in as admin, teacher, parent and student on the demo school; every page returned 200 with the words the redesign promises |

Nothing has been committed. The working tree holds the whole change set.

---

## 1 · The audit's bug list — status

| # | Bug | Status | Where |
|---|---|---|---|
| 1 | Skills grid says "Saved ✓" when the term is locked | **Fixed.** The action now returns an error sentence; the grid shows it per row. Also found and fixed on the way: any teacher could rate any preschool class (no scope check). | `assessment/skills-actions.ts`, `skills/[classId]/grid.tsx` |
| 2 | Staff "No portal access" lost on Back; login issued anyway | **Fixed at the root.** The choice is a stored column (`staffRole = "none"`), never a URL parameter. One private function creates every staff login and refuses "none". | `staff/staff-actions.ts` |
| 3 | Import row numbers wrong with blank rows | **Fixed.** The parser now keeps blank rows (`blankrows: true`) and numbers rows before filtering, so "Row 9" is Excel's row 9. | `students/import/excel.tsx` |
| 4 | Register re-save texts every absent child's parents again | **Fixed in the one shared function.** The action reads yesterday's records before rewriting and texts only newly absent children. The offline sync route goes through the same function, so it is fixed there too. | `attendance/actions.ts` |
| 5 | Homework resubmit deletes the earlier file | **Fixed.** `fileUrl: newFile ?? previous.fileUrl`. | `portal-actions.ts` |
| 6 | Hand in enabled during upload; empty hand-ins accepted | **Fixed** on both sides: the button waits for the upload or a note; the server rejects an empty hand-in. | `homework/[id]/submit.tsx`, `portal-actions.ts` |
| 7 | Score "abs" saved as 0; values above the maximum clamped silently | **Fixed.** The server refuses out-of-range and non-numeric input with a sentence ("Above 30"); "a", "abs", "-" mean did-not-write and are stored as such. | `assessment/actions.ts` |
| 8 | Sign-in says "password doesn't match" for accounts that do not exist | **Fixed as far as the auth layer allows.** better-auth deliberately returns one code for both cases, so the message is now honest about that: "We couldn't sign you in. Check the email or username and the password." Plus the line "Forgotten your password? Ask the school office to reset it." | `sign-in/sign-in-client.tsx` |
| 9 | Parent tour promises 4 stops, shows 3 | **Fixed.** The count is computed from the anchors that exist on the page. A 4-stop student tour was added. | `ui/tour.tsx` |
| 10 | Child fees table "Term" column shows the invoice date | **Fixed.** Joins the term's name. | `children/[id]/page.tsx` |
| 11 | Bursar preset creates an unrestricted admin | **Fixed in all three places** it could happen: the Team & access presets, the new staff form, and the old generic "issue login" path, which now routes through the guarded function. A bursar gets the existing `ACCESS_PRESETS.bursar` grant (Fees, students, parents). | `settings/team-actions.ts`, `staff/staff-actions.ts`, `accounts-actions.ts` |

---

## 2 · The audit's order of work — status

| # | Item | Status |
|---|---|---|
| 1 | Feedback everywhere: specific toasts, 6s, Undo | **Done.** `Flash` accepts a sentence and an Undo URL; `withFlash()` helper; every redirect in the changed areas now says what happened. Undo is live on discard student draft, discard staff draft, and mark-as-left. |
| 2 | Register: three-button rows, honest Save, stay-on-page banner, SMS only for changes | **Done**, plus child photos on the rows (the audit asked, the first pass skipped it because the roster query had no photo column). |
| 3 | Fees desk: search-first, pre-filled payment, receipt page | **Done.** "Who is paying?" search on the Fees page; payment form pre-filled; receipt page with Print and the SMS line; reference required for MoMo and bank. |
| 4 | The five confirms and the readiness gate | **Done.** Send report cards, send a test, lock a test, create bills, text reminders, text all parents, void a payment, run promotion. Tests cannot be sent until every class has locked them. |
| 5 | Parent "How to pay" button and report card Download | **Done.** Online pay was first wired, then removed on the owner's decision: no parent money passes through the app (§4.4). |
| 6 | Score sheet: autosave, Enter moves down, inline errors, marked-out-of first | **Done**, plus a "did not write" chip per cell because a phone's number keypad has no letter "a". |
| 7 | One-screen Admit student / Add staff; "Add more details" on the record page | **Done.** 7 stages became 1 screen with 5 fields; 6 stages became 1 screen with 3. Nothing was lost: every old field lives under "Add more details" on the record. |
| 8 | Sidebar regroup, plain words, bottom tabs, Help / Switch account | **Done.** Groups: Every day · People · This term · Extras · Setup. Bottom tabs with words per role. |
| 9 | Tables to cards below `md` | **Done** once in `DataTable`; 25 callers inherit it. A URL-bound search box is available as a prop. |
| 10 | Settings: merge grading, access presets, rename sections | **Done.** |
| 11 | Sign-up to two steps, signed-in landing; sign-in copy | **Done**, and the "sign in again" screen had a real root cause (§4.7). |
| 12 | Homework and timetable fixes | **Done.** |

---

## 3 · What each area changed (file by file, in one line each)

### The frame
- `src/ui/feedback.tsx` — toast shows a sentence, stays 6s (errors 9s), centred on phones, carries Undo.
- `src/lib/flash.ts` — `withFlash(path, message, { error, undo })`.
- `src/ui/confirm.tsx` — `ConfirmButton`: a native `<dialog>` with the question and two buttons; used only for money, messages and locks.
- `src/ui/nav.tsx` — new groups and labels; bottom tabs with words; "Menu" replaces the hamburger; footer "Sign out · Switch account · Help · Dark/Light".
- `src/ui/shell.tsx`, `breadcrumbs.tsx`, `src/modules/*/manifest.ts`, `src/core/access-const.ts` — plain-word labels; base text 16px, 18px on phones.
- `src/ui/kit.tsx`, `src/ui/table-search.tsx`, `globals.css` — `Field` gets `required`/`optional` markers; `DataTable` gets a search box and becomes a card list on phones.
- `src/ui/tour.tsx` — honest stop count; student tour; "Help" with a word.
- `src/app/s/[school]/layout.tsx` — trial banner asks for a plan on the last day (the audit's "day 13").
- `src/ui/theme-toggle.tsx` — deleted (icon-only, no longer used).

### Attendance
- `attendance/[classId]/register.tsx` — Present · Absent · Late buttons per row, 48px, child photo, 18px name; Save label states the SMS; saved state greys the rows behind a green banner with Edit.
- `attendance/[classId]/page.tsx` — "No school today" card on weekends and holidays; photos presigned; "Mark it myself" / "Correct it myself" labelled.
- `attendance/actions.ts` — SMS only for newly absent; returns counts for the toast; reminder toast names the teacher.
- `attendance/page.tsx`, `attendance/register/page.tsx` — "Remind {name}", "Choose a teacher", absent children as visible text, "Correct a past day" and "Holidays" as labelled controls.

### Scores
- `assessment/actions.ts` — rewritten: one guarded write per cell (`saveMark`), `setOutOf`, `lockColumn`; refuses bad input instead of clamping.
- `assessment/[classId]/[subjectId]/sheet.tsx` — rewritten: autosave with per-row status, Enter/↓ moves down, inline errors, "Start {test} — marked out of ___" panel, lock confirm, did-not-write chip.
- `assessment/skills-actions.ts`, `skills/[classId]/grid.tsx` — every tap saves; real errors; teacher scope check.
- `assessment/page.tsx` — titled "Scores"; 48px class · subject cards.

### Fees and paying
- `fees/page.tsx` — rewritten: "Who is paying?" search; tabs "Today's money / Who owes what / Owing past the due date"; Create bills and Text parents behind confirms with counts and cost; reminders disabled after sending until tomorrow.
- `fees/actions.ts`, `modules/fees/engine.ts`, `modules/fees/config.ts`, `modules/fees/payment-form.tsx` — dry-run for the bill count; reference required; receipt SMS; sent-today record in school settings.
- `fees/invoice/[id]/page.tsx`, `fees/receipt/[id]/page.tsx` — payment form above the paper; receipt with Print and the SMS line; Void behind a confirm.
- `src/lib/paystack.ts`, `src/core/billing.ts` — Paystack callback path fixed (§4.4); `src/ui/pay-fees.tsx` and `startFeePayment` deleted: no parent money through the app.
- `children/[id]/page.tsx`, `students/[id]/report/[termId]/page.tsx` — "How to pay" as the primary button; "Download report card" button.
- `src/lib/sms-cost.ts` — one SMS cost constant for the whole app (two agents had picked different numbers).

### Report cards
- `reports/page.tsx`, `reports/actions.ts` — confirm that names the unready classes and the parent count; tests gated on readiness; one word "Send to parents"; "Unlock scores" with a required reason, logged to the audit table.

### People
- `students/new/page.tsx`, `students/new/actions.ts` — one screen, five fields; creates student, parent, bill and the parent's login; `wizard-actions.ts` deleted.
- `students/[id]/page.tsx`, `students/[id]/actions.ts`, `students/[id]/undo/route.ts` — "Add more details" folded groups; per-group save; Undo route.
- `students/import/excel.tsx`, `students/import/actions.ts`, `students/page.tsx` — lands on the list with a banner of problem rows; validate-all-then-insert; cap counts only importable rows; sheet parents become primary.
- `staff/new/page.tsx`, `staff/staff-actions.ts`, `staff/[id]/page.tsx`, `staff/login-button.tsx`, `staff/[id]/undo/route.ts`, `staff/page.tsx` — one screen, three fields; "What they can open"; "Add more details"; Undo.
- `accounts-actions.ts` — generic staff login routed through the guarded path.

### Sign-up and sign-in
- `signup/page.tsx`, `signup/actions.ts` — two steps; link suggested from the school name; trial by default; lands signed in.
- `go/route.ts` — session read with the cookie cache disabled and re-issued cookies forwarded (§4.7).
- `sign-in/sign-in-client.tsx` — honest error; office line; always-visible remove on chips; 16px text.

### Homework and timetable
- `homework/actions.ts`, `homework/set-form.tsx`, `homework/page.tsx` — due tomorrow, last class, subjects filtered by class, server validates the pair, "Give homework".
- `homework/[id]/submit.tsx`, `homework/[id]/page.tsx`, `portal-actions.ts` — camera or file, upload guard, keeps the old file, big "Handed in at HH:MM ✓", labelled "Save mark".
- `timetable/actions.ts`, `timetable/slot-editor.tsx`, `timetable/page.tsx` — placing returns a result instead of reloading; panel stays open and jumps to the next empty slot; words for breaks; 44px cells.

### Settings, dashboard, notices
- `settings/page.tsx`, `settings/team.tsx`, `settings/team-actions.ts`, `settings/preset-of.ts`, `settings/promotion/*` — plain section names; "How marks become grades"; four presets with Customise folded; promotion confirm with counts.
- `s/[school]/page.tsx` — titled "Home"; "Scores still missing" card with "Remind the teacher"; parent card rebuilt (photo, words for status, Pay, Report card, 16px link); scores reminders shown as teacher banners.
- `comms/page.tsx`, `comms/blast-form.tsx`, `comms/sms.ts`, `comms/actions.ts` — "Text all parents" with character and SMS-segment counter and a confirm with count and cost; "Notice" box; audience chips; events get a class audience.

---

## 4 · Challenges met, and how each was handled

### 4.1 Nine people editing one tree at once
The work was split into nine workstreams by file ownership so nothing overlapped.
Two shared pieces every stream needed, the toast and the confirm box, were written
first and frozen as a contract. Two streams still needed the same file
(`portal-actions.ts`, `page.tsx`); each was given one owner and the other stream a
"read only" instruction. Two streams ran `git stash` / `git stash pop` in the shared
tree to compare lint baselines. Both popped cleanly and the tree was verified intact
afterwards, but it should not have happened; the report notes it so the practice is
not repeated.

### 4.2 Two type errors nobody owned
When the streams finished, `tsc` had two errors that each stream had attributed to
"someone else's in-progress file". One was a union type on the score sheet's guard
that narrowed to `never`; one was a `string | undefined` into a `string | null`
state. Both fixed at integration.

### 4.3 The team tab crashed at runtime while passing every static check
The settings page (a server component) called `presetOf()`, a pure helper that
happened to live in a `"use client"` file. Typecheck and lint cannot see this; Next
refuses it at render time. Found by the live smoke test, fixed by moving the helper
into a server-safe module. This is the reason the smoke test exists.

### 4.4 The parent "Pay" button: wired, then removed on purpose
The audit proposed wiring the existing online-pay button. It was wired, and reading
the callback path found three bugs (below). The owner then set the rule: **parents
pay the school directly, by MoMo to the school's number or cash at the office, and
the app only records it; Paystack is only for the school's own SchoolSpec
subscription.** So the parent-facing button, `src/ui/pay-fees.tsx` and
`startFeePayment` were deleted, and **How to pay** is the one big button on the
child card. The fixes below stay because the same code serves the school's own
subscription payments and any future decision to reverse this:
- Online payments never reached the ledger. They bumped `paidPesewas` only, so a
  parent who paid online still "owed" on every screen and would have been re-billed
  next term. Fixed by routing through the same `recordPaymentFor` the cashier uses,
  which also mints the receipt number and sends the receipt SMS.
- With no Paystack key, "fake mode" recorded instant payments, in production too.
  Now off in production; the page shows a plain sentence instead of the button.
- The callback URL was relative; Paystack needs absolute. Now built from the host
  headers.

### 4.5 Confirms need real numbers
"Create 312 bills totalling GHS 46,800?" needs the count before anything is written.
The invoice engine gained a `dryRun` flag rather than a second computation path.
Same idea for report cards (classes not fully marked, parents to notify) and blasts
(distinct phones, segments, cost).

### 4.6 Sending fee reminders "once a day" with no new table
The last send is recorded in the school's settings JSON (`feeRemindersSent`), which
the settings save already spreads, so no migration. Same for the promotion and
report-card counts: computed at render.

### 4.7 "Sign in again" after sign-up had a root cause
It was not a missing redirect. The auth session cookie is cached for 60s, and right
after sign-up the cache still says `schoolId: null`, so the school layout bounced the
new owner to sign-in. `/go` now reads the session with the cookie cache disabled and
forwards the re-issued cookies on its redirect. On the real domain the cookie spans
subdomains, so no token hand-off is needed; on localhost the preview cookie does
the routing.

### 4.8 The score sheet on an iPhone
The audit wanted a digits-only keypad and also "type a for did-not-write". iOS's
decimal keypad has no letters. Rather than choose, each cell has a small
"did not write" chip that does what typing "a" does.

### 4.9 Lint rules from the React compiler
The project's lint enforces the React compiler's rules (no `setState` in an
effect body, no ref writes during render, no `Date.now()` in render). Several
pre-existing violations sat in files the streams had to touch; each was fixed
properly (`useSyncExternalStore` for theme and checklist state, a `daysUntil()`
helper, refs moved into effects) rather than suppressed. One suppression remains,
with its reason: sign-up must use `window.location` because `/go` sets cookies and
may redirect across subdomains, which a client-side router push cannot do.

### 4.10 The build did not run on Windows
`scripts/stamp-sw.mjs` built its path with `URL.pathname`, which on Windows gives
`/E:/…` and reads as `E:\E:\…`. It has always worked on Vercel. Fixed with
`fileURLToPath` so local builds work too.

### 4.11 Lock granularity
"Unlock a class" was asked for; the data model locks scores per term, and the
guard that enforces it lives in the assessment actions. The unlock form still asks
which class and why, records both in the audit log, and says plainly that unlocking
reopens the term. Upgrade path if per-class is ever needed: a per-sheet
`unlockedUntil` checked in the same guard.

### 4.12 Undo without deleting
Discarding a draft student or staff member flips a status to `discarded`; the Undo
route flips it back. Every list already filters on an explicit status, so discarded
rows are invisible without new filters. Mark-as-left restores the record on Undo,
but the class-teacher seat and allocations that `markStaffLeft` released are not
restored; the toast says the classes are free to reassign.

### 4.13 Two SMS prices
Two streams needed a per-SMS cost and none existed; one picked 3 pesewas (Arkesel's
rate), the other 9 (the re-billed default in `sms_log`). Unified on 9, the number the
school is actually charged, in one file both import.

---

## 5 · Beyond the audit: things found and fixed on the way

- Online payments never hit the ledger; fake payments possible in production;
  relative Paystack callback (§4.4).
- No teacher-scope check on preschool skills ratings.
- "Parents told" after generating bills was not true: nothing was sent. Now each new
  bill's primary parent gets an SMS.
- The sign-up server path pointed at `/signup/done`, a page that never existed.
- The old generic staff-login path (`accounts-actions.ts`) also made bursars full
  admins; closed.
- Events had a class column the form never set; the form now sets it.
- A dozen pre-existing lint errors in touched files (refs in render, impure render,
  `Row` components created per render) fixed properly.

---

## 6 · Left for later, on purpose

- **Pre-existing lint errors in 11 untouched files** (41 in total, 31 of them one
  rule in `analytics/page.tsx`): `app/error.tsx`, `platform/error.tsx`,
  `platform/page.tsx`, `platform/subscriptions/page.tsx`, `admissions/[id]/page.tsx`,
  `admissions/page.tsx`, `analytics/page.tsx`, `s/[school]/error.tsx`,
  `ui/signature-pad.tsx`, `ui/term-pulse.tsx`, `ui/upload.tsx`. Out of scope; one
  small PR.
- **Promotion Undo** ("You can undo this today" in the steps): the promotion action
  is not yet reversible. Needs a snapshot of enrolments before the run.
- **Per-class unlock** (§4.11).
- **URL renames** (`/attendance/today/…`, `/attendance/record-book`): kept as they
  were; the words changed, the routes did not.
- **Module names in the catalogue and plan labels** still say "Staff HR"; the nav
  says "Leave". Change the catalogue if the plan pages should follow.
- **Page-level text sizes**: the shell base is 16/18px; pages that set their own
  `text-sm` keep it. The audit's 16px minimum is met on the screens rebuilt here
  (register, score sheet, fees desk, parent card, sign-in/up) and not audited on the
  rest.
- **Scores reminder on the teacher's home** shows as a banner for the day it was
  sent, because there is no cheap "is this sheet still missing" check per banner.

---

## 7 · How to test it by hand

Demo school `stmarys`, every login `password123`:
`admin@stmarys.test`, `teacher@stmarys.test`, `parent@stmarys.test`,
`student@stmarys.test`. On localhost visit `/t/stmarys` once to enter the school.

Then the test from `SIMPLE_STEPS.md` §7: hand the phone to someone over fifty and
say one sentence. "Ama is absent today." "Mr Mensah is paying 100 cedis for Ama."
"Send the report cards." If they ask a question, write it down; that is the next fix.

---

## 8 · Follow-up, 28 Sept: the walkthrough and the doors on subdomains

**The walkthrough is now one big card, not a spotlight that follows the page.**
Everything dims; the card shows a drawing of the screen on the left and a note on
the right, one stop at a time. The drawing is this person's real menu (a module
that is off, or a tab not granted, is simply not drawn) with the stop's item lit,
and the page control the note talks about, labelled "here". On phones the drawing
is a phone: the bottom tab lights when the stop is a tab, otherwise the Menu tab
lights and the drawer is drawn open. Scripts were rewritten around what the app does
today, per role, and each stop says where to go in words ("Menu → Fees → type the
child's name"). Help at the bottom of the menu reopens it; Esc and the arrow keys
work. Verified by driving headless Chrome through it as admin (desktop) and teacher
(phone).

**Switch account, Sign out and Sign in on a school's subdomain showed a 404.** The
host proxy rewrote every path on `stmarys.schoolspec.com` into the school, so
`/sign-in`, `/go` and `/signup` became `/s/stmarys/sign-in` and so on, which do not
exist. The same rewrite turned the school layout's own redirect to sign-in into a
404 for any signed-out visitor. It never showed on localhost, which has no
subdomains, which is why the smoke test passed. The doors are now served as
themselves on every host, and `/go` sends a person to their own school's subdomain
even when they signed in on another school's door. The routing check
(`pnpm run check:proxy`) has cases for all of it.
