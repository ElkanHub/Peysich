# Phone redesign — pre-build audit

Four checks, done against the real pages (every `href`, `<form action>`, `SubmitButton`,
`ConfirmButton`, `<details>` and `<button>` in the mocked routes was listed and matched
against the mockups).

1. Are any existing actions lost, hidden or ambiguous in the new UI?
2. Does the new UI invent an action or side effect that has no process behind it?
3. Will it hold up in the PWA and not fight the desktop?
4. How the same language is applied to the desktop without changing its structure.

Where the audit found a gap, the mockup has been patched (noted as **patched**) or the
item is listed under "New things" with how it gets resolved.

Legend: ✓ kept as-is · ↪ moved (where to) · ✎ patched into the mockup · ✗ dropped on purpose.

---

## 1. Action audit, screen by screen

### Sign-in / sign-up
| Today | New UI |
|---|---|
| Remembered accounts: pick, remove (×) | ✓ pill row; remove is a long-press or a small × on the pill (keep the ×) |
| Email/username + password, show/hide, Turnstile, Sign in | ✓ unchanged under the sheet |
| Switch-account mode (`?switch=1`) | ✓ title changes to "Switch account", same frame |
| Offline message, error box | ✓ same components |
| Sign-up two steps, slug suggestion + "change" | ✓ same forms; steps shown as a line under the sheet title |

### Home · Head
| Today | New UI |
|---|---|
| TermPulseBar: week, closing time, **Close term / Open next term / Close the year** (admin ceremony) | ✎ chips carry week + clock. The ceremony buttons were missing: when the term has ended or is closed, a **term card** sits directly under the hero with the same two actions (patched into `home-admin.html` as a note + card). |
| "First things first" (no term) card | ↪ same card, under the hero |
| Setup checklist (6 items, dismiss ×, "Ask for installation") | ↪ progress card under the hero with the same items, dismiss, and the installation line (patched as a note; not drawn to keep the mockup readable) |
| 4 stats (students, present, collected, outstanding) | ✓ strip, same four |
| Needs you: registers → `/attendance`, owed → `/fees?tab=reminders`, sheets → `/assessment/matrix` | ✓ rows; the Remind / Send buttons on rows jump to the same pages (they do not fire the action from the home screen) |
| Quick actions ×5 (add student, attendance, message parents, take a payment, check scores) | ✎ 4 tiles + "Check scores" is the "7 score sheets missing" row. Patched: a fifth tile is not needed; the row links to the matrix. |
| Attendance today per class (8 rows, link each) + "All classes" | ✓ bar + class chips (each chip links to `/attendance/[classId]`) + "All classes →" |
| Scores still missing: per sheet **Remind the teacher** (server action) | ↪ the matrix page, where each missing sheet row keeps the Remind button. The home row says "7 missing" and opens the matrix. Nothing lost; one tap further for the per-sheet remind. |
| More to do: import students, add a teacher, billing | ✗ dropped from Home. All three live in the drawer (Students, Staff, Your plan) and Students has Import. |
| Latest announcements + events (text) | ✓ picture card + rows, each links to `/comms` |

### Home · Teacher
| Today | New UI |
|---|---|
| Nudge banners (attendance → `/attendance/[id]`, scores → `/assessment/c/s`) | ✓ rows at the top of "To mark" with an Enter / Mark button |
| My registers cards → `/attendance/[id]` | ✓ the one tinted card (several homerooms: one card each, stacked) |
| Today's lessons + Full timetable | ✓ timeline + link |
| Homework to mark → `/homework/[id]`; Score sheets → `/assessment` | ✓ rows + "Scores →" |
| Announcements | ✓ rows → `/comms` |
| "Login not linked to a staff record" notice | ✓ same text, as a tinted card under the hero |

