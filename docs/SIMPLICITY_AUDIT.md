# SchoolSpec — the simplicity audit

> **Status (28 Sept 2026):** built. What was done, what got in the way and what
> was left for later is in `SIMPLICITY_BUILD_REPORT.md`.

**What this is.** `PROCESSES.md` lists the 214 things a person can do in SchoolSpec.
This document walks the ones people do *every day or every term* as they exist in the
code today, counts the real taps and fields, and says what to cut. The companion file
`SIMPLE_STEPS.md` shows every process rewritten as it should read once the cuts land.

**Who we are designing for.** Not us. Three people:

- **Madam Adjei, 61,** proprietress of a 300-pupil school. Uses WhatsApp and mobile
  money. Reads glasses-on. Has never used a spreadsheet. Her bursar is her niece.
- **Sir Kwame, 54,** class teacher of Basic 4. A Tecno phone with a cracked screen,
  2G in the staff room, five minutes between lessons.
- **Mr Mensah, 58,** father of two at the school, sells spare parts. Opens the app when
  an SMS tells him to. Reads slowly, taps carefully, and gives up after one confusing screen.

Every finding below was checked against one question: **would Madam Adjei get through
this alone, on her phone, the first time, without calling her niece?**

---

## 1 · The ten rules (what "stupidly simple" means here)

These are the design law for every screen. The per-process findings in §3 are just
these rules applied.

| # | Rule | What it means in practice |
|---|---|---|
| 1 | **One job per screen, named in the person's own words.** | The heading says what you are doing: "Mark today's register", "Who is paying?". Never "Ledger", "Assessment", "Comms". |
| 2 | **Big words, big buttons, whole rows.** | Body text 16px minimum, 18px on phones. Tap targets 48px. The whole row is the button. Nothing important is 11–12px. |
| 3 | **No icon without a word. No "More", no "⋯", no hover.** | A hamburger, a "?", a "✓", a "+", an emoji, a tooltip: each one is a place Mr Mensah gets stuck. Every control carries its word. |
| 4 | **The app does the remembering.** | Everyone starts present. The amount is the balance. Homework is due tomorrow. The class is the one you used last time. The user changes only the exception. |
| 5 | **Say what will happen, then say what happened.** | Before: "This sends 12 SMS." After: "Register saved. 12 parents told." A toast that says only "Done ✓" and vanishes in 3 seconds tells an anxious user nothing. |
| 6 | **Confirm only money, messages and locks. Everything else gets Undo.** | Today there are zero confirm dialogs in the app, including on the actions that spend money, text every parent, or lock a term. Elsewhere, a confirm is just one more tap. |
| 7 | **Every list starts with a search box that searches names.** | The cashier should never need to know which class a child is in. |
| 8 | **Required is marked. Optional is folded away.** | Two required fields should never sit among 37 optional ones looking identical. |
| 9 | **The phone is the first screen, not the last.** | Bottom tabs with words, card lists instead of sideways-scrolling tables, thumbs not cursors. |
| 10 | **Plain words everywhere.** | Parents, not Guardians. Scores, not Assessment. Report cards, not Reports. Your SchoolSpec plan, not Billing. Bills, not Invoices. |

---

## 2 · The score card

Taps are counted from the role's home screen on a phone (the hamburger costs one tap
today). "Fields" are what the person must fill, not what is on the screen.

