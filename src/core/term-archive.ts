import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  terms, termArchives, students, classes, subjects, staff, levels, guardians, studentGuardians, enrollments,
  attendanceRecords, componentScores, scoreSheets, scorePublications, assessmentComponents, skillRatings, skillDomains,
  reportCards, feeItems, feeTypes, feeInvoices, feePayments, feeAdjustments, studentScholarships, scholarships, ledgerEntries,
  messages, announcements, announcementAcks, outbox, assignments, submissions, lessons, timetableEntries, periodSlots,
  events, holidays, applicants, teachingAssignments, leaveRequests, loans, books, routes, routeStudents, inventoryItems,
  studentItems, platformAuditLogs,
} from "@/db/schema";
import { uid } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * The term snapshot (docs/11 §2.6). When a term closes, everything that
 * happened in it — in every module — is collated into self-contained rows
 * with the names already written in (the child, the class, the teacher, the
 * fee), and kept under the term. Archives reads these rows, never the live
 * tables, so the record stays what it was however the school changes later.
 * One collector per section; a collector that fails leaves a note, never
 * blocks the close.
 * ──────────────────────────────────────────────────────────────────────── */

export type ArchiveRow = Record<string, unknown> & { _link?: string; _classId?: string };
export type Section = { key: string; title: string; columns: [string, string][]; rows: ArchiveRow[]; staff?: boolean };

/** Sections a teacher may read (filtered to their classes); the rest are the office's. */
export const STAFF_SECTIONS = new Set(["roll", "registers", "scores", "skills", "reports", "homework", "timetable", "calendar", "notices"]);

const day = (d: Date | string | null | undefined) => d ? (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10) : "";
const stamp = (d: Date | null | undefined) => d ? d.toISOString().slice(0, 16).replace("T", " ") : "";
const ghs = (p: number | null | undefined) => p == null ? "" : (p / 100).toFixed(2);

/** Everything a term's rows need a name for, loaded once. */
async function names(schoolId: string) {
  const [st, cl, su, sf, lv, gs, sg, ft, sd, ac, sc, bk, rt, ps] = await Promise.all([
    db.select().from(students).where(eq(students.schoolId, schoolId)),
    db.select().from(classes).where(eq(classes.schoolId, schoolId)),
    db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
    db.select().from(staff).where(eq(staff.schoolId, schoolId)),
    db.select().from(levels).where(eq(levels.schoolId, schoolId)),
    db.select().from(guardians).where(eq(guardians.schoolId, schoolId)),
    db.select().from(studentGuardians).innerJoin(students, eq(students.id, studentGuardians.studentId)).where(eq(students.schoolId, schoolId)),
    db.select().from(feeTypes).where(eq(feeTypes.schoolId, schoolId)),
    db.select().from(skillDomains).where(eq(skillDomains.schoolId, schoolId)),
    db.select().from(assessmentComponents).where(eq(assessmentComponents.schoolId, schoolId)),
    db.select().from(scholarships).where(eq(scholarships.schoolId, schoolId)),
    db.select().from(books).where(eq(books.schoolId, schoolId)),
    db.select().from(routes).where(eq(routes.schoolId, schoolId)),
    db.select().from(periodSlots).where(eq(periodSlots.schoolId, schoolId)),
  ]);
  const by = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const S = by(st), C = by(cl), G = by(gs);
  const primary = new Map<string, string>();
  for (const r of sg) {
    const g = G.get(r.student_guardians.guardianId);
    if (g && (r.student_guardians.isPrimary || !primary.has(r.student_guardians.studentId)))
      primary.set(r.student_guardians.studentId, `${g.name} · ${g.phone}`);
  }
  return {
    students: st, classes: cl, staffRows: sf,
    student: (id: string | null | undefined) => { const s = id ? S.get(id) : null; return s ? `${s.lastName}, ${s.firstName}` : ""; },
    adm: (id: string | null | undefined) => (id && S.get(id)?.admissionNo) || "",
    classOf: (id: string | null | undefined) => (id && C.get(id)?.name) || "",
    classOfStudent: (id: string | null | undefined) => { const s = id ? S.get(id) : null; return s?.classId ? C.get(s.classId)?.name ?? "" : ""; },
    subject: (id: string | null | undefined) => (id && by(su).get(id)?.name) || "",
    staff: (id: string | null | undefined) => (id && by(sf).get(id)?.name) || "",
    level: (id: string | null | undefined) => (id && by(lv).get(id)?.name) || "",
    guardian: (sid: string) => primary.get(sid) ?? "",
    feeType: (id: string | null | undefined) => (id && by(ft).get(id)?.name) || "",
    domain: (id: string) => by(sd).get(id)?.name ?? "",
    component: (id: string) => by(ac).get(id)?.name ?? "",
    scholarship: (id: string) => by(sc).get(id)?.name ?? "",
    book: (id: string) => by(bk).get(id)?.title ?? "",
    route: (id: string) => by(rt).get(id)?.name ?? "",
    slot: (id: string) => by(ps).get(id)?.name ?? "",
  };
}
type N = Awaited<ReturnType<typeof names>>;
type Term = typeof terms.$inferSelect;