### Home · Parent
| Today | New UI |
|---|---|
| Per child: attendance today, owing/cleared, **How to pay** → `/fees?child=`, **Report card** → `/students/[id]/report/[term]`, **See everything** → `/children/[id]` | ✓ pills + two buttons; tapping the card = "See everything" |
| No children linked message | ✓ kraft empty card |
| Unacked announcements (gate modal) | ✓ gate stays; the card says "Tap to acknowledge" and opens the same gate |

### Home · Student
| Today | New UI |
|---|---|
| Own-file card (name, class, adm no, school) | ↪ hero eyebrow + title |
| 4 stats; Do today (overdue, pending, acknowledge); lessons; My results / attendance record / all homework; announcements | ✓ all present (results and attendance as tiles; homework via the tab) |

### Students
| Today | New UI |
|---|---|
| Add a student (top-right) | ✓ "+ Add" |
| Search by name / adm no; filters class, status (admin), sex | ✓ search + class chips + Filter sheet (status, sex, type) |
| **Import from a sheet, Admissions, Year-end promotion, Classes & rooms** (4 ghost buttons) | ✎ patched: a `⋯` overflow button in the top bar lists exactly these four. The line under the heading says "Import · Admissions". |
| Import issues banner (`?issues=`, Dismiss) | ✓ tinted card with Dismiss |
| Drafts: Finish → / **Discard** (server action) | ✎ patched: the drafts card lists each draft with Finish and Discard |
| Row → `/students/[id]` ("Open file") | ✓ whole row |
| Pagination Prev / Next | ✎ patched: "Prev · Page 1 of 17 · Next" (no "Load more", which would be a new mechanism) |
| Teacher view: "My students", no classes assigned empty | ✓ same, kraft empty |

### Staff
| Today | New UI |
|---|---|
| Add staff; search; type filter; status (former) | ✓ "+ Add", search, segmented type, "Former staff" link |
| Who teaches which class → `/staff/allocations`; Leave → `/hr` | ✓ two tiles |
| Drafts Finish / **Discard** | ✎ patched: drafts card with both |
| Row → `/staff/[id]` | ✓ |

### Scores (admin)
| Today | New UI |
|---|---|
| By students / By subjects | ✓ segmented |
| Class chips | ✓ snap row |
| Open Reports →, Configure the scheme → | ↪ Reports is the top-right link; scheme lives under Settings → Assessment scheme (and the drawer). |
| Students view: name → inline record (`?stu=`) with links to performance page and file | ✓ row → inline record expands under the row, same two links |
| Subjects view: per subject → sheet `/assessment/c/s`, allocations link | ✓ rows with Open sheet; "Who teaches what →" in the section header |
| Preschool skills grids | ✓ chips |
| **Teacher view** (class cards → subject links, skills grid) | ✎ not separately mocked; it is the same page without the segmented control: class chips, then one row per subject → `/assessment/c/s`. Noted in `scores.html`. |

### Attendance (office)
| Today | New UI |
|---|---|
| Record book (top-right) | ✓ |
| Pulse: registers marked bar, in-school %, present/late/absent | ✓ picture card |
| Unmarked: **Remind** (server action, shows "reminded at by"), "Mark it myself" → `?mark=1`, no-teacher → `/staff/allocations` | ✓ Remind on the row; row tap → class page (which has "Mark it myself"); ✎ patched: the no-teacher row links to allocations |
| Marked: per class rate bar, breakdown, absent names → class page | ✓ rows with subtitle |
| Empty classes list | ✓ small footer line |
| Teacher view: my registers + subject-only classes | ✓ follows the teacher home card + a muted list |
| Day strip (new in mockup) | ✎ patched out of the board. The board is today's board. Past days are on the record book and the class page (`?date=`), which already take a date. |
| "Remind all 4" (new in mockup) | ✎ patched out. There is no bulk nudge; per-row Remind is what exists. |

