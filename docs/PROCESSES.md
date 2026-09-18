# SchoolSpec — every process in the app

This is the catalogue: **what a person can do in SchoolSpec, from installing the
app to closing the school year**, organised the way the app is organised (the
sidebar), with a stable ID for every process. Once this list is agreed, each ID
gets its step-by-step ("click this, then this, then you'll see…") and every page
in the app gets a small **?** in its top-right corner that opens straight to the
processes that belong to that page.

**Reading the table:** *Who* = which login can do it · *Starts at* = the page
you must be on · *What happens* = the one-line outcome.

IDs never change once assigned (pages will link to them), so new processes get
new numbers rather than renumbering old ones.

---

## A · Getting the app (everyone)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| A1 | Install SchoolSpec on a phone (Android) | Everyone | My Account → Install | The app goes on the home screen; opens full-screen with the SchoolSpec icon and splash |
| A2 | Install SchoolSpec on an iPhone / iPad | Everyone | Safari → Share → Add to Home Screen | Same, via Safari's share sheet (iOS has no install button) |
| A3 | Install SchoolSpec on a laptop / desktop | Everyone | Browser address bar → Install / My Account → Install | Opens in its own window without browser chrome |
| A4 | Turn notifications on for a device | Everyone | My Account → Notifications | Announcements, report releases and register reminders reach the phone even when the app is closed |
| A5 | Send yourself a test notification | Everyone | My Account → Notifications → Send a test | Confirms the device is really subscribed |
| A6 | Turn notifications off for a device | Everyone | My Account → Notifications → Turn off | This device stops receiving pushes; others unaffected |
| A7 | Update the app when a new version is ready | Everyone | The "new version ready" toast | Tap Update — the app reloads on the new build; Later keeps working on the old one until next time |
| A8 | Work offline — what still works and what doesn't | Everyone | Anywhere | Recently opened pages keep opening; the offline chip explains; unseen pages show the offline screen |
| A9 | Get back online after a dropped signal | Everyone | Anywhere | The chip turns green, the page refreshes itself, queued registers send |
| A10 | Switch between light and dark mode | Everyone | Sidebar footer → moon/sun | Remembered on this device |
| A11 | Take (or retake) the guided tour | Everyone | Sidebar footer → ? / first sign-in | A spotlight walk of the pages your role uses |
| A12 | Dismiss / bring back the "Get [school] ready" checklist | Admin | Dashboard | The setup checklist ticks itself as real things get done |

## B · Signing in and accounts (everyone)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| B1 | Sign in with email and password | Everyone | Sign-in page | Lands on your school (subdomain) or the console |
| B2 | Sign in with a school-issued username (no email) | Parents, students | Sign-in page | Same box takes a username |
| B3 | Sign in with Google | Admins with Google | Sign-in → Continue with Google | Only shown when the school has Google connected |
| B4 | Switch between accounts remembered on this device | Everyone | Sidebar footer → Switch / Sign-in → On this device | Two taps: pick the chip, type the password |
| B5 | Forget a remembered account on a shared device | Everyone | Sign-in → chip → × | Removes the name from this device only |
| B6 | Sign out | Everyone | Sidebar footer → Sign out | Also clears the pages saved for offline on this device |
| B7 | Change your own password | Everyone | My Account → Change password | Signs out other sessions |
| B8 | Update your name | Everyone | My Account → Profile | |
| B9 | Set or change your profile picture | Everyone | My Account → Profile picture | Shows in the sidebar only |
| B10 | What to do when you can't sign in | Everyone | Sign-in page | Who resets what (the school office resets parent/student/teacher logins; SchoolSpec never emails passwords) |

## C · Starting a school (owner / first admin)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| C1 | Create a school account (free trial) | New owner | Sign up | Account → school name & address → plan → the school exists with default classes |
| C2 | Choose a paid plan at sign-up | New owner | Sign up → Plan | Goes to Paystack checkout, returns to the school |
| C3 | Open your school for the first time | New owner | Sign-up "Ready" screen | Preview link or `yourschool.<domain>` |
| C4 | First-run setup: the checklist | Admin | Dashboard → Get [school] ready | Classes, students, colour, signature, fee catalog, teachers |

## D · School settings (admin) — Settings page, four tabs

