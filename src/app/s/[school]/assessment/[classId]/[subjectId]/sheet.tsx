"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { saveSheet, submitSheetColumn } from "../../actions";
import { btnCls, btnGhostCls } from "@/ui/kit";
import { cn } from "@/lib/utils";

export type SheetComp = {
  id: string; name: string; weight: number; isExam: boolean;
  outOf: number; submitted: boolean; published: boolean; editable: boolean;
};
type Cell = { raw: number; absent: boolean };

/** The live score sheet. Conversion happens AT the cell (“27 → 9/10”), a
 *  dash means “did not write”, and a student's Total only appears once every
 *  column has an entry — no misleading partial totals. */
export function Sheet({ slug, classId, subjectId, roster, comps, initial, bands, isTeacher }: {
  slug: string; classId: string; subjectId: string;
  roster: { id: string; firstName: string; lastName: string }[];
  comps: SheetComp[];
  initial: Record<string, Cell>;
  bands: { min: number; grade: string; remark: string }[];
  isTeacher: boolean;
}) {
  // cell text state: "" = nothing entered, "-" = did not write, else the raw mark
  const [cells, setCells] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial)) m[k] = v.absent ? "-" : String(v.raw);
    return m;
  });
  const [outOf, setOutOf] = useState<Record<string, string>>(() =>
    Object.fromEntries(comps.map((c) => [c.id, String(c.outOf)])));
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null); // which button spins

  const oo = (cid: string) => Math.max(1, Number(outOf[cid]) || comps.find((c) => c.id === cid)!.outOf);
  const parse = (v: string): Cell | null => {
    const t = v.trim();
    if (t === "") return null;
    if (t === "-" || t === "–") return { raw: 0, absent: true };
    const n = Number(t);
    return Number.isFinite(n) ? { raw: n, absent: false } : null;
  };
  const conv = (cid: string, cell: Cell) => {
    if (cell.absent) return 0;
    const c = comps.find((x) => x.id === cid)!;
    return Math.round((Math.min(cell.raw, oo(cid)) / oo(cid)) * c.weight * 10) / 10;
  };

  const anyEditable = comps.some((c) => c.editable);
  const buildForm = () => {
    const f = new FormData();
    for (const c of comps) {
      if (!c.editable) continue;
      f.set(`outOf_${c.id}`, String(oo(c.id)));
      for (const r of roster) {
        const v = (cells[`${c.id}_${r.id}`] ?? "").trim();
        if (v !== "") f.set(`sc_${c.id}_${r.id}`, v);
      }
    }
    return f;
  };
  const doSave = () => { setBusy("save"); start(async () => { await saveSheet(slug, classId, subjectId, buildForm()); }); };
  const doSubmit = (cid: string) => { setBusy(cid); start(async () => { await submitSheetColumn(slug, classId, subjectId, cid, buildForm()); }); };

  const rows = useMemo(() => roster.map((r) => {
    const entries = comps.map((c) => parse(cells[`${c.id}_${r.id}`] ?? ""));
    const complete = entries.every((e) => e !== null);
    const total = complete
      ? Math.round(entries.reduce((a, e, i) => a + conv(comps[i].id, e!), 0) * 10) / 10
      : null;
    const band = total !== null ? (bands.find((b) => total >= b.min) ?? bands.at(-1)!) : null;
    const missing = entries.filter((e) => e === null).length;
    return { r, entries, total, band, missing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cells, outOf, comps, roster]);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="bg-muted/60 text-left">
              <th className="border-b border-r border-border px-3 py-2 font-semibold">Student</th>
              {comps.map((c) => (
                <th key={c.id} className={`border-b border-border px-2 py-2 text-center font-medium ${c.isExam ? "border-l bg-brand-soft/40" : ""}`}>
                  <div>{c.name}</div>
                  <div className="mt-0.5 flex items-center justify-center gap-1 text-[11.5px] font-normal text-muted-foreground">
                    <span>marked over</span>
                    {c.editable
                      ? <input value={outOf[c.id]} onChange={(e) => setOutOf({ ...outOf, [c.id]: e.target.value })}
                          type="number" min={1}
                          className="w-14 rounded border border-border bg-card px-1 py-0.5 text-center" data-nums="" />
                      : <b data-nums="">{c.outOf}</b>}
                    <span data-nums="">→ /{c.weight}</span>
                  </div>
                  <div className="mt-1">
                    {c.submitted
                      ? c.published
                        ? <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11.5px] font-medium text-success">published ✓</span>
                        : <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-medium text-primary">submitted ✓</span>
                      : <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] text-muted-foreground">draft</span>}
                  </div>
                </th>
              ))}
              <th className="border-b border-l border-border px-2 py-2 text-center font-semibold">Total /100</th>
              <th className="border-b border-border px-2 py-2 text-center font-semibold">Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, entries, total, band, missing }) => (
              <tr key={r.id} className="border-t border-border">
                <td className="border-r border-border px-3 py-1.5 font-medium">{r.lastName}, {r.firstName}</td>
                {comps.map((c, i) => {
                  const key = `${c.id}_${r.id}`;
                  const cell = entries[i];
                  const over = cell && !cell.absent && cell.raw > oo(c.id);
                  return (
                    <td key={c.id} className={`px-1.5 py-1 text-center align-middle ${c.isExam ? "border-l border-border bg-brand-soft/20" : ""}`}>
                      {c.editable ? (
                        <span className="inline-flex items-center gap-1">
                          <input value={cells[key] ?? ""} placeholder="–" inputMode="decimal"
                            onChange={(e) => setCells({ ...cells, [key]: e.target.value })}
                            title={`Mark over ${oo(c.id)} — type “-” if ${r.firstName} did not write`}
                            className={cn("w-14 rounded border bg-card px-1 py-1 text-center",
                              over ? "border-danger text-danger" : "border-border")} data-nums="" />
                          <span className={cn("w-12 text-left text-[11.5px]",
                            cell === null ? "text-faint" : cell.absent ? "text-warning" : over ? "text-danger" : "text-muted-foreground")} data-nums="">
                            {cell === null ? "" : cell.absent ? "dnw" : over ? `>${oo(c.id)}` : `→ ${conv(c.id, cell)}`}
                          </span>
                        </span>
                      ) : (
                        <span data-nums="">
                          {cell === null ? <span className="text-faint">·</span>
                            : cell.absent ? <span className="text-warning">–</span>
                            : <>{cell.raw} <span className="text-[11.5px] text-muted-foreground">→ {conv(c.id, cell)}</span></>}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="border-l border-border px-2 py-1.5 text-center font-semibold" data-nums=""
                  title={total === null ? `${missing} assessment${missing === 1 ? "" : "s"} still to enter` : undefined}>
                  {total !== null ? total : <span className="font-normal text-faint">· · ·</span>}
                </td>
                <td className="px-2 py-1.5 text-center" data-nums="">{band ? band.grade : <span className="text-faint">·</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {anyEditable && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={doSave} disabled={pending}
            className={btnCls + " inline-flex items-center gap-1.5 disabled:opacity-60"}>
            {pending && busy === "save" && <Loader2 size={13} className="animate-spin" />}
            {pending && busy === "save" ? "Saving…" : "Save draft"}
          </button>
          {comps.filter((c) => c.editable && !c.submitted).map((c) => (
            <button key={c.id} onClick={() => doSubmit(c.id)} disabled={pending}
              className={btnGhostCls + " inline-flex items-center gap-1.5 disabled:opacity-60"}>
              {pending && busy === c.id && <Loader2 size={13} className="animate-spin" />}
              {pending && busy === c.id ? "Submitting…" : <>Submit {c.name} 🔒</>}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-[13px] text-muted-foreground">
        Each mark converts right at the cell (raw ÷ marked-over × weight). Type <b>-</b> for a child who
        did not write. A student&apos;s Total appears only once every column has an entry.
        {isTeacher && " Submitting a column locks it — ask your admin if something must change after that."}
      </p>
    </div>
  );
}

/** Admin path into adjusting submitted columns, kept a deliberate step away. */
export function UnlockDisclosure({ href }: { href: string }) {
  return (
    <details className="mt-4">
      <summary className={btnGhostCls + " inline-flex cursor-pointer list-none"}>⋯ More</summary>
      <div className="mt-2 rounded-lg border border-border p-3 text-sm">
        <p className="text-muted-foreground">
          <b>Adjust submitted scores</b> — for corrections after a teacher has submitted.
        </p>
        <Link href={href} className={btnCls + " mt-2 inline-block"}>Unlock submitted columns</Link>
      </div>
    </details>
  );
}
