import Link from "next/link";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { requireConsole } from "@/core/console";
import { ACTIVITY_KINDS, activityFeed } from "@/core/activity";
import { DataTable, PageHeader, Tr, Td, Badge, inputCls, btnGhostCls } from "@/ui/kit";
import { FilterSelect, Pagination, SearchBox } from "@/ui/list-controls";

const PER = 50;
const TONE: Record<string, "brand" | "success" | "warning" | "danger" | "default"> = {
  console: "brand", ops: "default", signin: "default", register: "success", scores: "success", reports: "success", bills: "warning", payments: "warning", messages: "default",
};

/** The activity log: the whole platform, or one school, as events. Filter by
 *  school, then by who (role), what (kind), when, and a word. */
export default async function ActivityLog({ searchParams }: {
  searchParams: Promise<{ page?: string; search?: string; school?: string; role?: string; kind?: string; from?: string; to?: string }>;
}) {
  await requireConsole("activity");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ rows, count }, allSchools] = await Promise.all([
    activityFeed({ school: sp.school, role: sp.role, kind: sp.kind, from: sp.from, to: sp.to, q: sp.search, page, perPage: PER }),
    db.select({ id: schools.id, name: schools.name }).from(schools).orderBy(schools.name),
  ]);
  const school = allSchools.find((s) => s.id === sp.school);
  const keep = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v && k !== "page") u.set(k, v);
    return `/platform/audit?${u}`;
  };

  return (
    <div>
      <PageHeader title={school ? `Activity · ${school.name}` : "Activity log"}
        sub={school ? "What this school did, as events — never the contents of its records" : "Everything that happened on the platform and in every school, newest first"} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="A word, a school, a name…" />
        <FilterSelect name="school" allLabel="Every school" options={allSchools.map((s) => ({ value: s.id, label: s.name }))} />
        <FilterSelect name="role" allLabel="Everyone"
          options={[["platform_admin", "SchoolSpec team"], ["admin", "School admins"], ["teacher", "Teachers"], ["parent", "Parents"], ["student", "Students"], ["system", "Automatic"]].map(([v, l]) => ({ value: v, label: l }))} />
        <FilterSelect name="kind" allLabel="Every kind" options={Object.entries(ACTIVITY_KINDS).map(([v, l]) => ({ value: v, label: l }))} />
        <form className="flex items-center gap-1.5 text-[13px]">
          {Object.entries(sp).filter(([k]) => !["from", "to", "page"].includes(k)).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <input type="date" name="from" defaultValue={sp.from} className={inputCls + " h-9 w-36"} />
          <span className="text-muted-foreground">to</span>
          <input type="date" name="to" defaultValue={sp.to} className={inputCls + " h-9 w-36"} />
          <button className={btnGhostCls + " h-9"}>Apply</button>
          {(sp.from || sp.to) && <Link href={keep({ from: undefined, to: undefined })} className="text-primary hover:underline">clear dates</Link>}
        </form>
      </div>
      {school && (
        <p className="mb-3 text-[13.5px] text-muted-foreground">
          <Link href={`/platform/schools/${school.id}`} className="font-medium text-primary hover:underline">Open {school.name} →</Link>
          {" · "}<Link href={keep({ school: undefined })} className="hover:underline">all schools</Link>
        </p>
      )}
      <DataTable head={["When", "School", "Who", "What", "Event"]}>
        {rows.map((r, i) => (
          <Tr key={i}>
            <Td className="whitespace-nowrap text-[12.5px] text-muted-foreground" data-nums="">{r.at.toISOString().slice(0, 16).replace("T", " ")}</Td>
            <Td>{r.schoolId ? <Link href={keep({ school: r.schoolId })} className="text-primary hover:underline">{r.schoolName}</Link> : <span className="text-muted-foreground">platform</span>}</Td>
            <Td className="whitespace-nowrap">{r.actorName ?? <span className="text-muted-foreground">{r.actorRole === "system" ? "automatic" : "—"}</span>}
              {r.actorRole && r.actorRole !== "system" && <span className="ml-1.5 text-[12px] text-muted-foreground">{r.actorRole.replace("_", " ")}</span>}</Td>
            <Td><Badge tone={TONE[r.kind] ?? "default"}>{ACTIVITY_KINDS[r.kind] ?? r.kind}</Badge></Td>
            <Td className="max-w-[28rem] truncate text-[13.5px]">{r.summary}</Td>
          </Tr>
        ))}
      </DataTable>
      {rows.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nothing matches.</p>}
      <Pagination page={page} count={count} perPage={PER} />
      <p className="mt-3 text-[12.5px] text-faint">A school&apos;s rows are events, never contents: no child&apos;s name, mark, number or message text appears here.</p>
    </div>
  );
}
