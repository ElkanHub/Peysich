import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { classes, subjects, staff, lessons } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { addLesson, deleteLesson } from "./actions";
import { Card, Field, PageHeader, inputCls, btnCls } from "@/ui/kit";

const DAYS = ["mon", "tue", "wed", "thu", "fri"] as const;
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default async function Timetable({ params, searchParams }: {
  params: Promise<{ school: string }>; searchParams: Promise<{ c?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school, user } = await requireModule(slug, "timetable");
  const cls = await db.select().from(classes).where(eq(classes.schoolId, school.id));
  const active = cls.find((c) => c.id === sp.c) ?? cls[0];
  if (!active) return <p>Create classes first (Settings).</p>;
  const [subs, tchs, rows] = await Promise.all([
    db.select().from(subjects).where(eq(subjects.schoolId, school.id)),
    db.select().from(staff).where(and(eq(staff.schoolId, school.id), eq(staff.staffRole, "teacher"))),
    db.select({
      id: lessons.id, day: lessons.day, startMin: lessons.startMin, endMin: lessons.endMin,
      subject: subjects.name, teacher: staff.name,
    }).from(lessons)
      .leftJoin(subjects, eq(lessons.subjectId, subjects.id))
      .leftJoin(staff, eq(lessons.teacherId, staff.id))
      .where(and(eq(lessons.schoolId, school.id), eq(lessons.classId, active.id))),
  ]);
  const canEdit = ["admin", "platform_admin"].includes(user.role);

  return (
    <div>
      <PageHeader title="Timetable" sub={active.name} />
      <div className="mb-4 flex flex-wrap gap-2">
        {cls.map((c) => (
          <a key={c.id} href={`?c=${c.id}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${c.id === active.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
            {c.name}
          </a>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {DAYS.map((d) => (
          <Card key={d} className="p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{d}</p>
            <div className="mt-2 space-y-1.5">
              {rows.filter((r) => r.day === d).sort((a, b) => a.startMin - b.startMin).map((r) => (
                <div key={r.id} className="rounded-md bg-muted p-2 text-xs">
                  <p className="font-medium">{r.subject}</p>
                  <p className="text-muted-foreground">{fmt(r.startMin)}–{fmt(r.endMin)} · {r.teacher ?? "—"}</p>
                  {canEdit && (
                    <form action={deleteLesson.bind(null, slug, r.id)}>
                      <button className="mt-1 text-danger">remove</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {canEdit && (
        <Card className="mt-5 max-w-2xl">
          <h2 className="font-semibold">Add lesson</h2>
          <form action={addLesson.bind(null, slug, active.id)} className="mt-3 grid grid-cols-5 items-end gap-2">
            <Field label="Day">
              <select name="day" className={inputCls}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select>
            </Field>
            <Field label="Subject">
              <select name="subjectId" className={inputCls}>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </Field>
            <Field label="Teacher">
              <select name="teacherId" className={inputCls}>
                <option value="">—</option>
                {tchs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Start"><input name="start" type="time" defaultValue="08:00" required className={inputCls} /></Field>
            <Field label="End"><input name="end" type="time" defaultValue="09:00" required className={inputCls} /></Field>
            <button className={btnCls + " col-span-5"}>Add (clashes are rejected)</button>
          </form>
        </Card>
      )}
    </div>
  );
}
