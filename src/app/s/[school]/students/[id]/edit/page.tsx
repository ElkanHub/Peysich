import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { students, classes } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { Card, Field, PageHeader, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { PhotoUploader } from "../uploaders";
import { updateStudent } from "../actions";

/** Edit the Student File — every field the office keeps on a child, grouped
 *  the same way the file displays them. Save returns to the file. */
export default async function EditStudent({ params, searchParams }: {
  params: Promise<{ school: string; id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { school: slug, id } = await params;
  const { err } = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s) notFound();
  const cls = await db.select().from(classes).where(eq(classes.schoolId, school.id));
  const photoUrl = s.photoUrl && r2Enabled ? await presignDownload(s.photoUrl) : null;

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit — ${s.firstName} ${s.lastName}`} sub={`Student file · ${s.admissionNo}`} />
      {err === "admno" && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          That admission number is already taken by another student — nothing was saved.
        </p>
      )}
      <Card className="mb-5">
        <h2 className="font-semibold">Profile photo</h2>
        <div className="mt-3"><PhotoUploader slug={slug} studentId={id} enabled={r2Enabled} currentUrl={photoUrl} initials={`${s.firstName[0]}${s.lastName[0]}`} /></div>
      </Card>
      <form action={updateStudent.bind(null, slug, id)} className="space-y-5">
        <Card>
          <h2 className="font-semibold">Identity</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="First name"><input name="firstName" required defaultValue={s.firstName} className={inputCls} /></Field>
            <Field label="Last name"><input name="lastName" required defaultValue={s.lastName} className={inputCls} /></Field>
            <Field label="Other names"><input name="otherNames" defaultValue={s.otherNames ?? ""} className={inputCls} /></Field>
            <Field label="Sex">
              <select name="sex" defaultValue={s.sex} className={inputCls}>
                <option value="male">Male</option><option value="female">Female</option>
              </select>
            </Field>
            <Field label="Date of birth"><input name="dob" type="date" defaultValue={s.dob ?? ""} className={inputCls} /></Field>
            <Field label="Class">
              <select name="classId" defaultValue={s.classId ?? ""} className={inputCls}>
                <option value="">No class</option>
                {cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Admission number"><input name="admissionNo" defaultValue={s.admissionNo} className={inputCls} /></Field>
            <Field label="National ID / birth cert no"><input name="idNumber" defaultValue={s.idNumber ?? ""} className={inputCls} /></Field>
            <Field label="Admission date"><input name="admittedOn" type="date" defaultValue={s.admittedOn ?? ""} className={inputCls} /></Field>
            <Field label="Attendance type">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="boarding" defaultChecked={s.boarding} /> Boarder (unticked = day student)
              </label>
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Background</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Place of birth"><input name="placeOfBirth" defaultValue={s.placeOfBirth ?? ""} className={inputCls} /></Field>
            <Field label="Nationality"><input name="nationality" defaultValue={s.nationality ?? ""} placeholder="Ghanaian" className={inputCls} /></Field>
            <Field label="Hometown"><input name="hometown" defaultValue={s.hometown ?? ""} className={inputCls} /></Field>
            <Field label="Religion"><input name="religion" defaultValue={s.religion ?? ""} className={inputCls} /></Field>
            <Field label="Residential address"><input name="address" defaultValue={s.address ?? ""} className={inputCls} /></Field>
            <Field label="Previous school"><input name="previousSchool" defaultValue={s.previousSchool ?? ""} className={inputCls} /></Field>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Health & emergency</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Blood group">
              <select name="bloodGroup" defaultValue={s.bloodGroup ?? ""} className={inputCls}>
                <option value="">Unknown</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => <option key={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Emergency contact name"><input name="emergencyName" defaultValue={s.emergencyName ?? ""} className={inputCls} /></Field>
            <Field label="Emergency contact phone"><input name="emergencyPhone" defaultValue={s.emergencyPhone ?? ""} placeholder="024 XXX XXXX" className={inputCls} /></Field>
            <div className="sm:col-span-2">
              <Field label="Medical notes (allergies, conditions — teachers of the class will see a flag)">
                <textarea name="medicalNotes" rows={2} defaultValue={s.medicalNotes ?? ""} className={inputCls} />
              </Field>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <button className={btnCls}>Save student file</button>
          <Link href={`/students/${id}`} className={btnGhostCls}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
