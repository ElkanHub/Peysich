import Link from "next/link";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  students, staff, classes, academicYears, lessons, subjects,
  assignments, submissions, announcements, attendanceRecords, reportCards,
} from "@/db/schema";
import { requireSchool, getCurrentTerm, getTeacherClassIds } from "@/core/school-context";
import { getParentChildren, getStudentSelf } from "@/core/portal";
import { Card, PageHeader } from "@/ui/kit";
import { PayFeesButton } from "@/ui/pay-fees";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default async function Dashboard({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireSchool(slug);
  const term = await getCurrentTerm(school.id);
  const sub = term ? `${term.year?.name} · ${term.name}` : "No academic year set up yet";

  if (user.role === "parent") {
    const kids = await getParentChildren(school.id, user.id, term?.id);
    return (
      <div>
        <PageHeader title="My Children" sub={sub} />
        {kids.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No children linked to your account yet — please contact the school office.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {kids.map((k) => (
            <Card key={k.id}>
              <p className="text-lg font-semibold">{k.firstName} {k.lastName}</p>
              <p className="text-sm text-muted-foreground">{k.className ?? "—"}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Today</dt>
                  <dd className={k.today === "absent" ? "text-danger" : k.today ? "text-success" : ""}>
                    {k.today ?? "not marked yet"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Fees due</dt>
                  <dd className="flex items-center gap-2">
                    <span className={k.feeDuePesewas > 0 ? "font-medium text-danger" : "text-success"}>
                      {k.feeDuePesewas > 0 ? ghs(k.feeDuePesewas) : "cleared"}
                    </span>
                    {k.feeDuePesewas > 0 && k.invoiceId && (
                      <PayFeesButton slug={slug} invoiceId={k.invoiceId}
                        maxGhs={k.feeDuePesewas / 100} />
                    )}
                  </dd>
                </div>
                {k.reportTermIds.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Report card</dt>
                    <dd>
                      <Link className="text-primary underline-offset-2 hover:underline"
                        href={`/students/${k.id}/report/${k.reportTermIds.at(-1)}`}>
                        View latest
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
              <Link href={`/children/${k.id}`}
                className="mt-3 inline-block text-sm font-medium text-primary">
                Full details →
              </Link>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (user.role === "student") {
    const me = await getStudentSelf(school.id, user.id);
    if (!me) return <p className="text-sm text-muted-foreground">No student profile linked.</p>;
    const dayIdx = new Date().getDay(); // 1..5 = mon..fri
    const dayKey = (["", "mon", "tue", "wed", "thu", "fri", ""] as const)[dayIdx] || null;
    const [today, due, anns] = await Promise.all([
      dayKey && me.classId
        ? db.select({ startMin: lessons.startMin, endMin: lessons.endMin, subject: subjects.name })
            .from(lessons).leftJoin(subjects, eq(lessons.subjectId, subjects.id))
            .where(and(eq(lessons.schoolId, school.id), eq(lessons.classId, me.classId),
              eq(lessons.day, dayKey))).orderBy(lessons.startMin)
        : [],
      me.classId
        ? db.select().from(assignments)
            .where(and(eq(assignments.schoolId, school.id), eq(assignments.classId, me.classId)))
            .orderBy(desc(assignments.dueDate)).limit(6)
        : [],
      db.select().from(announcements)
        .where(eq(announcements.schoolId, school.id)).orderBy(desc(announcements.createdAt)).limit(4),
    ]);
    const subm = due.length
      ? await db.select().from(submissions).where(and(
          eq(submissions.studentId, me.id),
          inArray(submissions.assignmentId, due.map((d) => d.id))))
      : [];
    const submitted = new Set(subm.map((s) => s.assignmentId));
    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const todayStr = new Date().toISOString().slice(0, 10);
    return (
      <div className="max-w-2xl space-y-5">
        <PageHeader title={`Hi, ${me.firstName}`} sub={sub} />
        <Card>
          <h2 className="font-semibold">Today</h2>
          {today.length === 0 && <p className="mt-1 text-sm text-muted-foreground">No lessons scheduled.</p>}
          <ul className="mt-2 space-y-1 text-sm">
            {today.map((l, i) => (
              <li key={i}>{fmt(l.startMin)}–{fmt(l.endMin)} · <span className="font-medium">{l.subject}</span></li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Homework</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {due.map((a) => (
              <li key={a.id} className="flex justify-between">
                <Link href={`/homework/${a.id}`} className="text-primary underline-offset-2 hover:underline">
                  {a.title}
                </Link>
                <span className={submitted.has(a.id) ? "text-success"
                  : a.dueDate < todayStr ? "text-danger" : "text-muted-foreground"}>
                  {submitted.has(a.id) ? "submitted" : `due ${a.dueDate}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Announcements</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {anns.map((a) => <li key={a.id}><span className="font-medium text-foreground">{a.title}</span> — {a.body}</li>)}
          </ul>
        </Card>
      </div>
    );
  }

  if (user.role === "teacher") {
    const mine = await getTeacherClassIds(school.id, user.id);
    const today = new Date().toISOString().slice(0, 10);
    let cls = await db.select().from(classes).where(eq(classes.schoolId, school.id));
    if (mine) cls = cls.filter((c) => mine.has(c.id));
    const marked = new Set((await db.select({ classId: attendanceRecords.classId })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.schoolId, school.id), eq(attendanceRecords.date, today))))
      .map((r) => r.classId));
    return (
      <div>
        <PageHeader title="My Classes" sub={sub} />
        {(!mine || cls.length === 0) && (
          <p className="mb-4 text-sm text-muted-foreground">
            No classes assigned yet — ask your admin to set you as a class teacher or add you to the timetable.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {cls.map((c) => (
            <Link key={c.id} href={`/attendance/${c.id}`}>
              <Card className={marked.has(c.id) ? "border-success/40" : ""}>
                <p className="font-medium">{c.name}</p>
                <p className={`mt-1 text-sm ${marked.has(c.id) ? "text-success" : "text-warning"}`}>
                  {marked.has(c.id) ? "Register saved ✓" : "Mark register"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // ── admin (and platform_admin visiting) ──
  const [[st], [sf], [cl], [yr], [rc]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
    db.select({ n: sql<number>`count(*)` }).from(staff).where(eq(staff.schoolId, school.id)),
    db.select({ n: sql<number>`count(*)` }).from(classes).where(eq(classes.schoolId, school.id)),
    db.select({ n: sql<number>`count(*)` }).from(academicYears).where(eq(academicYears.schoolId, school.id)),
    db.select({ n: sql<number>`count(*)` }).from(reportCards)
      .where(and(eq(reportCards.schoolId, school.id), eq(reportCards.published, true))),
  ]);
  const setupNeeded = Number(yr.n) === 0 || Number(cl.n) === 0 || Number(st.n) === 0;
  return (
    <div>
      <PageHeader title="Dashboard" sub={sub} />
      {setupNeeded && (
        <Card className="mb-5">
          <p className="font-medium">Get {school.name} running</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            {Number(yr.n) === 0 && <li><Link className="text-primary underline-offset-2 hover:underline" href="/settings">Set up your academic year & term dates</Link></li>}
            {Number(cl.n) === 0 && <li><Link className="text-primary underline-offset-2 hover:underline" href="/settings">Choose your levels — classes & subjects are created for you</Link></li>}
            <li><Link className="text-primary underline-offset-2 hover:underline" href="/staff">Add your staff</Link></li>
            {Number(st.n) === 0 && <li><Link className="text-primary underline-offset-2 hover:underline" href="/students/import">Import students (CSV)</Link> or <Link className="text-primary underline-offset-2 hover:underline" href="/students/new">add them one by one</Link></li>}
          </ol>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[["Students", st.n, "/students"], ["Staff", sf.n, "/staff"],
          ["Classes", cl.n, "/settings"], ["Reports published", rc.n, "/assessment/matrix"]].map(([l, n, href]) => (
          <Link key={String(l)} href={String(href)}>
            <Card><p className="text-sm text-muted-foreground">{l}</p>
              <p className="mt-1 text-3xl font-semibold">{String(n)}</p></Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
