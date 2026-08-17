import { eq, ilike, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { guardians } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { DataTable, PageHeader, Tr, Td } from "@/ui/kit";
import { Pagination, SearchBox, PER_PAGE } from "@/ui/list-controls";

export default async function Guardians({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = and(eq(guardians.schoolId, school.id),
    sp.search ? ilike(guardians.name, `%${sp.search}%`) : undefined);
  const [rows, [{ n }]] = await Promise.all([
    db.select().from(guardians).where(where).orderBy(guardians.name)
      .limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    db.select({ n: sql<number>`count(*)` }).from(guardians).where(where),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Guardians" sub={`${n} guardians`} />
      <div className="mb-3"><SearchBox /></div>
      <DataTable head={["Name", "Phone", "Email", "Relation"]}>
        {rows.map((g) => (
          <Tr key={g.id}>
            <Td className="font-medium">{g.name}</Td>
            <Td>{g.phone}</Td><Td>{g.email ?? "—"}</Td>
            <Td className="capitalize">{g.relation}</Td>
          </Tr>
        ))}
      </DataTable>
      <Pagination page={page} count={Number(n)} />
    </div>
  );
}