**Academics tab**

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| D1 | Create the academic year and its three terms | Admin | Settings → Academics → Academic calendar | The year and terms exist; one term is current |
| D2 | Change which term is current | Admin | Settings → Academics → Academic calendar | Registers, fees and reports follow the current term |
| D3 | Edit term start / end dates | Admin | Settings → Academics → Academic calendar | The term pulse ("Week 5 of 13") and record book follow |
| D4 | Set the school day (opening / closing hours) | Admin | Settings → Academics → School hours | Dashboards show "closes 14:30 · 10m left" |
| D5 | Choose your levels (Creche → JHS 3) — classes and subjects are created for you | Admin | Settings → Academics → Structure | GES structure; preschool levels get skills-based reports |
| D6 | Add / rename / delete a level | Admin | Settings → Academics → Structure | |
| D7 | Add a class (a second stream: "Basic 1 B") | Admin | Settings → Academics → Structure | |
| D8 | Rename or delete a class | Admin | Settings → Academics → Structure | Deleting needs the class empty |
| D9 | Add / rename / delete a subject | Admin | Settings → Academics → Subjects | Subjects are per section (preschool / primary / JHS) |
| D10 | Set which subjects each section teaches | Admin | Settings → Academics → Day plan & timetable | Feeds allocations and score sheets |
| D11 | Set a section to class-teaching or subject-teaching mode | Admin | Settings → Academics → Day plan & timetable | Decides whether the register and papers use a Class Teacher or a Form Master |
| D12 | Build the day plan: periods, breaks, times | Admin | Settings → Academics → Day plan & timetable | The timetable grid is made of these slots |
| D13 | Give one class a different day plan | Admin | Settings → Academics → Day plan & timetable | A "deviation" for e.g. JHS 3 |
| D14 | Set the assessment scheme (class score / exam weights, per section) | Admin | Settings → Academics → Assessment scheme | How totals and grades compute |
| D15 | Set the preschool skills scale and skill areas | Admin | Settings → Academics → Assessment scheme | The scale on skills report cards |
| D16 | Set the grading scale (A1–F9, remarks) | Admin | Settings → Academics → Grading scale | |
| D17 | Add rooms and assign classes to rooms | Admin | Settings → Academics → Rooms & facilities | |

**School & identity tab**

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| D18 | Upload the school logo / crest | Admin | Settings → School & identity → Branding | Appears on every paper and the top bar |
| D19 | Pick the school colour | Admin | Settings → School & identity → Branding | Colour picker + shortcuts; papers and buttons reseed |
| D20 | Set the school's address, phone, motto, SMS sender ID | Admin | Settings → School & identity → Branding | The SMS name parents see (needs Arkesel approval) |
| D21 | Name the head teacher and the signing admin | Admin | Settings → School & identity → Signatures & stamp | Whose signatures the papers carry |
| D22 | Collect a signature by drawing it (mouse / finger) | Admin | Settings → School & identity → Signatures & stamp | |
| D23 | Collect a signature on a phone via QR code | Admin | Settings → School & identity → Signatures & stamp → Sign on phone | Scan, sign on the phone, it lands on the computer |
| D24 | Upload a signature or stamp image | Admin | Settings → School & identity → Signatures & stamp | Dark ink on white prints best |
| D25 | Remove a signature or the stamp | Admin | Settings → School & identity → Signatures & stamp | |

**Team & access tab**

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| D26 | Add an admin-level team member (bursar, secretary) | Admin | Settings → Team & access | Creates their login |
| D27 | Limit a team member to certain tabs (e.g. Fees only) | Admin | Settings → Team & access | A "cashier" without a fifth role |
| D28 | Limit which fee actions a member may do (record, void, catalog, generate) | Admin | Settings → Team & access | |
| D29 | Remove a team member's access | Admin | Settings → Team & access | |

**Year end tab**

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| D30 | Close the year: promote every class one level up | Admin | Settings → Year end → Promotion | JHS 3 leavers become alumni; preview before confirming |
| D31 | Repeat a student (hold back from promotion) | Admin | Settings → Year end → Promotion | |
| D32 | Start the new academic year after promotion | Admin | Settings → Academics → Academic calendar | |