### Register (class page)
| Today | New UI |
|---|---|
| Teacher: `Register` widget — one row per child, P/L/A radio group, Save; after save locks, shows "Saved at · N parents told", **Correct** button; offline queue | ✓ **this is already the mockup's structure.** The change is only styling (row kit, floating save bar). Patched the note. |
| Admin: class-teacher card (link + phone), **Remind**, "reminded at by", marked list, **Mark it myself / Correct it myself** behind `<details>` | ✓ admin variant: teacher row with Call + Remind at the top, the read-only marked list, and the override behind a ghost button at the bottom (same `<details>`). |
| Weekend / holiday "No school today" | ✓ kraft empty card |
| Past-date correction banner | ✓ title bar shows the date, subtitle says "Correcting" |

### Student file
| Today | New UI |
|---|---|
| **Emergency** (red, teachers too), **Exit**, **Enrol**, **Edit profile** | ✎ patched: hero shows Emergency (red) + Edit; Enrol and Exit are in a `⋯` menu. They were missing. |
| Exit record banner: leaving certificate, **Undo exit** | ✓ tinted card under the hero when status ≠ active |
| 6 tabs: Profile, Academics, Performance, Register, Fees, Documents | ✎ patched: a scrolling chip row with all six (the 4-segment control could not hold them) |
| Guardians: link to guardian file, **Unlink**, add guardian form, make primary (on guardian page) | ✓ rows → guardian file; Unlink via row `⋯`; "+ Add" opens the same form |
| Personal / Health forms (details → save) | ✓ "Edit" in each section header opens the same form |
| Login card (admin) | ✓ section row under Profile |
| Items, scholarship, adjustments, transport rider, payment note, documents upload, report links | ✓ on their tabs, same forms, rows instead of tables |

