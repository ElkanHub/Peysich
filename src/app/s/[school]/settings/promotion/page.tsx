import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { levels, classes, students } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { Card, Field, PageHeader, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { runPromotion } from "../promotion-actions";
import { SubmitButton } from "@/ui/feedback";

/** YEAR-END PROMOTION — mirrors what actually happens on the ground:
 *  each class is sent somewhere (next class, graduate, or stay), and the
 *  students who are repeating are ticked out of the list. One submit. */
export default async function Promotion({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const [lvs, cls, roster] = await Promise.all([
    db.select().from(levels).where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select({
      id: students.id, firstName: students.firstName, lastName: students.lastName,
      admissionNo: students.admissionNo, classId: students.classId,
    }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active")))
      .orderBy(students.lastName, students.firstName),
  ]);
  const levelOrder = new Map(lvs.map((l, i) => [l.id, i]));
  const ordered = [...cls].sort((a, b) =>
    (levelOrder.get(a.levelId) ?? 99) - (levelOrder.get(b.levelId) ?? 99) || a.name.localeCompare(b.name));
  const byClass = new Map<string, typeof roster>();
  for (const s of roster) {
    if (!s.classId) continue;
    if (!byClass.has(s.classId)) byClass.set(s.classId, []);
    byClass.get(s.classId)!.push(s);
  }
  // recommended destination: first class of the NEXT level; top level graduates
  const defaultTarget = (c: typeof cls[number]) => {
    const idx = levelOrder.get(c.levelId) ?? -1;
    const nextLevel = lvs[idx + 1];
    if (!nextLevel) return "graduate";
    return cls.find((x) => x.levelId === nextLevel.id)?.id ?? "stay";
  };
  const y = new Date().getFullYear();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Year-end promotion"
        sub="Choose where each class goes, untick nobody — tick only the students who will REPEAT their class." />
      <form action={runPromotion.bind(null, slug)} className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Field label="New academic year">
              <input name="yearName" placeholder={`${y}/${y + 1}`} className={inputCls + " w-44"} />
            </Field>
            <p className="max-w-sm text-[13px] text-muted-foreground">
              Submitting creates the new year, moves every class to its destination,
              keeps ticked students back as <em>repeated</em>, and graduates the top level to alumni.
              Students who are leaving should be <b>exited from their Student File first</b> —
              exited students are not carried into the new year.
            </p>
          </div>
        </Card>

        {ordered.map((c) => {
          const kids = byClass.get(c.id) ?? [];
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-[13px] text-muted-foreground">{kids.length} students</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">moves to</span>
                  <select name={`target_${c.id}`} defaultValue={defaultTarget(c)}
                    className="rounded-md border border-border px-2 py-1.5 text-sm">
                    {cls.filter((x) => x.id !== c.id).map((x) =>
                      <option key={x.id} value={x.id}>{x.name}</option>)}
                    <option value="graduate">🎓 Graduate (alumni)</option>
                    <option value="stay">No change (stay in {c.name})</option>
                  </select>
                </label>
              </div>
              {kids.length > 0 && (
                <details className="mt-3 border-t border-border pt-3">
                  <summary className="cursor-pointer text-[14px] font-medium text-primary">
                    Select students repeating in {c.name}
                  </summary>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {kids.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`repeat_${s.id}`} />
                        {s.lastName}, {s.firstName}
                        <span className="font-mono text-[12px] text-muted-foreground">{s.admissionNo}</span>
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </Card>
          );
        })}

        <div className="flex items-center justify-between">
          <Link href="/settings" className={btnGhostCls}>Keep everything as it is</Link>
          <SubmitButton className={btnCls + " bg-danger"} pendingText="Promoting…">Run promotion</SubmitButton>
        </div>
      </form>
    </div>
  );
}
