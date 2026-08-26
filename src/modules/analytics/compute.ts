import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  analyticsSnapshots, applicants, attendanceRecords, assessmentComponents,
  books, classes, componentScores, feeInvoices, feePayments, gradingSchemes,
  guardians, levels, loans, routes, routeStudents, scoreSheets, staff,
  students, studentGuardians, subjects,
} from "@/db/schema";
import { getStructure } from "@/core/academics";
import { getIntakeConfig } from "@/modules/admissions/config";

/* The analytics engine. One principle: dashboards never scan live tables —
 * they read a JSON snapshot computed once per school per day (the first
 * admin visit computes it; "Refresh now" recomputes on demand). */

export type Snapshot = {
  day: string; termId: string | null; termLabel: string; computedAt: string;
  money: {
    billed: number; collected: number; outstanding: number; owingStudents: number;
    weekly: { label: string; v: number }[]; forecast: number; weekNow: number; weeksTotal: number;
    aging: { label: string; v: number }[];
    channels: { label: string; v: number }[];
    byClass: { classId: string; name: string; billed: number; collected: number; outstanding: number; owing: number; of: number }[];
  };
  learning: {
    schoolAvg: number | null; studentsScored: number;
    subjects: { name: string; avg: number; n: number }[];
    grades: { grade: string; n: number }[];
    teachers: { name: string; subject: string; classes: string; avg: number; delta: number }[];
    atRisk: { id: string; name: string; className: string; avg: number | null; missed: number; of: number }[];
  };
  attendance: {
    rate: number | null;
    weekly: { label: string; v: number | null }[];
    heat: { rows: string[]; rowIds: string[]; cols: string[]; cells: (number | null)[][] };
    chronic: { id: string; name: string; className: string; missed: number; of: number }[];
    lateByDay: { label: string; v: number }[];
  };
  people: {
    enrolled: number; byLevel: { name: string; n: number }[];
    gender: { female: number; male: number };
    funnel: { label: string; v: number }[]; conversion: number;
    exits: { reason: string; n: number }[]; retention: number | null;
    transportRiders: number; smsReachablePct: number | null;
    seats: { name: string; enrolled: number; cap: number }[];
  };
  operations: {
    teacherLoad: { name: string; periods: number; students: number }[]; avgPeriods: number;
    library: { books: number; out: number; overdue: number };
    routes: { name: string; riders: number }[];
  };
};

const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
const DOW = ["mon", "tue", "wed", "thu", "fri"] as const;
const DOW_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** Week index of an ISO date inside the term (0-based); Mondays anchor. */
function weekIndex(termStart: string, iso: string) {
  return Math.floor((Date.parse(iso) - Date.parse(termStart)) / (7 * 86400000));
}