## E · Students (admin; teachers see their classes)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| E1 | Admit a student one by one (the admission wizard) | Admin | Students → Admit student | Identity → placement → guardians → emergency → health → done |
| E2 | Import students from a spreadsheet | Admin | Students → Import from Excel | Download the collection sheet, fill it, upload it, fix flagged rows |
| E3 | Find a student (search, filter by class / status / type) | Admin, teacher | Students | |
| E4 | Open a student's file and read its sections | Admin, teacher | Students → Open file | Personal, guardians, health, enrolment, attendance, reports, fees, documents, items |
| E5 | Edit a student's personal details | Admin | Student file → Edit profile | |
| E6 | Set / change a student's photo | Admin | Student file → Access & photo | Shows on papers and the parent's card |
| E7 | Add a guardian to a student (new or existing) | Admin | Student file → Guardians → Add guardian | |
| E8 | Unlink a guardian / set the primary guardian | Admin | Student file → Guardians | Primary receives SMS |
| E9 | Move a student to another class (enrol / transfer) | Admin | Student file → Enrolment history → Enrol | Mid-year moves keep history |
| E10 | Record a student leaving the school | Admin | Student file → Exit | Reason and date; the file becomes alumni |
| E11 | Undo an exit recorded in error | Admin | Student file → Undo exit | |
| E12 | Print a leaving certificate | Admin | Student file → Leaving certificate | Signed and stamped paper |
| E13 | Upload a digital document to a student's file (birth cert, ID) | Admin | Student file → Digital documents | |
| E14 | Record a physical item in custody (and return it) | Admin | Student file → Physical items in custody | Textbooks, kits |
| E15 | Record a fee arrangement / payment note for one child | Admin | Student file → Fee arrangement | Instalments, notes the office should know |
| E16 | Grant or apply a scholarship to one student | Admin | Student file → Fee arrangement | Uses scholarships defined in Fees → Catalog |
| E17 | See a student's attendance this term | Admin, teacher | Student file → Attendance this term | |
| E18 | See a student's performance over time | Admin, teacher | Student file → Performance over time | Term by term |
| E19 | Open / print a student's report card for a term | Admin, teacher | Student file → Report cards | |
| E20 | Issue a student login (JHS) / reset it | Admin | Student file → Access & photo | Username + password to hand over |

## F · Guardians (admin)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| F1 | Find a guardian and open their file | Admin | Guardians | |
| F2 | Edit a guardian's contact details and preferences (SMS / call / portal) | Admin | Guardian file → Contact & preferences | |
| F3 | Link an existing guardian to another child | Admin | Guardian file → Children → Link | Siblings under one family |
| F4 | Unlink a child / make this guardian primary for a child | Admin | Guardian file → Children | |
| F5 | Issue a parent portal login / reset it | Admin | Guardian file → Portal access | The parent's username + password |

## G · Staff (admin)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| G1 | Add a staff member (the onboarding wizard) | Admin | Staff → Add staff | Personal → employment → qualifications → payroll → access → done |
| G2 | Give a teacher a portal login (invite) / reset it | Admin | Staff file → Portal access | They sign in with it |
| G3 | Open a staff file and read its sections | Admin | Staff → open | Personal, employment, qualifications, payroll, teaching load, access |
| G4 | Edit personal, employment, qualification or payroll details | Admin | Staff file → each section | |
| G5 | Set / change a staff photo | Admin | Staff file | |
| G6 | Record that a staff member has left / reinstate them | Admin | Staff file → Offboarding | Removes them from allocations |
| G7 | Collect a teacher's signature from the admin side | Admin | Staff file → Signature | Draw, sign on phone, or upload |
| G8 | Allocate teachers with the Allocation Matrix (drag and drop) | Admin | Staff → Allocations | Subjects × classes grid |
| G9 | Make someone the class teacher (class-teaching sections) | Admin | Staff → Allocations / Settings → Structure | Their name and signature go on that class's papers |
| G10 | Make someone the form master (subject-teaching sections) | Admin | Staff → Allocations | Same, for JHS-style classes |
| G11 | Add assistant teachers to a class | Admin | Staff → Allocations | |
| G12 | Give one teacher a whole class's subjects at once | Admin | Staff → Allocations → Fill class | |
| G13 | Clear an allocation / a whole class | Admin | Staff → Allocations | |

