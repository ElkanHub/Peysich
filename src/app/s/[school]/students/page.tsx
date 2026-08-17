import Link from "next/link";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { students, classes } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { DataTable, Empty, PageHeader, Tr, Td, btnGhostCls } from "@/ui/kit";
import { Pagination, SearchBox, PER_PAGE } from "@/ui/list-controls";

export default async function Students({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ page?: string; search?: string; classId?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireSchool(slug, ["admin", "teacher"]);
  const page = Math.max(1, Number(sp.page) || 1);

  const where = and(
    eq(students.schoolId, school.id), eq(students.status, "active"),
    sp.search ? or(
      ilike(students.firstName, `%${sp.search}%`), ilike(students.lastName, `%${sp.search}%`),
      ilike(students.admissionNo, `%${sp.search}%`)) : undefined,
    sp.classId ? eq(students.classId, sp.classId) : undefined,
  );

  const [rows, [{ n: count }]] = await Promise.all([
    db.select({
      id: students.id, admissionNo: students.admissionNo, firstName: students.firstName,
      lastName: students.lastName, sex: students.sex, className: classes.name,
    }).from(students).leftJoin(classes, eq(students.classId, classes.id))
      .where(where).orderBy(students.lastName, students.firstName)
      .limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    db.select({ n: sql<number>`count(*)` }).from(students).where(where),
  ]);

  return (
    <div>
      <PageHeader title="Students" sub={`${count} active`}
        action={{ href: "/students/new", label: "Add student" }} />
      <div className="mb-3 flex items-center justify-between">
        <SearchBox placeholder="Name or admission no…" />
        <Link href="/students/import" className={btnGhostCls}>Import CSV</Link>
      </div>
      {rows.length === 0 ? (
        <Empty title="No students found"
          hint="Add your first student or import your roster from CSV." />
      ) : (
        <DataTable head={["Adm. No", "Name", "Sex", "Class", ""]}>
          {rows.map((s) => (
            <Tr key={s.id}>
              <Td className="font-mono text-xs">{s.admissionNo}</Td>
              <Td className="font-medium">{s.lastName}, {s.firstName}</Td>
              <Td className="capitalize">{s.sex}</Td>
              <Td>{s.className ?? "—"}</Td>
              <Td className="text-right">
                <Link href={`/students/${s.id}`} className="text-primary">View</Link>
              </Td>
            </Tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} count={Number(count)} />
    </div>
  );
}
