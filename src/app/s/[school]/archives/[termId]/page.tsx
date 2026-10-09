import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Search } from "lucide-react";
import { requireSchool, getTeacherClassIds } from "@/core/school-context";
import { listTerms, fmtDay } from "@/core/terms";
import { getTermArchive, STAFF_SECTIONS, type ArchiveRow } from "@/core/term-archive";
import { Badge, Card, DataTable, PageHeader, Td, Tr, btnGhostCls } from "@/ui/kit";

const PAGE = 150;

/** One closed term, all of it (docs/11 §2.6): every section the snapshot
 *  holds, a search box across the section, and the bill, receipt or report
 *  card one tap away. Teachers see the teaching sections for their classes. */
export default async function TermArchive({ params, searchParams }: {
  params: Promise<{ school: string; termId: string }>;
  searchParams: Promise<{ s?: string; q?: string; p?: string }>;
}) {
  const { school: slug, termId } = await params;
  const sp = await searchParams;
  const { school, user } = await requireSchool(slug, ["admin", "teacher"]);
  const term = (await listTerms(school.id)).find((t) => t.id === termId);
  if (!term || term.state !== "closed") notFound();

  const teacherClasses = user.role === "teacher" ? await getTeacherClassIds(school.id, user.id) : null;
  const all = await getTermArchive(school.id, termId);
  const sections = all.filter((s) => user.role !== "teacher" || STAFF_SECTIONS.has(s.section));
  const active = sections.find((s) => s.section === sp.s) ?? null;
  const q = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(sp.p) || 1);
  const ghs = (p: number) => `GHS ${Math.round(p / 100).toLocaleString()}`;
  const sum = term.closeSummary;

  // a teacher reads only rows of their own classes; a row with no class is everyone's
  const visible = (rows: ArchiveRow[]) => rows
    .filter((r) => !teacherClasses || !r._classId || teacherClasses.has(r._classId))
    .filter((r) => !q || Object.entries(r).some(([k, v]) => !k.startsWith("_") && String(v ?? "").toLowerCase().includes(q)));
  const rows = active ? visible(active.rows as ArchiveRow[]) : [];
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const here = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ s: sp.s, q: sp.q, p: sp.p, ...over })) if (v) u.set(k, v);
    return `/archives/${termId}?${u}`;
  };

  return (
    <div>
      <PageHeader title={`${term.name} · ${term.year.name}`}
        sub={`${fmtDay(term.startsAt)} – ${fmtDay(term.endsAt)} · closed ${term.closedAt ? fmtDay(term.closedAt.toISOString().slice(0, 10)) : ""}${term.closedBy ? ` by ${term.closedBy}` : ""} · read only`}
        action={user.role === "admin"
          ? <a href={`/api/export/term?t=${termId}`} className={btnGhostCls} download><Download size={15} /> Export this term</a>
          : undefined} />
      <p className="-mt-4 mb-4 text-[13.5px]"><Link href="/archives" className="text-primary hover:underline">← All archives</Link></p>

      {sum && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[["On roll", String(sum.students)], ["Weeks", String(sum.weeks)], ["Attendance", sum.attendanceRate !== null ? `${sum.attendanceRate}%` : "—"],
            ["Report cards", String(sum.reportCards)], ["Fees", `${ghs(sum.collectedPesewas)}${sum.outstandingPesewas > 0 ? ` · ${ghs(sum.outstandingPesewas)} owed` : ""}`]]
            .map(([l, v]) => (
              <Card key={l} className="p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{l}</p>
                <p className="mt-0.5 text-[20px] font-bold tracking-tight" data-nums="">{v}</p>
              </Card>
            ))}
        </div>
      )}

      {/* the sections: every one the term produced, with how much it holds */}
      <nav aria-label="Sections" className="mb-5 flex flex-wrap gap-2">
        {sections.map((s) => {
          const n = teacherClasses ? visible(s.rows as ArchiveRow[]).length : s.count;
          const on = active?.section === s.section;
          return (
            <Link key={s.section} href={`/archives/${termId}?s=${s.section}`}
              className={`rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : n ? "border-border bg-card hover:bg-muted" : "border-border bg-card text-faint"}`}>
              {s.title} <span className={`ml-1 ${on ? "opacity-80" : "text-muted-foreground"}`} data-nums="">{n}</span>
            </Link>
          );
        })}
      </nav>

      {!active && (
        <Card>
          <p className="font-medium">Everything {term.name} produced, kept as it was.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a section above. Each one opens as a table you can search; bills, receipts and report cards open from their rows.
            {user.role === "admin" && " Export this term gives you every section as one spreadsheet."}
          </p>
        </Card>
      )}

      {active && (
        <>
          <form className="mb-3 flex items-center gap-2" action={`/archives/${termId}`}>
            <input type="hidden" name="s" value={active.section} />
            <label className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input name="q" defaultValue={sp.q ?? ""} placeholder={`Search ${active.title.toLowerCase()} — a name, a bill number, a date`}
                className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" />
            </label>
            <span className="text-[13px] text-muted-foreground" data-nums="">{rows.length.toLocaleString()} {rows.length === 1 ? "row" : "rows"}</span>
          </form>
          {rows.length === 0 ? (
            <Card><p className="text-sm text-muted-foreground">{q ? "Nothing matches." : `Nothing was recorded under ${active.title.toLowerCase()} in ${term.name}.`}</p></Card>
          ) : (
            <DataTable head={[...active.columns.map(([, l]) => l), ""]}>
              {slice.map((r, i) => (
                <Tr key={i}>
                  {active.columns.map(([k]) => <Td key={k} className="max-w-[28rem] truncate" data-nums="">{String(r[k] ?? "")}</Td>)}
                  <Td>{r._link ? <Link href={r._link} className="whitespace-nowrap text-[13px] font-medium text-primary hover:underline">Open →</Link> : null}</Td>
                </Tr>
              ))}
            </DataTable>
          )}
          {pages > 1 && (
            <p className="mt-3 flex items-center gap-3 text-[13.5px] text-muted-foreground" data-nums="">
              {page > 1 && <Link href={here({ p: String(page - 1) })} className="text-primary hover:underline">← Previous</Link>}
              <span>Page {page} of {pages}</span>
              {page < pages && <Link href={here({ p: String(page + 1) })} className="text-primary hover:underline">Next →</Link>}
            </p>
          )}
          <p className="mt-3 text-[12.5px] text-faint">Snapshot taken {all[0]?.builtAt ? fmtDay(all[0].builtAt.toISOString().slice(0, 10)) : ""}. <Badge tone="default">read only</Badge></p>
        </>
      )}
    </div>
  );
}