## H · Attendance (teachers, admin)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| H1 | Mark today's register (30-second method) | Class teacher / form master | Attendance → My register | Everyone starts present; tap the exceptions; save |
| H2 | Mark a register with no signal (offline) | Teacher | Same | Saved on the phone; sends itself when back online |
| H3 | Understand absent / late / present and what parents receive | Teacher | Register | Absence SMS goes to the primary guardian |
| H4 | See which classes are marked today (the wall) | Admin | Attendance | |
| H5 | Remind a class teacher that the register isn't marked | Admin | Attendance → Nudge / class page → Remind | SMS + push + a banner on their dashboard |
| H6 | Mark a register on a teacher's behalf | Admin | Attendance → class → Mark on their behalf | |
| H7 | Correct a past day's register | Admin | Attendance → Record book → pick the day | Past days only; no re-alerts |
| H8 | Read and print the GES-style record book | Admin, teacher | Attendance → Record book | Week by week, per class, per term |
| H9 | Why a day can't be marked (weekend, holiday, no term) | Teacher, admin | Register | The messages and what to fix |

## I · Assessment and results (teachers, admin)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| I1 | Enter scores on a score sheet (class × subject) | Subject teacher | Assessment → class → subject | Class scores and exam; totals, grades, positions compute |
| I2 | Mark a student absent for a test on the sheet | Teacher | Score sheet | The dash |
| I3 | Submit a test column as complete | Teacher | Score sheet → Submit | Locks it for release |
| I4 | See what's outstanding across the school (the matrix) | Admin | Assessment → Matrix | Which sheets are done, which aren't |
| I5 | Rate preschool skills (skills-based classes) | Class teacher | Assessment → Preschool → class | The skills grid on the scale |
| I6 | Release one test's marks to parents | Admin | Reports → release the test | Recorded with who and when |
| I7 | Release end-of-term report cards (locks scores) | Admin | Reports → Release term reports | Parents get a push; papers go live |
| I8 | Release preschool skills reports | Admin | Reports → Release preschool reports | |
| I9 | Choose what appears on the report paper | Admin | Reports → Report design | Elements on/off |
| I10 | Print / download a class's report cards | Admin, teacher | Reports / Student file | Under the crest, signed, stamped |
| I11 | Who signs a report card and why (class teacher vs form master, head) | Admin | Reports | How the signature lines are chosen |

## J · Timetable (admin; everyone reads)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| J1 | Read the timetable (my day / class / teacher / room views) | Everyone | Timetable | |
| J2 | Place a lesson into a slot | Admin | Timetable → tap a slot | Subject + teacher; clashes are caught |
| J3 | Change the teacher on a placed lesson | Admin | Timetable → lesson → teacher | |
| J4 | Remove a lesson | Admin | Timetable → lesson → Remove | |
| J5 | Resolve a clash warning | Admin | Timetable | What the warning means and the fix |

## K · Homework (teachers, parents, students)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| K1 | Set homework for a class | Teacher | Homework → Set homework | Parents and students see it with the due date |
| K2 | Choose what the school records about homework | Admin | Homework → What this school records | Config |
| K3 | Record that a submission was received | Teacher | Homework → item → Received | |
| K4 | Submit homework (student portal) | Student | Homework → item → Submit | |
| K5 | Mark a submission | Teacher | Homework → item | |

## L · Announcements, messages and calendar

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| L1 | Post an announcement (school-wide or one class) | Admin, teacher | Announcements → Post | Push to the right people; badge on their tab |
| L2 | Send an SMS and/or email blast to all parents | Admin | Announcements → Send | Costs tracked per SMS; logged |
| L3 | Acknowledge announcements (parents, students, staff) | Everyone | The on-open notice / Announcements | Clears the badge |
| L4 | Add an event to the school calendar | Admin | Announcements → Add event / Calendar → Add to calendar | |
| L5 | Mark a holiday (no school day) | Admin | Calendar → Mark holiday | Registers refuse that day |
| L6 | Remove a holiday | Admin | Calendar | |
| L7 | Read the term calendar (term flags, events, holidays) | Everyone | Calendar | |

## M · Fees (admin / cashier; parents pay)

