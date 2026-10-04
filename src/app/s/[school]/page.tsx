import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  students, staff, classes, subjects, staffNudges, timetableEntries, periodSlots,
  assignments, submissions, announcements, events, attendanceRecords, feeInvoices,
  scorePublications, feeItems, componentScores,
} from "@/db/schema";
import { requireSchool, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { getStructure } from "@/core/academics";
import { getParentChildren, getStudentSelf } from "@/core/portal";
import { getUnackedAnnouncements } from "@/modules/comms/unacked";
import { Card, Stat } from "@/ui/kit";
import { ChildAvatar } from "@/ui/child-avatar";
import { TermPulseBar } from "@/ui/term-pulse-bar";
import { WelcomeHero } from "@/ui/welcome-hero";
import { BookOpenCheck, CircleAlert, ClipboardCheck, Megaphone, Upload, UserPlus, Users, Wallet, WalletCards } from "lucide-react";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { uid } from "@/lib/utils";
import { withFlash } from "@/lib/flash";
import { SubmitButton } from "@/ui/feedback";
import { SetupChecklist } from "./setup-checklist";
import { installing } from "@/core/installation";

/** "Remind the teacher" for a score sheet — the register nudge, aimed at a
 *  class·subject sheet: a nudge row and a notify() to the teacher. No confirm (one
 *  person, small), a toast says who was told. */
async function remindScoreTeacher(slug: string, f: FormData) {
  "use server";
  const { school, user } = await requireSchool(slug, ["admin"]);
  const classId = String(f.get("classId") ?? ""), subjectId = String(f.get("subjectId") ?? "");
  const S = await getStructure(school.id);
  const cls = S.classById.get(classId), sub = S.subjectById.get(subjectId);
  const t = cls && sub ? S.staffById.get(S.teacherFor(classId, subjectId) ?? "") : undefined;
  if (!cls || !sub || !t) {
    redirect(withFlash("/", "No teacher is allocated to that sheet yet — allocate one under Staff.", { error: true }));
  }
  const { notify } = await import("@/messaging/notify");
  const { render } = await import("@/messaging/render");
  const { schoolUrl } = await import("@/messaging/render");
  const vars = { school: school.name, first: t.name.split(" ")[0], class: cls.name, subject: sub.name };
  await db.insert(staffNudges).values({
    id: uid(), schoolId: school.id, staffId: t.id, kind: "scores",
    refId: `${classId}:${subjectId}`, message: render("staff_nudge_scores", vars), sentBy: user.name,
  });
  await notify({
    school, to: { kind: "staff", id: t.id }, kind: "staff_nudge_scores", vars,
    url: `/assessment/${classId}/${subjectId}`, link: schoolUrl(slug, `/assessment/${classId}/${subjectId}`),
  });
  redirect(withFlash("/", `Reminder sent to ${t.name}.`));
}

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default async function Dashboard({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireSchool(slug);
  const term = await getCurrentTerm(school.id);

  if (user.role === "parent") {
    const kids = await getParentChildren(school.id, user.id, term?.id);
    const invIds = kids.map((k) => k.invoiceId).filter(Boolean) as string[];
    const dueByInvoice = new Map((invIds.length
      ? await db.select({ id: feeInvoices.id, dueDate: feeInvoices.dueDate }).from(feeInvoices)
          .where(inArray(feeInvoices.id, invIds))
      : []).map((i) => [i.id, i]));
    return (
      <div>
        <WelcomeHero role="parent" name={user.name} schoolId={school.id} title="Your children at school"
          line={`Attendance, fees and report cards from ${school.name}, in one place.`} />
        <TermPulseBar school={school} />
        {kids.length === 0 && (
          <p className="text-[16px] text-muted-foreground">
            No children linked to your account yet — please contact the school office.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {kids.map((k) => {
            const inv = k.invoiceId ? dueByInvoice.get(k.invoiceId) : null;
            const due = inv?.dueDate
              ? new Date(inv.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
            const reportTerm = k.reportTermIds.at(-1);
            return (
              <Card key={k.id} className="p-5">
                <div className="flex items-center gap-4">
                  <ChildAvatar photoUrl={k.photoUrl} initials={`${k.firstName[0]}${k.lastName[0]}`}
                    owing={k.owingPesewas > 0} className="h-16 w-16 text-[18px]" />
                  <div className="min-w-0">
                    <p className="text-[18px] font-semibold leading-tight">{k.firstName} {k.lastName}</p>
                    <p className="text-[15px] text-muted-foreground">{k.className ?? "No class yet"}</p>
                  </div>
                </div>
                <p className={`mt-4 text-[16px] font-medium ${
                  k.today === "absent" ? "text-danger" : k.today ? "text-success" : "text-muted-foreground"}`}>
                  {k.today === "absent" ? "Absent today" : k.today ? "✓ In school today" : "Not marked yet"}
                </p>
                <p className={`mt-1 text-[16px] font-medium ${k.owingPesewas > 0 ? "text-danger" : "text-success"}`} data-nums="">
                  {k.owingPesewas > 0
                    ? <>Owing {ghs(k.owingPesewas)}{due ? ` · due ${due}` : ""}</>
                    : "Fees cleared ✓"}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {k.owingPesewas > 0 && (
                    <Link href={`/fees?child=${k.id}`}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:bg-brand-strong">
                      How to pay
                    </Link>
                  )}
                  {reportTerm && (
                    <Link href={`/students/${k.id}/report/${reportTerm}`}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-[15px] font-semibold hover:bg-muted">
                      Report card
                    </Link>
                  )}
                </div>
                <Link href={`/children/${k.id}`} className="mt-4 block text-[16px] font-medium text-primary">
                  See everything about {k.firstName} →
                </Link>
              </Card>
            );
          })}
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
        <WelcomeHero role="student" name={me.firstName} schoolId={school.id} title={`Ready for today, ${me.firstName}?`}
          line="Your lessons, your homework and your results are below." />
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
                  data-tour="tab:Results" className="text-primary underline-offset-2 hover:underline">My results this term →</Link></li>
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
          .filter((e) => e.day === dayKey && S.teacherFor(e.classId, e.subjectId, e.teacherId) === scope.staffId)
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
    // a register nudge stays visible only while that register is still unmarked
    // today; a scores nudge stays for the day it was sent
    const liveNudges = nudges.filter((n) => n.sentAt >= startOfDay && n.refId
      && (n.kind === "attendance" ? !marked.has(n.refId) : n.kind === "scores"));

    return (
      <div>
        <WelcomeHero role="teacher" name={user.name} schoolId={school.id} title="Your classes today"
          line="Mark the register, enter scores and set homework. Everything that needs you is below." />
        <TermPulseBar school={school} />
        {!scope && (
          <p className="mb-4 text-sm text-muted-foreground">
            Your login isn&apos;t linked to a staff record yet — ask your admin to check your Staff File.
          </p>
        )}

        {liveNudges.map((n) => (
          <div key={n.id} className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning-soft px-4 py-2.5 text-sm">
            {n.kind === "scores" ? (
              <>
                <span>📣 <b>{n.sentBy}</b>: the {clsName.get(n.refId!.split(":")[0]) ?? ""} · {S.subjectById.get(n.refId!.split(":")[1] ?? "")?.name ?? ""} scores are still missing.</span>
                <Link href={`/assessment/${n.refId!.replace(":", "/")}`} className="font-medium text-primary">Enter them now →</Link>
              </>
            ) : (
              <>
                <span>📣 <b>{n.sentBy}</b>: the {clsName.get(n.refId!) ?? ""} register for today isn&apos;t marked yet.</span>
                <Link href={`/attendance/${n.refId}`} className="font-medium text-primary">Mark it now →</Link>
              </>
            )}
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
  const [[st], allCls, attToday, fees, anns, evts, rosters] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
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
  const S = await getStructure(school.id);
  const [[feeItemCount], [invitedTeachers], entered] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(feeItems).where(eq(feeItems.schoolId, school.id)),
    db.select({ n: sql<number>`count(*)` }).from(staff)
      .where(and(eq(staff.schoolId, school.id), sql`${staff.userId} is not null`)),
    term
      ? db.select({
          classId: componentScores.classId, subjectId: componentScores.subjectId,
          n: sql<number>`count(distinct ${componentScores.studentId})`,
        }).from(componentScores)
          .where(and(eq(componentScores.schoolId, school.id), eq(componentScores.termId, term.id)))
          .groupBy(componentScores.classId, componentScores.subjectId)
      : [],
  ]);
  const docSign = (school.settings as { docSign?: { headSigKey?: string; adminSigKey?: string } }).docSign ?? {};
  const setupItems = [
    { key: "classes", label: "Create your classes", href: "/settings", done: allCls.length > 0 },
    { key: "students", label: "Add your first students", href: "/students", done: Number(st.n) > 0 },
    { key: "colour", label: "Pick your school colour", href: "/settings?tab=school", done: !!school.branding.primaryColor },
    { key: "signature", label: "Collect the head teacher's signature", href: "/settings?tab=school", done: !!(docSign.headSigKey || docSign.adminSigKey) },
    { key: "fees", label: "Enter this term's fees", href: "/fees/setup", done: Number(feeItemCount.n) > 0 },
    { key: "teachers", label: "Invite your teachers", href: "/staff", done: Number(invitedTeachers.n) > 0 },
  // installed and trained by SchoolSpec: we did these, so they are done
  ].map((i) => ({ ...i, done: i.done || school.installation === "done" }));
  const f = fees[0];
  const rosterN = new Map(rosters.map((r) => [r.classId, Number(r.n)]));
  const attByClass = new Map(attToday.map((a) => [a.classId, a]));
  const markedCount = attToday.length;
  const presentToday = attToday.reduce((a, r) => a + Number(r.present), 0);
  const totalToday = attToday.reduce((a, r) => a + Number(r.total), 0);
  const outstanding = Number(f.billed) - Number(f.paid);
  // a "sheet" is one class × subject that takes scores (preschool is skills-based);
  // it is missing while fewer children have a mark than sit in the class
  const enteredN = new Map(entered.map((e) => [`${e.classId}:${e.subjectId}`, Number(e.n)]));
  const sheets = allCls.flatMap((c) => S.sectionOfClass(c) === "preschool" || !(rosterN.get(c.id) ?? 0) ? []
    : S.effectiveSubjectIds(c.id).map((subjectId) => ({ classId: c.id, subjectId })));
  const missing = sheets.filter((x) => (enteredN.get(`${x.classId}:${x.subjectId}`) ?? 0) < (rosterN.get(x.classId) ?? 0));

  const billed = Number(f.paid) + outstanding;
  const unmarked = Math.max(0, allCls.length - markedCount);
  const needs = [
    unmarked > 0 && term && { href: "/attendance", what: `${unmarked} register${unmarked === 1 ? "" : "s"} not marked`,
      why: "Parents of absent children are not told until the register is saved.", go: "Remind the teachers" },
    outstanding > 0 && { href: "/fees?tab=reminders", what: `GHS ${(outstanding / 100).toLocaleString()} still owed`,
      why: "Send a reminder to every parent who is past the due date.", go: "Send reminders" },
    missing.length > 0 && { href: "/assessment/matrix", what: `${missing.length} score sheet${missing.length === 1 ? "" : "s"} missing`,
      why: "Report cards cannot go out until every sheet is entered.", go: "See which ones" },
  ].filter((n): n is { href: string; what: string; why: string; go: string } => !!n);

  return (
    <div>
      <WelcomeHero role="admin" name={user.name} schoolId={school.id} title={`Welcome back to ${school.name}`}
        line={school.branding.motto || "What needs you today is below, most urgent first."} />
      <TermPulseBar school={school} />
      {!term && (
        <Card className="mb-6">
          <p className="font-medium">First things first</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link className="font-medium text-primary hover:underline" href="/settings">Set up your academic year & term dates</Link>
            {" "}— everything else hangs on the calendar.
          </p>
        </Card>
      )}
      <SetupChecklist schoolName={school.name} items={setupItems}
        installation={school.installation === "none" ? "offer" : installing(school) ? "arranged" : null} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active students" value={String(st.n)} icon={<Users size={18} />}
          hint={`in ${allCls.length} class${allCls.length === 1 ? "" : "es"}`} />
        <Stat label="Present today" value={totalToday ? `${presentToday}/${totalToday}` : "—"} icon={<ClipboardCheck size={18} />}
          hint={totalToday ? `${Math.round((presentToday / totalToday) * 100)}% of those marked are in school` : "No register saved yet today"}
          tone={totalToday && presentToday / totalToday < 0.85 ? "danger" : "default"} />
        <Stat label="Collected this term" value={`GHS ${(Number(f.paid) / 100).toLocaleString()}`} tone="success" icon={<Wallet size={18} />}
          hint={billed > 0 ? `${Math.round((Number(f.paid) / billed) * 100)}% of what was billed` : "No bills created yet"} />
        <Stat label="Outstanding" value={`GHS ${(outstanding / 100).toLocaleString()}`} icon={<WalletCards size={18} />}
          hint={outstanding > 0 ? `${Math.round((outstanding / billed) * 100)}% still to collect` : "Nothing owed"}
          tone={outstanding > 0 ? "danger" : "success"} />
      </div>

      {/* what needs a decision today, most urgent first; each one goes straight to where it is fixed */}
      {needs.length > 0 && (
        <Card className="mt-4 border-l-4 border-warning">
          <h2 className="flex items-center gap-2 font-semibold"><CircleAlert size={17} className="text-warning" /> Needs you today</h2>
          <ul className="mt-2 grid gap-2 md:grid-cols-3">
            {needs.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block h-full rounded-md border border-border px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-muted">
                  <span className="block text-[15px] font-semibold">{n.what}</span>
                  <span className="block text-[13.5px] text-muted-foreground">{n.why}</span>
                  <span className="mt-1 block text-[13.5px] font-semibold text-primary">{n.go} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* quick actions: big, coloured, and where the eye lands */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {([
          ["/students/new", "Add a student", UserPlus, "bg-brand-container text-on-brand-container"],
          ["/attendance", "Mark attendance", ClipboardCheck, "bg-success-soft text-success"],
          ["/comms", "Message parents", Megaphone, "bg-warning-soft text-warning"],
          ["/fees", "Take a payment", Wallet, "bg-brand-soft text-primary"],
          ["/assessment/matrix", "Check scores", BookOpenCheck, "bg-danger-soft text-danger"],
        ] as const).map(([href, label, Icon, tone]) => (
          <Link key={href} href={href}
            className={`flex items-center gap-3 rounded-lg px-4 py-3.5 text-[15px] font-semibold shadow-[var(--shadow-sm)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] ${tone}`}>
            <Icon size={20} className="shrink-0" /> {label}
          </Link>
        ))}
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
          {term && sheets.length > 0 && (
            <Card>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Scores still missing</h2>
                <span className="text-[14px] text-muted-foreground" data-nums="">{missing.length} of {sheets.length} sheets</span>
              </div>
              {missing.length === 0 && <p className="mt-1 text-[14px] text-success">Every sheet is complete ✓</p>}
              <ul className="mt-2 space-y-2">
                {missing.slice(0, 5).map((x) => {
                  const teacher = S.staffById.get(S.teacherFor(x.classId, x.subjectId) ?? "");
                  return (
                    <li key={`${x.classId}:${x.subjectId}`} className="flex items-center justify-between gap-2 text-[14px]">
                      <Link href={`/assessment/${x.classId}/${x.subjectId}`} className="min-w-0 truncate font-medium text-primary hover:underline">
                        {S.classById.get(x.classId)?.name} · {S.subjectById.get(x.subjectId)?.name}
                      </Link>
                      <form action={remindScoreTeacher.bind(null, slug)} className="shrink-0">
                        <input type="hidden" name="classId" value={x.classId} />
                        <input type="hidden" name="subjectId" value={x.subjectId} />
                        <SubmitButton pendingText="Sending…" title={teacher ? `Text ${teacher.name}` : "No teacher allocated"}
                          className="rounded-full border border-border px-3 py-1 text-[13px] font-medium hover:bg-muted">
                          Remind the teacher
                        </SubmitButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
              {missing.length > 5 && (
                <Link href="/assessment/matrix" className="mt-3 inline-block text-[14px] font-medium text-primary">
                  All {missing.length} missing sheets →
                </Link>
              )}
            </Card>
          )}
          <Card>
            <h2 className="flex items-center gap-2 font-semibold"><Upload size={15} className="text-muted-foreground" /> More to do</h2>
            <div className="mt-3 grid gap-2">
              {[["/students/import", "Import students from a sheet"], ["/staff", "Add a teacher"],
                ["/billing", "Messaging balance and plan"]].map(([href, label]) => (
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
