import { and, desc, eq, gte, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { user, schools, session } from "@/db/schema";
import { requireConsole } from "@/core/console";
import { DataTable, PageHeader, Tr, Td, Badge } from "@/ui/kit";
import { FilterSelect, Pagination, SearchBox } from "@/ui/list-controls";
import { PER_PAGE } from "@/lib/utils";

const TONE = { platform_admin: "brand", admin: "success", teacher: "default", parent: "warning", student: "default" } as const;
const SINCE: Record<string, number> = { "7": 7, "30": 30, "90": 90 };

/** Every account on the platform: who they are, where they belong, when they
 *  last signed in. Filters: school, role, joined since, last seen. */
export default async function AllUsers({ searchParams }: {
  searchParams: Promise<{ page?: string; search?: string; role?: string; school?: string; joined?: string; seen?: string }>;
}) {
  await requireConsole("users");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const today = +new Date();
  const since = (d?: string) => SINCE[d ?? ""] ? new Date(today - SINCE[d!] * 86400000) : null;
  const joined = since(sp.joined);
  const lastSeen = db.select({ userId: session.userId, at: sql<Date>`max(${session.createdAt})`.as("at") })
    .from(session).groupBy(session.userId).as("last_seen");
  const where = and(
    sp.search ? or(ilike(user.name, `%${sp.search}%`), ilike(user.email, `%${sp.search}%`), ilike(user.phone, `%${sp.search}%`)) : undefined,
    sp.role ? eq(user.role, sp.role) : undefined,
    sp.school === "platform" ? isNull(user.schoolId) : sp.school ? eq(user.schoolId, sp.school) : undefined,
    joined ? gte(user.createdAt, joined) : undefined,
    since(sp.seen) ? sql`${lastSeen.at} >= ${since(sp.seen)!.toISOString()}` : undefined,
  );
  const [rows, [{ n }], allSchools] = await Promise.all([
    db.select({
      id: user.id, name: user.name, email: user.email, role: user.role,
      phone: user.phone, createdAt: user.createdAt, schoolName: schools.name, schoolId: schools.id, seen: lastSeen.at,
    }).from(user).leftJoin(schools, eq(user.schoolId, schools.id)).leftJoin(lastSeen, eq(lastSeen.userId, user.id))
      .where(where).orderBy(desc(user.createdAt))
      .limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    db.select({ n: sql<number>`count(*)` }).from(user).leftJoin(lastSeen, eq(lastSeen.userId, user.id)).where(where),
    db.select({ id: schools.id, name: schools.name }).from(schools).orderBy(schools.name),
  ]);
  const fmt = (d: Date | string | null) => d ? new Date(d).toISOString().slice(0, 10) : "never";

  return (
    <div>
      <PageHeader title="All users" sub={`${Number(n).toLocaleString()} account${Number(n) === 1 ? "" : "s"} match`} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Name, email or phone…" />
        <FilterSelect name="school" allLabel="Every school"
          options={[{ value: "platform", label: "Platform only" }, ...allSchools.map((s) => ({ value: s.id, label: s.name }))]} />
        <FilterSelect name="role" allLabel="Every role"
          options={["platform_admin", "admin", "teacher", "parent", "student"].map((r) => ({ value: r, label: r.replace("_", " ") }))} />
        <FilterSelect name="joined" allLabel="Joined any time"
          options={[{ value: "7", label: "Joined in 7 days" }, { value: "30", label: "Joined in 30 days" }, { value: "90", label: "Joined in 90 days" }]} />
        <FilterSelect name="seen" allLabel="Last seen any time"
          options={[{ value: "7", label: "Seen in 7 days" }, { value: "30", label: "Seen in 30 days" }, { value: "90", label: "Seen in 90 days" }]} />
      </div>
      <DataTable head={["Name", "Email / login", "Role", "School", "Phone", "Joined", "Last seen"]}>
        {rows.map((u) => (
          <Tr key={u.id}>
            <Td className="font-medium">{u.name}</Td>
            <Td className="text-[14px] text-muted-foreground">{u.email}</Td>
            <Td><Badge tone={TONE[u.role as keyof typeof TONE] ?? "default"}>{u.role.replace("_", " ")}</Badge></Td>
            <Td>{u.schoolId ? <a href={`/platform/schools/${u.schoolId}`} className="text-primary hover:underline">{u.schoolName}</a> : <span className="text-muted-foreground">— platform —</span>}</Td>
            <Td className="text-muted-foreground">{u.phone ?? "—"}</Td>
            <Td className="whitespace-nowrap text-muted-foreground" data-nums="">{fmt(u.createdAt)}</Td>
            <Td className="whitespace-nowrap text-muted-foreground" data-nums="">{fmt(u.seen)}</Td>
          </Tr>
        ))}
      </DataTable>
      <Pagination page={page} count={Number(n)} />
    </div>
  );
}
