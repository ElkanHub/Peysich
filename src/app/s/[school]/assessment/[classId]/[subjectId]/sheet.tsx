"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { lockColumn, saveMark, setOutOf, type CellResult } from "../../actions";
import { ConfirmButton } from "@/ui/confirm";
import { btnCls, btnGhostCls } from "@/ui/kit";
import { cn } from "@/lib/utils";

export type SheetComp = {
  id: string; name: string; weight: number; isExam: boolean;
  outOf: number; started: boolean; submitted: boolean; published: boolean; editable: boolean;
};
type Cell = { raw: number; absent: boolean };
type RowStatus = "saving" | "saved" | "error";

const DID_NOT_WRITE = new Set(["-", "–", "a", "abs", "absent"]);
/** School-configured names, in the teacher's words where the audit asked. */
export const plainName = (name: string) => name.replace(/^C\.?A\.?(?=\s|$)/i, "Class work");

/** The live score sheet. Every mark saves itself as it is typed (one server
 *  call per cell, debounced; blur or Enter saves at once). Conversion happens
 *  AT the cell (“27 → 9/10”), a dash means “did not write”, and a pupil's
 *  Total only appears once every column has an entry. */
export function Sheet({ slug, classId, subjectId, className, roster, comps, initial, bands, lastOutOf, isTeacher }: {
  slug: string; classId: string; subjectId: string; className: string;
  roster: { id: string; firstName: string; lastName: string }[];
  comps: SheetComp[];
  initial: Record<string, Cell>;
  bands: { min: number; grade: string; remark: string }[];
  lastOutOf: number;
  isTeacher: boolean;
}) {
  // cell text state: "" = nothing entered, "-" = did not write, else the raw mark
  const [cells, setCells] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial)) m[k] = v.absent ? "-" : String(v.raw);
    return m;
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [outOf, setOutOf_] = useState<Record<string, string>>(() =>
    Object.fromEntries(comps.map((c) => [c.id, String(c.outOf)])));
  const [ooErr, setOoErr] = useState<Record<string, string>>({});
  const [started, setStarted] = useState<Set<string>>(() => new Set(comps.filter((c) => c.started).map((c) => c.id)));
  const [starting, setStarting] = useState<string | null>(null);
  const [panelFor, setPanelFor] = useState<string | null>(null);

  const savedRef = useRef<Record<string, string>>({ ...cells });
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inflight = useRef<Record<string, number>>({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const compById = (cid: string) => comps.find((c) => c.id === cid)!;
  const oo = (cid: string) => Math.max(1, Number(outOf[cid]) || compById(cid).outOf);
  const check = (cid: string, v: string): { cell: Cell | null; error?: string } => {
    const t = v.trim().toLowerCase();
    if (t === "") return { cell: null };
    if (DID_NOT_WRITE.has(t)) return { cell: { raw: 0, absent: true } };
    const n = Number(t);
    if (!Number.isFinite(n)) return { cell: null, error: "Not a number" };
    if (n < 0) return { cell: null, error: "Below 0" };
    if (n > oo(cid)) return { cell: null, error: `Above ${oo(cid)}` };
    return { cell: { raw: n, absent: false } };
  };
  const conv = (cid: string, cell: Cell) => {
    if (cell.absent) return 0;
    return Math.round((Math.min(cell.raw, oo(cid)) / oo(cid)) * compById(cid).weight * 10) / 10;
  };

  /* ── autosave: one call per cell; debounced while typing, immediate on blur/Enter ── */
  const flush = async (cid: string, rid: string, typed: string) => {
    const key = `${cid}_${rid}`;
    clearTimeout(timers.current[key]); delete timers.current[key];
    const value = typed.trim();
    if (check(cid, value).error) return;            // the cell will not save until fixed
    if (value === (savedRef.current[key] ?? "")) return;
    inflight.current[rid] = (inflight.current[rid] ?? 0) + 1;
    setRowStatus((s) => ({ ...s, [rid]: "saving" }));
    let res: CellResult;
    try { res = await saveMark(slug, classId, subjectId, cid, rid, value); }
    catch { res = { ok: false, error: "Not saved — check your connection and type it again" }; }
    inflight.current[rid] -= 1;
    if (res.ok) {
      savedRef.current[key] = value;
      setErrs((e) => { const rest = { ...e }; delete rest[key]; return rest; });
      if (inflight.current[rid] === 0) setRowStatus((s) => ({ ...s, [rid]: "saved" }));
    } else {
      setErrs((e) => ({ ...e, [key]: res.error }));
      setRowStatus((s) => ({ ...s, [rid]: "error" }));
    }
  };
  const onChange = (cid: string, rid: string, v: string) => {
    const key = `${cid}_${rid}`;
    setCells((c) => ({ ...c, [key]: v }));
    const { error } = check(cid, v);
    setErrs((e) => { const rest = { ...e }; delete rest[key]; return error ? { ...rest, [key]: error } : rest; });
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => flush(cid, rid, v), 700); // ponytail: fixed debounce; tune if 2G users complain
  };
  const move = (cid: string, idx: number, dir: 1 | -1) => {
    const el = document.querySelector<HTMLInputElement>(`[data-cell="${cid}:${idx + dir}"]`);
    if (el) { el.focus(); el.select(); }
  };

  /* ── marked out of: set once when a test is started, editable in the header after ── */
  const saveOutOf = async (cid: string, raw: string) => {
    const n = Math.round(Number(raw));
    const res = await setOutOf(slug, classId, subjectId, cid, n).catch<CellResult>(() =>
      ({ ok: false, error: "Not saved — check your connection" }));
    setOoErr((e) => ({ ...e, [cid]: res.ok ? "" : res.error }));
    if (res.ok) setOutOf_((o) => ({ ...o, [cid]: String(n) }));
    return res.ok;
  };
  const toStart = comps.filter((c) => c.editable && !started.has(c.id));
  const starting_ = toStart.find((c) => c.id === panelFor) ?? toStart[0];
  const [startValue, setStartValue] = useState(String(lastOutOf));

  const rows = useMemo(() => roster.map((r) => {
    const entries = comps.map((c) => check(c.id, cells[`${c.id}_${r.id}`] ?? "").cell);
    const complete = entries.every((e) => e !== null);
    const total = complete
      ? Math.round(entries.reduce((a, e, i) => a + conv(comps[i].id, e!), 0) * 10) / 10
      : null;
    const band = total !== null ? (bands.find((b) => total >= b.min) ?? bands.at(-1)!) : null;
    const missing = entries.filter((e) => e === null).length;
    return { r, entries, total, band, missing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cells, outOf, comps, roster]);

  const anyEditable = comps.some((c) => c.editable);
  const anySaving = Object.values(rowStatus).includes("saving");

  return (
    <div>
      {starting_ && (
        <form className="mb-4 rounded-lg border border-primary/40 bg-brand-soft/30 p-4"
          onSubmit={async (e) => {
            e.preventDefault(); setStarting(starting_.id);
            if (await saveOutOf(starting_.id, startValue)) {
              setStarted((s) => new Set(s).add(starting_.id)); setPanelFor(null);
            }
            setStarting(null);
          }}>
          <p className="text-[15px] font-semibold">Start {plainName(starting_.name)}</p>
          <label className="mt-2 flex flex-wrap items-center gap-2 text-[15px]">
            This test was marked out of
            <input value={startValue} onChange={(e) => setStartValue(e.target.value)} autoFocus
              type="number" min={1} step={1} inputMode="numeric" required
              className="h-11 w-24 rounded-md border border-border bg-card px-2 text-center text-[18px] font-semibold" data-nums="" />
            <button type="submit" disabled={starting !== null} className={btnCls + " h-11"}>
              {starting ? <Loader2 size={14} className="animate-spin" /> : null} Start
            </button>
          </label>
          {ooErr[starting_.id] && <p className="mt-2 text-[14px] text-danger">{ooErr[starting_.id]}</p>}
          {toStart.length > 1 && (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Not started yet:{" "}
              {toStart.map((c) => (
                <button key={c.id} type="button" onClick={() => setPanelFor(c.id)}
                  className={cn("mr-2 underline-offset-2", c.id === starting_.id ? "font-semibold text-foreground" : "underline")}>
                  {plainName(c.name)}
                </button>
              ))}
            </p>
          )}
        </form>
      )}

      <div className="overflow-x-auto rounded-lg bg-card shadow-[var(--shadow-md)]">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="bg-muted/60 text-left align-top">
              <th className="border-b border-r border-border px-3 py-2 font-semibold">Pupil</th>
              {comps.map((c) => {
                const on = started.has(c.id);
                return (
                  <th key={c.id} className={`border-b border-border px-2 py-2 text-center font-medium ${c.isExam ? "border-l bg-brand-soft/40" : ""}`}>
                    <div>{plainName(c.name)}</div>
                    <div className="mt-1 flex items-center justify-center gap-1 text-[12.5px] font-normal text-muted-foreground">
                      <span>marked out of</span>
                      {c.editable && on
                        ? <input defaultValue={outOf[c.id]} key={outOf[c.id]}
                            onBlur={(e) => { if (e.target.value !== outOf[c.id]) saveOutOf(c.id, e.target.value); }}
                            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                            type="number" min={1} step={1} inputMode="numeric" aria-label={`${plainName(c.name)} marked out of`}
                            className="h-8 w-16 rounded-md border border-border bg-card px-1 text-center text-[14px] font-semibold text-foreground" data-nums="" />
                        : <b className="text-foreground" data-nums="">{on ? c.outOf : "?"}</b>}
                    </div>
                    {ooErr[c.id] && on && <div className="mt-1 text-[12.5px] font-normal text-danger">{ooErr[c.id]}</div>}
                    <div className="mt-0.5 text-[12.5px] font-normal text-muted-foreground" data-nums="">counts for {c.weight} of 100</div>
                    <div className="mt-1">
                      {c.submitted
                        ? c.published
                          ? <span className="rounded-full bg-success/10 px-2 py-0.5 text-[12px] font-medium text-success">published ✓</span>
                          : <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[12px] font-medium text-primary">locked ✓</span>
                        : !on && c.editable
                          ? <button type="button" onClick={() => setPanelFor(c.id)} className="rounded-full border border-border px-2 py-0.5 text-[12px] font-medium hover:bg-muted">Start</button>
                          : <span className="rounded-full bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">not sent yet</span>}
                    </div>
                  </th>
                );
              })}
              <th className="border-b border-l border-border px-2 py-2 text-center font-semibold">Total /100</th>
              <th className="border-b border-border px-2 py-2 text-center font-semibold">Grade</th>
              {anyEditable && <th className="border-b border-border px-2 py-2 text-center font-normal text-muted-foreground"><span className="sr-only">Saved</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, entries, total, band, missing }, idx) => {
              const st = rowStatus[r.id];
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="border-r border-border px-3 py-1.5 font-medium">{r.lastName}, {r.firstName}</td>
                  {comps.map((c, i) => {
                    const key = `${c.id}_${r.id}`;
                    const cell = entries[i];
                    const err = errs[key];
                    const on = started.has(c.id);
                    return (
                      <td key={c.id} className={`px-1.5 py-1 text-center align-middle ${c.isExam ? "border-l border-border bg-brand-soft/20" : ""}`}>
                        {c.editable ? (
                          <span className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1">
                              <input value={cells[key] ?? ""} placeholder="–" inputMode="decimal" disabled={!on}
                                data-cell={`${c.id}:${idx}`} aria-invalid={!!err}
                                onChange={(e) => onChange(c.id, r.id, e.target.value)}
                                onBlur={(e) => flush(c.id, r.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); move(c.id, idx, 1); }
                                  else if (e.key === "ArrowUp") { e.preventDefault(); move(c.id, idx, -1); }
                                }}
                                title={on ? `Mark out of ${oo(c.id)} — type a, abs or - if ${r.firstName} did not write` : "Start this test first"}
                                className={cn("h-9 w-14 rounded border bg-card px-1 text-center text-[15px] disabled:bg-muted/50",
                                  err ? "border-danger text-danger" : "border-border")} data-nums="" />
                              <span className={cn("w-12 text-left text-[12px]",
                                cell === null ? "text-faint" : cell.absent ? "text-warning" : "text-muted-foreground")} data-nums="">
                                {cell === null ? "" : cell.absent ? "–" : `→ ${conv(c.id, cell)}`}
                              </span>
                            </span>
                            {/* a phone's number keypad has no letters — one tap does what typing "a" does */}
                            {on && (
                              <button type="button" tabIndex={-1}
                                onClick={() => { onChange(c.id, r.id, cell?.absent ? "" : "-"); flush(c.id, r.id, cell?.absent ? "" : "-"); }}
                                className={cn("mt-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium",
                                  cell?.absent ? "border-warning bg-warning-soft text-warning" : "border-border text-muted-foreground hover:bg-muted")}>
                                {cell?.absent ? "did not write ✓" : "did not write"}
                              </button>
                            )}
                            {err && <span className="mt-0.5 text-[12.5px] font-medium text-danger">{err}</span>}
                          </span>
                        ) : (
                          <span data-nums="">
                            {cell === null ? <span className="text-faint">·</span>
                              : cell.absent ? <span className="text-warning" title="did not write">–</span>
                              : <>{cell.raw} <span className="text-[12px] text-muted-foreground">→ {conv(c.id, cell)}</span></>}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border-l border-border px-2 py-1.5 text-center font-semibold" data-nums=""
                    title={total === null ? `${missing} test${missing === 1 ? "" : "s"} still to enter` : undefined}>
                    {total !== null ? total : <span className="font-normal text-faint">· · ·</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center" data-nums="">{band ? band.grade : <span className="text-faint">·</span>}</td>
                  {anyEditable && (
                    <td className="px-2 py-1.5 text-center text-[12.5px]" aria-live="polite">
                      {st === "saving" && <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 size={12} className="animate-spin" />saving…</span>}
                      {st === "saved" && <span className="inline-flex items-center gap-0.5 text-success"><Check size={14} />saved</span>}
                      {st === "error" && <span className="font-medium text-danger">not saved</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {anyEditable && comps.some((c) => c.editable && !c.submitted && started.has(c.id)) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {comps.filter((c) => c.editable && !c.submitted && started.has(c.id)).map((c) => (
            <form key={c.id} action={lockColumn.bind(null, slug, classId, subjectId, c.id)}>
              <ConfirmButton title={`Lock ${plainName(c.name)} for ${className}?`}
                body="You will not be able to change it. The head can unlock it."
                confirmLabel="Lock" disabled={anySaving} className={btnGhostCls}>
                Lock {plainName(c.name)}
              </ConfirmButton>
            </form>
          ))}
        </div>
      )}
      <p className="mt-3 text-[13.5px] text-muted-foreground">
        Every mark saves itself; a tick appears beside the row. Press <b>Enter</b> to move down to the next pupil.
        {" "}<b>–</b> = did not write (type <b>a</b>, <b>abs</b> or <b>-</b>). Each mark converts right at the cell
        (mark ÷ marked out of × what the test counts for). A pupil&apos;s Total appears only once every test has an entry.
        {isTeacher && " Locking a test means you cannot change it — the head can unlock it."}
      </p>
    </div>
  );
}

/** Admin path into adjusting locked columns, kept a deliberate step away. */
export function UnlockDisclosure({ href }: { href: string }) {
  return (
    <details className="mt-4">
      <summary className={btnGhostCls + " inline-flex cursor-pointer list-none"}>⋯ More</summary>
      <div className="mt-2 rounded-lg border border-border p-3 text-sm">
        <p className="text-muted-foreground">
          <b>Unlock a locked test</b> — for corrections after a teacher has locked it.
        </p>
        <Link href={href} className={btnCls + " mt-2 inline-block"}>Unlock a locked test</Link>
      </div>
    </details>
  );
}
