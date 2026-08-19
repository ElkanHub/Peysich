import Link from "next/link";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { students, classes } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { DataTable, Empty, PageHeader, Tr, Td, Badge, btnGhostCls } from "@/ui/kit";
import { Pagination, SearchBox, FilterSelect, PER_PAGE } from "@/ui/list-controls";
import { discardAdmission } from "./new/wizard-actions";

export default async function Students({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ page?: string; search?: string; classId?: string; status?: string; sex?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school, user } = await requireSchool(slug, ["admin", "teacher"]);
  const isAdmin = ["admin", "platform_admin"].includes(user.role);
  const page = Math.max(1, Number(sp.page) || 1);
  const status = ["active", "alumni", "left"].includes(sp.status ?? "") ? sp.status! : "active";

  const where = and(
    eq(students.schoolId, school.id), eq(students.status, status),
    sp.search ? or(
      ilike(students.firstName, `%${sp.search}%`), ilike(students.lastName, `%${sp.search}%`),
      ilike(students.admissionNo, `%${sp.search}%`)) : undefined,
    sp.classId ? eq(students.classId, sp.classId) : undefined,
    sp.sex === "male" || sp.sex === "female" ? eq(students.sex, sp.sex) : undefined,
  );

  const [rows, [{ n: count }], cls, drafts] = await Promise.all([
    db.select({
      id: students.id, admissionNo: students.admissionNo, firstName: students.firstName,
      lastName: students.lastName, sex: students.sex, className: classes.name,
      boarding: students.boarding,
    }).from(students).leftJoin(classes, eq(students.classId, classes.id))
      .where(where).orderBy(students.lastName, students.firstName)
      .limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    db.select({ n: sql<number>`count(*)` }).from(students).where(where),
    db.select({ id: classes.id, name: classes.name }).from(classes)
      .where(eq(classes.schoolId, school.id)),
    isAdmin
      ? db.select({
          id: students.id, firstName: students.firstName, lastName: students.lastName,
          step: students.admissionStep,
        }).from(students)
          .where(and(eq(students.schoolId, school.id), eq(students.status, "draft")))
      : [],
  ]);

  return (
    <div>
      <PageHeader title="Students" sub={`${count} ${status}`}
        action={{ href: "/students/new", label: "Admit student" }} />

      {drafts.length > 0 && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3">
          <p className="text-sm font-medium">Admissions in progress</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span>{d.firstName} {d.lastName}
                  <span className="ml-2 text-xs text-muted-foreground">stage {Math.min((d.step ?? 0) + 1, 7)} of 7</span></span>
                <span className="flex items-center gap-2">
                  <Link href={`/students/new?draft=${d.id}`}
                    className="text-[13px] font-medium text-primary">Continue →</Link>
                  <form action={discardAdmission.bind(null, slug, d.id)}>
                    <button className="text-xs text-danger underline-offset-2 hover:underline">Discard</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Name or admission no…" />
        <FilterSelect name="classId" allLabel="All classes"
          options={cls.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect name="status" allLabel="Active"
          options={[{ value: "alumni", label: "Alumni" }, { value: "left", label: "Left" }]} />
        <FilterSelect name="sex" allLabel="All"
          options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
        <span className="flex-1" />
        <Link href="/students/import" className={btnGhostCls}>Import CSV</Link>
      </div>

      {rows.length === 0 ? (
        <Empty title="No students found"
          hint="Adjust the filters, admit your first student, or import your roster from CSV." />
      ) : (
        <DataTable head={["Adm. No", "Name", "Sex", "Class", "Type", ""]}>
          {rows.map((s) => (
            <Tr key={s.id}>
              <Td className="font-mono text-xs">{s.admissionNo}</Td>
              <Td className="font-medium">{s.lastName}, {s.firstName}</Td>
              <Td className="capitalize">{s.sex}</Td>
              <Td>{s.className ?? "—"}</Td>
              <Td>{s.boarding ? <Badge tone="brand">boarder</Badge> : <span className="text-xs text-muted-foreground">day</span>}</Td>
              <Td className="text-right">
                <Link href={`/students/${s.id}`} className="text-primary">Open file</Link>
              </Td>
            </Tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} count={Number(count)} />
    </div>
  );
}
