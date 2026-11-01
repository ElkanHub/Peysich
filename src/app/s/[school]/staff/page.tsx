import Link from "next/link";
import { eq, ilike, and, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { DataTable, Empty, PageHeader, Stat, StatStrip, Tr, Td, Badge, Row, RowList, Tile, btnGhostCls, btnCls } from "@/ui/kit";
import { Pagination, SearchBox, Filters } from "@/ui/list-controls";
import { PER_PAGE } from "@/lib/utils";
import { discardOnboarding } from "./staff-actions";
import { SubmitButton } from "@/ui/feedback";

const TYPE_LABEL: Record<string, string> = { teaching: "Teacher", admin: "Office", support: "Support" };

/** STAFF DIRECTORY — one unified list for every employee (teachers, office,
 *  kitchen, security), filtered by category. Teachers get their dedicated
 *  view on Teaching & allocations. */
export default async function Staff({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ page?: string; search?: string; type?: string; status?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status === "left" ? "left" : "active";

  const where = and(
    eq(staff.schoolId, school.id), eq(staff.status, status),
    sp.search ? or(ilike(staff.name, `%${sp.search}%`), ilike(staff.staffNo, `%${sp.search}%`)) : undefined,
    sp.type && sp.type in TYPE_LABEL ? eq(staff.staffType, sp.type) : undefined,
  );

  const [rows, [{ n }], mix, drafts] = await Promise.all([
    db.select().from(staff).where(where).orderBy(staff.name)
      .limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    db.select({ n: sql<number>`count(*)` }).from(staff).where(where),
    db.select({ type: staff.staffType, n: sql<number>`count(*)` }).from(staff)
      .where(and(eq(staff.schoolId, school.id), eq(staff.status, "active")))
      .groupBy(staff.staffType),
    db.select({ id: staff.id, name: staff.name }).from(staff)
      .where(and(eq(staff.schoolId, school.id), eq(staff.status, "draft"))),
  ]);
  const tally = (t: string) => Number(mix.find((m) => m.type === t)?.n ?? 0);
  const total = mix.reduce((a, m) => a + Number(m.n), 0);
  const photo = new Map<string, string>();
  if (r2Enabled)
    await Promise.all(rows.filter((r) => r.photoUrl).map(async (r) =>
      photo.set(r.id, await presignDownload(r.photoUrl!))));

  return (
    <div className="max-w-4xl">
      <PageHeader title="Staff" sub={`${n} ${status === "left" ? "former" : "active"}`}
        action={{ href: "/staff/new", label: "Add staff" }} />

      <StatStrip>
        <Stat label="All staff" value={String(total)} />
        <Stat label="Teachers" value={String(tally("teaching"))} tone="success" />
        <Stat label="Office / support" value={`${tally("admin")} / ${tally("support")}`} />
        <Stat label="Not yet saved" value={String(drafts.length)} tone={drafts.length ? "warning" : undefined} />
      </StatStrip>
      <div className="mb-4 grid grid-cols-2 gap-3 md:hidden">
        <Tile href="/staff/allocations" label="Who teaches what" hint="Teaching & allocations" spot="spot-staff-room" tone="soft" />
        <Tile href="/hr" label="Leave requests" spot="spot-leave" />
      </div>
      <div className="mb-4 hidden flex-wrap gap-2 md:flex">
        <Link href="/staff/allocations" className={btnGhostCls}>Who teaches which class</Link>
        <Link href="/hr" className={btnGhostCls}>Leave requests</Link>
      </div>

      {drafts.length > 0 && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3">
          <p className="text-sm font-medium">Started but not yet saved</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span>{d.name}</span>
                <span className="flex items-center gap-2">
                  <Link href={`/staff/new?draft=${d.id}`} className="text-[14px] font-medium text-primary">Finish →</Link>
                  <form action={discardOnboarding.bind(null, slug, d.id)}>
                    <SubmitButton className="text-xs text-danger underline-offset-2 hover:underline">Discard</SubmitButton>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Name or employee ID…" />
        <Filters current={{ type: sp.type, status: sp.status }} filters={[
          { name: "type", allLabel: "Everyone", options: [{ value: "teaching", label: "Teacher" }, { value: "admin", label: "Office" }, { value: "support", label: "Support" }] },
          { name: "status", allLabel: "Active", options: [{ value: "left", label: "Former staff" }] },
        ]} />
      </div>

      {rows.length === 0 ? (
        <Empty art={sp.search || sp.type || sp.status ? "empty-search" : "empty-staff"}
          title={sp.search || sp.type || sp.status ? "No staff match" : "No staff yet"}
          hint={sp.search || sp.type || sp.status ? "Try another name, or clear the filters." : "Add your first teacher and they can sign in on their own phone."}
          action={!(sp.search || sp.type || sp.status) ? <Link href="/staff/new" className={btnCls}>Add staff</Link> : undefined} />
      ) : (<>
        <RowList className="md:hidden">
          {rows.map((s) => (
            <Row key={s.id} href={`/staff/${s.id}`}
              lead={photo.has(s.id)
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={photo.get(s.id)} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 rounded-full object-cover" />
                : s.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              title={s.name}
              sub={[TYPE_LABEL[s.staffType], s.designation, s.phone].filter(Boolean).join(" · ")}
              trailing={<>
                {s.userId ? <Badge tone="success">{s.staffRole}</Badge> : <span className="text-[12px] text-muted-foreground">no login</span>}
                <span className="h-4 w-4 text-faint">›</span>
              </>} />
          ))}
        </RowList>
        <div className="max-md:hidden">
        <DataTable head={["Staff member", "What they do", "Contact", "Login", ""]}>
          {rows.map((s) => (
            <Tr key={s.id}>
              <Td className="font-medium">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-[12px] font-semibold text-primary">
                    {photo.has(s.id)
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={photo.get(s.id)} alt="" width={32} height={32} loading="lazy" className="h-full w-full object-cover" />
                      : s.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <span>
                    <Link href={`/staff/${s.id}`} className="text-primary">{s.name}</Link>
                    <span className="block text-[13px] font-normal text-muted-foreground">
                      {s.staffNo ?? "—"}{s.designation ? ` · ${s.designation}` : ""}
                    </span>
                  </span>
                </span>
              </Td>
              <Td><Badge tone={s.staffType === "teaching" ? "brand" : "default"}>{TYPE_LABEL[s.staffType]}</Badge></Td>
              <Td className="text-[14px]">{[s.phone, s.email].filter(Boolean).join(" · ") || "—"}</Td>
              <Td>{s.userId
                ? <Badge tone="success">{s.staffRole}</Badge>
                : <span className="text-xs text-muted-foreground">no login</span>}</Td>
              <Td className="text-right">
                <Link href={`/staff/${s.id}`} className="text-primary">Open file</Link>
              </Td>
            </Tr>
          ))}
        </DataTable>
        </div>
      </>)}
      <Pagination page={page} count={Number(n)} />
    </div>
  );
}