| Process | Who | Today | Proposed | What changes |
|---|---|---|---|---|
| H1 Mark today's register (all present) | Teacher | 2 taps, no feedback, SMS sent silently | **2 taps**, "Saved. 3 parents told." | Feedback and honesty, not fewer taps |
| H1 …with one child late | Teacher | +2 taps (cycle passes through Absent) | **+1 tap** | Present / Absent / Late as three buttons on the row |
| I1 Enter one test for 40 pupils | Teacher | ~123 taps, no autosave, work lost on leaving | **~83**, autosaves | Enter moves down the column; digits only |
| I3 Submit a test column | Teacher | 1 tap, locks silently | 1 tap + 1 confirm | It is a lock: say so |
| M9 Record a cash payment | Cashier | 4–5 taps, must know the class, no search | **3 taps + type a name** | The Fees page opens on "Who is paying?" |
| M7 Generate the term's bills | Admin | 1 tap, no preview | 1 tap + 1 confirm with the count | "Create 312 bills totalling GHS 46,800?" |
| M14 Send fee reminders | Admin | 1 tap, texts everyone, no preview, re-sends on second tap | 1 tap + 1 confirm with count, cost, message | And "sent this morning already" guard |
| I7 Publish report cards | Admin | 2 taps, no confirm, no readiness check, locks scores | 2 taps + 1 confirm that names the unready classes | The most irreversible action in the app |
| I6 Release a test | Admin | 2 taps, allowed at 0 of N classes ready | Button disabled until ready; 1 confirm | |
| Q3 Parent pays fees | Parent | "How to pay" text, small links; dead online-pay code | **1 tap to "How to pay"** | Parents pay the school directly, by decision; the app records it. Dead code removed |
| Q5 Parent gets the report card | Parent | 1 tap, then "use your browser's Print" in 11px | 1 tap, then a big **Download** button | |
| E1 Admit one student | Admin | 7 stages, ~39 fields, 2 marked required, class refused at the end | **1 screen, 5 fields** | Everything else lives on the student's page under "Add more details" |
| E2 Import students | Admin | 2 steps; ends with no way to the list | 2 steps; ends on the list with a banner | |
| G1 Add a staff member | Admin | 6 stages, ~27 fields, 1 required | **1 screen, 3 fields** | Name, phone, what they do |
| C1 Sign up | Owner | 3 steps, 6 fields, choose a plan first, then sign in again | **2 steps, 4 fields**, lands inside signed in | Plan choice moves to day 13 of the trial |
| L2 SMS blast to all parents | Admin | 1 tap, no count, no cost, 300 chars = 2–3 SMS each | 1 tap + 1 confirm with count and cost | Segment counter under the box |
| J2 Place 40 lessons | Admin | 80+ taps and 40 page reloads | **~45 taps**, no reloads | Panel stays open, jumps to the next empty slot |
| K1 Set homework | Teacher | 1 screen, 4 fields, subject list ignores the class | 1 screen, 2 fields | Due tomorrow; subject filtered by class |
| K4 Student hands in | Student | 2 taps; empty hand-ins accepted; upload race loses the photo | 2 taps; Submit waits for the upload | |
| D27 Limit a bursar to Fees | Admin | 24 checkboxes | **1 tap on "Cashier"** | Presets first, checkboxes folded away |

---

## 3 · Findings by area

Each finding: what the code does today → what to do. Ordered by how often a school
hits it.

### 3.1 The register (every teacher, every morning)

- **Status is a colour and a 12px word, chosen by cycling.** One tap too many and you
  go round again. → Three labelled buttons on each row: **Present · Absent · Late**.
  Present pre-selected. One tap sets anything. Colour plus the word plus a tick.
- **Saving texts the parents of every absent child and nothing says so.** A second save
  to correct one child texts everyone again. → The Save button reads *"Save register ·
  3 absent · their parents get an SMS"*. Only newly-absent children trigger an SMS.
- **After saving, the teacher is dropped on the attendance page with no message.** →
  Stay on the register, grey it out, show a big green banner: *"Saved at 07:42. 3
  parents told. Tap a child to correct."*
- **The route called "register" is the record book.** The place you mark the register
  is `/attendance/[classId]`. → Rename: `/attendance/today/[classId]` is the register,
  `/attendance/record-book` is the book. Fix the words before the URLs.
- **Offline works well.** Keep the "Saved on this phone ✓" panel exactly as it is; it is
  the best feedback in the app. Copy its tone everywhere.

### 3.2 The score sheet (every teacher, every test)

- **No autosave and no "leaving loses your work" guard.** A dropped 2G connection loses
  the sheet. → Save each cell as it is entered; show a small "saved" tick per row.
- **Tab moves across the row; teachers enter down the column.** → Enter and the down
  arrow move to the next pupil in the same test. The keypad is digits only.