/** Rows whose timestamp falls inside the term's days. */
const inWindow = (col: PgColumn, t: Term) =>
  and(gte(col, new Date(t.startsAt + "T00:00:00Z")), lte(col, new Date(t.endsAt + "T23:59:59Z")));

/* ── the collectors: each one returns a section ── */

const COLLECTORS: Record<string, (sid: string, t: Term, n: N) => Promise<Section>> = {
  async roll(sid, t, n) {
    const enr = await db.select().from(enrollments).where(and(eq(enrollments.schoolId, sid), eq(enrollments.yearId, t.yearId)));
    const enrolled = new Map(enr.map((e) => [e.studentId, e]));
    const rows = n.students
      .filter((s) => s.status !== "draft" && !s.deletedAt)
      .map((s) => {
        const e = enrolled.get(s.id);
        const classId = e?.classId ?? s.classId;
        return { adm: s.admissionNo, student: `${s.lastName}, ${s.firstName}`, class: n.classOf(classId), status: e?.status ?? s.status,
          guardian: n.guardian(s.id), _link: `/students/${s.id}`, _classId: classId ?? undefined };
      })
      .sort((a, b) => a.class.localeCompare(b.class) || a.student.localeCompare(b.student));
    return { key: "roll", title: "Class roll", columns: [["adm", "Admission no."], ["student", "Student"], ["class", "Class"], ["status", "Status"], ["guardian", "Parent"]], rows };
  },

  async registers(sid, t, n) {
    const rs = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.schoolId, sid), eq(attendanceRecords.termId, t.id)));
    const rows = rs.map((r) => ({ date: r.date, class: n.classOf(r.classId), student: n.student(r.studentId), status: r.status,
      by: n.staff(r.markedBy) || r.markedBy, _link: `/students/${r.studentId}`, _classId: r.classId }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.class.localeCompare(b.class) || a.student.localeCompare(b.student));
    return { key: "registers", title: "Registers", columns: [["date", "Day"], ["class", "Class"], ["student", "Student"], ["status", "Marked"], ["by", "By"]], rows };
  },

  async scores(sid, t, n) {
    const [cs, sheets, pubs] = await Promise.all([
      db.select().from(componentScores).where(and(eq(componentScores.schoolId, sid), eq(componentScores.termId, t.id))),
      db.select().from(scoreSheets).where(and(eq(scoreSheets.schoolId, sid), eq(scoreSheets.termId, t.id))),
      db.select().from(scorePublications).where(and(eq(scorePublications.schoolId, sid), eq(scorePublications.termId, t.id))),
    ]);
    const outOf = new Map(sheets.map((s) => [`${s.classId}:${s.subjectId}:${s.componentId}`, s]));
    const published = new Set(pubs.map((p) => p.componentId));
    const rows = cs.map((c) => {
      const sh = outOf.get(`${c.classId}:${c.subjectId}:${c.componentId}`);
      return { class: n.classOf(c.classId), subject: n.subject(c.subjectId), test: n.component(c.componentId), student: n.student(c.studentId),
        mark: c.absent ? "absent" : c.raw, outOf: sh?.outOf ?? "", locked: sh?.submitted ? "yes" : "", sent: published.has(c.componentId) ? "yes" : "",
        _classId: c.classId, _link: `/students/${c.studentId}/performance/${t.id}` };
    }).sort((a, b) => a.class.localeCompare(b.class) || a.subject.localeCompare(b.subject) || a.student.localeCompare(b.student));
    return { key: "scores", title: "Scores", columns: [["class", "Class"], ["subject", "Subject"], ["test", "Test"], ["student", "Student"], ["mark", "Mark"], ["outOf", "Out of"], ["locked", "Locked"], ["sent", "Sent to parents"]], rows };
  },

  async skills(sid, t, n) {
    const rs = await db.select().from(skillRatings).where(and(eq(skillRatings.schoolId, sid), eq(skillRatings.termId, t.id)));
    const rows = rs.map((r) => ({ class: n.classOfStudent(r.studentId), student: n.student(r.studentId), skill: n.domain(r.domainId), rating: r.rating,
      by: n.staff(r.ratedBy) || "", _classId: n.students.find((s) => s.id === r.studentId)?.classId ?? undefined }))
      .sort((a, b) => a.class.localeCompare(b.class) || a.student.localeCompare(b.student));
    return { key: "skills", title: "Preschool skills", columns: [["class", "Class"], ["student", "Student"], ["skill", "Skill"], ["rating", "Rating"], ["by", "Rated by"]], rows };
  },

  async reports(sid, t, n) {
    const rs = await db.select().from(reportCards).where(and(eq(reportCards.schoolId, sid), eq(reportCards.termId, t.id)));
    const rows = rs.map((r) => {
      const d = r.data as { className?: string; attendance?: { present?: number; total?: number }; overall?: { average?: number; position?: string | number } } | null;
      return { student: n.student(r.studentId), class: d?.className ?? n.classOfStudent(r.studentId), sent: r.published ? stamp(r.publishedAt) : "draft",
        attendance: d?.attendance?.total ? `${d.attendance.present ?? 0}/${d.attendance.total}` : "",
        _link: `/students/${r.studentId}/report/${t.id}`, _classId: n.students.find((s) => s.id === r.studentId)?.classId ?? undefined };
    }).sort((a, b) => a.class.localeCompare(b.class) || a.student.localeCompare(b.student));
    return { key: "reports", title: "Report cards", columns: [["student", "Student"], ["class", "Class"], ["sent", "Sent to parents"], ["attendance", "Attendance"]], rows };
  },

  async fees(sid, t, n) {
    const items = await db.select().from(feeItems).where(and(eq(feeItems.schoolId, sid), eq(feeItems.termId, t.id)));
    const rows = items.map((i) => ({ fee: n.feeType(i.feeTypeId), class: n.classOf(i.classId) || n.level(i.levelId), amount: ghs(i.amountPesewas), due: day(i.dueDate) }));
    return { key: "fees", title: "Fee amounts", columns: [["fee", "Fee"], ["class", "Class"], ["amount", "GHS"], ["due", "Due"]], rows };
  },

  async bills(sid, t, n) {
    const inv = await db.select().from(feeInvoices).where(and(eq(feeInvoices.schoolId, sid), eq(feeInvoices.termId, t.id)));
    const rows = inv.map((i) => ({ no: i.invoiceNo, student: n.student(i.studentId), class: n.classOfStudent(i.studentId), total: ghs(i.totalPesewas),
      paid: ghs(i.paidPesewas), balance: ghs(i.totalPesewas - i.paidPesewas), status: i.status, due: day(i.dueDate), _link: `/fees/invoice/${i.id}` }))
      .sort((a, b) => a.class.localeCompare(b.class) || a.student.localeCompare(b.student));
    return { key: "bills", title: "Bills", columns: [["no", "Bill"], ["student", "Student"], ["class", "Class"], ["total", "Billed GHS"], ["paid", "Paid GHS"], ["balance", "Balance GHS"], ["status", "Status"], ["due", "Due"]], rows };
  },

  async payments(sid, t, n) {
    // every payment on this term's bills, whenever it was made, and every payment made in the term
    const inv = await db.select({ id: feeInvoices.id, studentId: feeInvoices.studentId, no: feeInvoices.invoiceNo, termId: feeInvoices.termId })
      .from(feeInvoices).where(eq(feeInvoices.schoolId, sid));
    const invOf = new Map(inv.map((i) => [i.id, i]));
    const ps = await db.select().from(feePayments).where(eq(feePayments.schoolId, sid));
    const rows = ps.filter((p) => invOf.get(p.invoiceId)?.termId === t.id || (day(p.createdAt) >= t.startsAt && day(p.createdAt) <= t.endsAt))
      .map((p) => { const i = invOf.get(p.invoiceId); return { receipt: p.receiptNo ?? "", date: stamp(p.createdAt), student: n.student(i?.studentId), bill: i?.no ?? "",
        amount: ghs(p.amountPesewas), method: p.method, reference: p.reference ?? "", by: p.recordedBy ?? "", voided: p.voidedBy ? "yes" : "", _link: `/fees/receipt/${p.id}` }; })
      .sort((a, b) => a.date.localeCompare(b.date));
    return { key: "payments", title: "Payments", columns: [["receipt", "Receipt"], ["date", "When"], ["student", "Student"], ["bill", "Bill"], ["amount", "GHS"], ["method", "How"], ["reference", "Reference"], ["by", "Recorded by"], ["voided", "Voided"]], rows };
  },

  async adjustments(sid, t, n) {
    const [adj, sch] = await Promise.all([
      db.select().from(feeAdjustments).where(and(eq(feeAdjustments.schoolId, sid), eq(feeAdjustments.termId, t.id))),
      db.select().from(studentScholarships).where(and(eq(studentScholarships.schoolId, sid), inWindow(studentScholarships.createdAt, t))),
    ]);
    const rows = [
      ...adj.map((a) => ({ date: day(a.createdAt), student: n.student(a.studentId), what: a.reason, amount: ghs(a.amountPesewas), by: a.createdBy ?? "" })),
      ...sch.map((s) => ({ date: day(s.createdAt), student: n.student(s.studentId), what: `Scholarship: ${n.scholarship(s.scholarshipId)}${s.note ? ` — ${s.note}` : ""}`, amount: "", by: s.grantedBy ?? "" })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    return { key: "adjustments", title: "Discounts & scholarships", columns: [["date", "When"], ["student", "Student"], ["what", "What"], ["amount", "GHS"], ["by", "By"]], rows };
  },

  async ledger(sid, t, n) {
    const ls = await db.select().from(ledgerEntries).where(and(eq(ledgerEntries.schoolId, sid), inWindow(ledgerEntries.at, t)));
    const rows = ls.map((l) => ({ date: stamp(l.at), student: n.student(l.studentId), kind: l.kind, debit: ghs(l.debitPesewas), credit: ghs(l.creditPesewas), memo: l.memo ?? "" }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { key: "ledger", title: "Money ledger", columns: [["date", "When"], ["student", "Student"], ["kind", "Entry"], ["debit", "Debit GHS"], ["credit", "Credit GHS"], ["memo", "Memo"]], rows };
  },

  async notices(sid, t, n) {
    const [ms, an, acks] = await Promise.all([
      db.select().from(messages).where(and(eq(messages.schoolId, sid), inWindow(messages.createdAt, t))),
      db.select().from(announcements).where(and(eq(announcements.schoolId, sid), inWindow(announcements.createdAt, t))),
      db.select({ id: announcementAcks.announcementId, n: sql<number>`count(*)` }).from(announcementAcks).where(eq(announcementAcks.schoolId, sid)).groupBy(announcementAcks.announcementId),
    ]);
    const ackOf = new Map(acks.map((a) => [a.id, Number(a.n)]));
    const rows = [
      ...ms.map((m) => ({ date: stamp(m.createdAt), kind: m.kind, title: m.title, body: m.body, to: m.classId ? n.classOf(m.classId) : m.studentId ? n.student(m.studentId) : "Whole school", by: m.createdBy, read: "", _classId: m.classId ?? undefined })),
      ...an.map((a) => ({ date: stamp(a.createdAt), kind: "announcement", title: a.title, body: a.body, to: a.classId ? n.classOf(a.classId) : "Whole school", by: a.createdBy, read: String(ackOf.get(a.id) ?? 0), _classId: a.classId ?? undefined })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    return { key: "notices", title: "Notices & announcements", columns: [["date", "When"], ["kind", "Kind"], ["title", "Title"], ["body", "Text"], ["to", "To"], ["by", "By"], ["read", "Acknowledged"]], rows };
  },

  async sent(sid, t) {
    const os = await db.select().from(outbox).where(and(eq(outbox.schoolId, sid), inWindow(outbox.createdAt, t)));
    const rows = os.map((o) => ({ date: stamp(o.createdAt), channel: o.channel, to: o.to, kind: o.kind, text: o.body, status: o.status, cost: ghs(o.pricePesewas) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { key: "sent", title: "SMS & messages sent", columns: [["date", "When"], ["channel", "Channel"], ["to", "To"], ["kind", "Kind"], ["text", "Text"], ["status", "Status"], ["cost", "Cost GHS"]], rows };
  },

  async homework(sid, t, n) {
    const as = await db.select().from(assignments).where(and(eq(assignments.schoolId, sid), inWindow(assignments.createdAt, t)));
    const ids = as.map((a) => a.id);
    const subs = ids.length ? await db.select({ id: submissions.assignmentId, n: sql<number>`count(*)` }).from(submissions).where(inArray(submissions.assignmentId, ids)).groupBy(submissions.assignmentId) : [];
    const subOf = new Map(subs.map((s) => [s.id, Number(s.n)]));
    const rows = as.map((a) => ({ set: day(a.createdAt), class: n.classOf(a.classId), title: a.title, due: day(a.dueDate), by: n.staff(a.createdBy) || a.createdBy, handedIn: String(subOf.get(a.id) ?? 0), _classId: a.classId }))
      .sort((a, b) => a.set.localeCompare(b.set));
    return { key: "homework", title: "Homework", columns: [["set", "Set"], ["class", "Class"], ["title", "Homework"], ["due", "Due"], ["by", "By"], ["handedIn", "Handed in"]], rows };
  },

  async timetable(sid, t, n) {
    const [ls, te] = await Promise.all([
      db.select().from(lessons).where(eq(lessons.schoolId, sid)),
      db.select().from(timetableEntries).where(eq(timetableEntries.schoolId, sid)),
    ]);
    const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const order = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5 } as Record<string, number>;
    const rows = [
      ...ls.map((l) => ({ day: l.day, time: `${hm(l.startMin)}–${hm(l.endMin)}`, class: n.classOf(l.classId), subject: n.subject(l.subjectId), teacher: n.staff(l.teacherId), _classId: l.classId })),
      ...te.map((e) => ({ day: e.day, time: n.slot(e.slotId), class: n.classOf(e.classId), subject: n.subject(e.subjectId), teacher: n.staff(e.teacherId), _classId: e.classId })),
    ].sort((a, b) => (order[a.day] ?? 9) - (order[b.day] ?? 9) || a.time.localeCompare(b.time) || a.class.localeCompare(b.class));
    return { key: "timetable", title: "Timetable (as it ran)", columns: [["day", "Day"], ["time", "Time"], ["class", "Class"], ["subject", "Subject"], ["teacher", "Teacher"]], rows };
  },

  async calendar(sid, t, n) {
    const [ev, hs] = await Promise.all([
      db.select().from(events).where(and(eq(events.schoolId, sid), inWindow(events.startsAt, t))),
      db.select().from(holidays).where(and(eq(holidays.schoolId, sid), gte(holidays.date, t.startsAt), lte(holidays.date, t.endsAt))),
    ]);
    const rows = [
      ...ev.map((e) => ({ date: stamp(e.startsAt), what: e.title, to: e.classId ? n.classOf(e.classId) : "Whole school", _classId: e.classId ?? undefined })),
      ...hs.map((h) => ({ date: h.date, what: `Holiday: ${h.name}`, to: "Whole school" })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    return { key: "calendar", title: "Calendar", columns: [["date", "When"], ["what", "What"], ["to", "For"]], rows };
  },

  async admissions(sid, t, n) {
    const ap = await db.select().from(applicants).where(and(eq(applicants.schoolId, sid), inWindow(applicants.createdAt, t)));
    const rows = ap.map((a) => ({ applied: day(a.createdAt), name: a.name, level: n.level(a.levelId), guardian: a.guardianPhone ?? "", status: a.status, decided: day(a.decidedAt),
      admitted: a.admittedStudentId ? n.student(a.admittedStudentId) : "" })).sort((a, b) => a.applied.localeCompare(b.applied));
    return { key: "admissions", title: "Admissions", columns: [["applied", "Applied"], ["name", "Applicant"], ["level", "For"], ["guardian", "Parent phone"], ["status", "Status"], ["decided", "Decided"], ["admitted", "Became student"]], rows };
  },

  async staff(sid, t, n) {
    const [ta, lv] = await Promise.all([
      db.select().from(teachingAssignments).where(eq(teachingAssignments.schoolId, sid)),
      db.select().from(leaveRequests).where(and(eq(leaveRequests.schoolId, sid), gte(leaveRequests.fromDate, t.startsAt), lte(leaveRequests.fromDate, t.endsAt))),
    ]);
    const teaches = new Map<string, string[]>();
    for (const a of ta) teaches.set(a.teacherId, [...(teaches.get(a.teacherId) ?? []), `${n.classOf(a.classId)} ${n.subject(a.subjectId)}`.trim()]);
    const rows = [
      ...n.staffRows.filter((s) => !s.deletedAt).map((s) => ({ name: s.name, role: s.designation || s.staffRole, type: s.staffType, phone: s.phone ?? "", taught: (teaches.get(s.id) ?? []).join("; "), leave: "" })),
      ...lv.map((l) => ({ name: n.staff(l.staffId), role: "", type: "", phone: "", taught: "", leave: `${l.fromDate} – ${l.toDate} · ${l.status}${l.reason ? ` · ${l.reason}` : ""}` })),
    ];
    return { key: "staff", title: "Staff & leave", columns: [["name", "Name"], ["role", "Role"], ["type", "Type"], ["phone", "Phone"], ["taught", "Taught"], ["leave", "Leave"]], rows };
  },

  async library(sid, t, n) {
    const ls = await db.select().from(loans).where(and(eq(loans.schoolId, sid), gte(loans.loanedAt, t.startsAt), lte(loans.loanedAt, t.endsAt)));
    const rows = ls.map((l) => ({ out: l.loanedAt, book: n.book(l.bookId), student: n.student(l.studentId), back: l.returnedAt ?? "not returned" })).sort((a, b) => a.out.localeCompare(b.out));
    return { key: "library", title: "Library loans", columns: [["out", "Borrowed"], ["book", "Book"], ["student", "Student"], ["back", "Returned"]], rows };
  },

  async transport(sid, t, n) {
    const rs = await db.select().from(routeStudents).where(eq(routeStudents.schoolId, sid));
    const rows = rs.map((r) => ({ route: n.route(r.routeId), student: n.student(r.studentId), class: n.classOfStudent(r.studentId) })).sort((a, b) => a.route.localeCompare(b.route));
    return { key: "transport", title: "Transport riders", columns: [["route", "Route"], ["student", "Student"], ["class", "Class"]], rows };
  },

  async inventory(sid, t, n) {
    const [items, si] = await Promise.all([
      db.select().from(inventoryItems).where(eq(inventoryItems.schoolId, sid)),
      db.select().from(studentItems).where(and(eq(studentItems.schoolId, sid), inWindow(studentItems.receivedAt, t))),
    ]);
    const rows = [
      ...items.map((i) => ({ what: i.name, where: i.location ?? "", quantity: String(i.quantity), student: "", received: "", returned: "" })),
      ...si.map((s) => ({ what: s.itemName, where: s.location ?? "", quantity: "", student: n.student(s.studentId), received: day(s.receivedAt), returned: day(s.returnedAt) })),
    ];
    return { key: "inventory", title: "Inventory & items held", columns: [["what", "Item"], ["where", "Where"], ["quantity", "Qty"], ["student", "Student"], ["received", "Received"], ["returned", "Returned"]], rows };
  },

  async audit(sid, t) {
    const ls = await db.select().from(platformAuditLogs).where(and(eq(platformAuditLogs.schoolId, sid), inWindow(platformAuditLogs.createdAt, t)));
    const rows = ls.map((l) => ({ date: stamp(l.createdAt), action: l.action, detail: JSON.stringify(l.detail) })).sort((a, b) => a.date.localeCompare(b.date));
    return { key: "audit", title: "Changes log", columns: [["date", "When"], ["action", "What"], ["detail", "Detail"]], rows };
  },
};

export const SECTION_ORDER = Object.keys(COLLECTORS);

/** Build (or rebuild) the snapshot of one term. Every section is written,
 *  empty ones included, so Archives can say "nothing happened here" honestly. */
export async function buildTermArchive(schoolId: string, termId: string) {
  const [t] = await db.select().from(terms).where(and(eq(terms.id, termId), eq(terms.schoolId, schoolId)));
  if (!t) throw new Error("No such term.");
  const n = await names(schoolId);
  const built: Section[] = [];
  for (const [key, collect] of Object.entries(COLLECTORS)) {
    try { built.push(await collect(schoolId, t, n)); }
    catch (e) {
      // a module's table may be missing on an old database; the note stands in for the rows
      built.push({ key, title: key, columns: [["note", "Note"]], rows: [{ note: `Could not collect: ${(e as Error).message}` }] });
    }
  }
  await db.delete(termArchives).where(eq(termArchives.termId, termId));
  await db.insert(termArchives).values(built.map((s) => ({
    id: uid(), schoolId, termId, section: s.key, title: s.title, count: s.rows.length, columns: s.columns, rows: s.rows,
  })));
  return built.length;
}

/** The snapshot of a closed term; built on first sight for terms closed
 *  before snapshots existed (closed by the migration). */
export async function getTermArchive(schoolId: string, termId: string) {
  let rows = await db.select().from(termArchives).where(and(eq(termArchives.schoolId, schoolId), eq(termArchives.termId, termId)));
  if (!rows.length) {
    await buildTermArchive(schoolId, termId);
    rows = await db.select().from(termArchives).where(and(eq(termArchives.schoolId, schoolId), eq(termArchives.termId, termId)));
  }
  return rows.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section));
}
