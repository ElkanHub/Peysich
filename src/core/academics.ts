import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  levels, classes, subjects, staff, teachingAssignments, staffTeaching,
  sectionConfig, periodSlots, sectionSubjects, classSubjectOverrides, timetableEntries,
  assessmentComponents, skillDomains,
} from "@/db/schema";
import { uid } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * The single source of truth for academic structure:
 *   levels  → grouped into SECTIONS (preschool / primary / jhs)
 *   section → teaching mode, day skeleton (period slots), subject set
 *   class   → inherits its section's subjects; may deviate via overrides
 *   WHO teaches WHAT comes from Teaching & allocations (or the class teacher
 *   in class_teacher mode) — the timetable only decides WHEN.
 * ──────────────────────────────────────────────────────────────────────── */

export type Section = "preschool" | "primary" | "jhs";
export const SECTIONS: Section[] = ["preschool", "primary", "jhs"];
export const SECTION_LABELS: Record<Section, string> = {
  preschool: "Preschool", primary: "Primary", jhs: "JHS",
};
export type Day = "mon" | "tue" | "wed" | "thu" | "fri";
export const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri"];
export const DAY_LABELS: Record<Day, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday",
};

export const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Which section a GES level code belongs to. */
export function sectionOf(levelCode: string): Section {
  if (["b7", "b8", "b9"].includes(levelCode)) return "jhs";
  if (/^b\d$/.test(levelCode)) return "primary";
  return "preschool";
}

/* ── sensible GES-flavoured defaults, seeded once so a new school starts
 *    with a working day plan instead of an empty screen ── */

const DEFAULT_SKELETONS: Record<Section, Array<{ name: string; kind: string; start: number; end: number }>> = {
  preschool: [
    { name: "Assembly", kind: "assembly", start: 465, end: 480 },      // 07:45–08:00
    { name: "Period 1", kind: "teaching", start: 480, end: 520 },
    { name: "Period 2", kind: "teaching", start: 520, end: 560 },
    { name: "Snack break", kind: "break", start: 560, end: 590 },
    { name: "Period 3", kind: "teaching", start: 590, end: 630 },
    { name: "Period 4", kind: "teaching", start: 630, end: 670 },
    { name: "Lunch & rest", kind: "lunch", start: 670, end: 720 },
    { name: "Period 5", kind: "teaching", start: 720, end: 760 },
  ],
  primary: [
    { name: "Assembly", kind: "assembly", start: 450, end: 470 },      // 07:30–07:50
    { name: "Period 1", kind: "teaching", start: 470, end: 510 },
    { name: "Period 2", kind: "teaching", start: 510, end: 550 },
    { name: "Period 3", kind: "teaching", start: 550, end: 590 },
    { name: "First break", kind: "break", start: 590, end: 610 },
    { name: "Period 4", kind: "teaching", start: 610, end: 650 },
    { name: "Period 5", kind: "teaching", start: 650, end: 690 },
    { name: "Lunch", kind: "lunch", start: 690, end: 735 },
    { name: "Period 6", kind: "teaching", start: 735, end: 775 },
    { name: "Period 7", kind: "teaching", start: 775, end: 815 },
  ],
  jhs: [
    { name: "Assembly", kind: "assembly", start: 450, end: 470 },
    { name: "Period 1", kind: "teaching", start: 470, end: 510 },
    { name: "Period 2", kind: "teaching", start: 510, end: 550 },
    { name: "Period 3", kind: "teaching", start: 550, end: 590 },
    { name: "First break", kind: "break", start: 590, end: 610 },
    { name: "Period 4", kind: "teaching", start: 610, end: 650 },
    { name: "Period 5", kind: "teaching", start: 650, end: 690 },
    { name: "Lunch", kind: "lunch", start: 690, end: 735 },
    { name: "Period 6", kind: "teaching", start: 735, end: 775 },
    { name: "Period 7", kind: "teaching", start: 775, end: 815 },
    { name: "Period 8", kind: "teaching", start: 815, end: 855 },
  ],
};

/** Idempotent: gives a school its starting configuration the first time any
 *  timetable/settings screen loads — mode per section (preschool defaults to
 *  class-teacher), a day skeleton, and section subject sets drawn from the
 *  school's own subject catalogue. Admins edit from there. */