**Setup**

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| M1 | Set fee settings (currency, due days, payment numbers shown to parents) | Admin | Fees → Catalog & settings | |
| M2 | Add / edit / delete a fee type (tuition, PTA, feeding…) | Admin | Fees → Catalog & settings | |
| M3 | Set the amounts per level for the term (the catalog) | Admin | Fees → Catalog & settings | |
| M4 | Copy last term's catalog into this term | Admin | Fees → Catalog & settings → Copy from term | |
| M5 | Define scholarships / discounts | Admin | Fees → Catalog & settings | |
| M6 | Mark who rides the school bus (transport fee) | Admin | Fees → Catalog & settings / Transport | |

**The term's money**

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| M7 | Generate this term's invoices for every student | Admin | Fees → Today → Generate invoices | One bill per child from the catalog |
| M8 | Add a one-off adjustment to a child's bill (extra charge / waiver) | Admin | Student file → Fee arrangement / Ledger | |
| M9 | Record a cash / MoMo payment at the office | Admin, cashier | Fees → Today → Record payment | Receipt issued; SMS receipt to the parent |
| M10 | Record a partial payment | Admin, cashier | Same | Balance keeps itself |
| M11 | Void a payment recorded in error | Admin | Fees → Ledger → receipt → Void | Audit-safe (nothing deleted) |
| M12 | Print / download an invoice or a receipt | Admin, parent | Fees → Ledger / Receipts | PDF with the crest |
| M13 | Email an invoice to a parent | Admin | Fees → Ledger → invoice → Email | |
| M14 | Send fee reminders to those owing | Admin | Fees → Reminders | SMS; chase list oldest-first |
| M15 | Read the day-close (what came in today) | Admin | Fees → Today → Day-close | |
| M16 | Read who owes what (the ledger) | Admin | Fees → Ledger | |
| M17 | Check a child's fee clearance | Admin | Student file → Invoices | |
| M18 | Explain "How to pay" to parents | Admin | Fees → How to pay | The numbers and steps parents see |

## N · Admissions (admin)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| N1 | Set up intake: required documents and screening items | Admin | Admissions → Setup | |
| N2 | Add an applicant | Admin | Admissions → + New application | |
| N3 | Move an applicant through the stages (enquiry → screening → offer → admitted) | Admin | Admissions → pipeline | Drag or move |
| N4 | Record screening results | Admin | Applicant file → Screening | |
| N5 | Tick the documents received | Admin | Applicant file → Documents | |
| N6 | Add / remove an applicant's guardians | Admin | Applicant file → Guardians | |
| N7 | Make an offer (letter by email / SMS) | Admin | Applicant file → Make offer | Printable offer letter too |
| N8 | Resend an offer | Admin | Applicant file → Resend | |
| N9 | Add a note to an applicant | Admin | Applicant file → Notes | |
| N10 | Admit the applicant — becomes a student | Admin | Applicant file → Admit | Creates the student file and guardians |
| N11 | Edit applicant details | Admin | Applicant file → Edit | |

## O · Other operations modules (admin)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| O1 | Add a book to the library | Admin | Library → Add book | |
| O2 | Loan a book to a student and take it back | Admin | Library → Loan / Return | |
| O3 | Add a transport route | Admin | Transport → Add route | |
| O4 | Assign a student to a route | Admin | Transport → Assign | Links to the transport fee |
| O5 | Add an inventory item / adjust its quantity | Admin | Inventory | |
| O6 | Record staff leave | Admin | Staff HR → Record leave | |
| O7 | Approve or decline leave | Admin | Staff HR | |
| O8 | Read analytics (overview, attendance, learning, money, people, operations) | Admin | Analytics → tabs | |
| O9 | Refresh the analytics snapshot / export a tab to CSV | Admin | Analytics | |

## P · Billing and plan (admin)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| P1 | See your plan, renewal date and student-cap usage | Admin | Billing | |
| P2 | Compare plans monthly vs yearly, with everything included / excluded | Admin | Billing → toggle | |
| P3 | Upgrade or change plan (Paystack) | Admin | Billing → Switch to this plan | |
| P4 | Build and request a custom plan | Admin | Billing → Build your own | SchoolSpec calls to agree the price |
| P5 | Request cancellation (reason required) | Admin | Billing → I want to cancel | Nothing changes until we call |
| P6 | What happens on trial end / past due / suspension | Admin | Trial banner / suspended screen | |

