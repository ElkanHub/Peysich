import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  students, classes, terms, academicYears, componentScores, scoreSheets,
  scorePublications, gradingSchemes, skillRatings, skillDomains,
} from "@/db/schema";
import { requireSchool, getTeacherScope } from "@/core/school-context";
import { assertParentOf, getStudentSelf } from "@/core/portal";
import { getStructure } from "@/core/academics";
import { getReportConfig } from "@/modules/assessment/report-config";
import { r2Enabled, presignDownload } from "@/lib/r2";

const DEFAULT_BANDS = [
  { min: 80, grade: "1", remark: "Excellent" }, { min: 70, grade: "2", remark: "Very Good" },
  { min: 60, grade: "3", remark: "Good" }, { min: 55, grade: "4", remark: "Credit" },
  { min: 50, grade: "5", remark: "Average" }, { min: 40, grade: "6", remark: "Below Average" },
  { min: 35, grade: "7", remark: "Pass" }, { min: 30, grade: "8", remark: "Weak Pass" },
  { min: 0, grade: "9", remark: "Fail" },
];

/** A child's performance for one term, laid out like it would be on paper —
 *  formal, print-ready. Families see only what the school has published;
 *  staff see everything with draft columns marked. */
export default async function PerformanceSheet({ params }: {
  params: Promise<{ school: string; id: string; termId: string }>;
}) {
  const { school: slug, id, termId } = await params;
  const { school, user } = await requireSchool(slug);

  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s) notFound();

  const famView = user.role === "parent" || user.role === "student";
  if (user.role === "parent" && !(await assertParentOf(school.id, user.id, id))) notFound();
  if (user.role === "student" && (await getStudentSelf(school.id, user.id))?.id !== id) notFound();
  if (user.role === "teacher") {
    const scope = await getTeacherScope(school.id, user.id);
    if (!s.classId || !scope?.allClassIds.has(s.classId)) notFound();
  }

  const [t] = await db.select().from(terms).where(eq(terms.id, termId));
  if (!t) notFound();
  const [y] = await db.select().from(academicYears).where(eq(academicYears.id, t.yearId));
  const S = await getStructure(school.id);
  const cls = s.classId ? S.classById.get(s.classId) : null;
  const preschool = cls ? !!S.levelById.get(cls.levelId)?.preschool : false;

  const [marks, sheets, pubs, [scheme]] = await Promise.all([
    db.select().from(componentScores).where(and(
      eq(componentScores.studentId, id), eq(componentScores.termId, termId))),
    db.select().from(scoreSheets).where(and(
      eq(scoreSheets.schoolId, school.id), eq(scoreSheets.termId, termId))),
    db.select().from(scorePublications).where(and(
      eq(scorePublications.schoolId, school.id), eq(scorePublications.termId, termId))),
    db.select().from(gradingSchemes).where(eq(gradingSchemes.schoolId, school.id)),
  ]);
  const bands = scheme?.bands ?? DEFAULT_BANDS;
  const published = new Set(pubs.map((p) => p.componentId));
  const pubAt = new Map(pubs.map((p) => [p.componentId, p.publishedAt]));

  const b = school.branding;
  const color = b.primaryColor || "#5E1D3E";

  // preschool: the skills picture instead of a marks table
  let skillRows: { domain: string; rating: string }[] = [];
  if (preschool) {
    const [rs, doms] = await Promise.all([
      db.select().from(skillRatings).where(and(
        eq(skillRatings.studentId, id), eq(skillRatings.termId, termId))),
      db.select().from(skillDomains).where(eq(skillDomains.schoolId, school.id)),
    ]);
    const dname = new Map(doms.map((d) => [d.id, d.name]));
    skillRows = rs.map((r) => ({ domain: dname.get(r.domainId) ?? "", rating: r.rating }));
    if (famView) {
      // families see the skills record only once the school RELEASES it
      const { reportCards } = await import("@/db/schema");
      const [rc] = await db.select({ id: reportCards.id }).from(reportCards).where(and(
        eq(reportCards.studentId, id), eq(reportCards.termId, termId),
        eq(reportCards.published, true)));
      if (!rc) notFound();
    }
  }

  const section = cls ? S.sectionOfClass(cls) : "primary";
  const allComps = S.componentsFor(section);
  const comps = famView ? allComps.filter((c) => published.has(c.id)) : allComps;
  if (!preschool && famView && comps.length === 0) notFound(); // nothing published yet

  const outOfBy = new Map(sheets.map((sh) => [`${sh.subjectId}:${sh.componentId}`, sh.outOf]));
  const cellMap = new Map(marks.map((m) => [`${m.subjectId}:${m.componentId}`, m]));
  const subjectIds = cls ? S.effectiveSubjectIds(cls.id) : [];
  const rows = subjectIds
    .map((sid2) => {
      const cells = comps.map((c) => {
        const m = cellMap.get(`${sid2}:${c.id}`);
        if (!m) return null;
        if (m.absent) return { display: "–", value: 0 }; // did not write
        const outOf = outOfBy.get(`${sid2}:${c.id}`) ?? 100;
        const v = Math.round((m.raw / outOf) * c.weight * 10) / 10;
        return { display: String(v), value: v };
      });
      // a subject's total forms only once every column is in
      const complete = comps.length > 0 && cells.every((v) => v !== null);
      const total = complete
        ? Math.round(cells.reduce<number>((a, v) => a + (v?.value ?? 0), 0) * 10) / 10 : null;
      const hasAny = cells.some((v) => v !== null);
      const band = total !== null ? (bands.find((bd) => total >= bd.min) ?? bands.at(-1)!) : null;
      return { name: S.subjectById.get(sid2)?.name ?? "", cells, total, hasAny, band };
    })
    // every subject the class studies stays on the paper — empty rows are
    // honest (nothing entered yet), never silently dropped
    .sort((a, b2) => a.name.localeCompare(b2.name));
  const fullScheme = comps.length === allComps.length;

  const cfg = getReportConfig(school.settings);
  const photoUrl = cfg.studentPhoto && s.photoUrl && r2Enabled
    ? await presignDownload(s.photoUrl) : null;
  const logoUrl = cfg.logo && b.logoUrl && r2Enabled
    ? await presignDownload(b.logoUrl) : null;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <div className="relative border-b-4 pb-4 text-center" style={{ borderColor: color }}>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="absolute left-0 top-0 h-16 w-16 object-contain" />
        )}
        {cfg.schoolName && <h1 className="text-2xl font-bold" style={{ color }}>{school.name}</h1>}
        {cfg.motto && b.motto && <p className="text-sm italic">{b.motto}</p>}
        {cfg.addressLine && (
          <p className="text-xs text-neutral-600">{[b.address, b.phone, b.email].filter(Boolean).join(" · ")}</p>
        )}
        <p className="mt-2 font-semibold uppercase tracking-wide">
          {preschool ? "Learning & Development Record" : "Academic Performance Record"}
        </p>
        <p className="text-sm">{y?.name} — {t.name}</p>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="absolute right-0 top-0 h-20 w-20 rounded border border-neutral-300 object-cover" />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <p><span className="text-neutral-500">Student:</span> <b>{s.firstName} {s.lastName}</b></p>
        <p><span className="text-neutral-500">Class:</span> {cls?.name ?? "—"}</p>
        <p><span className="text-neutral-500">Admission No:</span> {s.admissionNo ?? "—"}</p>
        <p><span className="text-neutral-500">Issued:</span> {new Date().toLocaleDateString("en-GB")}</p>
      </div>

      {preschool ? (
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-neutral-400 px-3 py-1.5 text-left" style={{ background: `${color}12` }}>Area of learning</th>
              <th className="border border-neutral-400 px-3 py-1.5 text-left" style={{ background: `${color}12` }}>Rating</th>
            </tr>
          </thead>
          <tbody>
            {skillRows.map((r, i) => (
              <tr key={i}>
                <td className="border border-neutral-400 px-3 py-1.5">{r.domain}</td>
                <td className="border border-neutral-400 px-3 py-1.5 capitalize">{r.rating}</td>
              </tr>
            ))}
            {skillRows.length === 0 && (
              <tr><td colSpan={2} className="border border-neutral-400 px-3 py-2 text-neutral-500">No ratings recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      ) : (
        <>
          <table className="mt-5 w-full border-collapse text-sm" data-nums="">
            <thead>
              <tr>
                <th className="border border-neutral-400 px-2 py-1.5 text-left" style={{ background: `${color}12` }}>Subject</th>
                {comps.map((c) => (
                  <th key={c.id} className="border border-neutral-400 px-2 py-1.5 text-center" style={{ background: `${color}12` }}>
                    {c.name}<br /><span className="font-normal text-neutral-500">/{c.weight}</span>
                    {!famView && !published.has(c.id) && !c.isExam && (
                      <span className="block text-[10px] font-normal text-neutral-400">(not published)</span>
                    )}
                  </th>
                ))}
                <th className="border border-neutral-400 px-2 py-1.5 text-center" style={{ background: `${color}12` }}>
                  {fullScheme ? "Total /100" : "Total so far"}
                </th>
                {fullScheme && <th className="border border-neutral-400 px-2 py-1.5 text-center" style={{ background: `${color}12` }}>Grade</th>}
                {fullScheme && cfg.gradeRemarks && <th className="border border-neutral-400 px-2 py-1.5 text-center" style={{ background: `${color}12` }}>Remark</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="border border-neutral-400 px-2 py-1.5 font-medium">{r.name}</td>
                  {r.cells.map((v, j) => (
                    <td key={j} className="border border-neutral-400 px-2 py-1.5 text-center">{v ? v.display : ""}</td>
                  ))}
                  <td className="border border-neutral-400 px-2 py-1.5 text-center font-semibold">{r.total ?? ""}</td>
                  {fullScheme && <td className="border border-neutral-400 px-2 py-1.5 text-center">{r.band?.grade ?? ""}</td>}
                  {fullScheme && cfg.gradeRemarks && <td className="border border-neutral-400 px-2 py-1.5 text-center">{r.band?.remark ?? ""}</td>}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={comps.length + 4} className="border border-neutral-400 px-3 py-2 text-neutral-500">
                  No subjects configured for this class yet.
                </td></tr>
              )}
            </tbody>
          </table>
          {!fullScheme && (
            <p className="mt-2 text-xs text-neutral-500">
              Interim record — {comps.length} of {allComps.length} assessments released so far. Grades appear on the terminal report.
            </p>
          )}
        </>
      )}

      {cfg.signatures && (
        <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div className="border-t border-neutral-400 pt-1 text-center text-neutral-600">Class Teacher</div>
          <div className="border-t border-neutral-400 pt-1 text-center text-neutral-600">Head Teacher</div>
        </div>
      )}
      {(b.signatureLines ?? []).map((l, i) => (
        <p key={i} className="mt-2 text-center text-xs text-neutral-500">{l}</p>
      ))}
      <p className="mt-6 text-center text-[10px] text-neutral-400 print:hidden">
        Use your browser&apos;s print for a paper copy.
        {comps.length > 0 && pubAt.size > 0 && " Published records only."}
      </p>
    </div>
  );
}
