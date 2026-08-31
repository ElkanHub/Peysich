import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { reportCards, students, classes, terms, academicYears } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { assertParentOf, getStudentSelf } from "@/core/portal";
import { getReportConfig } from "@/modules/assessment/report-config";
import { getDocSign } from "@/core/doc-sign";
import { SignLine } from "@/ui/paper-sign";
import { r2Enabled, presignDownload } from "@/lib/r2";

/** School-branded digital report card — print-optimized (browser print → PDF).
 *  Server PDF→R2 pipeline swaps in at deploy without changing this template. */
export default async function ReportCard({ params }: {
  params: Promise<{ school: string; id: string; termId: string }>;
}) {
  const { school: slug, id, termId } = await params;
  const { school, user } = await requireSchool(slug);
  const [rc] = await db.select().from(reportCards).where(and(
    eq(reportCards.studentId, id), eq(reportCards.termId, termId),
    eq(reportCards.schoolId, school.id)));
  if (!rc || (!rc.published && !["admin", "platform_admin"].includes(user.role))) notFound();
  if (user.role === "parent" && !(await assertParentOf(school.id, user.id, id))) notFound();
  if (user.role === "student" && (await getStudentSelf(school.id, user.id))?.id !== id) notFound();
  const [s] = await db.select().from(students).where(eq(students.id, id));
  const [cls] = s?.classId ? await db.select().from(classes).where(eq(classes.id, s.classId)) : [null];
  const [t] = await db.select().from(terms).where(eq(terms.id, termId));
  const [y] = t ? await db.select().from(academicYears).where(eq(academicYears.id, t.yearId)) : [null];
  const b = school.branding;
  const color = b.primaryColor || "#5E1D3E";

  const cfg = getReportConfig(school.settings);
  const photoUrl = cfg.studentPhoto && s?.photoUrl && r2Enabled
    ? await presignDownload(s.photoUrl) : null;
  const logoUrl = cfg.logo && b.logoUrl && r2Enabled
    ? await presignDownload(b.logoUrl) : null;
  const ds = cfg.signatures ? await getDocSign(school) : null;
  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-black print:p-0">
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
        <p className="mt-2 font-semibold uppercase tracking-wide">Terminal Report Card</p>
        <p className="text-sm">{y?.name} — {t?.name}</p>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="absolute right-0 top-0 h-20 w-20 rounded border border-neutral-300 object-cover" />
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <p><span className="text-neutral-500">Student:</span> <b>{s?.firstName} {s?.lastName}</b></p>
        <p><span className="text-neutral-500">Class:</span> {cls?.name}</p>
        <p><span className="text-neutral-500">Admission No:</span> {s?.admissionNo}</p>
        {cfg.attendance && (
          <p><span className="text-neutral-500">Attendance:</span> {rc.data.attendance.present}/{rc.data.attendance.total} days</p>
        )}
      </div>
      {rc.data.skills && rc.data.skills.length > 0 && (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: color, color: "white" }}>
              <th className="border px-2 py-1.5 text-left">Learning Area</th>
              <th className="border px-2 py-1.5 text-left">Progress</th>
            </tr>
          </thead>
          <tbody>
            {rc.data.skills.map((r) => (
              <tr key={r.domain}>
                <td className="border px-2 py-1">{r.domain}</td>
                <td className="border px-2 py-1 capitalize">{r.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rc.data.subjects.length > 0 && (
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr style={{ background: color, color: "white" }}>
            <th className="border px-2 py-1.5 text-left">Subject</th>
            <th className="border px-2 py-1.5">Class Score</th>
            <th className="border px-2 py-1.5">Exam Score</th>
            <th className="border px-2 py-1.5">Total</th>
            <th className="border px-2 py-1.5">Grade</th>
            {cfg.gradeRemarks && <th className="border px-2 py-1.5 text-left">Remark</th>}
          </tr>
        </thead>
        <tbody>
          {rc.data.subjects.map((r) => (
            <tr key={r.name}>
              <td className="border px-2 py-1">{r.name}</td>
              {/* an empty subject stays on the paper as a blank row — never dropped */}
              <td className="border px-2 py-1 text-center">{r.empty ? "" : r.ca}</td>
              <td className="border px-2 py-1 text-center">{r.empty ? "" : r.exam}</td>
              <td className="border px-2 py-1 text-center font-semibold">{r.empty ? "" : r.total}</td>
              <td className="border px-2 py-1 text-center">{r.empty ? "" : r.grade}</td>
              {cfg.gradeRemarks && <td className="border px-2 py-1">{r.empty ? "" : r.remark}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      )}
      {cfg.signatures && (
        <div className="relative mt-6 grid grid-cols-2 items-end gap-8 text-sm">
          {ds?.stampUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ds.stampUrl} alt="" data-stamp=""
              className="absolute bottom-4 left-1/2 h-16 -translate-x-1/2 object-contain opacity-90" />
          )}
          {(b.signatureLines?.length ? b.signatureLines : ["Class Teacher", "Head Teacher"]).map((l) =>
            /head/i.test(l)
              ? <SignLine key={l} label={l} sigUrl={ds?.headSigUrl} name={ds?.headName} />
              : <SignLine key={l} label={l} />)}
        </div>
      )}
      <p className="mt-6 text-center text-[11px] text-neutral-400 print:hidden">
        Digital report card · use your browser&apos;s Print for a PDF copy
      </p>
    </div>
  );
}
