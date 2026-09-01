import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applicants, levels, classes, students } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { getIntakeConfig } from "@/modules/admissions/config";
import { Card, Field, PageHeader, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { saveIntakeSettings, addIntakeDoc, removeIntakeDoc } from "../actions";

/** Intake settings — seats, requirements, season. Configured once a year;
 *  seats make "seats left" real on the desk and in analytics. */
export default async function IntakeSetup({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  const cfg = getIntakeConfig(school.settings);
  const [lvs, cls, roster, apps] = await Promise.all([
    db.select().from(levels).where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select({ id: students.id, classId: students.classId }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
    db.select({ levelId: applicants.levelId, status: applicants.status }).from(applicants)
      .where(eq(applicants.schoolId, school.id)),
  ]);
  const classLevel = new Map(cls.map((c) => [c.id, c.levelId]));
  const enrolled = new Map<string, number>();
  for (const s of roster) {
    const lid = s.classId ? classLevel.get(s.classId) : null;
    if (lid) enrolled.set(lid, (enrolled.get(lid) ?? 0) + 1);
  }
  const applying = new Map<string, number>();
  for (const a of apps) {
    if (["waitlist", "rejected", "admitted"].includes(a.status)) continue;
    applying.set(a.levelId, (applying.get(a.levelId) ?? 0) + 1);
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Intake settings" sub="Seats, documents and the application season — once a year" />
      <p className="-mt-3 mb-4">
        <Link href="/admissions" className="text-[13.5px] font-medium text-primary">← Admissions desk</Link>
      </p>

      <form action={saveIntakeSettings.bind(null, slug)}>
        <Card className="mb-4">
          <h2 className="font-semibold">Seats per level</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Leave a level blank if you don&apos;t cap it. &quot;Left&quot; = capacity − currently enrolled.
          </p>
          <div className="overflow-x-auto"><table className="min-w-[460px] mt-3 w-full text-sm" data-nums="">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-1">Level</th><th className="text-right">Enrolled</th>
              <th className="text-right">Capacity</th><th className="text-right">Applying</th>
              <th className="text-right">Left</th></tr></thead>
            <tbody>
              {lvs.map((l) => {
                const cap = cfg.seats[l.id];
                const enr = enrolled.get(l.id) ?? 0;
                const left = cap ? cap - enr : null;
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className="py-1.5 font-medium">{l.name}</td>
                    <td className="text-right">{enr}</td>
                    <td className="text-right">
                      <input name={`seat_${l.id}`} type="number" min={1} defaultValue={cap ?? ""}
                        className="w-20 rounded-md border border-border bg-card px-2 py-1 text-right text-sm outline-none focus:border-primary" />
                    </td>
                    <td className="text-right">{applying.get(l.id) ?? 0}</td>
                    <td className="text-right">
                      {left === null ? <span className="text-faint">—</span>
                        : <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${left <= 2
                            ? "bg-warning-soft text-warning" : "bg-success/10 text-success"}`}>{Math.max(0, left)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </Card>

        <Card className="mb-4">
          <h2 className="font-semibold">Application season</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="open" defaultChecked={cfg.open} className="h-4 w-4 accent-[var(--primary)]" />
              Accepting applications
            </label>
            <Field label="Applications close (optional)">
              <input name="closesOn" type="date" defaultValue={cfg.closesOn} className={inputCls} />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="testRequired" defaultChecked={cfg.testRequired} className="h-4 w-4 accent-[var(--primary)]" />
              Entrance test
            </label>
            <Field label="Test is out of">
              <input name="testMax" type="number" min={1} defaultValue={cfg.testMax} className={inputCls} />
            </Field>
            <Field label="Cut-off (advisory)">
              <input name="testCutoff" type="number" min={0} defaultValue={cfg.testCutoff} className={inputCls} />
            </Field>
          </div>
          <SubmitButton className={btnCls + " mt-4"} pendingText="Saving…">Save intake settings</SubmitButton>
        </Card>
      </form>

      <Card>
        <h2 className="font-semibold">Documents to collect</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          This checklist appears on every applicant file; unfinished ones show a &quot;docs missing&quot; chip on the desk.
        </p>
        <ul className="mt-2 divide-y divide-border text-[13.5px]">
          {cfg.docs.map((d) => (
            <li key={d.key} className="flex items-center justify-between py-1.5">
              <span>{d.label} <span className="text-[11.5px] text-faint">· {d.note}</span></span>
              <form action={removeIntakeDoc.bind(null, slug, d.key)}>
                <SubmitButton className="text-[12px] font-medium text-danger hover:underline" pendingText="…">
                  remove
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
        <form action={addIntakeDoc.bind(null, slug)} className="mt-3 flex flex-wrap gap-2">
          <input name="label" placeholder="Document name" required className={inputCls + " flex-1"} />
          <input name="note" placeholder="Applies to (e.g. all levels)" className={inputCls + " w-44"} />
          <SubmitButton className={btnGhostCls} pendingText="…">+ Add</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