export async function ensureAcademicDefaults(schoolId: string) {
  const [confs, slots, secSubs, subs, comps, domains] = await Promise.all([
    db.select().from(sectionConfig).where(eq(sectionConfig.schoolId, schoolId)),
    db.select({ section: periodSlots.section }).from(periodSlots).where(eq(periodSlots.schoolId, schoolId)),
    db.select({ section: sectionSubjects.section }).from(sectionSubjects).where(eq(sectionSubjects.schoolId, schoolId)),
    db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
    db.select({ section: assessmentComponents.section }).from(assessmentComponents)
      .where(eq(assessmentComponents.schoolId, schoolId)),
    db.select({ id: skillDomains.id }).from(skillDomains).where(eq(skillDomains.schoolId, schoolId)),
  ]);
  const hasConf = new Set(confs.map((c) => c.section));
  const hasSlots = new Set(slots.map((s) => s.section));
  const hasSubs = new Set(secSubs.map((s) => s.section));
  const hasComps = new Set(comps.map((c) => c.section));

  // test sections start with a classic GES split: 3 class tests + exam = 100
  for (const section of ["primary", "jhs"] as Section[]) {
    if (!hasComps.has(section)) {
      await db.insert(assessmentComponents).values([
        { id: uid(), schoolId, section, name: "Class Test 1", weight: 10, sortOrder: 0, isExam: false },
        { id: uid(), schoolId, section, name: "Class Test 2", weight: 10, sortOrder: 1, isExam: false },
        { id: uid(), schoolId, section, name: "Class Test 3", weight: 20, sortOrder: 2, isExam: false },
        { id: uid(), schoolId, section, name: "End of Term Exam", weight: 60, sortOrder: 3, isExam: true },
      ]).onConflictDoNothing();
    }
  }
  // skills sections need areas to rate — seed the standard early-years set
  if (domains.length === 0) {
    const names = ["Language & Literacy", "Numeracy", "Motor Skills",
      "Social & Emotional", "Creative Arts", "Independence"];
    await db.insert(skillDomains).values(names.map((name, i) => ({
      id: uid(), schoolId, name, sortOrder: i,
    })));
  }

  for (const section of SECTIONS) {
    if (!hasConf.has(section)) {
      await db.insert(sectionConfig).values({
        id: uid(), schoolId, section,
        mode: section === "preschool" ? "class_teacher" : "subject_teaching",
      }).onConflictDoNothing();
    }
    if (!hasSlots.has(section)) {
      await db.insert(periodSlots).values(DEFAULT_SKELETONS[section].map((s, i) => ({
        id: uid(), schoolId, section, name: s.name, kind: s.kind,
        startMin: s.start, endMin: s.end, sortOrder: i,
      })));
    }
    if (!hasSubs.has(section) && subs.length) {
      // preschool skips the bookish JHS subjects; JHS skips OWOP — defaults only
      const skip = section === "preschool"
        ? ["Social Studies", "Computing", "Science"]
        : section === "jhs" ? ["Our World Our People"] : ["Social Studies"];
      const chosen = subs.filter((s) => !skip.includes(s.name));
      if (chosen.length) {
        await db.insert(sectionSubjects).values(chosen.map((s) => ({
          id: uid(), schoolId, section, subjectId: s.id,
        }))).onConflictDoNothing();
      }
    }
  }
}

export type Structure = Awaited<ReturnType<typeof getStructure>>;

/** Everything the timetable and its sibling screens need, resolved once.
 *  cache() dedupes it per request — pages and getTeacherScope share one
 *  resolution instead of each firing the 13-query fan-out again. */