export async function computeSnapshot(
  school: { id: string; settings: unknown },
  term: { id: string; name: string; startsAt: string; endsAt: string; year?: { name: string } | null } | null,
): Promise<Snapshot> {
  const today = new Date().toISOString().slice(0, 10);
  const schoolId = school.id;

  const [roster, allCls, allLvs, allGuardianLinks, allGuardians] = await Promise.all([
    db.select({
      id: students.id, firstName: students.firstName, lastName: students.lastName,
      classId: students.classId, sex: students.sex, transportRider: students.transportRider,
      status: students.status, exitReason: students.exitReason, exitDate: students.exitDate,
    }).from(students).where(eq(students.schoolId, schoolId)),
    db.select().from(classes).where(eq(classes.schoolId, schoolId)),
    db.select().from(levels).where(eq(levels.schoolId, schoolId)).orderBy(levels.sortOrder),
    db.select({ studentId: studentGuardians.studentId })
      .from(studentGuardians)
      .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
      .where(eq(guardians.schoolId, schoolId)),
    db.select().from(guardians).where(eq(guardians.schoolId, schoolId)),
  ]);
  const active = roster.filter((s) => s.status === "active");
  const className = new Map(allCls.map((c) => [c.id, c.name]));
  const classLevel = new Map(allCls.map((c) => [c.id, c.levelId]));
  const studentName = new Map(roster.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
  const studentClass = new Map(roster.map((s) => [s.id, s.classId ? className.get(s.classId) ?? "—" : "—"]));

  // ── money ────────────────────────────────────────────────────────────
  const money: Snapshot["money"] = {
    billed: 0, collected: 0, outstanding: 0, owingStudents: 0,
    weekly: [], forecast: 0, weekNow: 0, weeksTotal: 0,
    aging: [], channels: [], byClass: [],
  };
  if (term) {
    const [invs, pays] = await Promise.all([
      db.select().from(feeInvoices).where(and(
        eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.termId, term.id))),
      db.select({
        amountPesewas: feePayments.amountPesewas, method: feePayments.method,
        createdAt: feePayments.createdAt, voidedAt: feePayments.voidedAt,
        invoiceId: feePayments.invoiceId,
      }).from(feePayments)
        .innerJoin(feeInvoices, eq(feePayments.invoiceId, feeInvoices.id))
        .where(and(eq(feePayments.schoolId, schoolId), eq(feeInvoices.termId, term.id))),
    ]);
    const live = pays.filter((p) => !p.voidedAt);
    money.billed = invs.reduce((a, i) => a + i.totalPesewas, 0);
    money.collected = invs.reduce((a, i) => a + i.paidPesewas, 0);
    money.outstanding = Math.max(0, money.billed - money.collected);
    money.owingStudents = invs.filter((i) => i.totalPesewas > i.paidPesewas).length;

    money.weeksTotal = Math.max(1, Math.ceil(
      (Date.parse(term.endsAt) - Date.parse(term.startsAt)) / (7 * 86400000)));
    money.weekNow = Math.min(money.weeksTotal, Math.max(1, weekIndex(term.startsAt, today) + 1));
    const cum: number[] = Array.from({ length: money.weekNow }, () => 0);
    for (const p of live) {
      const w = weekIndex(term.startsAt, p.createdAt.toISOString().slice(0, 10));
      if (w >= 0 && w < money.weekNow) cum[w] += p.amountPesewas;
    }
    let run = 0;
    money.weekly = cum.map((v, i) => ({ label: `wk ${i + 1}`, v: (run += v) }));
    // forecast = current pace (avg of the last 3 weeks' inflow) to term end, capped at billed
    const recent = cum.slice(-3);
    const pace = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    money.forecast = Math.min(money.billed,
      Math.round(money.collected + pace * (money.weeksTotal - money.weekNow)));

    const bucket = [0, 0, 0, 0]; // not due / 1-30 / 31-60 / 60+
    for (const i of invs) {
      const bal = i.totalPesewas - i.paidPesewas;
      if (bal <= 0) continue;
      const days = i.dueDate ? Math.floor((Date.parse(today) - Date.parse(i.dueDate)) / 86400000) : 0;
      bucket[days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3] += bal;
    }
    money.aging = [
      { label: "Not yet due", v: bucket[0] }, { label: "1–30 days", v: bucket[1] },
      { label: "31–60 days", v: bucket[2] }, { label: "60+ days", v: bucket[3] },
    ];
    const chan = new Map<string, number>();
    for (const p of live) {
      const key = p.method === "momo" ? "MoMo" : p.method === "cash" ? "Cash"
        : p.method === "bank" ? "Bank" : "Other";
      chan.set(key, (chan.get(key) ?? 0) + p.amountPesewas);
    }
    money.channels = [...chan.entries()].map(([label, v]) => ({ label, v }))
      .sort((a, b) => b.v - a.v);
    const invByStudent = new Map(invs.map((i) => [i.studentId, i]));
    const lvOrder = new Map(allLvs.map((l) => [l.id, l.sortOrder]));
    money.byClass = allCls
      .map((c) => {
        const kids = active.filter((s) => s.classId === c.id);
        let billed = 0, collected = 0, owing = 0;
        for (const k of kids) {
          const i = invByStudent.get(k.id);
          if (!i) continue;
          billed += i.totalPesewas; collected += i.paidPesewas;
          if (i.totalPesewas > i.paidPesewas) owing++;
        }
        return {
          classId: c.id, name: c.name, billed, collected,
          outstanding: Math.max(0, billed - collected), owing, of: kids.length,
          sort: lvOrder.get(c.levelId) ?? 99,
        };
      })
      .filter((r) => r.of > 0 && r.billed > 0)
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
      .map(({ sort: _sort, ...r }) => r);
  }

  // ── attendance (also feeds at-risk) ──────────────────────────────────
  const attendance: Snapshot["attendance"] = {
    rate: null, weekly: [], heat: { rows: [], rowIds: [], cols: [...DOW_LABEL], cells: [] },
    chronic: [], lateByDay: [],
  };
  const missedBy = new Map<string, { missed: number; of: number }>();
  if (term) {
    const att = await db.select({
      studentId: attendanceRecords.studentId, classId: attendanceRecords.classId,
      date: attendanceRecords.date, status: attendanceRecords.status,
    }).from(attendanceRecords).where(and(
      eq(attendanceRecords.schoolId, schoolId), eq(attendanceRecords.termId, term.id)));
    const present = att.filter((r) => r.status !== "absent").length;
    attendance.rate = pctOf(present, att.length);
    // weekly rate
    const wk = new Map<number, { p: number; t: number }>();
    for (const r of att) {
      const w = weekIndex(term.startsAt, r.date);
      if (w < 0) continue;
      const b = wk.get(w) ?? { p: 0, t: 0 };
      if (r.status !== "absent") b.p++;
      b.t++; wk.set(w, b);
    }
    const maxWk = Math.max(0, ...wk.keys());
    attendance.weekly = Array.from({ length: maxWk + 1 }, (_, i) => {
      const b = wk.get(i);
      return { label: `wk ${i + 1}`, v: b ? pctOf(b.p, b.t) : null };
    });
    // class × weekday absence heat
    const heat = new Map<string, { a: number; t: number }[]>();
    for (const r of att) {
      const dow = new Date(r.date + "T12:00:00Z").getUTCDay() - 1; // 0=mon
      if (dow < 0 || dow > 4 || !r.classId) continue;
      const row = heat.get(r.classId) ?? DOW.map(() => ({ a: 0, t: 0 }));
      if (r.status === "absent") row[dow].a++;
      row[dow].t++; heat.set(r.classId, row);
    }
    const lvOrder = new Map(allLvs.map((l) => [l.id, l.sortOrder]));
    const heatRows = [...heat.keys()]
      .sort((a, b) => (lvOrder.get(classLevel.get(a) ?? "") ?? 99) - (lvOrder.get(classLevel.get(b) ?? "") ?? 99));
    attendance.heat = {
      rowIds: heatRows,
      rows: heatRows.map((id) => className.get(id) ?? "—"),
      cols: [...DOW_LABEL],
      cells: heatRows.map((id) => heat.get(id)!.map((c) => (c.t ? Math.round((c.a / c.t) * 100) : null))),
    };
    // chronic absentees + the shared missed map
    for (const r of att) {
      const b = missedBy.get(r.studentId) ?? { missed: 0, of: 0 };
      if (r.status === "absent") b.missed++;
      b.of++; missedBy.set(r.studentId, b);
    }
    attendance.chronic = [...missedBy.entries()]
      .filter(([, b]) => b.of >= 10 && b.missed / b.of > 0.1)
      .sort((a, b) => b[1].missed / b[1].of - a[1].missed / a[1].of)
      .slice(0, 12)
      .map(([id, b]) => ({
        id, name: studentName.get(id) ?? "—", className: studentClass.get(id) ?? "—",
        missed: b.missed, of: b.of,
      }));
    const lateCount = DOW.map(() => 0);
    for (const r of att) {
      if (r.status !== "late") continue;
      const dow = new Date(r.date + "T12:00:00Z").getUTCDay() - 1;
      if (dow >= 0 && dow <= 4) lateCount[dow]++;
    }
    attendance.lateByDay = DOW_LABEL.map((label, i) => ({ label, v: lateCount[i] }));
  }

  // ── learning — same conversion the report cards use ──────────────────
  const learning: Snapshot["learning"] = {
    schoolAvg: null, studentsScored: 0, subjects: [], grades: [], teachers: [], atRisk: [],
  };
  if (term) {
    const [rows, sheets, allSubjects] = await Promise.all([
      db.select({
        studentId: componentScores.studentId, subjectId: componentScores.subjectId,
        classId: componentScores.classId, componentId: componentScores.componentId,
        raw: componentScores.raw,
        weight: assessmentComponents.weight, isExam: assessmentComponents.isExam,
      }).from(componentScores)
        .innerJoin(assessmentComponents, eq(componentScores.componentId, assessmentComponents.id))
        .where(and(eq(componentScores.schoolId, schoolId), eq(componentScores.termId, term.id))),
      db.select().from(scoreSheets).where(and(
        eq(scoreSheets.schoolId, schoolId), eq(scoreSheets.termId, term.id))),
      db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
    ]);
    const outOfBy = new Map(sheets.map((s) => [`${s.classId}:${s.subjectId}:${s.componentId}`, s.outOf]));
    const subjName = new Map(allSubjects.map((s) => [s.id, s.name]));
    // per student·subject total /100 — exactly the report-card conversion
    const totals = new Map<string, { studentId: string; subjectId: string; classId: string; total: number }>();
    for (const r of rows) {
      const key = `${r.studentId}:${r.subjectId}`;
      const outOf = outOfBy.get(`${r.classId}:${r.subjectId}:${r.componentId}`) ?? 100;
      const t = totals.get(key) ?? { studentId: r.studentId, subjectId: r.subjectId, classId: r.classId, total: 0 };
      t.total += (r.raw / outOf) * r.weight;
      totals.set(key, t);
    }
    const list = [...totals.values()].map((t) => ({ ...t, total: Math.round(t.total) }));
    if (list.length) {
      learning.schoolAvg = Math.round(list.reduce((a, t) => a + t.total, 0) / list.length);
      // subject averages
      const bySub = new Map<string, { sum: number; n: number }>();
      for (const t of list) {
        const b = bySub.get(t.subjectId) ?? { sum: 0, n: 0 };
        b.sum += t.total; b.n++; bySub.set(t.subjectId, b);
      }
      learning.subjects = [...bySub.entries()]
        .map(([id, b]) => ({ name: subjName.get(id) ?? "—", avg: Math.round(b.sum / b.n), n: b.n }))
        .sort((a, b) => b.avg - a.avg);
      // grade spread from the school's own bands
      const [scheme] = await db.select().from(gradingSchemes)
        .where(eq(gradingSchemes.schoolId, schoolId));
      const bands = (scheme?.bands as { min: number; grade: string }[] | undefined) ?? [];
      if (bands.length) {
        const count = new Map<string, number>();
        for (const t of list) {
          const band = bands.find((b) => t.total >= b.min) ?? bands.at(-1)!;
          count.set(band.grade, (count.get(band.grade) ?? 0) + 1);
        }
        learning.grades = bands.map((b) => ({ grade: b.grade, n: count.get(b.grade) ?? 0 }));
      }
      // teacher outcomes vs the same subject's school average
      const S = await getStructure(schoolId);
      const staffRows = await db.select().from(staff).where(eq(staff.schoolId, schoolId));
      const staffName = new Map(staffRows.map((s) => [s.id, s.name]));
      const subAvg = new Map([...bySub.entries()].map(([id, b]) => [id, b.sum / b.n]));
      const byTeacherSub = new Map<string, { sum: number; n: number; classes: Set<string> }>();
      for (const t of list) {
        const tid = S.teacherFor(t.classId, t.subjectId);
        if (!tid) continue;
        const key = `${tid}:${t.subjectId}`;
        const b = byTeacherSub.get(key) ?? { sum: 0, n: 0, classes: new Set() };
        b.sum += t.total; b.n++; b.classes.add(className.get(t.classId) ?? "");
        byTeacherSub.set(key, b);
      }
      learning.teachers = [...byTeacherSub.entries()]
        .filter(([, b]) => b.n >= 3)
        .map(([key, b]) => {
          const [tid, subjectId] = key.split(":");
          const avg = Math.round(b.sum / b.n);
          return {
            name: staffName.get(tid) ?? "—", subject: subjName.get(subjectId) ?? "—",
            classes: [...b.classes].filter(Boolean).sort().join(", "),
            avg, delta: Math.round(avg - (subAvg.get(subjectId) ?? avg)),
          };
        })
        .sort((a, b) => b.delta - a.delta);
      // at-risk: falling grades × missed days, guardians one tap away on the file
      const byStudent = new Map<string, { sum: number; n: number }>();
      for (const t of list) {
        const b = byStudent.get(t.studentId) ?? { sum: 0, n: 0 };
        b.sum += t.total; b.n++; byStudent.set(t.studentId, b);
      }
      learning.studentsScored = byStudent.size;
      learning.atRisk = [...byStudent.entries()]
        .map(([id, b]) => {
          const m = missedBy.get(id) ?? { missed: 0, of: 0 };
          return {
            id, name: studentName.get(id) ?? "—", className: studentClass.get(id) ?? "—",
            avg: Math.round(b.sum / b.n), missed: m.missed, of: m.of,
          };
        })
        .filter((r) => r.avg !== null && r.avg < 55 && r.of >= 5 && r.missed / r.of > 0.1)
        .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
        .slice(0, 15);
    }
  }

  // ── people ───────────────────────────────────────────────────────────
  const cfg = getIntakeConfig(school.settings);
  const apps = await db.select().from(applicants).where(eq(applicants.schoolId, schoolId));
  const screened = apps.filter((a) =>
    a.interviewAt || a.testScore !== null || !["new"].includes(a.status)).length;
  const offered = apps.filter((a) => a.offerAt || ["offer", "admitted"].includes(a.status)).length;
  const admittedN = apps.filter((a) => a.status === "admitted").length;
  const exitsThisYear = roster.filter((s) => s.status === "left" &&
    s.exitDate && s.exitDate >= `${new Date().getFullYear()}-01-01`);
  const exitCount = new Map<string, number>();
  for (const s of exitsThisYear) {
    const r = s.exitReason ?? "other";
    exitCount.set(r, (exitCount.get(r) ?? 0) + 1);
  }
  const linkedStudentIds = new Set(allGuardianLinks.map((l) => l.studentId));
  const guardianHasPhone = allGuardians.some((g) => g.phone);
  const enrolledByLevel = new Map<string, number>();
  for (const s of active) {
    const lid = s.classId ? classLevel.get(s.classId) : null;
    if (lid) enrolledByLevel.set(lid, (enrolledByLevel.get(lid) ?? 0) + 1);
  }
  const people: Snapshot["people"] = {
    enrolled: active.length,
    byLevel: allLvs.map((l) => ({ name: l.name, n: enrolledByLevel.get(l.id) ?? 0 }))
      .filter((r) => r.n > 0),
    gender: {
      female: active.filter((s) => s.sex === "female").length,
      male: active.filter((s) => s.sex === "male").length,
    },
    funnel: [
      { label: "Applied", v: apps.length },
      { label: "Screened", v: screened },
      { label: "Offered", v: offered },
      { label: "Admitted", v: admittedN },
    ],
    conversion: apps.length ? Math.round((admittedN / apps.length) * 100) : 0,
    exits: [...exitCount.entries()].map(([reason, n]) => ({ reason, n }))
      .sort((a, b) => b.n - a.n),
    retention: active.length + exitsThisYear.length > 0
      ? Math.round((active.length / (active.length + exitsThisYear.length)) * 1000) / 10
      : null,
    transportRiders: active.filter((s) => s.transportRider).length,
    smsReachablePct: guardianHasPhone
      ? pctOf(active.filter((s) => linkedStudentIds.has(s.id)).length, active.length)
      : null,
    seats: allLvs
      .filter((l) => cfg.seats[l.id])
      .map((l) => ({ name: l.name, enrolled: enrolledByLevel.get(l.id) ?? 0, cap: cfg.seats[l.id] })),
  };

  // ── operations ───────────────────────────────────────────────────────
  const S = await getStructure(schoolId);
  const staffRows = await db.select().from(staff).where(eq(staff.schoolId, schoolId));
  const staffNameById = new Map(staffRows.map((s) => [s.id, s.name]));
  const rosterByClass = new Map<string, number>();
  for (const s of active) if (s.classId)
    rosterByClass.set(s.classId, (rosterByClass.get(s.classId) ?? 0) + 1);
  const load = new Map<string, { periods: number; classes: Set<string> }>();
  for (const e of S.entries) {
    const tid = S.teacherFor(e.classId, e.subjectId, e.teacherId);
    if (!tid) continue;
    const b = load.get(tid) ?? { periods: 0, classes: new Set() };
    b.periods++; b.classes.add(e.classId); load.set(tid, b);
  }
  const teacherLoad = [...load.entries()]
    .map(([tid, b]) => ({
      name: staffNameById.get(tid) ?? "—", periods: b.periods,
      students: [...b.classes].reduce((a, cid) => a + (rosterByClass.get(cid) ?? 0), 0),
    }))
    .sort((a, b) => b.periods - a.periods);
  const [allBooks, allLoans, allRoutes, allRouteStudents] = await Promise.all([
    db.select().from(books).where(eq(books.schoolId, schoolId)),
    db.select().from(loans).where(eq(loans.schoolId, schoolId)),
    db.select().from(routes).where(eq(routes.schoolId, schoolId)),
    db.select().from(routeStudents).where(eq(routeStudents.schoolId, schoolId)),
  ]);
  const out = allLoans.filter((l) => !l.returnedAt);
  const cutoff = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
  const ridersByRoute = new Map<string, number>();
  for (const r of allRouteStudents)
    ridersByRoute.set(r.routeId, (ridersByRoute.get(r.routeId) ?? 0) + 1);
  const operations: Snapshot["operations"] = {
    teacherLoad,
    avgPeriods: teacherLoad.length
      ? Math.round(teacherLoad.reduce((a, t) => a + t.periods, 0) / teacherLoad.length) : 0,
    library: {
      books: allBooks.reduce((a, b) => a + b.copies, 0),
      out: out.length,
      overdue: out.filter((l) => l.loanedAt < cutoff).length,
    },
    routes: allRoutes.map((r) => ({ name: r.name, riders: ridersByRoute.get(r.id) ?? 0 })),
  };

  return {
    day: today, termId: term?.id ?? null,
    termLabel: term ? `${term.year?.name ?? ""} · ${term.name}`.replace(/^ · /, "") : "No current term",
    computedAt: new Date().toISOString(),
    money, learning, attendance, people, operations,
  };
}

/** Today's snapshot — read it, or compute-and-store it on the first visit. */
export async function getSnapshot(
  school: { id: string; settings: unknown },
  term: Parameters<typeof computeSnapshot>[1],
  force = false,
): Promise<Snapshot> {
  const today = new Date().toISOString().slice(0, 10);
  if (!force) {
    const [row] = await db.select().from(analyticsSnapshots).where(and(
      eq(analyticsSnapshots.schoolId, school.id), eq(analyticsSnapshots.day, today)));
    if (row) {
      try { return JSON.parse(row.data) as Snapshot; } catch { /* recompute */ }
    }
  }
  const snap = await computeSnapshot(school, term);
  await db.delete(analyticsSnapshots).where(and(
    eq(analyticsSnapshots.schoolId, school.id), eq(analyticsSnapshots.day, today)));
  await db.insert(analyticsSnapshots).values({
    schoolId: school.id, day: today, termId: snap.termId, data: JSON.stringify(snap),
  });
  return snap;
}
