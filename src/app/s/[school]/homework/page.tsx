import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";
import { db } from "@/db";
import { assignments, classes, levels, subjects, submissions, students } from "@/db/schema";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { getParentChildren, getStudentSelf } from "@/core/portal";
import { getStructure } from "@/core/academics";
import { getHomeworkConfig } from "@/modules/homework/config";
import { mondayOf, todayIso } from "@/core/calendar";
import Link from "next/link";
import { createHomework, saveHomeworkConfig } from "./actions";
import { Card, DataTable, Field, PageHeader, Empty, Stat, Tr, Td, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

export default async function Homework({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ subject?: string; child?: string; from?: string; to?: string; c?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school, user } = await requireModule(slug, "homework");
  const cfg = getHomeworkConfig(school.settings);
  const today = todayIso();

  // ── student: MY class only, filterable by subject ──
  if (user.role === "student") {
    const me = await getStudentSelf(school.id, user.id);
    if (!me?.classId) return <Empty title="No class yet" hint="Please contact the school office." />;
    const rows = await db.select({
      id: assignments.id, title: assignments.title, dueDate: assignments.dueDate,
      subject: subjects.name, subjectId: assignments.subjectId,
    }).from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(and(eq(assignments.schoolId, school.id), eq(assignments.classId, me.classId)))
      .orderBy(desc(assignments.dueDate)).limit(40);
    const subjectsHere = [...new Map(rows.map((r) => [r.subjectId, r.subject ?? ""])).entries()]
      .sort((a, b) => (a[1] ?? "").localeCompare(b[1] ?? ""));
    const shown = sp.subject ? rows.filter((r) => r.subjectId === sp.subject) : rows;
    const mine = shown.length
      ? await db.select().from(submissions).where(and(
          eq(submissions.studentId, me.id),
          inArray(submissions.assignmentId, shown.map((r) => r.id))))
      : [];
    const done = new Set(mine.map((s) => s.assignmentId));
    return (
      <div className="max-w-2xl">
        <PageHeader title="Homework" sub={`What ${me.firstName}'s class has been set — your own record only`} />
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Link href="/homework" className={`rounded-full px-3 py-1 text-[13.5px] font-medium ${!sp.subject ? "bg-brand-container text-on-brand-container" : "border border-border hover:bg-muted"}`}>
            All subjects
          </Link>
          {subjectsHere.map(([id, name]) => (
            <Link key={id} href={`/homework?subject=${id}`}
              className={`rounded-full px-3 py-1 text-[13.5px] font-medium ${sp.subject === id ? "bg-brand-container text-on-brand-container" : "border border-border hover:bg-muted"}`}>
              {name}
            </Link>
          ))}
        </div>
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`/homework/${r.id}`} className="block rounded-lg border border-border bg-card px-4 py-2.5 transition-colors hover:border-border-strong">
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-medium">{r.title}</span>
                    <span className="ml-2 text-[13.5px] text-muted-foreground">{r.subject}</span>
                  </span>
                  <span className={`shrink-0 text-[13.5px] font-medium ${done.has(r.id) ? "text-success"
                    : r.dueDate < today ? "text-danger" : "text-muted-foreground"}`} data-nums="">
                    {done.has(r.id) ? "handed in ✓" : r.dueDate < today ? `was due ${r.dueDate}` : `due ${r.dueDate}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {shown.length === 0 && <Empty title="No homework here" hint="Nothing set for this subject recently." />}
        </ul>
      </div>
    );
  }

  // ── parent: my children's classes only, filter by child + subject ──
  if (user.role === "parent") {
    const kids = await getParentChildren(school.id, user.id);
    const withClass = kids.filter((k) => k.classId);
    const classIds = [...new Set(withClass.map((k) => k.classId))] as string[];
    const rows = classIds.length
      ? await db.select({
          id: assignments.id, title: assignments.title, dueDate: assignments.dueDate,
          classId: assignments.classId, subject: subjects.name, subjectId: assignments.subjectId,
        }).from(assignments)
          .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
          .where(and(eq(assignments.schoolId, school.id), inArray(assignments.classId, classIds)))
          .orderBy(desc(assignments.dueDate)).limit(40)
      : [];
    const subjectsHere = [...new Map(rows.map((r) => [r.subjectId, r.subject ?? ""])).entries()]
      .sort((a, b) => (a[1] ?? "").localeCompare(b[1] ?? ""));
    const shownKids = sp.child ? withClass.filter((k) => k.id === sp.child) : withClass;
    const subs = rows.length && cfg.recordSubmissions
      ? await db.select({ assignmentId: submissions.assignmentId, studentId: submissions.studentId })
          .from(submissions).where(inArray(submissions.assignmentId, rows.map((r) => r.id)))
      : [];
    const handedIn = new Set(subs.map((s) => `${s.assignmentId}:${s.studentId}`));
    const q = (child?: string, subject?: string) =>
      `/homework?${[child && `child=${child}`, subject && `subject=${subject}`].filter(Boolean).join("&")}`;

    return (
      <div className="max-w-2xl">
        <PageHeader title="Homework"
          sub="What has been set for your children — their classes only, nothing else" />
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Link href={q(undefined, sp.subject)} className={`rounded-full px-3 py-1 text-[13.5px] font-medium ${!sp.child ? "bg-brand-container text-on-brand-container" : "border border-border hover:bg-muted"}`}>
            All children
          </Link>
          {withClass.map((k) => (
            <Link key={k.id} href={q(k.id, sp.subject)}
              className={`rounded-full px-3 py-1 text-[13.5px] font-medium ${sp.child === k.id ? "bg-brand-container text-on-brand-container" : "border border-border hover:bg-muted"}`}>
              {k.firstName} · {k.className}
            </Link>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Link href={q(sp.child)} className={`rounded-full px-2.5 py-0.5 text-[13px] ${!sp.subject ? "bg-muted font-medium" : "border border-border hover:bg-muted"}`}>
            All subjects
          </Link>
          {subjectsHere.map(([id, name]) => (
            <Link key={id} href={q(sp.child, id)}
              className={`rounded-full px-2.5 py-0.5 text-[13px] ${sp.subject === id ? "bg-muted font-medium" : "border border-border hover:bg-muted"}`}>
              {name}
            </Link>
          ))}
        </div>
        {shownKids.map((k) => {
          const kidRows = rows
            .filter((r) => r.classId === k.classId)
            .filter((r) => !sp.subject || r.subjectId === sp.subject)
            .slice(0, 10);
          return (
            <Card key={k.id} className="mb-4">
              <h2 className="font-semibold">{k.firstName} {k.lastName}
                <span className="ml-2 text-[13px] font-normal text-muted-foreground">{k.className}</span></h2>
              <ul className="mt-2 divide-y divide-border text-sm">
                {kidRows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0">
                      <span className="font-medium">{r.title}</span>
                      <span className="ml-2 text-[13px] text-muted-foreground">{r.subject} · due {r.dueDate}</span>
                    </span>
                    {cfg.recordSubmissions && (
                      handedIn.has(`${r.id}:${k.id}`)
                        ? <span className="shrink-0 text-[13px] font-medium text-success">handed in ✓</span>
                        : <span className={`shrink-0 text-[13px] ${r.dueDate < today ? "text-danger" : "text-muted-foreground"}`}>
                            {r.dueDate < today ? "not handed in" : "pending"}
                          </span>
                    )}
                  </li>
                ))}
                {kidRows.length === 0 && (
                  <li className="py-1.5 text-muted-foreground">No homework set recently.</li>
                )}
              </ul>
            </Card>
          );
        })}
        {withClass.length === 0 && <Empty title="No children linked" hint="Please contact the school office." />}
      </div>
    );
  }

  // ── shared staff data ──
  const [allCls, allSubs] = await Promise.all([
    db.select({ id: classes.id, name: classes.name, sortOrder: levels.sortOrder })
      .from(classes).innerJoin(levels, eq(classes.levelId, levels.id))
      .where(eq(classes.schoolId, school.id)),
    db.select().from(subjects).where(eq(subjects.schoolId, school.id)).orderBy(subjects.name),
  ]);
  const clsOrdered = [...allCls].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  // ── teacher: only the classes they are assigned to ──
  if (user.role === "teacher") {
    const scope = await getTeacherScope(school.id, user.id);
    const myCls = clsOrdered.filter((c) => scope?.allClassIds.has(c.id));
    if (!myCls.length)
      return <Empty title="No classes assigned" hint="Homework covers the classes you teach — ask your admin about allocations." />;
    const S = await getStructure(school.id);
    // subjects this teacher can set for: their allocations + everything a
    // homeroom takes (class-teacher mode)
    const mySubjectIds = new Set(scope!.cells.map((c) => c.subjectId));
    for (const hid of scope!.homeroomIds) for (const sid of S.effectiveSubjectIds(hid)) mySubjectIds.add(sid);
    const mySubs = allSubs.filter((s) => mySubjectIds.has(s.id));
    const rows = await db.select({
      id: assignments.id, title: assignments.title, dueDate: assignments.dueDate,
      className: classes.name, subject: subjects.name,
    }).from(assignments)
      .leftJoin(classes, eq(assignments.classId, classes.id))
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(and(eq(assignments.schoolId, school.id),
        inArray(assignments.classId, myCls.map((c) => c.id))))
      .orderBy(desc(assignments.dueDate)).limit(30);
    const counts = rows.length
      ? await db.select({ assignmentId: submissions.assignmentId, n: sql<number>`count(*)` })
          .from(submissions).where(inArray(submissions.assignmentId, rows.map((r) => r.id)))
          .groupBy(submissions.assignmentId)
      : [];
    const nOf = new Map(counts.map((c) => [c.assignmentId, Number(c.n)]));

    return (
      <div className="max-w-3xl">
        <PageHeader title="Homework" sub={`Your classes: ${myCls.map((c) => c.name).join(", ")}`} />
        <DataTable head={["Title", "Class", "Subject", "Due", cfg.recordSubmissions ? "Hand-ins" : ""]}>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="font-medium"><Link href={`/homework/${r.id}`} className="text-primary underline-offset-2 hover:underline">{r.title}</Link></Td>
              <Td>{r.className}</Td><Td>{r.subject}</Td>
              <Td>{r.dueDate}</Td><Td>{cfg.recordSubmissions ? nOf.get(r.id) ?? 0 : ""}</Td>
            </Tr>
          ))}
        </DataTable>
        <Card className="mt-5">
          <h2 className="font-semibold">Set homework</h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">For your classes and subjects only.</p>
          <form action={createHomework.bind(null, slug)} className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Title"><input name="title" required className={inputCls} /></Field>
            <Field label="Due date"><input name="dueDate" type="date" required className={inputCls} /></Field>
            <Field label="Class">
              <select name="classId" className={inputCls}>{myCls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
            <Field label="Subject">
              <select name="subjectId" className={inputCls}>{mySubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </Field>
            <div className="col-span-2">
              <Field label="Instructions"><textarea name="instructions" rows={3} className={inputCls} /></Field>
            </div>
            <SubmitButton className={btnCls + " col-span-2"}>Assign</SubmitButton>
          </form>
        </Card>
      </div>
    );
  }

  // ── admin: the whole school, grouped by class, with decision KPIs ──
  const term = await getCurrentTerm(school.id);
  const weekStart = mondayOf(today);
  const conds = [eq(assignments.schoolId, school.id)];
  if (sp.subject) conds.push(eq(assignments.subjectId, sp.subject));
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) conds.push(gte(assignments.dueDate, sp.from));
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) conds.push(sql`${assignments.dueDate} <= ${sp.to}`);
  const [rows, rosters, termCount] = await Promise.all([
    db.select({
      id: assignments.id, title: assignments.title, dueDate: assignments.dueDate,
      classId: assignments.classId, subject: subjects.name, createdAt: assignments.createdAt,
    }).from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(and(...conds)).orderBy(desc(assignments.dueDate)).limit(200),
    db.select({ classId: students.classId, n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active")))
      .groupBy(students.classId),
    term
      ? db.select({ n: sql<number>`count(*)` }).from(assignments)
          .where(and(eq(assignments.schoolId, school.id),
            gte(assignments.dueDate, term.startsAt), sql`${assignments.dueDate} <= ${term.endsAt}`))
      : Promise.resolve([{ n: 0 }]),
  ]);
  const rosterN = new Map(rosters.map((r) => [r.classId, Number(r.n)]));
  const subCounts = rows.length
    ? await db.select({ assignmentId: submissions.assignmentId, n: sql<number>`count(*)` })
        .from(submissions).where(inArray(submissions.assignmentId, rows.map((r) => r.id)))
        .groupBy(submissions.assignmentId)
    : [];
  const nOf = new Map(subCounts.map((c) => [c.assignmentId, Number(c.n)]));

  const thisWeek = rows.filter((r) => r.dueDate >= weekStart);
  const activeClasses = clsOrdered.filter((c) => (rosterN.get(c.id) ?? 0) > 0);
  const classesQuietThisWeek = activeClasses.filter((c) => !thisWeek.some((r) => r.classId === c.id));
  // hand-in rate over homework already due (last 14 days) — how much comes back
  const recentDue = rows.filter((r) => r.dueDate <= today && r.dueDate >= new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10));
  const expected = recentDue.reduce((a, r) => a + (rosterN.get(r.classId) ?? 0), 0);
  const received = recentDue.reduce((a, r) => a + (nOf.get(r.id) ?? 0), 0);
  const rate = expected ? Math.round((received / expected) * 100) : null;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Homework"
        sub="What every class has been set — teachers assign, you see the whole picture" />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Set this term" value={String(Number(termCount[0]?.n ?? 0))} />
        <Stat label="Due this week" value={String(thisWeek.length)} />
        <Stat label="Classes with none this week" value={String(classesQuietThisWeek.length)}
          tone={classesQuietThisWeek.length > 0 ? "danger" : "success"} />
        <Stat label={cfg.recordSubmissions ? "Hand-in rate (14 days)" : "Hand-ins"}
          value={cfg.recordSubmissions ? (rate === null ? "—" : `${rate}%`) : "not tracked"}
          tone={rate !== null && rate < 70 ? "danger" : "default"} />
      </div>
      {classesQuietThisWeek.length > 0 && (
        <p className="mb-5 rounded-md bg-warning-soft px-3 py-2 text-[13.5px]">
          No homework due this week for: <b>{classesQuietThisWeek.map((c) => c.name).join(", ")}</b> —
          worth a word with their teachers if that&apos;s unexpected.
        </p>
      )}

      <form className="mb-5 flex flex-wrap items-end gap-2" method="get">
        <Field label="Subject">
          <select name="subject" defaultValue={sp.subject ?? ""} className={inputCls}>
            <option value="">All subjects</option>
            {allSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Due from"><input name="from" type="date" defaultValue={sp.from ?? ""} className={inputCls} /></Field>
        <Field label="Due to"><input name="to" type="date" defaultValue={sp.to ?? ""} className={inputCls} /></Field>
        <button className={btnGhostCls}>Filter</button>
        {(sp.subject || sp.from || sp.to) && (
          <Link href="/homework" className="pb-2.5 text-[13.5px] font-medium text-primary">clear</Link>
        )}
      </form>

      {clsOrdered.map((c) => {
        const classRows = rows.filter((r) => r.classId === c.id);
        if (!classRows.length) return null;
        return (
          <section key={c.id} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold">{c.name}
              <span className="ml-2 text-[13px] font-normal text-muted-foreground" data-nums="">
                {classRows.length} assignment{classRows.length === 1 ? "" : "s"}
              </span>
            </h2>
            <DataTable head={["Title", "Subject", "Due", cfg.recordSubmissions ? "Hand-ins" : ""]}>
              {classRows.slice(0, 8).map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">
                    <Link href={`/homework/${r.id}`} className="text-primary underline-offset-2 hover:underline">{r.title}</Link>
                  </Td>
                  <Td>{r.subject}</Td>
                  <Td>{r.dueDate}</Td>
                  <Td>{cfg.recordSubmissions ? `${nOf.get(r.id) ?? 0}/${rosterN.get(c.id) ?? 0}` : ""}</Td>
                </Tr>
              ))}
            </DataTable>
          </section>
        );
      })}
      {rows.length === 0 && <Empty title="Nothing matches" hint="Try widening the filters." />}

      <Card className="mt-2">
        <h2 className="font-semibold">What this school records</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Homework here is a record, not done in-app. Choose how much to track — marks
          recorded twice (books AND the app) can be a pain, so that&apos;s off unless you want it.
          Setting homework itself is the teachers&apos; job.
        </p>
        <form action={saveHomeworkConfig.bind(null, slug)} className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-[14px]">
            <input type="checkbox" name="recordSubmissions" defaultChecked={cfg.recordSubmissions} />
            Record hand-ins (parents see who submitted)
          </label>
          <label className="flex items-center gap-1.5 text-[14px]">
            <input type="checkbox" name="recordMarks" defaultChecked={cfg.recordMarks} />
            Also record marks &amp; feedback in-app
          </label>
          <SubmitButton className={btnCls} pendingText="Saving…">Save</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
