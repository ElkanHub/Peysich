import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { students, classes, academicYears, enrollments, rooms } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { Card, Field, PageHeader, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { enrollStudent } from "../actions";

/** ENROLL STUDENT — academic placement for a child who already exists in the
 *  directory (the other half of add ≠ enrol). Shows seats vs. room capacity. */
export default async function EnrollStudent({ params }: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school: slug, id } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s) notFound();

  const [years, cls, rms, counts, history] = await Promise.all([
    db.select().from(academicYears).where(eq(academicYears.schoolId, school.id))
      .orderBy(academicYears.startsAt),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(rooms).where(eq(rooms.schoolId, school.id)),
    db.select({ classId: students.classId, n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active")))
      .groupBy(students.classId),
    db.select().from(enrollments).where(eq(enrollments.studentId, id)),
  ]);
  const roomById = new Map(rms.map((r) => [r.id, r]));
  const countByClass = new Map(counts.map((c) => [c.classId, Number(c.n)]));
  const current = years.find((y) => y.isCurrent);
  const enrolledYears = new Set(history.map((h) => h.yearId));

  return (
    <div className="max-w-xl">
      <PageHeader title={`Enrol — ${s.firstName} ${s.lastName}`}
        sub={`${s.admissionNo} · place into a year and class. Enrolling a year again updates the placement.`} />
      <Card>
        <form action={enrollStudent.bind(null, slug, id)} className="grid grid-cols-2 gap-3">
          <Field label="Academic year">
            <select name="yearId" defaultValue={current?.id} required className={inputCls}>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}{y.isCurrent ? " (current)" : ""}{enrolledYears.has(y.id) ? " — already placed" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class (seats filled / room capacity)">
            <select name="classId" defaultValue={s.classId ?? ""} required className={inputCls}>
              <option value="" disabled>Choose a class</option>
              {cls.map((c) => {
                const cap = c.roomId ? roomById.get(c.roomId)?.capacity : null;
                const n = countByClass.get(c.id) ?? 0;
                return <option key={c.id} value={c.id}>{c.name} — {n}{cap ? ` / ${cap} seats` : " enrolled"}</option>;
              })}
            </select>
          </Field>
          <Field label="Enrolment type">
            <select name="enrollType" className={inputCls}>
              <option value="enrolled">New placement</option>
              <option value="promoted">Promoted</option>
              <option value="repeated">Repeating</option>
              <option value="transfer">Transfer in</option>
            </select>
          </Field>
          <Field label="Attendance">
            <label className="flex h-10 items-center gap-2 text-sm">
              <input type="checkbox" name="boarding" defaultChecked={s.boarding} /> Boarder
            </label>
          </Field>
          <div className="col-span-2 mt-1 flex items-center justify-between border-t border-border pt-4">
            <Link href={`/students/${id}`} className={btnGhostCls}>Cancel</Link>
            <button className={btnCls}>Enrol student</button>
          </div>
        </form>
      </Card>
      {history.length > 0 && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Existing placements: {history.map((h) => {
            const y = years.find((yy) => yy.id === h.yearId);
            const c = cls.find((cc) => cc.id === h.classId);
            return `${y?.name ?? "?"} → ${c?.name ?? "?"}`;
          }).join(" · ")}
        </p>
      )}
    </div>
  );
}
