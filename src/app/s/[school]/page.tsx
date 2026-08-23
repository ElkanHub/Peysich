import Link from "next/link";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  students, staff, classes, subjects, staffNudges, timetableEntries, periodSlots,
  assignments, submissions, announcements, events, attendanceRecords, feeInvoices,
  scorePublications,
} from "@/db/schema";
import { requireSchool, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { getStructure } from "@/core/academics";
import { getParentChildren, getStudentSelf } from "@/core/portal";
import { getUnackedAnnouncements } from "@/modules/comms/unacked";
import { Card, PageHeader, Stat } from "@/ui/kit";
import { PayFeesButton } from "@/ui/pay-fees";
import { TermPulseBar } from "@/ui/term-pulse-bar";
import { r2Enabled, presignDownload } from "@/lib/r2";

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
        <TermPulseBar school={school} />
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
    const userImage = (user as { image?: string | null }).image ?? null;
    const [today, due, anns, cls2, attRows, released, unacked, avatarUrl] = await Promise.all([
      dayKey && me.classId
        ? db.select({ startMin: periodSlots.startMin, endMin: periodSlots.endMin, subject: subjects.name })
            .from(timetableEntries)
            .innerJoin(periodSlots, eq(timetableEntries.slotId, periodSlots.id))
            .leftJoin(subjects, eq(timetableEntries.subjectId, subjects.id))
            .where(and(eq(timetableEntries.schoolId, school.id),
              eq(timetableEntries.classId, me.classId), eq(timetableEntries.day, dayKey)))
            .orderBy(periodSlots.startMin)
        : [],
      me.classId
        ? db.select().from(assignments)
            .where(and(eq(assignments.schoolId, school.id), eq(assignments.classId, me.classId)))
            .orderBy(desc(assignments.dueDate)).limit(10)
        : [],
      db.select().from(announcements)
        .where(eq(announcements.schoolId, school.id)).orderBy(desc(announcements.createdAt)).limit(3),
      me.classId ? db.select().from(classes).where(eq(classes.id, me.classId)) : [],
      term
        ? db.select({
            att: sql<number>`count(*) filter (where status != 'absent')`,
            abs: sql<number>`count(*) filter (where status = 'absent')`,
          }).from(attendanceRecords)
            .where(and(eq(attendanceRecords.studentId, me.id), eq(attendanceRecords.termId, term.id)))
        : [],
      term
        ? db.select({ id: scorePublications.id }).from(scorePublications)
            .where(and(eq(scorePublications.schoolId, school.id),
              eq(scorePublications.termId, term.id)))
        : [],
      getUnackedAnnouncements(school.id, user.id, "student"),
      userImage && r2Enabled ? presignDownload(userImage) : null,
    ]);
    const subm = due.length
      ? await db.select().from(submissions).where(and(
          eq(submissions.studentId, me.id),
          inArray(submissions.assignmentId, due.map((d) => d.id))))
      : [];
    const submitted = new Set(subm.map((s) => s.assignmentId));
    const todayStr = new Date().toISOString().slice(0, 10);
    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const att = Number(attRows[0]?.att ?? 0), abs = Number(attRows[0]?.abs ?? 0);
    const attPct = att + abs > 0 ? Math.round((att / (att + abs)) * 100) : null;
    const overdue = due.filter((a) => !submitted.has(a.id) && a.dueDate < todayStr).slice(0, 3);
    const pending = due.filter((a) => !submitted.has(a.id) && a.dueDate >= todayStr);
    const nothingWaiting = overdue.length === 0 && pending.length === 0 && unacked.length === 0;

    return (
      <div className="max-w-2xl">
        <PageHeader title={`Hi, ${me.firstName}`} sub={sub} />
        <TermPulseBar school={school} />

        {/* the student's own file card — personal AND official */}
        <Card className="mb-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-lg font-semibold uppercase text-primary ring-2 ring-primary/25">
              {avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                : `${me.firstName[0]}${me.lastName[0]}`}
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-tight">{me.firstName} {me.lastName}</p>
              <p className="text-[14px] text-muted-foreground">
                {cls2[0]?.name ?? "—"}{me.admissionNo ? <span data-nums=""> · Admission No {me.admissionNo}</span> : ""}
              </p>
              <p className="mt-0.5 text-[13px] text-faint">{school.name}</p>
            </div>
          </div>
        </Card>

        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="My attendance" value={attPct === null ? "—" : `${attPct}%`}
            tone={attPct !== null && attPct < 85 ? "danger" : "success"} />
          <Stat label="Homework waiting" value={String(overdue.length + pending.length)}
            tone={overdue.length > 0 ? "danger" : "default"} />
          <Stat label="Results released" value={String(released.length)} />
          <Stat label="To acknowledge" value={String(unacked.length)}
            tone={unacked.length > 0 ? "danger" : "success"} />
        </div>

        {/* what actually needs doing — the reason to open the app daily */}
        <Card className="mb-5 border-primary/25">
          <h2 className="font-semibold">Do today</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {overdue.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <Link href={`/homework/${a.id}`} className="min-w-0 truncate font-medium text-danger underline-offset-2 hover:underline">
                  Hand in: {a.title}
                </Link>
                <span className="shrink-0 text-[13px] text-danger" data-nums="">was due {a.dueDate}</span>
              </li>
            ))}
            {pending.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <Link href={`/homework/${a.id}`} className="min-w-0 truncate text-primary underline-offset-2 hover:underline">
                  {a.title}
                </Link>
                <span className="shrink-0 text-[13px] text-muted-foreground" data-nums="">due {a.dueDate}</span>
              </li>
            ))}
            {unacked.length > 0 && (
              <li>
                <Link href="/comms" className="font-medium text-primary underline-offset-2 hover:underline">
                  Acknowledge {unacked.length} announcement{unacked.length === 1 ? "" : "s"} →
                </Link>
              </li>
            )}
            {nothingWaiting && <li className="text-success">All caught up ✓ — nothing waiting on you.</li>}
          </ul>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <h2 className="font-semibold">Today&apos;s lessons</h2>
            {today.length === 0 && <p className="mt-1 text-sm text-muted-foreground">No lessons scheduled.</p>}
            <ul className="mt-2 space-y-1 text-sm">
              {today.map((l, i) => (
                <li key={i} data-nums="">{fmt(l.startMin)}–{fmt(l.endMin)} · <span className="font-medium">{l.subject}</span></li>
              ))}
            </ul>
            <Link href="/timetable" className="mt-3 inline-block text-[14px] font-medium text-primary">Full timetable →</Link>
          </Card>
          <Card>
            <h2 className="font-semibold">My records</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {released.length > 0 && term && (
                <li><Link href={`/students/${me.id}/performance/${term.id}`}
                  className="text-primary underline-offset-2 hover:underline">My results this term →</Link></li>
              )}
              <li><Link href="/attendance/register" className="text-primary underline-offset-2 hover:underline">My attendance record →</Link></li>
              <li><Link href="/homework" className="text-primary underline-offset-2 hover:underline">All my homework →</Link></li>
            </ul>
          </Card>
        </div>

        <Card className="mt-4">
          <h2 className="font-semibold">Announcements</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {anns.map((a) => <li key={a.id}><span className="font-medium text-foreground">{a.title}</span> — {a.body.slice(0, 100)}{a.body.length > 100 ? "…" : ""}</li>)}
            {anns.length === 0 && <li>Nothing yet.</li>}
          </ul>
        </Card>
      </div>
    );
  }

  if (user.role === "teacher") {
    // the teacher's morning in one screen: register duty, today's lessons,
    // marking backlog, announcements — plus any admin nudges still live
    const scope = await getTeacherScope(school.id, user.id);
    const today = new Date().toISOString().slice(0, 10);
    const dayKey = (["", "mon", "tue", "wed", "thu", "fri", ""] as const)[new Date().getDay()] || null;
    const allCls = await db.select().from(classes).where(eq(classes.schoolId, school.id));
    const clsName = new Map(allCls.map((c) => [c.id, c.name]));
    const homerooms = allCls.filter((c) => scope?.homeroomIds.has(c.id));
    const myClassIds = scope ? [...scope.allClassIds] : [];

    // today's lessons come from the timetable, teacher DERIVED the same way
    // the timetable derives it (allocations / class-teacher mode)
    const S = await getStructure(school.id);
    const myLessons = scope && dayKey
      ? S.entries
          .filter((e) => e.day === dayKey && S.teacherFor(e.classId, e.subjectId) === scope.staffId)
          .map((e) => {
            const sl = S.slotById.get(e.slotId)!;
            return {
              startMin: sl.startMin, endMin: sl.endMin, classId: e.classId,
              subject: S.subjectById.get(e.subjectId)?.name ?? "",
            };
          })
          .sort((a, b) => a.startMin - b.startMin)
      : [];
    const [markedRows, myAssignments, anns, nudges] = await Promise.all([
      db.select({ classId: attendanceRecords.classId }).from(attendanceRecords)
        .where(and(eq(attendanceRecords.schoolId, school.id), eq(attendanceRecords.date, today))),
      myClassIds.length
        ? db.select().from(assignments)
            .where(and(eq(assignments.schoolId, school.id), inArray(assignments.classId, myClassIds)))
            .orderBy(desc(assignments.dueDate)).limit(10)
        : [],
      db.select().from(announcements).where(eq(announcements.schoolId, school.id))
        .orderBy(desc(announcements.createdAt)).limit(3),
      scope
        ? db.select().from(staffNudges)
            .where(and(eq(staffNudges.schoolId, school.id), eq(staffNudges.staffId, scope.staffId)))
            .orderBy(desc(staffNudges.sentAt)).limit(3)
        : [],
    ]);
    const marked = new Set(markedRows.map((r) => r.classId));
    const unmarkedSubs = myAssignments.length
      ? await db.select({ assignmentId: submissions.assignmentId, n: sql<number>`count(*) filter (where mark is null)` })
          .from(submissions)
          .where(inArray(submissions.assignmentId, myAssignments.map((a) => a.id)))
          .groupBy(submissions.assignmentId)
      : [];
    const toMark = new Map(unmarkedSubs.map((u) => [u.assignmentId, Number(u.n)]));
    const backlog = myAssignments.filter((a) => (toMark.get(a.id) ?? 0) > 0).slice(0, 5);
    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    // a nudge stays visible only while its register is still unmarked today
    const liveNudges = nudges.filter((n) =>
      n.sentAt >= startOfDay && n.kind === "attendance" && n.refId && !marked.has(n.refId));

    return (
      <div>
        <PageHeader title={`Good day, ${user.name.split(" ")[0]}`} sub={sub} />
        <TermPulseBar school={school} />
        {!scope && (
          <p className="mb-4 text-sm text-muted-foreground">
            Your login isn&apos;t linked to a staff record yet — ask your admin to check your Staff File.
          </p>
        )}

        {liveNudges.map((n) => (
          <div key={n.id} className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning-soft px-4 py-2.5 text-sm">
            <span>📣 <b>{n.sentBy}</b>: the {clsName.get(n.refId!) ?? ""} register for today isn&apos;t marked yet.</span>
            <Link href={`/attendance/${n.refId}`} className="font-medium text-primary">Mark it now →</Link>
          </div>
        ))}

        {homerooms.length > 0 && (
          <>
            <h2 className="mb-2.5 text-sm font-semibold">My register{homerooms.length === 1 ? "" : "s"}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {homerooms.map((c) => (
                <Link key={c.id} href={`/attendance/${c.id}`}>
                  <Card className={marked.has(c.id) ? "border-success/40" : "border-warning/50"}>
                    <p className="font-medium">{c.name}</p>
                    <p className={`mt-1 text-sm ${marked.has(c.id) ? "text-success" : "font-medium text-warning"}`}>
                      {marked.has(c.id) ? "Register saved ✓" : "Mark register →"}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card>
            <h2 className="font-semibold">Today&apos;s lessons</h2>
            {myLessons.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Nothing scheduled for you today.</p>}
            <ul className="mt-2 space-y-1.5 text-sm">
              {myLessons.map((l, i) => (
                <li key={i} className="flex justify-between">
                  <span><span className="font-medium">{clsName.get(l.classId)}</span> · {l.subject}</span>
                  <span className="text-muted-foreground" data-nums="">{fmt(l.startMin)}–{fmt(l.endMin)}</span>
                </li>
              ))}
            </ul>
            <Link href="/timetable" className="mt-3 inline-block text-[14px] font-medium text-primary">Full timetable →</Link>
          </Card>
          <Card>
            <h2 className="font-semibold">Homework to mark</h2>
            {backlog.length === 0 && <p className="mt-1 text-sm text-muted-foreground">All caught up ✓</p>}
            <ul className="mt-2 space-y-1.5 text-sm">
              {backlog.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <Link href={`/homework/${a.id}`} className="min-w-0 truncate text-primary underline-offset-2 hover:underline">
                    {a.title}
                  </Link>
                  <span className="shrink-0 text-muted-foreground" data-nums="">{toMark.get(a.id)} to mark</span>
                </li>
              ))}
            </ul>
            <Link href="/assessment" className="mt-3 inline-block text-[14px] font-medium text-primary">Score sheets →</Link>
          </Card>
          <Card>
            <h2 className="font-semibold">Announcements</h2>
            <ul className="mt-2 space-y-2 text-[14px] text-muted-foreground">
              {anns.map((a) => (
                <li key={a.id}><span className="font-medium text-foreground">{a.title}</span> — {a.body.slice(0, 90)}{a.body.length > 90 ? "…" : ""}</li>
              ))}
              {anns.length === 0 && <li>Nothing yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    );
  }

  // ── admin (and platform_admin visiting): the 90-second morning check ──
  const today = new Date().toISOString().slice(0, 10);
  const [[st], [sf], allCls, attToday, fees, anns, evts, rosters] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
    db.select({ n: sql<number>`count(*)` }).from(staff).where(eq(staff.schoolId, school.id)),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select({
      classId: attendanceRecords.classId,
      present: sql<number>`count(*) filter (where status != 'absent')`,
      total: sql<number>`count(*)`,
    }).from(attendanceRecords)
      .where(and(eq(attendanceRecords.schoolId, school.id), eq(attendanceRecords.date, today)))
      .groupBy(attendanceRecords.classId),
    term
      ? db.select({
          billed: sql<number>`coalesce(sum(total_pesewas),0)`,
          paid: sql<number>`coalesce(sum(paid_pesewas),0)`,
        }).from(feeInvoices)
          .where(and(eq(feeInvoices.schoolId, school.id), eq(feeInvoices.termId, term.id)))
      : [{ billed: 0, paid: 0 }],
    db.select().from(announcements).where(eq(announcements.schoolId, school.id))
      .orderBy(desc(announcements.createdAt)).limit(3),
    db.select().from(events).where(eq(events.schoolId, school.id))
      .orderBy(desc(events.startsAt)).limit(3),
    db.select({ classId: students.classId, n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active")))
      .groupBy(students.classId),
  ]);
  const f = fees[0];
  const rosterN = new Map(rosters.map((r) => [r.classId, Number(r.n)]));
  const attByClass = new Map(attToday.map((a) => [a.classId, a]));
  const markedCount = attToday.length;
  const presentToday = attToday.reduce((a, r) => a + Number(r.present), 0);
  const totalToday = attToday.reduce((a, r) => a + Number(r.total), 0);
  const outstanding = Number(f.billed) - Number(f.paid);
  const setupNeeded = !term || allCls.length === 0 || Number(st.n) === 0;

  return (
    <div>
      <PageHeader title="Dashboard" sub={sub} />
      <TermPulseBar school={school} />
      {setupNeeded && (
        <Card className="mb-6">
          <p className="font-medium">Get {school.name} running</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            {!term && <li><Link className="text-primary hover:underline" href="/settings">Set up your academic year & term dates</Link></li>}
            {allCls.length === 0 && <li><Link className="text-primary hover:underline" href="/settings">Choose your levels — classes & subjects are created for you</Link></li>}
            <li><Link className="text-primary hover:underline" href="/staff">Add your staff</Link></li>
            {Number(st.n) === 0 && <li><Link className="text-primary hover:underline" href="/students/import">Import students (CSV)</Link> or <Link className="text-primary hover:underline" href="/students/new">add them one by one</Link></li>}
          </ol>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active students" value={String(st.n)} />
        <Stat label="Present today" value={totalToday ? `${presentToday}/${totalToday}` : "—"}
          tone={totalToday && presentToday / totalToday < 0.85 ? "danger" : "default"} />
        <Stat label="Collected this term" value={`GHS ${(Number(f.paid) / 100).toLocaleString()}`} tone="success" />
        <Stat label="Outstanding" value={`GHS ${(outstanding / 100).toLocaleString()}`}
          tone={outstanding > 0 ? "danger" : "success"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* attendance today — every number is a link (doc 10) */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Attendance today</h2>
            <span className="text-[13px] text-muted-foreground">{markedCount}/{allCls.length} classes marked</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {allCls.slice(0, 8).map((c) => {
              const a = attByClass.get(c.id);
              const total = rosterN.get(c.id) ?? 0;
              const pct = a && Number(a.total) ? Math.round((Number(a.present) / Number(a.total)) * 100) : null;
              return (
                <Link key={c.id} href={`/attendance/${c.id}`} className="group flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-[14px] font-medium group-hover:text-primary">{c.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    {pct !== null && (
                      <span className="block h-full rounded-full bg-primary/80 transition-all"
                        style={{ width: `${pct}%` }} />
                    )}
                  </span>
                  <span data-nums="" className="w-28 shrink-0 whitespace-nowrap text-right text-[13px] text-muted-foreground">
                    {pct !== null ? `${pct}% · ${a!.present}/${a!.total}` : `${total} · not marked`}
                  </span>
                </Link>
              );
            })}
          </div>
          {allCls.length > 8 && (
            <Link href="/attendance" className="mt-3 inline-block text-[14px] font-medium text-primary">
              All {allCls.length} classes →
            </Link>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold">Quick actions</h2>
            <div className="mt-3 grid gap-2">
              {[["/students/new", "Add a student"], ["/students/import", "Import students (CSV)"],
                ["/comms", "Post an announcement"], ["/assessment/matrix", "Term closing status"],
                ["/fees", "Fees & invoices"]].map(([href, label]) => (
                <Link key={href} href={href}
                  className="rounded-md border border-border px-3 py-2 text-[14px] font-medium transition-colors hover:border-border-strong hover:bg-muted">
                  {label}
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold">Latest</h2>
            <ul className="mt-2.5 space-y-2 text-[14px]">
              {anns.map((a) => (
                <li key={a.id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{a.title}</span> · {a.createdAt.toISOString().slice(5, 10)}
                </li>
              ))}
              {evts.map((e) => (
                <li key={e.id} className="text-muted-foreground">
                  📅 <span className="font-medium text-foreground">{e.title}</span> · {e.startsAt.toISOString().slice(5, 10)}
                </li>
              ))}
              {anns.length + evts.length === 0 && <li className="text-muted-foreground">Nothing yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