### Fees · Parent
| Today | New UI |
|---|---|
| Child chips | ✓ |
| Owing / cleared, due badge, progress, **How to pay** (#anchor), **Download bill PDF**, **View or print bill** → `/fees/invoice/[id]` | ✎ patched: "View bill" link added in the bill section header (it was missing) |
| Bill lines; How to pay (MoMo, bank, cash); receipts **View or print** + **PDF**; full statement | ✓ all present; "View" is the row tap, PDF is the button |
| Term picker (`?t=`) | ✓ top-right |

### Fees · Office
| Today | New UI |
|---|---|
| Fee amounts & settings (top-right) | ✎ patched: gear button in the top bar (the term picker takes the text slot) |
| "Bills not created yet" card + **Create bills** (confirm with SMS cost) | ✎ patched: a tinted card above the list whenever bills are missing (first time, or new admissions), same ConfirmButton |
| **Who is paying?** search → hits → `/fees/invoice/[id]` (Record payment) | ✎ patched: the "Record a payment" tile focuses the search box; search hits are the list rows; row tap → invoice page. There is no separate record-payment screen today and the mockup does not invent one. |
| Tabs: Today's money / Who owes what / Past due | ✓ segmented Today · Owing · Everyone, with Past due as the "Send reminders" tile |
| Today's money by cashier (table) | ✎ patched: a "Today" summary row that expands to the cashier breakdown |
| Ledger class chips + "Only who owes" | ✓ chips + the Owing segment |
| Row: Record payment / Open bill, PDF | ✓ row tap → invoice (PDF lives there) |
| Reminders: **Text all N parents** (confirm, cost, once a day, disabled states) | ✓ the tile opens the same ConfirmButton; disabled text ("Sent at 08:12 to 64") shows on the tile |

### Homework
| Today | New UI |
|---|---|
| Teacher: table, **Set homework** form | ✓ rows; "+ Set" opens the same form full-screen |
| Admin: 4 stats, quiet-classes warning, subject/date filters, per-class tables, **config** (record hand-ins / marks) | ✓ summary card; ✎ filters → Filter sheet (subject, due from/to); config → Settings → "What this school records" row (and the `⋯` on this page) |
| Parent / student: subject chips, child cards, rows → `/homework/[id]` | ✓ same bones |

### Announcements
| Today | New UI |
|---|---|
| Feed of notices (audience badge, **Acknowledge** per notice), events, messages (**Read by N of M** names, **Remind the rest** confirm with cost), SMS/email blasts | ✓ segmented Notices / Events / Messages. ✎ patched: unacked notice rows show an "Acknowledge" pill; message rows show "Read 212/380 ›" expanding to names + Remind. |
| Post announcement (audience chips), Add event, Message all parents (BlastForm) | ✓ "+ Post" opens a sheet with the three choices (teacher: one), each the existing form full-screen |
| "Pinned" (new in mockup) | ✎ patched out: there is no pin field. The picture card is the newest notice. |

### Calendar
| Today | New UI |
|---|---|
| Month ‹ today ›; grid; coming up; add event; mark holiday; **remove** holiday | ✓ ‹ › kept; "+ Event" sheet with Event / Holiday; ✎ patched: holiday cards in the timeline carry "remove" for admins |

### Timetable
| Today | New UI |
|---|---|
| Views: class / teacher / subject / level; class chips; **cell select** (`sel=`) opens the slot editor; print | ✎ patched: segmented Class · Teacher · Subject (· Level for admin), chips, day strip, timeline; tapping a slot opens the same editor in a sheet. Print stays top-right. |

### Account
| Today | New UI |
|---|---|
| Profile save; change password; profile picture; notifications on / **test** / off; WhatsApp save, Telegram link / unlink; install; signature + remove | ✓ all as rows → sub-screens with the existing forms |
| "Signed-in devices" (new in mockup) | ✎ patched out. No sessions UI exists yet. |

### Settings
| Today | New UI |
|---|---|
| Accordion: term dates, reopen term, create year, school hours; team access grants; levels/classes/rooms CRUD; subjects CRUD; timetable link; assessment link; branding; signature people + images; promotion link | ✓ grouped rows → each opens the same forms full-screen. ✎ patched: "School hours" lives inside "Academic year & terms", "Signatures" inside "Profile & branding", rooms inside "Classes & rooms" — said in the row subtitles. |

### Menu drawer / tabs
| Today | New UI |
|---|---|
| Groups, badges, account, How to do things, Privacy · Terms, Sign out, Switch account, Tour, Theme | ✎ patched: Privacy · Terms line added. Everything else present. |
| Bottom tabs per role | ✓ unchanged |

---

## 2. New things the mockups introduced, and what happens to each

| Item | Where | Verdict |
|---|---|---|
| **Bell with a dot** in the top bar | every screen | There is no notification centre. **Resolve:** the bell shows the existing nav badge count (unacknowledged announcements + nudges, from `getNavBadges`) and opens `/comms`. No new process. |
| **"owing" / "absent today" pills** on student rows | Students | Needs the invoice balance and today's attendance joined into the list query. Small, but new. **Resolve:** phase 2; v1 rows show class · number · boarder only. |
| **Position / average** on Scores rows and the student hero | Scores, Student file | Comes from the performance engine, which runs per student today, not per class list. **Resolve:** drop from the list in v1 (completeness pill only); the hero chip reads from the same figure the Performance tab already computes. |
| **Day strip** on the office attendance board | Attendance | Board is today-only. **Patched out.** |
| **Remind all** | Attendance | No bulk nudge. **Patched out.** |
| **Pinned** notice, **read count on notices** | Announcements | No pin field; acknowledgements exist per user but are not counted for admins. **Patched:** pinned removed; read count stays as a small new `count(*)` on `announcement_acks`, which is a query, not a process. |
| **Copy** buttons for MoMo / bank | Fees parent | Clipboard only, client-side. Fine. |
| **Load more** | Students | **Patched** back to Prev / Next. |
| **Signed-in devices** | Account | **Patched out.** |
| **School campus photo** | Settings header | New optional upload in Branding. **Resolve:** v1 uses the generated `hero-campus-portrait` for every school; the upload (reusing the logo uploader) is phase 2. |
| **Announcement picture card** | Home, Announcements | Announcements have no image. **Resolve:** the card's picture is chosen by type (event → `hero-pta-portrait`, notice → spot-megaphone on kraft), never uploaded. Optional image attach is phase 2. |
| **Repeat-absence ring** ("3rd time this term") | Register | One grouped count query per class per term. Small; v1 can ship without it. |
| **Find a name / Absent / Late chips** on the register | Register | Client-side filter on the existing widget's state. Fine. |
| **Record a payment tile** | Fees office | **Patched:** focuses the search; no new screen. |
| **Today's money expandable row** | Fees office | Same data as the cashier table, in a `<details>`. Fine. |
| **Filter bottom sheet** | lists | Pure UI over the existing URL params. The sheet writes `?status=&sex=&type=` exactly as the selects do. Fine. |
| **"+ Post" chooser sheet** | Announcements, Calendar | A sheet with links to full-screen versions of the existing forms (`/comms?compose=announcement` etc.). The forms and actions are unchanged. Fine. |

Nothing in the mockups requires a new server action, a schema change, or a new
message. Two items (read count, repeat-absence count) add a query each. Two items
(campus photo upload, announcement image) are explicitly phase 2 and the v1 design
does not depend on them.

### Links
Every tappable thing in the mockups maps to an existing route or query param; the
route table at the bottom of `index.html` lists which mockup each of the 95 routes
follows. New query params the sheets write (`?status`, `?sex`, `?type`, `?view`,
`?c`, `?t`, `?child`, `?date`, `?compose`) all exist today except `?compose`, which
only chooses which existing form to render.

---

## 3. PWA and desktop

**Breakpoints stay where they are.** Shell (sidebar vs drawer + tabs) switches at
`lg` (1024). Tables switch at `md` (768). All redesign CSS is under `max-md`
(< 768px) except the one-top-bar change, which follows the shell at `max-lg`.
Tablets (768–1023) therefore keep tables and get the drawer, exactly as now. The
desktop is untouched by every phone rule.

**Installed app (standalone):**

- `theme_color` and `background_color` are ink; the new 56px top bar is ink and pads
  by `--sat`, so it still reads as one surface with the status bar. ✓
- **Inner pages with the paper (light) top bar need an ink strip of height `--sat`
  above them.** `statusBarStyle` is `black-translucent`, so iOS draws white clock
  text over whatever is under it; over paper that is invisible. Fix: the light bar
  gets `border-top: var(--sat) solid var(--ink)` (one line). Same for the sign-in
  sheet: the scene is ink, so it is fine.
- Bottom tabs keep `pb-[var(--sab)]`; the floating Save bar on the register sits
  `bottom: calc(3.75rem + var(--sab))`.
- The sign-in scene uses `46vh`; in standalone that is the real screen height
  (`100dvh` is what the Door already uses). ✓
- Snap chip rows and the swipe-to-open drawer: the drawer already refuses a
  gesture that starts inside a horizontally scrollable element, so chip rows scroll
  and the drawer does not steal them. ✓ (The gesture code checks `overflowX` and
  `scrollWidth`, which the chip rows satisfy.)
- Offline: the register widget's queue is untouched. The offline page follows the
  kraft empty pattern. Risograph spots are tiny WebPs; add `/spot/*` to the service
  worker precache so empties and tiles render offline.
- Splash screens and icons are unchanged.
- Windows / macOS installed PWA runs the desktop layout (≥1024), so it sees the
  desktop, not the phone design. No conflict.

**Dark mode:** photos get the same ink gradient in both themes; kraft cards stay
kraft in dark (they are paper, like the printed report card). Risograph art is wine
on kraft so it never needs a dark variant.

**Print:** the one-bar shell is `print:hidden` like today; documents are untouched.

---

## 4. Applying the language to the desktop (no restructuring)

The desktop keeps: ink sidebar, breadcrumb top bar, page header with the primary
action top-right, tables with the actions column, 5px control corners, the fixed
shell. What changes is only the *dressing*, using the same pieces the phone gets:

| Piece | Desktop today | Desktop with the language applied |
|---|---|---|
| **Dashboard hero** | photo on the right 64%, text on card | Same, but the term strip's week + clock + ceremony buttons move into the hero (one surface instead of two stacked). The photo is the portrait re-cut on narrow desktops, the landscape on wide. |
| **Stats** | 4 white tiles, mono label, number, hint | Unchanged layout; the hero tile becomes the wine one, and the status tiles get their small risograph spot bottom-right, as on phones. |
| **Quick actions** | 5 coloured bars with an icon | Same 5-column grid; each becomes the phone's tile (title, one line, spot art). |
| **Needs you / Scores missing / More to do** | cards of boxes | Rows in a card (avatar tile, title, line, action on the right), the phone row kit at desktop width. Remind buttons stay inline. |
| **Section headers** | `<h2>` in each card | "Title ……… View all →" header above a list or sheet; cards only where something is lifted. Same rule as phones. |
| **Lists / tables** | DataTable | **Tables stay.** Add the avatar tile in the first column, the subtitle line under the name (class · number), and status as a pill. The row's first column then looks like the phone row. Actions column unchanged. |
| **Filters** | search + selects | Search + the same chip row for classes (allowed to wrap on desktop) + the selects kept for the rest. Chips are the only visible difference. |
| **View switches** (By student / By subject, Profile / Academics …) | underlined tabs | Segmented control for ≤4 views, underlined tabs beyond that. Phones and desktop match. |
| **Banners** (trial, past due, frozen, wallet low, import issues, drafts, nudges) | six slightly different boxes | One `Banner` component: ink-left-border strip, a spot icon, bold lead, one line, one button on the right, dismiss where it exists today. Order fixed: trial → payment → frozen → wallet → page banners. |
| **Announcements** | left-border cards | The newest as a picture card (type-chosen art) in the feed's first slot; the rest as rows. Compose forms stay in the right column on desktop (there is room); on phones they are behind "+ Post". |
| **Announcement gate** (acknowledge modal) | centred dialog | Same dialog; the picture card art at the top and the same Acknowledge button. |
| **Empty states** | dashed grey box | The kraft card with the risograph illustration, at a smaller size, centred in the content area. |
| **Sidebar header** | logo + school | Logo + school stays; the person block at the bottom gets the avatar ring and the same four footer pills as the phone drawer. |
| **Fees parent balance** | white card | The dark balance card, max-width 480, left-aligned in its column. |
| **Files** (student, staff, guardian) | avatar + h1 + button row | Avatar grows to 72px with the three fact chips under the name; tabs → segmented; sections keep their cards but gain the key-value sheet layout inside. |
| **Corners** | 5px everywhere | **Unchanged** on desktop controls. Picture cards, empties and the balance card use 12px because they are "objects", not controls. |
| **Spot art placement** | none | Only on tiles, empties, the balance card and banners. Never on tables, forms or settings. |
| **Settings** | accordion | Unchanged structure; each `<details>` summary row gets the icon tile + current-value subtitle, so it reads like the phone list. |

The net effect: a head teacher who uses the phone in the morning and the office PC
in the afternoon sees the same hero, the same tiles, the same banners, the same
rows-in-tables, the same empties and the same art. Only the frame differs, and the
desktop frame is the one the docs already lock down.

---

## 5. Open points left for you

1. v1 ships without the three "small new query" items (owing/absent pills on student
   rows, position/average on scores rows, repeat-absence ring)? They are cheap but
   each touches a hot list query. I recommend yes, and add them in the week after.
2. Announcement art by type (no upload) is fine for v1?
3. Desktop: segmented control for ≤4 views replaces the underlined tabs — agree?
