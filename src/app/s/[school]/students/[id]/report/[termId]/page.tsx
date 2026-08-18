import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { reportCards, students, classes, terms, academicYears } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { assertParentOf, getStudentSelf } from "@/core/portal";

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

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-black print:p-0">
      <div className="border-b-4 pb-4 text-center" style={{ borderColor: color }}>
        <h1 className="text-2xl font-bold" style={{ color }}>{school.name}</h1>
        {b.motto && <p className="text-sm italic">{b.motto}</p>}
        <p className="text-xs text-neutral-600">{[b.address, b.phone, b.email].filter(Boolean).join(" · ")}</p>
        <p className="mt-2 font-semibold uppercase tracking-wide">Terminal Report Card</p>
        <p className="text-sm">{y?.name} — {t?.name}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <p><span className="text-neutral-500">Student:</span> <b>{s?.firstName} {s?.lastName}</b></p>
        <p><span className="text-neutral-500">Class:</span> {cls?.name}</p>
        <p><span className="text-neutral-500">Admission No:</span> {s?.admissionNo}</p>
        <p><span className="text-neutral-500">Attendance:</span> {rc.data.attendance.present}/{rc.data.attendance.total} days</p>
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
            <th className="border px-2 py-1.5 text-left">Remark</th>
          </tr>
        </thead>
        <tbody>
          {rc.data.subjects.map((r) => (
            <tr key={r.name}>
              <td className="border px-2 py-1">{r.name}</td>
              <td className="border px-2 py-1 text-center">{r.ca}</td>
              <td className="border px-2 py-1 text-center">{r.exam}</td>
              <td className="border px-2 py-1 text-center font-semibold">{r.total}</td>
              <td className="border px-2 py-1 text-center">{r.grade}</td>
              <td className="border px-2 py-1">{r.remark}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        {(b.signatureLines?.length ? b.signatureLines : ["Class Teacher", "Head Teacher"]).map((l) => (
          <div key={l} className="border-t border-neutral-400 pt-1 text-center">{l}</div>
        ))}
      </div>
      <p className="mt-6 text-center text-[10px] text-neutral-400 print:hidden">
        Digital report card · use your browser&apos;s Print for a PDF copy
      </p>
    </div>
  );
}
