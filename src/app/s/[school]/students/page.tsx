import Link from "next/link";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { students, classes } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { DataTable, Empty, PageHeader, Stat, Tr, Td, Badge, btnGhostCls } from "@/ui/kit";
import { Pagination, SearchBox, FilterSelect } from "@/ui/list-controls";
import { PER_PAGE } from "@/lib/utils";
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

  const [rows, [{ n: count }], cls, drafts, mix] = await Promise.all([
    db.select({
      id: students.id, admissionNo: students.admissionNo, firstName: students.firstName,
      lastName: students.lastName, sex: students.sex, className: classes.name,
      boarding: students.boarding, photoUrl: students.photoUrl,
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
    // one grouped query feeds every KPI tile — no N stat queries
    db.select({ status: students.status, boarding: students.boarding, n: sql<number>`count(*)` })
      .from(students).where(eq(students.schoolId, school.id))
      .groupBy(students.status, students.boarding),
  ]);

  const tally = (st: string) => mix.filter((m) => m.status === st).reduce((a, m) => a + Number(m.n), 0);
  const activeN = tally("active");
  const boarderN = mix.filter((m) => m.status === "active" && m.boarding).reduce((a, m) => a + Number(m.n), 0);

  // photo thumbnails: presigned straight from R2 (no Vercel egress), lazy-loaded
  const photo = new Map<string, string>();
  if (r2Enabled)
    await Promise.all(rows.filter((r) => r.photoUrl).map(async (r) =>
      photo.set(r.id, await presignDownload(r.photoUrl!))));

  return (
    <div>
      <PageHeader title="Students" sub={`${count} ${status}`}
        action={{ href: "/students/new", label: "Admit student" }} />

      {/* data at a glance + the actions an office actually reaches for */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active students" value={String(activeN)} />
        <Stat label="Boarders / day" value={`${boarderN} / ${activeN - boarderN}`} />
        <Stat label="Admissions in progress" value={String(drafts.length)} tone={drafts.length ? "warning" : undefined} />
        <Stat label="Alumni" value={String(tally("alumni"))} />
      </div>
      {isAdmin && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/students/import" className={btnGhostCls}>Import from Excel</Link>
          <Link href="/settings/promotion" className={btnGhostCls}>Year-end promotion</Link>
          <Link href="/settings" className={btnGhostCls}>Classes & rooms</Link>
        </div>
      )}

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
      </div>

      {rows.length === 0 ? (
        <Empty title="No students found"
          hint="Adjust the filters, admit your first student, or import your roster from Excel." />
      ) : (
        <DataTable head={["Student", "Adm. No", "Sex", "Class", "Type", ""]}>
          {rows.map((s) => (
            <Tr key={s.id}>
              <Td className="font-medium">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-[11px] font-semibold text-primary">
                    {photo.has(s.id)
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={photo.get(s.id)} alt="" width={32} height={32}
                          loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      : `${s.firstName[0]}${s.lastName[0]}`}
                  </span>
                  {s.lastName}, {s.firstName}
                </span>
              </Td>
              <Td className="font-mono text-xs">{s.admissionNo}</Td>
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