export const getStructure = cache(async (schoolId: string) => {
  await ensureAcademicDefaults(schoolId);
  const [lvls, cls, subs, confs, slots, secSubs, ovr, tas, tchs, entries, comps, domains, profiles] = await Promise.all([
    db.select().from(levels).where(eq(levels.schoolId, schoolId)),
    db.select().from(classes).where(eq(classes.schoolId, schoolId)),
    db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
    db.select().from(sectionConfig).where(eq(sectionConfig.schoolId, schoolId)),
    db.select().from(periodSlots).where(eq(periodSlots.schoolId, schoolId)),
    db.select().from(sectionSubjects).where(eq(sectionSubjects.schoolId, schoolId)),
    db.select().from(classSubjectOverrides).where(eq(classSubjectOverrides.schoolId, schoolId)),
    db.select().from(teachingAssignments).where(eq(teachingAssignments.schoolId, schoolId)),
    db.select().from(staff).where(and(eq(staff.schoolId, schoolId))),
    db.select().from(timetableEntries).where(eq(timetableEntries.schoolId, schoolId)),
    db.select().from(assessmentComponents).where(eq(assessmentComponents.schoolId, schoolId)),
    db.select().from(skillDomains).where(eq(skillDomains.schoolId, schoolId)),
    db.select().from(staffTeaching).where(eq(staffTeaching.schoolId, schoolId)),
  ]);

  const levelById = new Map(lvls.map((l) => [l.id, l]));
  const sectionOfClass = (c: { levelId: string }) =>
    sectionOf(levelById.get(c.levelId)?.code ?? "b1");
  const classById = new Map(cls.map((c) => [c.id, c]));
  const subjectById = new Map(subs.map((s) => [s.id, s]));
  const staffById = new Map(tchs.map((t) => [t.id, t]));
  const modeBySection = new Map<string, string>(confs.map((c) => [c.section, c.mode]));
  const slotsBySection = (section: Section) =>
    slots.filter((s) => s.section === section)
      .sort((a, b) => a.startMin - b.startMin || a.sortOrder - b.sortOrder);
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const taByCell = new Map(tas.map((t) => [`${t.classId}:${t.subjectId}`, t.teacherId]));
  const subsBySection = new Map<string, string[]>();
  for (const r of secSubs) {
    if (!subsBySection.has(r.section)) subsBySection.set(r.section, []);
    subsBySection.get(r.section)!.push(r.subjectId);
  }

  /** A class's real subject list: section set + its own add/remove deviations. */
  const effectiveSubjectIds = (classId: string): string[] => {
    const c = classById.get(classId);
    if (!c) return [];
    const base = new Set(subsBySection.get(sectionOfClass(c)) ?? []);
    for (const o of ovr.filter((o) => o.classId === classId))
      o.action === "add" ? base.add(o.subjectId) : base.delete(o.subjectId);
    return [...base];
  };

  /* ── the profile-based teacher model ──
   * A teacher IS either a class teacher (main on classes.classTeacherId,
   * assistants as kind="class" profile rows) or a subject teacher (kind=
   * "subject" rows: subject + the levels they carry, main/assistant).
   * WHO teaches a cell is DERIVED: period override → pin → sole main → sole
   * eligible. Nothing is repeated per class any more. */
  const parseLevelIds = (raw: string | null): string[] => {
    try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
  };
  const classAssistants = new Map<string, { staffId: string }[]>();
  const subjectRows: { staffId: string; subjectId: string; levelIds: string[]; role: string }[] = [];
  for (const p of profiles) {
    if (p.kind === "class" && p.classId) {
      if (!classAssistants.has(p.classId)) classAssistants.set(p.classId, []);
      classAssistants.get(p.classId)!.push({ staffId: p.staffId });
    } else if (p.kind === "subject" && p.subjectId) {
      subjectRows.push({ staffId: p.staffId, subjectId: p.subjectId,
        levelIds: parseLevelIds(p.levelIds), role: p.role });
    }
  }

  /** Everyone eligible for a cell, mains first (class mode: main class teacher
   *  + class assistants; subject mode: subject carriers covering the level). */
  const poolFor = (classId: string, subjectId: string): { staffId: string; role: string }[] => {
    const c = classById.get(classId);
    if (!c) return [];
    if (modeBySection.get(sectionOfClass(c)) === "class_teacher") {
      const out: { staffId: string; role: string }[] = [];
      if (c.classTeacherId) out.push({ staffId: c.classTeacherId, role: "main" });
      for (const a of classAssistants.get(classId) ?? [])
        if (!out.some((x) => x.staffId === a.staffId)) out.push({ staffId: a.staffId, role: "assistant" });
      return out;
    }
    const seen = new Map<string, string>(); // staffId → best role (main wins)
    for (const r of subjectRows) {
      if (r.subjectId !== subjectId || !r.levelIds.includes(c.levelId)) continue;
      if (seen.get(r.staffId) !== "main") seen.set(r.staffId, r.role);
    }
    return [...seen.entries()].map(([staffId, role]) => ({ staffId, role }))
      .sort((a, b) => Number(b.role === "main") - Number(a.role === "main"));
  };

  /** WHO teaches subject X in class Y (optionally for one period). */
  const teacherFor = (classId: string, subjectId: string, entryTeacherId?: string | null): string | null => {
    if (entryTeacherId) return entryTeacherId;
    const c = classById.get(classId);
    if (!c) return null;
    if (modeBySection.get(sectionOfClass(c)) === "class_teacher") return c.classTeacherId;
    const pin = taByCell.get(`${classId}:${subjectId}`);
    if (pin) return pin;
    const pool = poolFor(classId, subjectId);
    const mains = pool.filter((p) => p.role === "main");
    if (mains.length === 1) return mains[0].staffId;
    if (pool.length === 1) return pool[0].staffId;
    return null; // a tie or nobody — the allocations screen surfaces it
  };

  /** The pastoral tag: explicit form master, else the class teacher. */
  const formMasterOf = (classId: string): string | null => {
    const c = classById.get(classId);
    return c ? (c.formMasterId ?? c.classTeacherId ?? null) : null;
  };

  /** Derivation gaps for the allocations screen: cells nobody covers, and
   *  ties that need a per-class pin. */
  const allocationIssues = () => {
    const issues: { classId: string; subjectId: string; kind: "uncovered" | "tie";
      pool: { staffId: string; role: string }[] }[] = [];
    for (const c of cls) {
      if (modeBySection.get(sectionOfClass(c)) === "class_teacher") continue;
      for (const sid of effectiveSubjectIds(c.id)) {
        if (taByCell.get(`${c.id}:${sid}`)) continue;
        const pool = poolFor(c.id, sid);
        const mains = pool.filter((p) => p.role === "main");
        if (pool.length === 0) issues.push({ classId: c.id, subjectId: sid, kind: "uncovered", pool });
        else if (mains.length !== 1 && pool.length > 1)
          issues.push({ classId: c.id, subjectId: sid, kind: "tie", pool });
      }
    }
    return issues;
  };

  /** Teacher double-bookings: same teacher, same day, overlapping slot times
   *  (cross-section aware — different skeletons can still collide in time). */
  const findClashes = () => {
    const byTeacherDay = new Map<string, Array<{ entry: typeof entries[number]; start: number; end: number }>>();
    for (const e of entries) {
      const tid = teacherFor(e.classId, e.subjectId, e.teacherId);
      const slot = slotById.get(e.slotId);
      if (!tid || !slot) continue;
      const key = `${tid}|${e.day}`;
      if (!byTeacherDay.has(key)) byTeacherDay.set(key, []);
      byTeacherDay.get(key)!.push({ entry: e, start: slot.startMin, end: slot.endMin });
    }
    const clashes: Array<{ teacherId: string; teacherName: string; day: Day; time: string; classes: string[] }> = [];
    for (const [key, list] of byTeacherDay) {
      list.sort((a, b) => a.start - b.start);
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length && list[j].start < list[i].end; j++) {
          const [tid, day] = key.split("|");
          clashes.push({
            teacherId: tid, teacherName: staffById.get(tid)?.name ?? "?", day: day as Day,
            time: `${fmtMin(Math.max(list[i].start, list[j].start))}–${fmtMin(Math.min(list[i].end, list[j].end))}`,
            classes: [list[i], list[j]].map((x) => classById.get(x.entry.classId)?.name ?? "?"),
          });
        }
      }
    }
    return clashes;
  };

  /** The section's marking scheme, tests first, exam last. */
  const componentsFor = (section: Section) =>
    comps.filter((c) => c.section === section)
      .sort((a, b) => Number(a.isExam) - Number(b.isExam) || a.sortOrder - b.sortOrder);
  const skillScaleFor = (section: Section) =>
    confs.find((c) => c.section === section)?.skillScale ?? ["Emerging", "Developing", "Secure"];

  return {
    levels: lvls, classes: cls, subjects: subs, staff: tchs, entries,
    levelById, classById, subjectById, staffById, slotById,
    sectionOfClass, modeBySection, slotsBySection, subsBySection, overrides: ovr,
    effectiveSubjectIds, teacherFor, poolFor, formMasterOf, allocationIssues,
    classAssistants, subjectProfiles: subjectRows, pins: taByCell, findClashes,
    components: comps, componentsFor, skillScaleFor,
    skillDomains: domains.sort((a, b) => a.sortOrder - b.sortOrder),
  };
});
