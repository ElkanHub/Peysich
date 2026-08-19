/* Demo seed: makes St. Mary's a LIVING school so every screen has real data.
   Idempotent — checks each layer and only fills what's missing.
   Run: pnpm run db:demo   (DATABASE_URL from .env; pooled Neon URL is fine) */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import {
  schools, academicYears, terms, levels, classes, subjects, staff, students,
  guardians, studentGuardians, enrollments, lessons, attendanceRecords,
  assessments, scores, skillDomains, skillRatings, feeStructures, feeInvoices,
  feePayments, assignments, submissions, announcements, events, user as userTable,
  rooms, studentItems,
} from "./schema";
import { publishTermReports } from "@/modules/assessment/publish";
import { auth } from "@/core/auth";
import { uid } from "@/lib/utils";
import { LEVEL_TEMPLATE } from "@/lib/levels";

const FIRST = ["Ama", "Kofi", "Esi", "Kwame", "Akosua", "Yaw", "Adwoa", "Kwabena", "Abena", "Kojo", "Efua", "Kwesi", "Aba", "Kwaku", "Akua", "Fiifi", "Araba", "Ekow", "Maame", "Paa"];
const LAST = ["Mensah", "Owusu", "Asante", "Boateng", "Osei", "Appiah", "Agyemang", "Addo", "Ofori", "Amoah", "Darko", "Ansah", "Sarpong", "Bonsu", "Frimpong"];
let r = 7; const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const log = (m: string) => console.log("  •", m);

async function ensureLogin(email: string, name: string, role: string, schoolId: string | null) {
  const [ex] = await db.select().from(userTable).where(eq(userTable.email, email));
  if (ex) return ex.id;
  await auth.api.signUpEmail({ body: { email, password: "password123", name } });
  await db.update(userTable).set({ role, schoolId }).where(eq(userTable.email, email));
  const [u] = await db.select().from(userTable).where(eq(userTable.email, email));
  return u.id;
}

