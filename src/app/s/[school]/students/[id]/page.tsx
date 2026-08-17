import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { students, classes, guardians, studentGuardians, enrollments, academicYears } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { Card, PageHeader } from "@/ui/kit";
import { IssueLoginButton } from "@/ui/issue-login";

export default async function StudentDetail({ params }: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school: slug, id } = await params;
  const { school } = await requireSchool(slug, ["admin", "teacher"]);
  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s) notFound();
  const [cls] = s.classId
    ? await db.select().from(classes).where(eq(classes.id, s.classId)) : [null];
  const gs = await db.select({ name: guardians.name, phone: guardians.phone, relation: guardians.relation })
    .from(studentGuardians)
    .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
    .where(eq(studentGuardians.studentId, id));
  const history = await db.select({ year: academicYears.name, className: classes.name, status: enrollments.status })
    .from(enrollments)
    .innerJoin(academicYears, eq(enrollments.yearId, academicYears.id))
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .where(eq(enrollments.studentId, id));

  return (
    <div className="max-w-2xl">
      <PageHeader title={`${s.firstName} ${s.lastName}`}
        sub={`${s.admissionNo} · ${cls?.name ?? "no class"} · ${s.status}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Profile</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Sex</dt><dd className="capitalize">{s.sex}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Date of birth</dt><dd>{s.dob ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Admitted</dt><dd>{s.createdAt.toISOString().slice(0, 10)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Student login</dt>
              <dd>{s.userId ? <span className="text-success">active</span>
                : <IssueLoginButton slug={slug} kind="student" id={s.id} />}</dd></div>
          </dl>
        </Card>
        <Card>
          <h2 className="font-semibold">Guardians</h2>
          {gs.length === 0 && <p className="mt-2 text-sm text-muted-foreground">None linked.</p>}
          <ul className="mt-2 space-y-1 text-sm">
            {gs.map((g, i) => <li key={i}>{g.name} · {g.phone} <span className="text-muted-foreground">({g.relation})</span></li>)}
          </ul>
        </Card>
        <Card className="md:col-span-2">
          <h2 className="font-semibold">Enrolment history</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {history.map((h, i) => <li key={i}>{h.year} — {h.className} <span className="text-muted-foreground">({h.status})</span></li>)}
          </ul>
        </Card>
      </div>
    </div>
  );
}
