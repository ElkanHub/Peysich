import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { classes, students, attendanceRecords, staff, studentGuardians } from "@/db/schema";
import { requireModule, getTeacherScope } from "@/core/school-context";
import { getHolidayMap, isWeekend } from "@/core/calendar";
import { PageHeader, Card, Badge, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { Register } from "./register";
import { remindClassTeacher, lastNudgeToday } from "../actions";

const hhmm = (d: Date) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" });

/** One class register. For the CLASS TEACHER, marking is the primary job.
 *  For an ADMIN this is a monitoring view: the class teacher on top with a
 *  send-reminder button; marking on their behalf sits behind "Mark it myself". */
export default async function ClassRegister({ params, searchParams }: {
  params: Promise<{ school: string; classId: string }>;
  searchParams: Promise<{ date?: string; mark?: string }>;
}) {
  const { school: slug, classId } = await params;
  const { date: dateParam, mark } = await searchParams;
  const { school, user } = await requireModule(slug, "attendance", ["admin", "teacher"]);
  const [cls] = await db.select().from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  if (!cls) notFound();

  const isTeacher = user.role === "teacher";
  if (isTeacher) {
    const scope = await getTeacherScope(school.id, user.id);
    if (!scope?.homeroomIds.has(classId)) notFound(); // subject teachers have no register here
  }

  const today = new Date().toISOString().slice(0, 10);
  // admins may open a PAST day to correct it from the record book
  const date = !isTeacher && dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today
    ? dateParam : today;

  // weekends and holidays: say so plainly, nothing to mark
  const holidayMap = await getHolidayMap(school.id);
  const holiday = holidayMap.get(date);
  if (isWeekend(date) || holiday) {
    return (
      <div className="max-w-lg">
        <PageHeader title={cls.name} sub={date === today ? "Register" : `Register · ${date}`} />
        <Card>
          <p className="text-[22px] font-bold">No school today</p>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {holiday ? `${date} is a holiday: ${holiday}.` : `${date} is a weekend.`} There is no register to keep.
          </p>
          <Link href="/attendance" className={btnGhostCls + " mt-4"}>Back to attendance</Link>
        </Card>
      </div>
    );
  }

  const [roster, existing, [classTeacher]] = await Promise.all([
    db.select({
      id: students.id, firstName: students.firstName, lastName: students.lastName, photoUrl: students.photoUrl,
    }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.classId, classId),
        eq(students.status, "active")))
      .orderBy(students.lastName),
    db.select().from(attendanceRecords)
      .where(and(eq(attendanceRecords.schoolId, school.id),
        eq(attendanceRecords.classId, classId), eq(attendanceRecords.date, date))),
    (cls.formMasterId ?? cls.classTeacherId)
      ? db.select().from(staff).where(eq(staff.id, (cls.formMasterId ?? cls.classTeacherId)!))
      : Promise.resolve([null]),
  ]);
  const { presignDownload, r2Enabled } = await import("@/lib/r2");
  const rosterWithPhotos = await Promise.all(roster.map(async (r) => ({
    ...r, photoUrl: r.photoUrl && r2Enabled ? await presignDownload(r.photoUrl).catch(() => null) : null,
  })));
  const statusMap = Object.fromEntries(existing.map((r) => [r.studentId, r.status]));
  const marked = existing.length > 0;
  const present = existing.filter((r) => r.status !== "absent").length;
  const absentIds = existing.filter((r) => r.status === "absent").map((r) => r.studentId);

  // the saved banner: when it was saved, and how many parents were texted
  // (every guardian of every child recorded absent today)
  let saved: { at: string; told: number } | undefined;
  if (marked) {
    const at = hhmm(existing.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), existing[0].createdAt));
    const told = absentIds.length && date === today
      ? (await db.select({ id: studentGuardians.guardianId }).from(studentGuardians)
        .where(inArray(studentGuardians.studentId, absentIds))).length
      : 0;
    saved = { at, told };
  }
  // key: a fresh save remounts the register so it opens locked
  const register = (
    <Register key={saved ? saved.at + JSON.stringify(statusMap) : "new"}
      slug={slug} classId={classId} className={cls.name} roster={rosterWithPhotos} initial={statusMap}
      date={date === today ? undefined : date} saved={saved} />
  );

  // ── class teacher: straight to marking ──
  if (isTeacher) {
    return (
      <div className="max-w-lg">
        <PageHeader title={cls.name} sub={`Register · ${today} · everyone starts Present — mark only the exceptions`} />
        {register}
      </div>
    );
  }

  // ── admin correcting a past day: straight to the register, clearly dated ──
  if (date !== today) {
    return (
      <div className="max-w-lg">
        <PageHeader title={cls.name}
          sub={`Correcting the register for ${date} — the record will show it was edited by you`} />
        {register}
      </div>
    );
  }

  // ── admin: monitor first, mark-on-behalf tucked away ──
  const nudge = marked ? null : await lastNudgeToday(school.id, classId);
  const first = classTeacher?.name.split(" ")[0];
  return (
    <div className="max-w-lg">
      <PageHeader title={cls.name} sub={`Register · ${today}`} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Class teacher</p>
            <p className="mt-0.5 font-medium">
              {classTeacher
                ? <Link href={`/staff/${classTeacher.id}`} className="text-primary">{classTeacher.name}</Link>
                : <span className="text-warning">No class teacher assigned</span>}
              {classTeacher?.phone && <span className="ml-2 text-[13.5px] font-normal text-muted-foreground">{classTeacher.phone}</span>}
            </p>
          </div>
          {marked
            ? <Badge tone="success">{present}/{existing.length} present ✓</Badge>
            : (
              <div className="text-right">
                <form action={remindClassTeacher.bind(null, slug, classId)}>
                  <SubmitButton className={btnCls} pendingText="Sending…">
                    {first ? `Remind ${first}` : "Send reminder"}
                  </SubmitButton>
                </form>
                {nudge && (
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    reminded {hhmm(nudge.sentAt)} by {nudge.sentBy}
                  </p>
                )}
              </div>
            )}
        </div>
        {!marked && (
          <p className="mt-2 text-[13.5px] text-muted-foreground">
            Not marked yet — the reminder goes to the teacher by SMS and shows on their dashboard until the register is saved.
          </p>
        )}
      </Card>

      {marked ? (
        <Card>
          <h2 className="font-semibold">Today&apos;s register</h2>
          {saved && (
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Saved at {saved.at}. {saved.told} parent{saved.told === 1 ? "" : "s"} told.
            </p>
          )}
          <ul className="mt-2 divide-y divide-border text-sm">
            {roster.map((s) => {
              const st = statusMap[s.id] ?? "present";
              return (
                <li key={s.id} className="flex items-center justify-between py-1.5">
                  <span>{s.lastName}, {s.firstName}</span>
                  <span className={st === "absent" ? "font-medium text-danger" : st === "late" ? "text-warning" : "text-success"}>
                    {st}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">{roster.length} students on this roster.</p>
      )}

      {/* marking is the teacher's job — the admin override is deliberately a step away */}
      <details className="mt-5" open={mark === "1"}>
        <summary className={btnGhostCls + " cursor-pointer list-none"}>
          {marked ? "Correct it myself" : "Mark it myself"}
        </summary>
        <div className="mt-3 rounded-lg border border-border p-4">
          <p className="mb-3 text-[14px] text-muted-foreground">
            Use this when the class teacher is absent or unreachable. The record will show it was marked by you.
          </p>
          {register}
        </div>
      </details>
    </div>
  );
}