- **Bad input is changed silently.** 35 out of 30 becomes 30; "abs" becomes 0. → Red
  inline message *"Above 30"*; the cell will not save. "abs", "a", "-" all mean *did
  not write* and show as a dash, never a zero.
- **"Marked over" defaults to 100 for every column and hides in the header.** →
  Ask once when the column is created, in a big field: *"This test was marked out of
  ___"*, defaulting to the last test's value.
- **Submit locks the column with no warning.** → Confirm: *"Lock Maths · Test 1 for
  Basic 4 A? You will not be able to change it. The head can unlock it."*
- **Jargon:** "marked over", "dnw", "weight", "draft", "CA". → "marked out of",
  "did not write", "counts for", "not sent yet", "class work".
- **Preschool grid says "Saved ✓" even when the term is locked and nothing saved.** → Bug.
  Return an error from `saveSkillRatings` and show it.

### 3.3 Fees (the bursar's whole day; the parent's only reason to open the app)

- **Recording a payment is buried.** Fees → Ledger → pick a class → find the row →
  Open → scroll past the invoice paper → form. There is no search by name. → The Fees
  page opens on one big box: **"Who is paying? Type the child's name."** Result rows
  show the child, class and balance. Tap → the amount is pre-filled with the balance,
  Cash is selected, **Save payment** is the only big button. Receipt appears with
  **Print** and *"SMS receipt sent to Mr Mensah"*.
- **Reference is optional for MoMo and bank.** → Required when the method is not cash.
- **Generate invoices has no preview.** → *"Create Term 1 bills for 312 children,
  totalling GHS 46,800? Each parent gets an SMS."* Yes / Not now.
- **Reminders text every overdue parent with no preview and re-send on a second tap.**
  → Show the count, the message and the cost first. After sending, the button reads
  *"Sent at 09:15 to 37 parents"* and is disabled until tomorrow.