async function main() {
  const [school] = await db.select().from(schools).where(eq(schools.slug, "stmarys"));
  if (!school) throw new Error("Run `pnpm run db:seed` first (creates the demo schools)");
  const sid = school.id;
  if (school.planKey !== "premium" || school.studentCap < 100000) {
    await db.update(schools).set({ planKey: "premium", status: "active", studentCap: 100000 })
      .where(eq(schools.id, sid));
    log("St. Mary's moved to the PREMIUM plan (all modules on)");
  }

  // ── 1. academic year + terms ──
  let [year] = await db.select().from(academicYears)
    .where(and(eq(academicYears.schoolId, sid), eq(academicYears.isCurrent, true)));
  if (!year) {
    const yid = uid();
    await db.insert(academicYears).values({
      id: yid, schoolId: sid, name: "2025/2026", startsAt: "2025-09-02", endsAt: "2026-07-30", isCurrent: true,
    });
    await db.insert(terms).values([
      { id: uid(), schoolId: sid, yearId: yid, name: "Term 1", startsAt: "2025-09-02", endsAt: "2025-12-18", isCurrent: false },
      { id: uid(), schoolId: sid, yearId: yid, name: "Term 2", startsAt: "2026-01-06", endsAt: "2026-04-02", isCurrent: true },
      { id: uid(), schoolId: sid, yearId: yid, name: "Term 3", startsAt: "2026-04-20", endsAt: "2026-07-30", isCurrent: false },
    ]);
    [year] = await db.select().from(academicYears)
      .where(and(eq(academicYears.schoolId, sid), eq(academicYears.isCurrent, true)));
    log("academic year 2025/2026 + 3 terms");
  }
  const [term] = await db.select().from(terms)
    .where(and(eq(terms.schoolId, sid), eq(terms.isCurrent, true)));
  await db.update(terms).set({ scoresLocked: false }).where(eq(terms.id, term.id));

  // ── 2. levels, classes, subjects ──
  let lvs = await db.select().from(levels).where(eq(levels.schoolId, sid)).orderBy(levels.sortOrder);
  if (!lvs.length) {
    for (let i = 0; i < LEVEL_TEMPLATE.length; i++) {
      const [code, name, preschool] = LEVEL_TEMPLATE[i];
      const lid = uid();
      await db.insert(levels).values({ id: lid, schoolId: sid, code, name, sortOrder: i, preschool });
      await db.insert(classes).values({ id: uid(), schoolId: sid, levelId: lid, name: `${name} A` });
    }
    lvs = await db.select().from(levels).where(eq(levels.schoolId, sid)).orderBy(levels.sortOrder);
    log("14 levels + one class each");
  }
  const cls = await db.select().from(classes).where(eq(classes.schoolId, sid));
  let subs = await db.select().from(subjects).where(eq(subjects.schoolId, sid));
  if (!subs.length) {
    const GES = ["English Language", "Mathematics", "Science", "Our World Our People",
      "Religious & Moral Education", "Creative Arts", "Ghanaian Language", "Computing", "Social Studies"];
    await db.insert(subjects).values(GES.map((name) => ({ id: uid(), schoolId: sid, name })));
    subs = await db.select().from(subjects).where(eq(subjects.schoolId, sid));
    log("9 GES subjects");
  }
  const preschoolLevel = new Set(lvs.filter((l) => l.preschool).map((l) => l.id));
  const academicCls = cls.filter((c) => !preschoolLevel.has(c.levelId));
  const preschoolCls = cls.filter((c) => preschoolLevel.has(c.levelId));

  // ── 3. staff (+ link the teacher@ demo login so teacher scoping works) ──
  let sf = await db.select().from(staff).where(and(eq(staff.schoolId, sid), isNull(staff.deletedAt)));
  if (sf.length < 16) {
    await db.insert(staff).values(Array.from({ length: 18 - sf.length }, (_, i) => ({
      id: uid(), schoolId: sid, name: `${FIRST[(i * 3) % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`,
      staffRole: i === 0 && !sf.length ? "admin" : "teacher",
      phone: `0244${String(100000 + i).slice(0, 6)}`,
    })));
    sf = await db.select().from(staff).where(and(eq(staff.schoolId, sid), isNull(staff.deletedAt)));
    log(`${sf.length} staff`);
  }
  const teachers = sf.filter((s) => s.staffRole === "teacher");
  const [tUser] = await db.select().from(userTable).where(eq(userTable.email, "teacher@stmarys.test"));
  if (tUser && teachers.length && !(await db.select().from(staff)
      .where(eq(staff.userId, tUser.id))).length) {
    await db.update(staff).set({ userId: tUser.id, name: tUser.name, email: tUser.email })
      .where(eq(staff.id, teachers[0].id));
    log("linked teacher@stmarys.test to a staff profile");
  }
  // class teachers
  for (let i = 0; i < cls.length; i++)
    if (!cls[i].classTeacherId)
      await db.update(classes).set({ classTeacherId: teachers[i % teachers.length].id })
        .where(eq(classes.id, cls[i].id));

  // ── 4. students + guardians (~220) ──
  let roster = await db.select().from(students)
    .where(and(eq(students.schoolId, sid), eq(students.status, "active")));
  if (roster.length < 100) {
    let adm = roster.length + 1;
    for (const c of cls) {
      const n = 12 + Math.floor(rand() * 8);
      for (let i = 0; i < n; i++) {
        const stId = uid();
        const ln = pick(LAST);
        await db.insert(students).values({
          id: stId, schoolId: sid, admissionNo: `ADM${String(adm++).padStart(4, "0")}`,
          firstName: pick(FIRST), lastName: ln, sex: rand() > 0.5 ? "male" : "female", classId: c.id,
        }).onConflictDoNothing();
        await db.insert(enrollments).values({
          id: uid(), schoolId: sid, studentId: stId, yearId: year.id, classId: c.id,
        }).onConflictDoNothing();
        const phone = `024${String(1000000 + Math.floor(rand() * 8999999))}`;
        let [g] = await db.select().from(guardians)
          .where(and(eq(guardians.schoolId, sid), eq(guardians.phone, phone)));
        if (!g) {
          const gid = uid();
          await db.insert(guardians).values({ id: gid, schoolId: sid, name: `${pick(FIRST)} ${ln}`, phone });
          [g] = await db.select().from(guardians).where(eq(guardians.id, gid));
        }
        await db.insert(studentGuardians).values({ studentId: stId, guardianId: g.id }).onConflictDoNothing();
      }
    }
    roster = await db.select().from(students)
      .where(and(eq(students.schoolId, sid), eq(students.status, "active")));
    log(`${roster.length} students with guardians`);
  }
  const byClass = new Map<string, typeof roster>();
  for (const s of roster) {
    if (!s.classId) continue;
    byClass.set(s.classId, [...(byClass.get(s.classId) ?? []), s]);
  }

  // ── 5. timetable ──
  const haveLessons = await db.select({ n: sql<number>`count(*)` }).from(lessons).where(eq(lessons.schoolId, sid));
  if (!Number(haveLessons[0].n)) {
    const days = ["mon", "tue", "wed", "thu", "fri"] as const;
    const slots = [[480, 540], [540, 600], [630, 690], [690, 750]];
    const rows = [];
    for (const c of academicCls)
      for (const d of days)
        for (let i = 0; i < slots.length; i++)
          rows.push({
            id: uid(), schoolId: sid, classId: c.id,
            subjectId: subs[(i + days.indexOf(d)) % subs.length].id,
            teacherId: teachers[(academicCls.indexOf(c) + i) % teachers.length].id,
            day: d, startMin: slots[i][0], endMin: slots[i][1],
          });
    await db.insert(lessons).values(rows);
    log(`timetable: ${rows.length} lessons`);
  }

  // ── 6. attendance: last 10 weekdays ──
  const dates: string[] = [];
  for (let d = new Date(); dates.length < 10; d.setDate(d.getDate() - 1))
    if (d.getDay() >= 1 && d.getDay() <= 5) dates.push(d.toISOString().slice(0, 10));
  const haveAtt = await db.select({ n: sql<number>`count(*)` })
    .from(attendanceRecords).where(eq(attendanceRecords.schoolId, sid));
  if (Number(haveAtt[0].n) < 500) {
    for (const c of cls)
      for (const date of dates)
        await db.insert(attendanceRecords).values((byClass.get(c.id) ?? []).map((s) => ({
          id: uid(), schoolId: sid, studentId: s.id, classId: c.id, termId: term.id,
          date, status: rand() > 0.07 ? "present" : "absent", markedBy: "demo",
        }))).onConflictDoNothing();
    log(`attendance for ${dates.length} school days`);
  }

  // ── 7. scores (CA1, CA2, exam) for academic classes ──
  const haveAssess = await db.select({ n: sql<number>`count(*)` })
    .from(assessments).where(and(eq(assessments.schoolId, sid), eq(assessments.termId, term.id)));
  if (!Number(haveAssess[0].n)) {
    for (const c of academicCls)
      for (const su of subs)
        for (const [kind, title, max] of [["ca", "CA 1", 20], ["ca", "CA 2", 30], ["exam", "End of Term Exam", 100]] as const) {
          const aid = uid();
          await db.insert(assessments).values({
            id: aid, schoolId: sid, termId: term.id, classId: c.id, subjectId: su.id,
            kind, title, maxScore: max, createdBy: "demo",
          });
          await db.insert(scores).values((byClass.get(c.id) ?? []).map((s) => ({
            assessmentId: aid, studentId: s.id, schoolId: sid,
            score: Math.floor(max * (0.35 + rand() * 0.6)), enteredBy: "demo",
          }))).onConflictDoNothing();
        }
    log("CA + exam scores for every academic class × subject");
  }

  // ── 8. preschool skills ratings ──
  let domains = await db.select().from(skillDomains).where(eq(skillDomains.schoolId, sid));
  if (!domains.length) {
    const D = ["Language & Literacy", "Numeracy", "Motor Skills", "Social & Emotional", "Creative Expression", "Independence & Self-help"];
    await db.insert(skillDomains).values(D.map((name, i) => ({ id: uid(), schoolId: sid, name, sortOrder: i })));
    domains = await db.select().from(skillDomains).where(eq(skillDomains.schoolId, sid));
  }
  const RAT = ["emerging", "developing", "secure"];
  for (const c of preschoolCls)
    for (const s of byClass.get(c.id) ?? [])
      for (const d of domains)
        await db.insert(skillRatings).values({
          schoolId: sid, studentId: s.id, termId: term.id, domainId: d.id,
          rating: RAT[Math.floor(rand() * 3)], ratedBy: "demo",
        }).onConflictDoNothing();
  log("preschool skills ratings");

  // ── 9. publish report cards ──
  const published = await publishTermReports(sid, term.id);
  await db.update(terms).set({ scoresLocked: false }).where(eq(terms.id, term.id)); // keep demo editable
  log(`${published} report cards published`);

  // ── 10. fees: structure, invoices, ~60% collected ──
  const haveFees = await db.select({ n: sql<number>`count(*)` })
    .from(feeInvoices).where(and(eq(feeInvoices.schoolId, sid), eq(feeInvoices.termId, term.id)));
  if (!Number(haveFees[0].n)) {
    for (const l of lvs)
      await db.insert(feeStructures).values({
        id: uid(), schoolId: sid, termId: term.id, levelId: l.id, name: "Tuition",
        amountPesewas: preschoolLevel.has(l.id) ? 35000 : 45000,
      });
    const levelOf = new Map(cls.map((c) => [c.id, c.levelId]));
    let i = 0;
    for (const s of roster) {
      const lid = levelOf.get(s.classId ?? "");
      if (!lid) continue;
      const total = preschoolLevel.has(lid) ? 35000 : 45000;
      const invId = uid();
      await db.insert(feeInvoices).values({
        id: invId, schoolId: sid, studentId: s.id, termId: term.id, totalPesewas: total,
      }).onConflictDoNothing();
      if (i++ % 5 < 3) {
        const amt = i % 4 === 0 ? Math.floor(total / 2) : total;
        await db.insert(feePayments).values({
          id: uid(), schoolId: sid, invoiceId: invId, amountPesewas: amt,
          method: i % 3 ? "momo" : "cash", reference: `pay_${uid()}`,
        });
        await db.update(feeInvoices).set({
          paidPesewas: amt, status: amt >= total ? "paid" : "part_paid",
        }).where(eq(feeInvoices.id, invId));
      }
    }
    log("fee invoices for every student, ~60% collected (some partial)");
  }

  // ── 11. homework + submissions ──
  const haveHw = await db.select({ n: sql<number>`count(*)` })
    .from(assignments).where(eq(assignments.schoolId, sid));
  if (!Number(haveHw[0].n)) {
    const due = new Date(); due.setDate(due.getDate() + 3);
    for (const c of academicCls.slice(-6)) { // upper primary + JHS
      const aid = uid();
      await db.insert(assignments).values({
        id: aid, schoolId: sid, classId: c.id, subjectId: subs[0].id,
        title: "Comprehension: read pages 12–15 and answer Q1–5",
        instructions: "Write full sentences. Photograph your exercise book and submit here.",
        dueDate: due.toISOString().slice(0, 10), createdBy: "demo",
      });
      for (const s of (byClass.get(c.id) ?? []).slice(0, 6))
        await db.insert(submissions).values({
          assignmentId: aid, studentId: s.id, schoolId: sid,
          note: "My answers: 1) ... 2) ...", mark: 6 + Math.floor(rand() * 5),
          feedback: "Good effort — watch your punctuation.",
        }).onConflictDoNothing();
    }
    log("homework with marked submissions");
  }

  // ── 12. announcements + events ──
  const haveAnn = await db.select({ n: sql<number>`count(*)` })
    .from(announcements).where(eq(announcements.schoolId, sid));
  if (!Number(haveAnn[0].n)) {
    await db.insert(announcements).values([
      { id: uid(), schoolId: sid, title: "PTA meeting this Friday", body: "All parents are invited to the assembly hall at 4pm. Term 2 report cards will be discussed.", classId: null, createdBy: "demo" },
      { id: uid(), schoolId: sid, title: "Inter-house sports kits", body: "Blue House and Red House students should collect their kits from the office by Wednesday.", classId: null, createdBy: "demo" },
    ]);
    const ev = new Date(); ev.setDate(ev.getDate() + 7);
    await db.insert(events).values([
      { id: uid(), schoolId: sid, title: "Inter-house Sports Day", startsAt: ev },
      { id: uid(), schoolId: sid, title: "Open Day for new parents", startsAt: new Date(+ev + 7 * 86400000) },
    ]);
    log("announcements + upcoming events");
  }

  // ── 13. demo logins: parent + student, tied to real records ──
  const jhs = academicCls.at(-1)!;
  const demoStudent = (byClass.get(jhs.id) ?? [])[0];
  if (demoStudent) {
    const suid = await ensureLogin("student@stmarys.test", `${demoStudent.firstName} ${demoStudent.lastName}`, "student", sid);
    await db.update(students).set({ userId: suid }).where(eq(students.id, demoStudent.id));
    const [link] = await db.select().from(studentGuardians).where(eq(studentGuardians.studentId, demoStudent.id));
    if (link) {
      const [g] = await db.select().from(guardians).where(eq(guardians.id, link.guardianId));
      const puid = await ensureLogin("parent@stmarys.test", g.name, "parent", sid);
      await db.update(guardians).set({ userId: puid, email: "parent@stmarys.test" }).where(eq(guardians.id, g.id));
      // give the parent a second child for the multi-child card view
      const younger = (byClass.get(academicCls[2]?.id ?? "") ?? [])[0];
      if (younger) await db.insert(studentGuardians)
        .values({ studentId: younger.id, guardianId: g.id }).onConflictDoNothing();
    }
  }

  // ── 14. rooms + student-file extras (custody register, payment notes) ──
  const haveRooms = await db.select({ n: sql<number>`count(*)` })
    .from(rooms).where(eq(rooms.schoolId, sid));
  if (!Number(haveRooms[0].n)) {
    const roomRows = [
      ...academicCls.map((c, i) => ({ id: uid(), schoolId: sid, name: `Room ${i + 1}`, kind: "classroom", capacity: 35 })),
      { id: uid(), schoolId: sid, name: "Science Lab", kind: "science_lab", capacity: 30, notes: "Block B, ground floor" },
      { id: uid(), schoolId: sid, name: "ICT Lab", kind: "ict_lab", capacity: 25, notes: "20 workstations" },
      { id: uid(), schoolId: sid, name: "Library", kind: "library", capacity: 40 },
      { id: uid(), schoolId: sid, name: "Assembly Hall", kind: "hall", capacity: 300 },
    ];
    await db.insert(rooms).values(roomRows);
    for (let i = 0; i < academicCls.length; i++)
      await db.update(classes).set({ roomId: roomRows[i].id }).where(eq(classes.id, academicCls[i].id));
    log("rooms created; each class assigned a home room");
  }

  const haveItems = await db.select({ n: sql<number>`count(*)` })
    .from(studentItems).where(eq(studentItems.schoolId, sid));
  if (!Number(haveItems[0].n)) {
    const someClass = academicCls[1];
    const kids = (byClass.get(someClass?.id ?? "") ?? []).slice(0, 3);
    if (kids.length >= 2) {
      await db.insert(studentItems).values([
        { id: uid(), schoolId: sid, studentId: kids[0].id, itemName: "Birth certificate (original)",
          location: "Office cabinet A · folder 12", receivedFrom: `Mother — ${pick(FIRST)} ${kids[0].lastName}`,
          receivedBy: "Front office", note: "To be returned after GES verification" },
        { id: uid(), schoolId: sid, studentId: kids[1].id, itemName: "Immunization card",
          location: "Office cabinet A · folder 13", receivedFrom: "Father", receivedBy: "Front office" },
      ]);
      await db.update(students).set({
        paymentNote: "Father pays via MoMo 024 555 0192, usually week 2 of term. Backup: GCB Adum branch.",
        nationality: "Ghanaian", hometown: "Kumasi", bloodGroup: "O+",
        emergencyName: `Uncle — Kwame ${kids[0].lastName}`, emergencyPhone: "020 555 0134",
      }).where(eq(students.id, kids[0].id));
      log("custody register + payment arrangement samples on the student file");
    }
  }

  console.log(`
✔ St. Mary's is now a living school.

Demo logins (all password123):
  admin@stmarys.test    school admin — dashboard, matrix, fees, everything
  teacher@stmarys.test  teacher — own classes, registers, score sheets
  parent@stmarys.test   parent — child cards, fees to pay, report downloads
  student@stmarys.test  JHS student — timetable, homework to submit, results
`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
