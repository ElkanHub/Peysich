# SchoolSpec — the simple steps

> **In the app (29 Sept 2026):** these steps now live inside SchoolSpec. Every page
> has a **Show me how** button at the top that drops down only that page's steps,
> and **How to do things** in the menu (`/help`) lists every step for the person's
> role, with search. The source of truth is `src/help/steps.ts`; keep the two in step.

This is how every everyday process should read **after** the cuts in
`SIMPLICITY_AUDIT.md`. Each one is written the way it will be printed on the **Help**
card of its page, so it is written for the person, not for us: short lines, the exact
words on the buttons, and what the screen shows back. No step assumes you know what a
"ledger" or a "scheme" is.

A process is finished when it fits on one phone screen of instructions. If it does not,
the screen is wrong, not the instructions.

The IDs are the ones in `PROCESSES.md`. Current tap counts come from the audit.

---

## 0 · What every screen has

Before any process, this is the frame every person sees. It does not change from page
to page, so it is learned once.

**On a phone: four big tabs along the bottom, with words.**

| Who | Tab 1 | Tab 2 | Tab 3 | Tab 4 |
|---|---|---|---|---|
| Head / owner | **Home** | **Attendance** | **Fees** | **Menu** |
| Teacher | **Register** | **Scores** | **Homework** | **Menu** |
| Parent | **My children** | **Fees** | **Notices** | **Menu** |
| Student | **Today** | **Homework** | **Results** | **Menu** |

**Menu** opens the full list, grouped by when you use it, every item with an icon *and*
a word. The bottom of the menu has three buttons: **Help**, **Switch account**,
**Sign out**.

**On every page:**

- The heading says what you are doing, in plain words.
- One big coloured button does the main thing. Its label is a verb: **Save register**,
  **Save payment**, **Send to parents**.
- Every list starts with a search box: *"Type a name…"*.
- When something happens, a green bar says exactly what, in one sentence, and stays
  long enough to read. If it can be undone, the bar has **Undo**.
- Before money leaves, a message goes out, or something locks, a question box appears
  with the numbers in it and two buttons: do it, or **Not now**.
- Nothing needs a hover. Nothing is only an icon. Nothing is smaller than the text in
  this sentence.

---

## 1 · Teacher — Sir Kwame's day

### H1 · Mark today's register  *(today: 2 taps · proposed: 2 taps)*

1. Open the app. The **Register** tab is already showing *Basic 4 A · Monday 28 Sept*.
2. Every child is already **Present**. Find the children who are not here and tap
   **Absent** or **Late** on their row.
3. Tap **Save register · 3 absent · their parents get an SMS**.

The screen goes green: *"Saved at 07:42. 3 parents told. Tap a child to correct."*

*What the screen shows:* one row per child with the photo, the name in 18px, and
three buttons: **Present · Absent · Late**. The chosen one is filled in and ticked.
Nothing else on the page.

*If there is no signal:* the same. The green bar says *"Saved on this phone. It will
send itself when the signal returns."* When it does, a small note says *"Register
sent ✓"*.

*If it is Saturday or a holiday:* the page says *"No school today"* and nothing else.

### I1 · Enter scores for a test  *(today: ~123 taps for 40 pupils · proposed: ~83)*