- **Day-close is a table with nothing to do.** Either it is an action (*"Close today:
  GHS 2,340 cash, GHS 1,100 MoMo. Print the summary"*) or it is renamed *"Today's
  money"*. Do the second unless a school asks for the first.
- **Words:** "Ledger", "lines frozen at issue", "mints the next receipt", "Defaulters",
  "Catalog", "carry forward". → "Who owes what", drop the frozen note, "Save payment",
  "Owing past the due date", "Fee amounts", "brought forward from last term".
- **No parent money passes through SchoolSpec, by decision.** Parents pay the school
  directly (MoMo to the school's number, cash at the office) and the office records
  it; Paystack is only for the school's own SchoolSpec subscription. The dead
  online-pay code (`PayFeesButton`, `startFeePayment`) is removed so nobody wires
  it by accident. → **How to pay** is the one big button on the child card, and the
  page it opens carries the school's number, the name to confirm, and office hours.

### 3.4 Report cards and releases (admin, three times a year)

- **Publishing report cards locks every score in the term, notifies every family, and
  has no confirm.** → Confirm that names the state: *"Publish Term 1 report cards for
  14 classes? Basic 2 B and JHS 1 are not fully marked. Scores will lock. 612 parents
  get a message."* with **Publish** and **Wait**.
- **Releasing a test is allowed with 0 of N classes ready.** → Disabled until every
  class has submitted, with the missing classes listed in words on the page, not in a
  hover tooltip.
- **"Release" vs "Publish".** → One word: **Send to parents**.
- **The report card page has no print or download button;** it has 11px grey text
  telling the parent to use the browser's print. `PrintButton` exists and is used on
  receipts. → Put it here, large, labelled **Download report card**.

### 3.5 Adding people (admin, once per person, but it is the first thing they do)

- **The student wizard is 7 stages and ~39 fields for 2 required ones.** Class says
  "Choose later" and then refuses completion without one. Sex defaults to Male with no
  blank. Emergency contact is a separate form on the Guardians stage, so filling a
  guardian and pressing the emergency card's button loses the guardian. → **One
  screen:** First name · Last name · Boy/Girl · Class · Parent's name and phone.
  **Save student.** Land on the student's page, where **Add more details** opens the
  rest in folded sections: date of birth and ID · health · previous school · documents ·
  photo · second parent. The term's bill is raised automatically, as today.
- **Discard deletes the draft with no confirm.** → Undo toast: *"Draft removed. Undo."*
- **Import ends with an inline result and no link anywhere.** → Land on the students
  list with a banner *"312 students imported. 3 rows need a look →"*. Also: blank rows
  in the sheet shift the "Row N" numbers in error messages (rows are numbered after
  blanks are dropped). Fix the numbering.
- **The staff wizard is 6 stages for 1 required field.** Payroll and access get whole
  stages. "No portal access" lives only in a URL parameter and is lost if the user
  presses Back. → **One screen:** Full name · Phone · *What do they do?* (Teacher /
  Office / Support) · *Send them a login by SMS?* (on when a phone is given). Land on
  the staff page with **Add more details** folded. Fix the access bug regardless.
- **A bursar preset creates a full admin login.** The label admits it. → A bursar is
  an admin limited to Fees, which Team & access already supports. Wire the preset to it.

### 3.6 Sign-up and sign-in (once, but it decides whether there is a second time)

- **Sign-up asks for a plan before the person has seen the product, and "Your address"
  means a subdomain.** Step 3 then sends them to sign in again. → Two steps: *You*
  (name, email, password) and *Your school* (school name only; the web address is
  suggested from it and shown as *"Your school's link will be stmarys.schoolspec.com
  · change"*). Finish signed in, on the dashboard, with the checklist. The plan
  question arrives on day 13 of the trial and in Billing.
- **Every failed sign-in says the password is wrong,** even when the account does not
  exist. → Say which. And for parents and teachers add one plain line: *"Forgotten
  your password? Ask the school office to reset it."* (`B10` already says this is the
  rule; the screen does not.)

### 3.7 Navigation and the shell

- **Admin sidebar: 20 items under "Learn / Money / Operate".** Settings sits second
  in Operate. Billing sits next to Fees and reads as fee billing. Staff and Staff HR
  sound the same. → Group by *when*, not by *what*:
  - **Every day:** Home · Attendance · Scores · Fees · Announcements
  - **People:** Students · Parents · Staff · Admissions
  - **This term:** Report cards · Timetable · Calendar · Homework
  - **Extras** (add-ons, only when on): Library · Transport · Inventory · Leave · Analytics
  - **Setup:** School settings · Your SchoolSpec plan
- **On phones the sidebar becomes a nameless hamburger.** → Bottom tabs with words,
  four per role (see `SIMPLE_STEPS.md` §0). The hamburger survives as **Menu**.
- **Footer controls:** "?" and the theme toggle are icon-only; "Switch" does not say
  what. → **Help**, **Dark / Light**, **Switch account**.
- **Tables scroll sideways on phones** (560px minimum width, 34 raw tables, none
  collapse). `06-ui-ux.md` promised card lists below `md`. → Do it in `DataTable`
  once; every list inherits it.
- **The toast says "Saved ✓" or "Done ✓" and vanishes in 3.5s.** → The toast says what
  happened in one sentence, stays 6s, and offers Undo where undo is possible. The
  `?flash=` mechanism can carry a message key instead of a boolean.
- **Tour:** the parent tour promises 4 stops and shows 3 (the Reports step has no
  anchor). Students have no tour. → Fix the count; write the four-stop student tour.

### 3.8 Settings

- **"Assessment scheme" and "Grading scale" are two places for one idea.** → One
  section: **How marks become grades**.
- **Team & access is 24 checkboxes.** → Four big presets (Cashier · Bursar ·
  Registrar · Full admin). *"Customise"* opens the checkboxes for the 1 in 50 who need
  them.
- **Section names:** "Structure — levels & classes", "Day plan & timetable", "Rooms &
  facilities (feed enrolment capacity)", "SMS sender ID". → "Classes", "The school day",
  "Rooms", "The name parents see on SMS".
- **Setup checklist item "Set the fee catalog".** → "Enter this term's fees".
- **Quick action "Term closing status".** → "Which scores are still missing".

### 3.9 Homework and timetable

- **Homework:** due date is blank; subject list ignores the class; empty hand-ins are
  accepted; Submit is enabled while the photo is still uploading; resubmitting without
  a file deletes the old one; marking gives no feedback. → Due tomorrow by default,
  subjects filtered by the chosen class, Submit disabled until the upload finishes and
  until there is a note or a photo, resubmission keeps the old file unless replaced, and
  a real "Marked ✓ · 8/10" state after marking.
- **Timetable:** every placement reloads the page and closes the panel; cells show "+"
  and emoji only. → Keep the panel open, move to the next empty slot automatically,
  write "Break" and "Assembly" as words, and make the cell the full tap target.

---

## 4 · Where a confirm belongs, and where Undo belongs

| Action | Why | Confirm text (draft) |
|---|---|---|
| Publish report cards | Locks scores, messages everyone | "Publish Term 1 report cards? Scores lock. 612 parents get a message. [Not ready classes listed]" |
| Send a test to parents | Messages everyone, no un-send | "Send Maths · Test 1 results to 41 parents?" |
| Lock a score column | Teacher cannot undo | "Lock this test? The head can unlock it." |
| Create the term's bills | Money, messages | "Create 312 bills totalling GHS 46,800? Parents get an SMS." |
| Send fee reminders | Costs money | "Text 37 parents (about GHS 1.11)? Message: …" |
| SMS / email all parents | Costs money | "Send to 640 parents as 2 SMS each (about GHS 38)?" |
| Send a register-not-marked reminder | Small; one person | No confirm; toast "Reminder sent to Sir Kwame." |

Everything else, including discard draft, unlink parent, remove a lesson, void a
payment, gets an **Undo** toast, not a dialog. (Void a payment is audit-safe already.)

---

## 5 · Bugs found on the way (fix regardless of the redesign)

1. Skills grid reports "Saved ✓" when the term is locked and nothing was saved
   (`skills-actions.ts`).
2. Staff wizard: "No portal access" is dropped on Back, and completion issues a login
   anyway (`staff-actions.ts`, `saveAccess`).
3. Import: row numbers in errors do not match Excel when the sheet has blank rows.
4. Register re-save texts every absent child's parents again (`attendance/actions.ts`).
5. Homework resubmit without a file sets `fileUrl` to null (`portal-actions.ts`).
6. Homework Submit is enabled during upload; the submission goes without the file.
7. Score input "abs" is saved as 0; values above the maximum are clamped silently
   (`assessment/actions.ts`).
8. Sign-in reports "password doesn't match" for accounts that do not exist.
9. Parent tour announces 4 stops and shows 3.
10. Child fees table "Term" column shows the invoice date, not the term.
11. Bursar preset creates an unrestricted admin login.

---

## 6 · Order of work

Ranked by (how many people × how often) ÷ effort. Each line is one PR.

1. **Feedback everywhere:** specific toasts, 6s, Undo. One change in `feedback.tsx`
   and the `?flash=` keys. Touches every flow.
2. **Register:** three-button rows, honest Save label, stay-on-page banner, SMS only for
   changes.
3. **Fees desk:** search-first "Who is paying?", pre-filled payment, receipt page.
4. **The five confirms** in §4, and the readiness gate on releases.
5. **"How to pay" as the parent's one big button** and the report card Download button.
6. **Score sheet:** autosave, Enter-moves-down, inline errors, "marked out of" up front.
7. **Admit student / Add staff:** one-screen forms; "Add more details" on the record page.
8. **Sidebar regroup and plain words**, bottom tabs on phones, Help / Switch account.
9. **Tables to cards** below `md` in `DataTable`.
10. **Settings:** merge grading sections, access presets, rename sections.
11. Sign-up to two steps, signed-in landing; sign-in error copy.
12. Homework and timetable fixes.

Items 1–5 are a fortnight and change what a school feels on day one. Items 6–12 are the
following month.
