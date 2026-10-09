import Link from "next/link";
import { Archive } from "lucide-react";
import { requireSchool } from "@/core/school-context";
import { listTerms, fmtDay } from "@/core/terms";
import { Badge, Card, Empty, PageHeader } from "@/ui/kit";

/** Archives (docs/11 §2.6): every closed term, exactly as it was, under its
 *  year, newest first. A term row opens the normal module pages on that term
 *  (?t=) — the same app, frozen, with the read-only banner. */
export default async function Archives({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireSchool(slug, ["admin", "teacher"]);
  const all = await listTerms(school.id);
  const closed = all.filter((t) => t.state === "closed");
  const ghs = (p: number) => `GHS ${Math.round(p / 100).toLocaleString()}`;

  // years newest first; a year is complete when it is closed, else "so far"
  const years = [...new Map(all.map((t) => [t.yearId, t.year])).values()]
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .map((y) => ({ ...y, terms: closed.filter((t) => t.yearId === y.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }))
    .filter((y) => y.terms.length);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Archives" sub="Every closed term, everything it produced — registers, scores, report cards, bills, receipts, messages, the lot — kept as it was. Read only; fees still owed can still be paid." />
      {!years.length && (
        <Empty icon={<Archive size={22} />} title="Nothing archived yet"
          hint="A term appears here the day it is closed from Home. The current term never does." />
      )}
      {years.map((y) => {
        const sum = y.terms.reduce((a, t) => ({
          reports: a.reports + (t.closeSummary?.reportCards ?? 0),
          collected: a.collected + (t.closeSummary?.collectedPesewas ?? 0),
          owed: a.owed + (t.closeSummary?.outstandingPesewas ?? 0),
        }), { reports: 0, collected: 0, owed: 0 });
        return (
          <Card key={y.id} className="mb-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[18px] font-semibold">{y.name}
                {y.closedAt ? <Badge tone="default">complete</Badge> : <span className="ml-2 text-[13px] font-normal text-muted-foreground">this year so far</span>}
              </h2>
              <p className="text-[13.5px] text-muted-foreground" data-nums="">
                {sum.reports} report cards · {ghs(sum.collected)} collected{sum.owed > 0 ? ` · ${ghs(sum.owed)} still owed` : ""}
              </p>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {y.terms.map((t) => {
                const s = t.closeSummary;
                return (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">{t.name} <span className="text-[13px] font-normal text-muted-foreground">{fmtDay(t.startsAt)} – {fmtDay(t.endsAt)}</span></p>
                      <p className="text-[13px] text-muted-foreground" data-nums="">
                        {s ? <>{s.students} on roll · {s.reportCards} report cards{s.attendanceRate !== null ? ` · ${s.attendanceRate}% attendance` : ""} · {ghs(s.collectedPesewas)} collected{s.outstandingPesewas > 0 ? ` · ${ghs(s.outstandingPesewas)} owed` : ""}</> : "closed"}
                        {t.closedBy ? ` · closed by ${t.closedBy}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] font-medium text-primary">
                      <Link href={`/archives/${t.id}`} className="rounded-full bg-primary px-3.5 py-1.5 text-primary-foreground hover:bg-brand-strong">Open the term →</Link>
                      <Link href={`/attendance/register?t=${t.id}`} className="self-center hover:underline">Record book</Link>
                      {user.role === "admin" && <Link href={`/reports?t=${t.id}`} className="self-center hover:underline">Report cards</Link>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