## Q · Parent portal

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| Q1 | See your children and today's status | Parent | Dashboard | Photo, class, today's attendance, owing dot |
| Q2 | Open a child's file (attendance, homework, results, fees) | Parent | Dashboard → Full details | |
| Q3 | Pay fees by mobile money / card (Paystack) | Parent | Fees → Pay / How to pay | Receipt by SMS, balance updates |
| Q4 | Download a receipt or invoice | Parent | Fees | |
| Q5 | Read and download a released report card | Parent | Child → Report card | |
| Q6 | See released test results | Parent | Child → Released results | |
| Q7 | Read announcements and acknowledge them | Parent | Announcements | |
| Q8 | See homework set for your child | Parent | Child → Homework | |
| Q9 | Switch between a teacher account and a parent account on one phone | Parent / teacher | Sidebar → Switch | |

## R · Student portal (JHS logins)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| R1 | Read "Do today" (overdue homework, unread notices) | Student | Dashboard | |
| R2 | See today's timetable | Student | Dashboard / Timetable | |
| R3 | Submit homework | Student | Homework → Submit | |
| R4 | See released results and report cards | Student | Results / Reports | |
| R5 | Acknowledge announcements | Student | Announcements | |

## S · Teacher's own account

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| S1 | Submit your own signature (draw / phone / upload) | Teacher | My Account → My signature | Goes on the papers you sign; no admin needed |
| S2 | Remove your signature | Teacher | My Account → My signature | |
| S3 | See only your classes: what "scoped" means | Teacher | Dashboard | Which pages a subject teacher vs class teacher sees |

## T · Platform console (SchoolSpec staff only)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| T1 | Read the overview (needs attention, trials ending, recent signups) | Platform | Console → Overview | |
| T2 | Create a school for a customer | Platform | Console → Schools → New | |
| T3 | Open a school: switch modules on/off (the switchboard) | Platform | Console → School | |
| T4 | Suspend / reactivate a school | Platform | Console → School → Status | |
| T5 | Extend a trial | Platform | Console → School → Extend trial | |
| T6 | Put a school on a plan or a custom plan | Platform | Console → School → Plan | |
| T7 | Track onboarding progress across schools | Platform | Console → Onboarding | |
| T8 | Work the leads pipeline (new → contacted → converted) | Platform | Console → Leads | From the website's demo form |
| T9 | Edit plan prices, caps, modules and marketing visibility | Platform | Console → Plans | Publishes to Billing pages and the website instantly |
| T10 | Handle custom-plan requests (call, negotiate, approve as a private plan) | Platform | Console → Requests | |
| T11 | Handle cancellation feedback | Platform | Console → Requests | |
| T12 | See subscriptions and financials | Platform | Console → Subscriptions / Financials | |
| T13 | Broadcast a message to all schools | Platform | Console → Broadcast | |
| T14 | See all users; invite another platform admin | Platform | Console → All users / Settings | |
| T15 | Read the audit log | Platform | Console → Audit log | |
| T16 | Run the daily dunning sweep (automatic) | Platform | Vercel cron | What it does to past-due schools |

## U · Owner / operations (outside the app — see docs/CONNECTIONS.md)

| ID | Process | Who | Starts at | What happens |
|---|---|---|---|---|
| U1 | Connect the domain (Namecheap → Vercel) | Owner | Vercel + Namecheap | |
| U2 | Connect email (Resend), SMS (Arkesel), push keys, Google, R2, Paystack | Owner | Vercel env | |
| U3 | Run a database migration after pulling code | Owner | Terminal | `pnpm run db:migrate` |
| U4 | Regenerate brand assets after changing the mark | Owner | Terminal | `npm run brand:assets` |

---

**Count:** 12 + 10 + 4 + 32 + 20 + 5 + 13 + 9 + 11 + 5 + 5 + 7 + 18 + 11 + 9 + 6 + 9 + 5 + 3 + 16 + 4 = **214 processes**.

*Review notes for you:* tell me (1) any process you know exists that isn't here, (2) any wording that doesn't match how you and the schools say it, (3) which areas should get the step-by-step first. After that I write the steps for every ID (what to click, what you'll see, where each link leads, the gotchas), and add the **?** button to every page that opens its own processes.
