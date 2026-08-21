import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { componentScores, scoreSheets, scorePublications, gradingSchemes } from "@/db/schema";
import { getStructure } from "@/core/academics";

export const DEFAULT_BANDS = [
  { min: 80, grade: "1", remark: "Excellent" }, { min: 70, grade: "2", remark: "Very Good" },
  { min: 60, grade: "3", remark: "Good" }, { min: 55, grade: "4", remark: "Credit" },
  { min: 50, grade: "5", remark: "Average" }, { min: 40, grade: "6", remark: "Below Average" },
  { min: 35, grade: "7", remark: "Pass" }, { min: 30, grade: "8", remark: "Weak Pass" },
  { min: 0, grade: "9", remark: "Fail" },
];

/** One student's whole record for a term: rows = their subjects, columns =
 *  the configured tests + exam, converted to weights. Totals appear only when
 *  a subject's every column is in (a “–” counts as entered, worth 0).
 *  publishedOnly trims the columns to what families may see. */
export async function PerformanceTable({ schoolId, studentId, classId, termId, publishedOnly }: {
  schoolId: string; studentId: string; classId: string; termId: string; publishedOnly?: boolean;
}) {
  const S = await getStructure(schoolId);
  const cls = S.classById.get(classId);
  if (!cls) return <p className="text-sm text-muted-foreground">No class on record.</p>;
  const allComps = S.componentsFor(S.sectionOfClass(cls));

  const [marks, sheets, pubs, [scheme]] = await Promise.all([
    db.select().from(componentScores).where(and(
      eq(componentScores.studentId, studentId), eq(componentScores.termId, termId))),
    db.select().from(scoreSheets).where(and(
      eq(scoreSheets.schoolId, schoolId), eq(scoreSheets.termId, termId),
      eq(scoreSheets.classId, classId))),
    db.select().from(scorePublications).where(and(
      eq(scorePublications.schoolId, schoolId), eq(scorePublications.termId, termId))),
    db.select().from(gradingSchemes).where(eq(gradingSchemes.schoolId, schoolId)),
  ]);
  const published = new Set(pubs.map((p) => p.componentId));
  const comps = publishedOnly ? allComps.filter((c) => published.has(c.id)) : allComps;
  const bands = scheme?.bands ?? DEFAULT_BANDS;
  const outOfBy = new Map(sheets.map((sh) => [`${sh.subjectId}:${sh.componentId}`, sh.outOf]));
  const cellBy = new Map(marks.map((m) => [`${m.subjectId}:${m.componentId}`, m]));

  const rows = S.effectiveSubjectIds(classId).map((sid) => {
    const cells = comps.map((c) => {
      const m = cellBy.get(`${sid}:${c.id}`);
      if (!m) return null;
      if (m.absent) return { display: "–", value: 0 };
      const outOf = outOfBy.get(`${sid}:${c.id}`) ?? 100;
      const v = Math.round((m.raw / outOf) * c.weight * 10) / 10;
      return { display: String(v), value: v };
    });
    const complete = comps.length > 0 && cells.every((c) => c !== null);
    const total = complete
      ? Math.round(cells.reduce((a, c) => a + (c?.value ?? 0), 0) * 10) / 10 : null;
    const band = total !== null ? (bands.find((b) => total >= b.min) ?? bands.at(-1)!) : null;
    return { name: S.subjectById.get(sid)?.name ?? "", cells, total, band };
    // every subject the class studies stays on the record — an empty row is
    // honest information (nothing entered yet), never silently dropped
  }).sort((a, b) => a.name.localeCompare(b.name));

  if (comps.length === 0)
    return <p className="text-sm text-muted-foreground">Nothing released yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" data-nums="">
        <thead>
          <tr className="border-b border-border text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
            <th className="py-1.5 pr-2">Subject</th>
            {comps.map((c) => (
              <th key={c.id} className="px-2 py-1.5 text-center">
                {c.name} <span className="font-normal">/{c.weight}</span>
                {!publishedOnly && !published.has(c.id) && !c.isExam && (
                  <span className="block text-[9.5px] font-normal normal-case text-faint">not published</span>
                )}
              </th>
            ))}
            <th className="px-2 py-1.5 text-center">Total</th>
            <th className="px-2 py-1.5 text-center">Grade</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-1.5 pr-2 font-medium">{r.name}</td>
              {r.cells.map((c, j) => (
                <td key={j} className="px-2 py-1.5 text-center">
                  {c === null ? <span className="text-faint" title="Nothing entered yet"></span> : c.display}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center font-semibold">
                {r.total !== null ? r.total : <span className="font-normal text-faint">· · ·</span>}
              </td>
              <td className="px-2 py-1.5 text-center">{r.band ? r.band.grade : <span className="text-faint">·</span>}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={comps.length + 3} className="py-2 text-muted-foreground">No marks recorded yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
