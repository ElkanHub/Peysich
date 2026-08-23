import { desc, eq, ilike, or, sql, and } from "drizzle-orm";
import { db } from "@/db";
import { user, schools } from "@/db/schema";
import { DataTable, PageHeader, Tr, Td, Badge } from "@/ui/kit";
import { Pagination, SearchBox } from "@/ui/list-controls";
import { PER_PAGE } from "@/lib/utils";

const TONE = { platform_admin: "brand", admin: "success", teacher: "default", parent: "warning", student: "default" } as const;

/** Every account on the platform — who they are, where they belong. */
export default async function AllUsers({ searchParams }: {
  searchParams: Promise<{ page?: string; search?: string; role?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = and(
    sp.search ? or(ilike(user.name, `%${sp.search}%`), ilike(user.email, `%${sp.search}%`)) : undefined,
    sp.role ? eq(user.role, sp.role) : undefined,
  );
  const [rows, [{ n }]] = await Promise.all([
    db.select({
      id: user.id, name: user.name, email: user.email, role: user.role,
      phone: user.phone, createdAt: user.createdAt, schoolName: schools.name,
    }).from(user).leftJoin(schools, eq(user.schoolId, schools.id))
      .where(where).orderBy(desc(user.createdAt))
      .limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    db.select({ n: sql<number>`count(*)` }).from(user).where(where),
  ]);

  return (
    <div>
      <PageHeader title="All users" sub={`${n} accounts across the platform`} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Name or email…" />
        <span className="flex gap-1 text-[13px]">
          {["", "platform_admin", "admin", "teacher", "parent", "student"].map((r) => (
            <a key={r} href={r ? `?role=${r}` : "?"}
              className={`rounded-md border px-2.5 py-1 capitalize transition-colors ${(sp.role ?? "") === r ? "border-primary bg-brand-soft text-primary" : "border-border hover:bg-muted"}`}>
              {r ? r.replace("_", " ") : "all"}
            </a>
          ))}
        </span>
      </div>
      <DataTable head={["Name", "Email / login", "Role", "School", "Phone", "Joined"]}>
        {rows.map((u) => (
          <Tr key={u.id}>
            <Td className="font-medium">{u.name}</Td>
            <Td className="text-[14px] text-muted-foreground">{u.email}</Td>
            <Td><Badge tone={TONE[u.role as keyof typeof TONE] ?? "default"}>{u.role.replace("_", " ")}</Badge></Td>
            <Td>{u.schoolName ?? <span className="text-muted-foreground">— platform —</span>}</Td>
            <Td className="text-muted-foreground">{u.phone ?? "—"}</Td>
            <Td className="whitespace-nowrap text-muted-foreground">{u.createdAt.toISOString().slice(0, 10)}</Td>
          </Tr>
        ))}
      </DataTable>
      <Pagination page={page} count={Number(n)} />
    </div>
  );
}
