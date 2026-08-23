import Link from "next/link";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, classes, levels, students, terms, academicYears } from "@/db/schema";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { getParentChildren, getStudentSelf } from "@/core/portal";
import { getHolidayMap, termWeeks } from "@/core/calendar";
import { addHoliday } from "../../calendar/actions";
import { Card, PageHeader, Empty, inputCls, btnGhostCls, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

type Kid = { id: string; firstName: string; lastName: string };
type Rec = { studentId: string; date: string; status: string };

/** The digital version of the class attendance book schools keep for GES:
 *  one grid per class, weeks across the top, Monday–Friday day columns, a
 *  row per child and the term tally at the end — the same shape as the
 *  paper book, so it reads instantly. Read-only for everyone; an admin's
 *  corrections live behind the ⋯ menu, never in the cells. */
function BookGrid({ term, kids, recs, holidayMap, today, color }: {
  term: { startsAt: string; endsAt: string };
  kids: Kid[]; recs: Rec[]; holidayMap: Map<string, string>; today: string; color?: string;
}) {
  const weeks = termWeeks(term);
  const byKey = new Map(recs.map((r) => [`${r.studentId}:${r.date}`, r.status]));
  const inTerm = (d: string) => d >= term.startsAt && d <= term.endsAt;
  const cellFor = (sid: string, d: string) => {
    if (!inTerm(d)) return { txt: "", cls: "bg-muted/40" };
    if (holidayMap.has(d)) return { txt: "H", cls: "bg-warning-soft text-warning", title: holidayMap.get(d) };
    if (d > today) return { txt: "", cls: "" };
    const st = byKey.get(`${sid}:${d}`);
    if (st === "absent") return { txt: "A", cls: "bg-danger/10 font-semibold text-danger" };
    if (st === "late") return { txt: "L", cls: "text-warning" };
    if (st === "present") return { txt: "✓", cls: "text-success" };
    return { txt: "–", cls: "text-faint" }; // school day, register not marked
  };
  const tally = (sid: string) => {
    let att = 0, abs = 0;
    for (const r of recs) if (r.studentId === sid && inTerm(r.date))
      r.status === "absent" ? abs++ : att++;
    const total = att + abs;
    return { att, abs, pct: total ? Math.round((att / total) * 100) : null };
  };
  const dailyPresent = (d: string) => {
    if (!inTerm(d) || holidayMap.has(d) || d > today) return "";
    let n = 0, any = false;
    for (const r of recs) if (r.date === d) { any = true; if (r.status !== "absent") n++; }
    return any ? String(n) : "";
  };
  const hdr = { background: color ? `${color}14` : undefined };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-max border-collapse text-[12px]" data-nums="">
        <thead>
          <tr>
            <th rowSpan={3} className="sticky left-0 z-10 min-w-40 border-b border-r border-border bg-card px-2 py-1 text-left text-[13px]">
              Name
            </th>
            {weeks.map((w) => (
              <th key={w.n} colSpan={5} style={hdr}
                className="border-b border-r border-border px-1 py-0.5 font-semibold text-muted-foreground">
                Week {w.n}
              </th>
            ))}
            <th colSpan={3} rowSpan={2} className="border-b border-border bg-muted/60 px-2 font-semibold">
              Term tally
            </th>
          </tr>
          <tr>
            {weeks.flatMap((w) => w.days.map((d, i) => (
              <th key={d} className={`border-b border-border px-0.5 py-0.5 font-medium text-muted-foreground ${i === 4 ? "border-r" : ""}`}>
                {["Mo", "Tu", "We", "Th", "Fr"][i]}
              </th>
            )))}
          </tr>
          <tr>
            {weeks.flatMap((w) => w.days.map((d, i) => (
              <th key={d} title={d}
                className={`border-b border-border px-0.5 py-0.5 font-normal text-faint ${i === 4 ? "border-r" : ""}`}>
                {Number(d.slice(8, 10))}
              </th>
            )))}
            {["Att", "Abs", "%"].map((h) => (
              <th key={h} className="border-b border-border bg-muted/60 px-1.5 py-0.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kids.map((k) => {
            const t = tally(k.id);
            return (
              <tr key={k.id} className="hover:bg-muted/30">
                <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-2 py-1 text-[13px] font-medium">
                  {k.lastName}, {k.firstName}
                </td>
                {weeks.flatMap((w) => w.days.map((d, i) => {
                  const c = cellFor(k.id, d);
                  return (
                    <td key={d} title={c.title ?? d}
                      className={`h-6 w-6 border-b border-border text-center ${i === 4 ? "border-r" : ""} ${c.cls}`}>
                      {c.txt}
                    </td>
                  );
                }))}
                <td className="border-b border-border bg-muted/40 px-1.5 text-center font-medium text-success">{t.att}</td>
                <td className={`border-b border-border bg-muted/40 px-1.5 text-center font-medium ${t.abs ? "text-danger" : ""}`}>{t.abs}</td>
                <td className="border-b border-border bg-muted/40 px-1.5 text-center font-semibold">
                  {t.pct === null ? "—" : `${t.pct}`}
                </td>
              </tr>
            );
          })}
        </tbody>
        {kids.length > 1 && (
          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 border-r border-border bg-card px-2 py-1 text-[12.5px] font-semibold text-muted-foreground">
                Present that day
              </td>
              {weeks.flatMap((w) => w.days.map((d, i) => (
                <td key={d} className={`border-border py-0.5 text-center text-[11.5px] text-muted-foreground ${i === 4 ? "border-r" : ""}`}>
                  {dailyPresent(d)}
                </td>
              )))}
              <td colSpan={3} className="bg-muted/40" />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

const Legend = () => (
  <p className="mt-2 text-[13px] text-muted-foreground">
    <span className="text-success">✓ present</span> · <span className="text-warning">L late</span> ·{" "}
    <span className="font-medium text-danger">A absent</span> · <span className="text-warning">H holiday</span> ·{" "}
    <span className="text-faint">– register not marked</span> · weekends are not school days and don&apos;t appear.
  </p>
);

export default async function RecordBook({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ c?: string; t?: string }>;
}) {
  const { school: slug } = await params;
  const { c, t } = await searchParams;
  const { school, user } = await requireModule(slug, "attendance");
  const today = new Date().toISOString().slice(0, 10);

  const [allTerms, yrs, cls, holidayMap, current] = await Promise.all([
    db.select().from(terms).where(eq(terms.schoolId, school.id)),
    db.select().from(academicYears).where(eq(academicYears.schoolId, school.id)),
    db.select({ id: classes.id, name: classes.name, sortOrder: levels.sortOrder })
      .from(classes).innerJoin(levels, eq(classes.levelId, levels.id))
      .where(eq(classes.schoolId, school.id)),
    getHolidayMap(school.id),
    getCurrentTerm(school.id),
  ]);
  if (!allTerms.length) return <Empty title="No academic year yet" hint="Set up your year and term dates in Settings first." />;
  const term = allTerms.find((x) => x.id === t) ?? allTerms.find((x) => x.id === current?.id) ?? allTerms[0];
  const yearName = new Map(yrs.map((y) => [y.id, y.name]));
  const color = school.branding.primaryColor || "#5E1D3E";

  const termPicker = (base: string) => (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {[...yrs].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((y) => (
        <span key={y.id} className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-muted-foreground" data-nums="">{y.name}:</span>
          {allTerms.filter((x) => x.yearId === y.id)
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
            .map((x) => (
              <Link key={x.id} href={`${base}t=${x.id}`}
                className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${x.id === term.id
                  ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
                {x.name}
              </Link>
            ))}
        </span>
      ))}
    </div>
  );

  const recsFor = async (classId: string, studentIds?: string[]) => {
    const conds = [
      eq(attendanceRecords.schoolId, school.id), eq(attendanceRecords.classId, classId),
      gte(attendanceRecords.date, term.startsAt), lte(attendanceRecords.date, term.endsAt),
    ];
    if (studentIds) conds.push(inArray(attendanceRecords.studentId, studentIds));
    return db.select({
      studentId: attendanceRecords.studentId, date: attendanceRecords.date,
      status: attendanceRecords.status,
    }).from(attendanceRecords).where(and(...conds));
  };

  // ── families: each child's own row only — their record, no one else's ──
  if (user.role === "parent" || user.role === "student") {
    const kids = (user.role === "parent"
      ? await getParentChildren(school.id, user.id)
      : [await getStudentSelf(school.id, user.id)].filter(Boolean)) as (Kid & { classId: string | null })[];
    const withClass = kids.filter((k) => k.classId);
    const kidData = await Promise.all(withClass.map(async (k) => ({
      k, recs: await recsFor(k.classId!, [k.id]),
    })));
    return (
      <div>
        <PageHeader title="Attendance record"
          sub={`${yearName.get(term.yearId)} · ${term.name} — the official register, exactly as marked`} />
        {termPicker("/attendance/register?")}
        {kidData.map(({ k, recs }) => (
          <Card key={k.id} className="mb-5 overflow-hidden">
            <h2 className="mb-2 font-semibold">{k.firstName} {k.lastName}
              <span className="ml-2 text-[13.5px] font-normal text-muted-foreground">
                {cls.find((x) => x.id === k.classId)?.name}
              </span>
            </h2>
            <BookGrid term={term} kids={[k]} recs={recs} holidayMap={holidayMap} today={today} color={color} />
            <Legend />
          </Card>
        ))}
        {withClass.length === 0 && (
          <Empty title="No attendance record yet" hint="Records appear once the class register is marked." />
        )}
      </div>
    );
  }

  // ── staff: whole-class books ──
  let allowed = [...cls].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  if (user.role === "teacher") {
    const scope = await getTeacherScope(school.id, user.id);
    allowed = allowed.filter((x) => scope?.allClassIds.has(x.id));
    if (!allowed.length)
      return <Empty title="No classes assigned" hint="The record book covers the classes you teach — ask your admin about allocations." />;
  }
  const active = allowed.find((x) => x.id === c) ?? allowed[0];
  const [roster, recs] = await Promise.all([
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
      .from(students).where(and(eq(students.schoolId, school.id),
        eq(students.classId, active.id), eq(students.status, "active")))
      .orderBy(students.lastName),
    recsFor(active.id),
  ]);
  const isAdmin = ["admin", "platform_admin"].includes(user.role);

  return (
    <div>
      <PageHeader title="Attendance record book"
        sub={`${yearName.get(term.yearId)} · ${term.name} — the class register as GES knows it, kept for the whole year`} />
      {termPicker(`/attendance/register?c=${active.id}&`)}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {allowed.map((x) => (
          <Link key={x.id} href={`/attendance/register?c=${x.id}&t=${term.id}`}
            className={`rounded-full px-3 py-1 text-[13.5px] font-medium ${x.id === active.id
              ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
            {x.name}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{active.name} <span className="text-[13.5px] font-normal text-muted-foreground" data-nums="">· {roster.length} students · read-only</span></h2>
          {isAdmin && (
            <details className="relative">
              <summary className={btnGhostCls + " inline-flex cursor-pointer list-none px-2.5 py-1 text-[13.5px]"}>⋯ Corrections & holidays</summary>
              <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
                <p className="text-[13px] font-semibold">Correct a day&apos;s register</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Cells are never edited in place — pick the day and re-mark it. The record keeps who edited.
                </p>
                <form action={`/attendance/${active.id}`} method="get" className="mt-2 flex gap-1.5">
                  <input name="date" type="date" max={today} required className={inputCls + " flex-1"} />
                  <button className={btnCls + " px-3"}>Open</button>
                </form>
                <p className="mt-3 text-[13px] font-semibold">Mark a holiday</p>
                <form action={addHoliday.bind(null, slug)} className="mt-1.5 space-y-1.5">
                  <input type="hidden" name="back" value={`/attendance/register?c=${active.id}`} />
                  <input name="name" required placeholder="e.g. Founders' Day" className={inputCls} />
                  <div className="flex gap-1.5">
                    <input name="from" type="date" required className={inputCls + " flex-1"} />
                    <SubmitButton className={btnCls + " px-3"} pendingText="…">Mark</SubmitButton>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    Shows as H on every sheet and drops out of tallies. Ranges &amp; removal on the <Link href="/calendar" className="text-primary">Calendar</Link>.
                  </p>
                </form>
              </div>
            </details>
          )}
        </div>
        <div className="mt-3">
          <BookGrid term={term} kids={roster} recs={recs} holidayMap={holidayMap} today={today} color={color} />
        </div>
        <Legend />
      </Card>
    </div>
  );
}