1. Tap **Scores**. Tap the class and subject card, e.g. *Basic 4 A · Maths*.
2. Tap **Add a test**. Type its name and *marked out of* (it suggests last time's).
   Tap **Start**.
3. Type each pupil's mark. Press the big **Next** key (or Enter) to move down to the
   next pupil. Every mark saves itself. Type **a** for a pupil who did not write.

That is it. There is no Save button because there is nothing left to save. A tick
appears beside each saved row. A mark above the maximum turns red and says
*"Above 30"* until you fix it.

4. When the test is complete, tap **Lock this test**. A box asks: *"Lock Maths ·
   Test 1 for Basic 4 A? You will not be able to change it. The head can unlock it."*
   Tap **Lock**.

*Preschool teachers* see the same page with words instead of numbers: tap a child's
box under each skill to choose *Beginning · Developing · Secure*.

### K1 · Set homework  *(today: 4 fields · proposed: 2)*

1. Tap **Homework**. Tap **Set homework**.
2. Type what to do. The class is the one you used last time and it is due tomorrow;
   change either if you need to.
3. Tap **Give homework**.

*"Given to Basic 4 A · due Tuesday. 38 parents told."*

### K3 / K5 · Mark homework

1. Tap **Homework**. Tap the homework. Every child is listed with **Handed in** or
   **Not yet**.
2. Tap a child to see their work. Type a mark. Tap **Save mark**.

*"Marked 8/10 for Ama Mensah."*

### L1 · Tell the class something

1. Tap **Menu → Announcements**. Tap **Write a notice**.
2. Type it. It goes to your class unless you change the *To* line.
3. Tap **Send**. *"Sent to the parents of Basic 4 A (38 people)."*

### S1 · Put your signature on report cards

1. **Menu → My account → My signature**. Draw it with your finger, or tap **Sign on
   my phone** to scan a code and draw it there.
2. Tap **Keep this signature**.

---

## 2 · Head / owner / bursar — Madam Adjei's day

### M9 · Record a payment at the office  *(today: 4–5 taps and you must know the class · proposed: 3 taps)*

1. Tap **Fees**. The page opens on one box: **Who is paying? Type the child's name.**
2. Type *Ama*. Tap *Ama Mensah · Basic 4 A · owes GHS 250*.
3. The amount **250** is already filled in and **Cash** is already chosen. If they are
   paying part, change the amount. If it is MoMo, tap **MoMo** and type the reference.
   Tap **Save payment**.

The receipt appears with a big **Print** button and the line *"Receipt SMS sent to
Mr Mensah."*

### M7 · Create this term's bills  *(one tap, once a term)*

1. Tap **Fees**. At the top: *"Term 1 bills are not created yet."* Tap **Create bills**.
2. A box says: *"Create Term 1 bills for 312 children, totalling GHS 46,800? Each
   parent gets an SMS."* Tap **Create bills**.

*"312 bills created. Parents told."* If you admit a child later, their bill is
created on its own.

### M14 · Remind parents who owe

1. Tap **Fees → Owing**. The list is oldest-first with *"32 days late"* on each row.
2. Tap **Text all 37 parents**. A box shows the message and *"37 SMS · about GHS 1.11"*.
   Tap **Send**.

*"Sent at 09:15 to 37 parents."* The button then says so and rests until tomorrow.

### H4 / H5 · See who has marked the register, and remind who has not

1. Tap **Attendance**. The top says *"11 of 14 registers marked · 94% in school"*.
   The three unmarked classes are at the top with the teacher's name.
2. Tap **Remind Sir Kwame**. *"Reminder sent to Sir Kwame."*

If a class has no teacher, the row says **Choose a teacher** instead.

### H6 · Mark a register for a teacher who is away

1. Tap **Attendance**. On the unmarked class, tap **Mark it myself**.
2. Same register as the teacher's. Tap **Save register**.

### I4 · See which scores are still missing

1. Tap **Home**. The card *"Scores still missing"* says *"3 of 84 sheets · Basic 2 B
   Maths, JHS 1 English, JHS 1 Science"*.
2. Tap a sheet to see it, or tap **Remind the teacher**.

### I7 · Send report cards to parents  *(the most important two taps of the term)*

1. Tap **Menu → Report cards**. The page says *"Term 1 · 12 of 14 classes ready"* and
   lists the two that are not, in words.
2. Tap **Send report cards to parents**. A box says: *"Send Term 1 report cards for 14
   classes? Basic 2 B and JHS 1 are not fully marked and will go out incomplete.
   Scores lock after this. 612 parents get a message."* Tap **Send**, or **Wait**.

*"Report cards sent to 612 parents. Scores are locked."* Need to change a score after
this? **Menu → Report cards → Unlock a class** asks why, records it, and unlocks.

### I6 · Send one test's results early

1. **Menu → Report cards**. Each test has a row: *"Maths · Test 1 · every class ready"*.
2. Tap **Send to parents**. *"Send Maths · Test 1 to 41 parents?"* Tap **Send**.

The button is grey with *"waiting on Basic 2 B"* until every class has locked it.

### E1 · Admit one child  *(today: 7 stages, 39 fields · proposed: 1 screen, 5 fields)*

1. Tap **Menu → Students → Add a student**.
2. Fill in five things: **First name · Last name · Boy / Girl · Class · Parent's name
   and phone**. Everything else can wait.
3. Tap **Save student**.

You land on the child's page. *"Ama Mensah is in Basic 4 A. Her Term 1 bill of GHS
250 is ready. Her father will get an SMS with his login."* Under **Add more details**
you can open, when you have time: *Date of birth & ID · Health · Previous school ·
Photo · Documents · Second parent*.

### E2 · Bring in the whole school from a sheet

1. **Menu → Students → Import from a sheet**. Tap **Download the sheet** and fill it
   in Excel or with someone who can. Four columns matter: *First name, Last name,
   Boy/Girl, Class*. The rest are optional.
2. Come back and tap **Upload the filled sheet**. It shows *"312 students found · 3 rows
   have a problem"* with each problem in words.
3. Tap **Import 312 students**.

You land on the students list: *"312 students imported. 3 rows still need a look →"*.

### G1 · Add a teacher or office staff  *(today: 6 stages · proposed: 1 screen, 3 fields)*

1. **Menu → Staff → Add staff**.
2. **Full name · Phone · What do they do?** (Teacher / Office / Support). *Send them a
   login by SMS* is already ticked.
3. Tap **Save**.

*"Sir Kwame added. His login was sent by SMS."* On his page, **Add more details**
holds *Employment · Qualifications · Bank & SSNIT · Photo · Signature*, and **Classes
he teaches** opens the allocation grid.

### G9 · Make someone the class teacher

1. **Menu → Staff → Who teaches what**. Find the class. Tap the **Class teacher** box.
2. Tap the teacher's name.

*"Sir Kwame is now class teacher of Basic 4 A."* The register and report cards follow.

### J2 · Fill the timetable  *(today: 80+ taps and 40 reloads for a week · proposed: ~45 taps)*

1. **Menu → Timetable**. Tap the class.
2. Tap an empty box. A panel lists the subjects with each one's teacher. Tap a subject.
   The panel stays open and jumps to the next empty box. Keep tapping subjects until
   the week is full.
3. If a teacher is already somewhere else at that time, the box turns red and says
   *"Sir Kwame is in JHS 1 then"*. Pick another subject or another teacher.

### L2 · Text every parent

1. **Menu → Announcements → Text all parents**.
2. Type the message. Under the box: *"92 characters · 1 SMS each"*.
3. Tap **Send**. *"Send to 640 parents as 1 SMS each (about GHS 19)?"* Tap **Send**.

*"Sent to 640 parents at 10:02."*

### D27 · Let the bursar see only Fees  *(today: 24 checkboxes · proposed: 1 tap)*

1. **Menu → School settings → People who help run the school → Add a person**.
2. Type their name and phone. Tap **Cashier** (takes payments only), **Bursar** (all of
   Fees) or **Full access**.
3. Tap **Add**. *"Login sent by SMS."*

*Customise* sits under the presets for the rare case.

### C4 · The first hour with a new school

The first screen after signing up is not a dashboard; it is six big cards in order.
Each turns green as you do it. Nothing else shows until the first three are done.

1. **Set your term dates** (start, end; the app makes three terms).
2. **Tick the classes you have** (Creche to JHS 3; classes and subjects are created).
3. **Bring in your students** (from a sheet, or one by one).
4. **Enter this term's fees** (one amount per class per fee).
5. **Add your teachers** (name and phone; they get logins by SMS).
6. **Pick your school colour and upload your crest**.

### D30 · End of year: move everyone up

1. **Menu → School settings → End of year**. The page lists every class with *"moves
   to Basic 5 A"* already filled in, and *JHS 3 → leaves the school*.
2. Tap a class to tick any child who is repeating.
3. Tap **Move everyone up**. A box says *"Move 312 children up one class and start
   2027/28? 41 JHS 3 leavers become past students. You can undo this today."* Tap **Go**.

---

## 3 · Parent — Mr Mensah's phone

### Q1 · Is my child in school, and what do I owe?

1. Open the app. That is the whole step.

One card per child, big:

```
┌────────────────────────────────────────┐
│  [photo]  Ama Mensah · Basic 4 A       │
│                                        │
│  ✓ In school today                     │
│  Owing GHS 250 · due 30 Sept           │
│                                        │
│  [ How to pay ]    [ Report card ]     │
│  See everything about Ama →            │
└────────────────────────────────────────┘
```

### Q3 · Pay fees  *(no money passes through the app, on purpose)*

Parents pay the **school**, not SchoolSpec: MoMo to the school's own number, or cash
at the office. The app tells them how, and the office records what came in.

1. Tap **How to pay**. The page shows the amount owing, the school's MoMo number
   with the name to confirm before sending, and the office hours for cash.
2. Pay the school. Keep the MoMo message.
3. When the office records it, the card updates and a receipt SMS arrives. The
   receipt stays under **Fees** forever with a **Download** button.

*Why not a Pay button?* Because then SchoolSpec would be holding the school's money.
The only Paystack payment in the app is the school paying for SchoolSpec itself.

### Q5 · Get the report card

1. Tap **Report card**. It opens.
2. Tap **Download report card**. It saves to your phone as a PDF you can share.

### Q7 · Read a notice from the school

1. An SMS says *"St Mary's: a notice from the school. Open SchoolSpec."* Open the app;
   the **Notices** tab has a red number.
2. Read it. Tap **Seen** at the bottom.

### B1 · Sign in

1. Open the link from the school's SMS. Type the username and password the school gave
   you. Tap **Sign in**.
2. Next time your name is already there. Tap it, type the password.

*Forgotten it?* The line under the button says: *"Ask the school office to reset it."*
That is the only way, on purpose.

---

## 4 · Student (JHS) — the borrowed phone

### R1 · What do I do today?

Open the app. **Today** shows, in order: the next lesson and the one after; homework
due, overdue ones in red at the top; new notices.

### R3 · Hand in homework

1. Tap **Homework**. Tap the one due.
2. Tap **Take a photo of your work** (or **Choose a file**). Wait for *"Photo attached ✓"*.
3. Tap **Hand in**. *"Handed in at 19:20 ✓"* in big green letters.

**Hand in** stays grey until the photo has finished uploading or you have typed an
answer, so nothing is ever handed in empty.

### R4 · See results

Tap **Results**. This term first, subject by subject, with the mark, the grade and the
teacher's comment. When report cards are sent, **Report card** appears at the top.

---

## 5 · Everyone — the small things

### A1 · Put the app on your phone

1. **Menu → My account**. Tap **Put SchoolSpec on my home screen**.
2. Tap **Add**. (On an iPhone the page shows the two taps in Safari with pictures.)

### A4 · Get told when something happens

1. **Menu → My account**. Tap **Tell me on this phone**. Tap **Allow**.
2. Tap **Send me a test**. Your phone buzzes. Done.

### B4 · Two accounts on one phone (a teacher who is also a parent)

1. **Menu → Switch account**. Tap the other name. Type its password.

### B7 · Change your password

1. **Menu → My account → Change my password**. Type the old one, then the new one
   twice. Tap **Change**.

---

## 6 · What must change in the app for these steps to be true

Grouped by screen, in the order the audit ranks them. Each line is one thing a
developer does; the audit has the detail.

**The frame (every page)**
- Bottom tabs with words on phones; **Menu** replaces the hamburger.
- Toasts say what happened, stay 6s, carry Undo. `feedback.tsx`.
- One confirm-box component used only for the six actions in the audit §4.
- Search box on every list, searching names. `DataTable`.
- Tables become card lists on phones. `DataTable`.
- Sidebar regrouped as *Every day · People · This term · Extras · Setup*; plain words.
- Footer: **Help · Switch account · Dark/Light · Sign out**, all with words.

**Register**
- Three labelled buttons per row instead of a cycling colour.
- Save label states the SMS; SMS only for newly-absent children.
- Stay on the page after saving; green banner with time and count.

**Score sheet**
- Autosave per cell; Enter and ↓ move down the column.
- "Marked out of" asked when the column is created.
- Inline red errors; "a" means did not write; no silent clamping.
- Lock confirm.

**Fees**
- Fees page opens on "Who is paying?"; payment form pre-filled; receipt with Print.
- Reference required for MoMo and bank.
- Confirms on Create bills and Text all parents, with counts and cost; sent-today guard.
- Parent card: **How to pay** as the one big button (no online pay by design).

**Report cards**
- Readiness shown in words; Send disabled until ready for tests; confirm with the
  unready classes named for report cards.
- **Download report card** button (reuse `PrintButton`).
- One word: "Send to parents".

**People**
- Admit a student: one screen, five fields; "Add more details" on the student page.
- Add staff: one screen, three fields; "Add more details" on the staff page.
- Import lands on the list with a banner; row numbers match Excel.
- Access presets first; checkboxes under Customise. Bursar preset limited to Fees.

**Sign-up / sign-in**
- Two steps; address suggested from the school name; finish signed in.
- Plan question at day 13 and in Billing.
- Sign-in: honest error; "ask the school office" line.

**Homework / timetable**
- Due tomorrow; subjects filtered by class; Hand in disabled until attached; keep old
  file on resubmit; "Marked ✓" state.
- Timetable panel stays open and advances; words for breaks.

**Settings**
- Merge "Assessment scheme" and "Grading scale" into "How marks become grades".
- Rename sections in plain words; checklist says "Enter this term's fees".

---

## 7 · The test

Before any of these screens ships, one of us hands a phone to someone over fifty who
has never seen the app, says one sentence (*"Ama is absent today; mark the register"*,
*"Mr Mensah is paying 100 cedis for Ama"*, *"send the report cards"*), and says
nothing else. If they ask a question, the screen failed, not the person. Write down
the question; it is the next fix.
