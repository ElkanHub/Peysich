import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { students, classes } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { Card, Field, PageHeader, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { updateStudent } from "../actions";

/** Edit the Student File — every field the office keeps on a child, grouped
 *  the same way the file displays them. Save returns to the file. */
export default async function EditStudent({ params }: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school: slug, id } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s) notFound();
  const cls = await db.select().from(classes).where(eq(classes.schoolId, school.id));

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit — ${s.firstName} ${s.lastName}`} sub={`Student file · ${s.admissionNo}`} />
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
