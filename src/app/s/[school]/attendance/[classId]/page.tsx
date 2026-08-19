import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { classes, students, attendanceRecords, staff } from "@/db/schema";
import { requireModule, getTeacherScope } from "@/core/school-context";
import { PageHeader, Card, Badge, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { Register } from "./register";
import { remindClassTeacher, lastNudgeToday } from "../actions";

const ERR: Record<string, string> = {
  noteacher: "This class has no class teacher yet — assign one on Teaching & allocations first.",
};

/** One class register. For the CLASS TEACHER, marking is the primary job.
 *  For an ADMIN this is a monitoring view: the class teacher on top with a
 *  send-reminder button; marking on their behalf sits behind a disclosure. */
export default async function ClassRegister({ params, searchParams }: {
  params: Promise<{ school: string; classId: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { school: slug, classId } = await params;
  const { err } = await searchParams;
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
  const [roster, existing, [classTeacher]] = await Promise.all([
    db.select({
      id: students.id, firstName: students.firstName, lastName: students.lastName,
    }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.classId, classId),
        eq(students.status, "active")))
      .orderBy(students.lastName),
    db.select().from(attendanceRecords)
      .where(and(eq(attendanceRecords.schoolId, school.id),
        eq(attendanceRecords.classId, classId), eq(attendanceRecords.date, today))),
    cls.classTeacherId
      ? db.select().from(staff).where(eq(staff.id, cls.classTeacherId))
      : Promise.resolve([null]),
  ]);
  const statusMap = Object.fromEntries(existing.map((r) => [r.studentId, r.status]));
  const marked = existing.length > 0;
  const present = existing.filter((r) => r.status !== "absent").length;

  // ── class teacher: straight to marking ──
  if (isTeacher) {
    return (
      <div className="max-w-lg">
        <PageHeader title={cls.name} sub={`Register · ${today} · everyone starts Present — tap only the exceptions`} />
        <Register slug={slug} classId={classId} roster={roster} initial={statusMap} />
      </div>
    );
  }

  // ── admin: monitor first, mark-on-behalf tucked away ──
  const nudge = marked ? null : await lastNudgeToday(school.id, classId);
  return (
    <div className="max-w-lg">
      <PageHeader title={cls.name} sub={`Register · ${today}`} />

      {err && ERR[err] && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{ERR[err]}</p>
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Class teacher</p>
            <p className="mt-0.5 font-medium">
              {classTeacher
                ? <Link href={`/staff/${classTeacher.id}`} className="text-primary">{classTeacher.name}</Link>
                : <span className="text-warning">No class teacher assigned</span>}
              {classTeacher?.phone && <span className="ml-2 text-[12.5px] font-normal text-muted-foreground">{classTeacher.phone}</span>}
            </p>
          </div>
          {marked
            ? <Badge tone="success">{present}/{existing.length} present ✓</Badge>
            : (
              <div className="text-right">
                <form action={remindClassTeacher.bind(null, slug, classId)}>
                  <SubmitButton className={btnCls} pendingText="Sending…">Send reminder</SubmitButton>
                </form>
                {nudge && (
                  <p className="mt-1 text-[11.5px] text-muted-foreground">
                    reminded {nudge.sentAt.toISOString().slice(11, 16)} by {nudge.sentBy}
                  </p>
                )}
              </div>
            )}
        </div>
        {!marked && (
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Not marked yet — the reminder goes to the teacher by SMS and shows on their dashboard until the register is saved.
          </p>
        )}
      </Card>

      {marked ? (
        <Card>
          <h2 className="font-semibold">Today&apos;s register</h2>
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
      <details className="mt-5">
        <summary className={btnGhostCls + " inline-flex cursor-pointer list-none items-center"}>
          ⋯ More
        </summary>
        <div className="mt-3 rounded-lg border border-border p-4">
          <p className="mb-3 text-[13px] text-muted-foreground">
            <b>Mark on behalf of the class teacher</b> — use when the teacher is absent or unreachable.
            The record will show it was marked by you.
          </p>
          <Register slug={slug} classId={classId} roster={roster} initial={statusMap} />
        </div>
      </details>
    </div>
  );
}
