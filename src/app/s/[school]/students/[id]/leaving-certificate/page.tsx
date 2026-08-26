import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  students, classes, enrollments, academicYears, feeInvoices, attendanceRecords,
} from "@/db/schema";
import { requireSchool } from "@/core/school-context";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const REASON_LABEL: Record<string, string> = {
  transferred: "Transferred to another school",
  withdrawn: "Withdrawn by family",
  completed: "Completed schooling",
  expelled: "Dismissed by the school",
  other: "Other",
};

/** SCHOOL LEAVING CERTIFICATE + final statement — school-branded, printable
 *  (browser print → PDF), generated from the historical record on the file. */
export default async function LeavingCertificate({ params }: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school: slug, id } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s || !s.exitReason) notFound(); // only exists once an exit is recorded

  const [history, [fees], [att], [lastCls]] = await Promise.all([
    db.select({ year: academicYears.name, className: classes.name, status: enrollments.status })
      .from(enrollments)
      .innerJoin(academicYears, eq(enrollments.yearId, academicYears.id))
      .innerJoin(classes, eq(enrollments.classId, classes.id))
      .where(eq(enrollments.studentId, id)).orderBy(academicYears.startsAt),
    db.select({
      billed: sql<number>`coalesce(sum(total_pesewas), 0)`,
      paid: sql<number>`coalesce(sum(paid_pesewas), 0)`,
    }).from(feeInvoices).where(and(
      eq(feeInvoices.schoolId, school.id), eq(feeInvoices.studentId, id))),
    db.select({
      present: sql<number>`count(*) filter (where status != 'absent')`,
      total: sql<number>`count(*)`,
    }).from(attendanceRecords).where(eq(attendanceRecords.studentId, id)),
    s.classId ? db.select().from(classes).where(eq(classes.id, s.classId)) : Promise.resolve([null]),
  ]);
  const b = school.branding;
  const color = b.primaryColor || "#5E1D3E";
  const balance = Number(fees.billed) - Number(fees.paid);
  const admitted = s.admittedOn ?? s.createdAt.toISOString().slice(0, 10);

  // fee clearance gate — in "block" mode the certificate waits for a clear ledger
  const { getFeesConfig } = await import("@/modules/fees/config");
  const { studentBalance } = await import("@/modules/fees/engine");
  const gate = getFeesConfig(school.settings).clearanceGate;
  const ledgerBal = gate === "off" ? 0 : await studentBalance(school.id, id);
  if (gate === "block" && ledgerBal > 0) {
    const { Card } = await import("@/ui/kit");
    return (
      <div className="mx-auto max-w-md pt-8">
        <Card>
          <h1 className="text-lg font-semibold">Certificate held — fees outstanding</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {s.firstName} {s.lastName} still owes{" "}
            <b className="text-danger">GHS {(ledgerBal / 100).toFixed(2)}</b>. This school issues
            leaving certificates only once fees are cleared or formally waived — record the payment
            or a waiver adjustment on the student file, then return here.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-black print:p-0">
      <div className="border-b-4 pb-4 text-center" style={{ borderColor: color }}>
        <h1 className="text-2xl font-bold" style={{ color }}>{school.name}</h1>
        {b.motto && <p className="text-sm italic">{b.motto}</p>}
        <p className="text-xs text-neutral-600">{[b.address, b.phone, b.email].filter(Boolean).join(" · ")}</p>
        <p className="mt-3 font-semibold uppercase tracking-widest">School Leaving Certificate</p>
      </div>

      <p className="mt-6 text-sm leading-relaxed">
        This is to certify that <b>{s.firstName} {s.otherNames ? `${s.otherNames} ` : ""}{s.lastName}</b>
        {" "}(admission no. <b>{s.admissionNo}</b>{s.idNumber ? `, ID ${s.idNumber}` : ""}) was a student of this
        school from <b>{admitted}</b> to <b>{s.exitDate}</b>, last enrolled in{" "}
        <b>{lastCls?.name ?? "—"}</b>.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
        <p><span className="text-neutral-500">Date of birth:</span> {s.dob ?? "—"}</p>
        <p><span className="text-neutral-500">Sex:</span> <span className="capitalize">{s.sex}</span></p>
        <p><span className="text-neutral-500">Reason for leaving:</span> {REASON_LABEL[s.exitReason] ?? s.exitReason}</p>
        <p><span className="text-neutral-500">Transferring to:</span> {s.exitDestination ?? "—"}</p>
        <p><span className="text-neutral-500">Overall attendance:</span> {Number(att.total) ? `${att.present}/${att.total} days` : "—"}</p>
        <p><span className="text-neutral-500">Attendance type:</span> {s.boarding ? "Boarder" : "Day student"}</p>
      </div>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr style={{ background: color, color: "white" }}>
            <th className="border px-2 py-1.5 text-left">Academic year</th>
            <th className="border px-2 py-1.5 text-left">Class</th>
            <th className="border px-2 py-1.5 text-left">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h, i) => (
            <tr key={i}>
              <td className="border px-2 py-1">{h.year}</td>
              <td className="border px-2 py-1">{h.className}</td>
              <td className="border px-2 py-1 capitalize">{h.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 rounded border p-3 text-sm">
        <p className="font-semibold" style={{ color }}>Final statement of account</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <p><span className="text-neutral-500">Total billed:</span> {ghs(Number(fees.billed))}</p>
          <p><span className="text-neutral-500">Total paid:</span> {ghs(Number(fees.paid))}</p>
          <p><span className="text-neutral-500">Balance:</span>{" "}
            <b>{balance <= 0 ? "Nil — cleared" : ghs(balance)}</b></p>
        </div>
      </div>

      {s.exitNote && <p className="mt-4 text-sm"><span className="text-neutral-500">Remarks:</span> {s.exitNote}</p>}

      <div className="mt-12 grid grid-cols-2 gap-10 text-center text-sm">
        <div><div className="border-t border-neutral-400 pt-1">Head Teacher — signature & stamp</div></div>
        <div><div className="border-t border-neutral-400 pt-1">Date issued</div></div>
      </div>

      <p className="mt-8 text-center text-[11px] text-neutral-400 print:hidden">
        School leaving certificate · use your browser&apos;s Print for a PDF copy
      </p>
    </div>
  );
}
