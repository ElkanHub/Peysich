"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { matrixAssignSubject, matrixAssignClass, matrixClearCell, matrixClearClass } from "../staff-actions";

/* THE ALLOCATION MATRIX — one grid, whole school. Rows are subjects,
 * columns are classes in school order; tinted columns run class teaching
 * and take ONE drop for the whole column. On subject rows you sweep a
 * horizontal span, then drop (or type) a teacher onto it. Every action
 * saves instantly and the grid re-derives — what you see is what the
 * timetable uses. */

export type MatrixTeacher = { id: string; name: string; color: string; load: number };
export type MatrixColumn = {
  id: string; name: string; ct: boolean;
  main: { id: string; name: string } | null;
  assistants: { id: string; name: string }[];
};
export type MatrixCell =
  | { off: true }
  | {
      off?: false;
      main: { id: string; name: string } | null;
      pinned: boolean; tie: boolean;
      assistants: { id: string; name: string }[];
      pool: { id: string; name: string; role: string }[];
    };
export type MatrixProps = {
  slug: string;
  teachers: MatrixTeacher[];
  bands: { label: string; span: number }[];
  columns: MatrixColumn[];
  subjects: { id: string; name: string }[];
  cells: Record<string, MatrixCell>; // `${subjectId}|${classId}`
};

const first = (n: string) => n.split(" ")[0];
const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("");

export function AllocationMatrix({ slug, teachers, bands, columns, subjects, cells }: MatrixProps) {
  const [mode, setMode] = useState<"main" | "assistant">("main");
  const [sel, setSel] = useState<{ subjectId: string; classIds: string[] }>({ subjectId: "", classIds: [] });
  const [popover, setPopover] = useState<{ subjectId: string; classId: string } | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [pending, start] = useTransition();
  const sweeping = useRef(false);
  const dragId = useRef<string | null>(null);
  const colorOf = useMemo(() => new Map(teachers.map((t) => [t.id, t.color])), [teachers]);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };
  const clearSel = () => setSel({ subjectId: "", classIds: [] });

  const assignSubject = (teacherId: string, subjectId: string, classIds: string[]) => {
    const t = teachers.find((x) => x.id === teacherId);
    start(async () => {
      const r = await matrixAssignSubject(slug, teacherId, subjectId, classIds, mode);
      if (r.ok) say(`${t?.name ?? "Teacher"} → ${subjects.find((s) => s.id === subjectId)?.name}, ` +
        `${classIds.length} class${classIds.length > 1 ? "es" : ""} (${mode})`);
    });
    clearSel(); setPopover(null); setQuery("");
  };
  const assignClass = (teacherId: string, classId: string) => {
    const t = teachers.find((x) => x.id === teacherId);
    start(async () => {
      const r = await matrixAssignClass(slug, teacherId, classId, mode);
      if (r.ok) say(`${t?.name} → ${columns.find((c) => c.id === classId)?.name} ` +
        `(${mode === "main" ? "class teacher — all subjects" : "assistant"})`);
    });
    setPopover(null); setQuery("");
  };

  // coverage: CT columns need a main; subject cells need a resolved main
  const coverage = useMemo(() => {
    let done = 0, total = 0;
    for (const c of columns) if (c.ct) { total++; if (c.main) done++; }
    for (const key of Object.keys(cells)) {
      const cell = cells[key];
      if ("off" in cell && cell.off) continue;
      total++; if (!("off" in cell && cell.off) && (cell as Exclude<MatrixCell, { off: true }>).main) done++;
    }
    return { done, total };
  }, [columns, cells]);

  const cellAt = (subjectId: string, classId: string) => cells[`${subjectId}|${classId}`];

  return (
    <div onPointerUp={() => { sweeping.current = false; }} className="relative">
      {/* ── the teacher drawer ── */}
      <div className="sticky top-12 z-20 -mx-1 mb-3 rounded-lg border border-border bg-card/95 px-3 py-2.5 shadow-[var(--shadow-sm)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">To assign</span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {teachers.filter((t) => t.load === 0).map((t) => (
              <span key={t.id} draggable
                onDragStart={(e) => { dragId.current = t.id; e.dataTransfer.setData("text/plain", t.id); }}
                onDragEnd={() => { dragId.current = null; }}
                title={`${t.name} — drag into the grid`}
                className="inline-flex cursor-grab items-center gap-1.5 rounded-full border-[1.5px] border-border-strong bg-card py-0.5 pl-1 pr-2.5 text-[12.5px] font-semibold transition-transform hover:-translate-y-px active:cursor-grabbing">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: t.color }}>{initials(t.name)}</span>
                {t.name}
              </span>
            ))}
            {teachers.every((t) => t.load > 0) && (
              <span className="py-0.5 text-[13px] font-medium text-success">Everyone has a role ✓</span>
            )}
          </div>
          <div className="flex overflow-hidden rounded-full border-[1.5px] border-border-strong text-[11.5px] font-bold">
            <button type="button" onClick={() => setMode("main")}
              className={mode === "main" ? "bg-primary px-3 py-1 text-primary-foreground" : "bg-card px-3 py-1 text-muted-foreground"}>
              Drop as MAIN
            </button>
            <button type="button" onClick={() => setMode("assistant")}
              className={mode === "assistant" ? "bg-primary px-3 py-1 text-primary-foreground" : "bg-card px-3 py-1 text-muted-foreground"}>
              as ASSISTANT
            </button>
          </div>
        </div>
        {teachers.some((t) => t.load > 0) && (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-[11.5px] font-semibold text-muted-foreground">
              Assigned · {teachers.filter((t) => t.load > 0).length} — drag one out again for another role
            </summary>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {teachers.filter((t) => t.load > 0).map((t) => (
                <span key={t.id} draggable
                  onDragStart={(e) => { dragId.current = t.id; e.dataTransfer.setData("text/plain", t.id); }}
                  onDragEnd={() => { dragId.current = null; }}
                  title={`${t.name} · ${t.load} role${t.load === 1 ? "" : "s"} — drag for another`}
                  className="inline-flex cursor-grab items-center gap-1.5 rounded-full border-[1.5px] border-border bg-muted/60 py-0.5 pl-1 pr-2.5 text-[12.5px] font-semibold opacity-85 transition-transform hover:-translate-y-px active:cursor-grabbing">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: t.color }}>{initials(t.name)}</span>
                  {t.name}
                  <span className="font-bold text-success">✓</span>
                  <span className="text-[10.5px] font-medium text-faint" data-nums="">{t.load}</span>
                </span>
              ))}
            </div>
          </details>
        )}
        <p className="mt-1 text-[12px] text-muted-foreground" data-nums="">
          <b className="text-foreground">Drag</b> a name in, or <b className="text-foreground">click a cell to type</b>.
          Sweep across a subject row to give one teacher several classes at once. Double-click clears.
          <span className="ml-2 font-semibold text-primary">{coverage.done} of {coverage.total} covered</span>
          {pending && <span className="ml-2 text-warning">saving…</span>}
        </p>
      </div>

      {/* ── the grid ── */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-[12px]" data-nums="">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-border bg-muted/70 px-3 py-1 text-left text-[10px] uppercase tracking-wider text-muted-foreground" />
              {bands.map((b) => (
                <th key={b.label} colSpan={b.span}
                  className="border-b border-r border-border bg-muted/70 px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {b.label}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-10 min-w-32 border-b border-r border-border bg-card px-3 py-2 text-left text-[11px] text-muted-foreground">
                CLASS TEACHER →
              </th>
              {columns.map((c) => (
                <th key={c.id} className={`min-w-[92px] border-b border-r border-border px-1.5 py-1.5 align-top ${c.ct ? "bg-primary/10" : "bg-muted/40"}`}>
                  <span className="block text-[12px] font-bold">{c.name}</span>
                  {c.ct ? (
                    <>
                      <span className="block text-[8.5px] font-bold uppercase tracking-wider text-primary">class teaching</span>
                      <div data-ctslot={c.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); if (dragId.current) assignClass(dragId.current, c.id); }}
                        onClick={() => setPopover({ subjectId: "", classId: c.id })}
                        className={`relative mt-1 min-h-10 cursor-pointer rounded-md border-[1.5px] px-1 py-0.5 text-[10.5px] ${
                          c.main ? "border-primary/40 bg-card" : "border-dashed border-primary/50 bg-card/60 text-primary/70"}`}>
                        {c.main ? (
                          <>
                            <span className="group flex items-center justify-center gap-1 font-bold"
                              style={{ color: colorOf.get(c.main.id) }}>
                              {c.main.name}
                              <button type="button" title="Remove"
                                onClick={(e) => { e.stopPropagation(); start(async () => { await matrixClearClass(slug, c.id, c.main!.id); }); }}
                                className="hidden text-danger group-hover:inline">×</button>
                            </span>
                            {c.assistants.length > 0 && (
                              <span className="block text-[9px] text-muted-foreground">
                                + {c.assistants.map((a) => (
                                  <span key={a.id} className="group/a">
                                    {first(a.name)}
                                    <button type="button" title="Remove assistant"
                                      onClick={(e) => { e.stopPropagation(); start(async () => { await matrixClearClass(slug, c.id, a.id); }); }}
                                      className="ml-0.5 hidden text-danger group-hover/a:inline">×</button>{" "}
                                  </span>
                                ))} asst.
                              </span>
                            )}
                          </>
                        ) : "drop / click"}
                        {popover?.classId === c.id && popover.subjectId === "" && (
                          <TeacherPopover teachers={teachers} query={query} setQuery={setQuery}
                            onPick={(tid) => assignClass(tid, c.id)} onClose={() => setPopover(null)} />
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="block text-[8.5px] uppercase tracking-wider text-faint">subject teaching</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub) => (
              <tr key={sub.id}>
                <th className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-0 text-left text-[12.5px] font-semibold">
                  {sub.name}
                </th>
                {columns.map((col, ci) => {
                  if (col.ct) {
                    return (
                      <td key={col.id} className="h-10 border-b border-r border-border bg-primary/10 text-center">
                        <span className="text-[10px] text-primary/50">{col.main ? initials(col.main.name) : "—"}</span>
                      </td>
                    );
                  }
                  const cell = cellAt(sub.id, col.id);
                  if (!cell || ("off" in cell && cell.off)) {
                    return <td key={col.id} className="h-10 border-b border-r border-border bg-muted/50" title="Not on this class's subject list" />;
                  }
                  const c = cell as Exclude<MatrixCell, { off: true }>;
                  const selected = sel.subjectId === sub.id && sel.classIds.includes(col.id);
                  const prevSame = ci > 0 && !columns[ci - 1].ct &&
                    ((cellAt(sub.id, columns[ci - 1].id) as Exclude<MatrixCell, { off: true }> | undefined)?.main?.id ?? "≠") === (c.main?.id ?? "∅");
                  const nextSame = ci < columns.length - 1 && !columns[ci + 1].ct &&
                    ((cellAt(sub.id, columns[ci + 1].id) as Exclude<MatrixCell, { off: true }> | undefined)?.main?.id ?? "≠") === (c.main?.id ?? "∅");
                  return (
                    <td key={col.id} data-cell={`${sub.id}|${col.id}`}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        sweeping.current = true;
                        setSel({ subjectId: sub.id, classIds: [col.id] });
                      }}
                      onPointerEnter={() => {
                        if (!sweeping.current || sel.subjectId !== sub.id) return;
                        setSel((s) => s.classIds.includes(col.id) ? s : { ...s, classIds: [...s.classIds, col.id] });
                      }}
                      onClick={() => {
                        if (sel.classIds.length <= 1) { setPopover({ subjectId: sub.id, classId: col.id }); setSel({ subjectId: sub.id, classIds: [col.id] }); }
                      }}
                      onDoubleClick={() => {
                        if (c.main) start(async () => { await matrixClearCell(slug, sub.id, col.id); });
                        setPopover(null); setQuery(""); clearSel();
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!dragId.current) return;
                        const ids = selected && sel.classIds.length > 1 ? sel.classIds : [col.id];
                        assignSubject(dragId.current, sub.id, ids);
                      }}
                      className={`relative h-10 cursor-cell border-b border-r border-border text-center align-middle ${
                        selected ? "bg-warning-soft shadow-[inset_0_0_0_1.5px_var(--warning)]" : "bg-card"}`}>
                      {c.main ? (
                        <span title={`${c.main.name}${c.pinned ? " (pinned to this class)" : ""}${c.assistants.length ? ` + ${c.assistants.map((a) => a.name).join(", ")}` : ""} — double-click to clear`}
                          className={`absolute inset-y-1.5 flex items-center justify-center gap-1 overflow-hidden whitespace-nowrap text-[11px] font-bold text-white ${
                            prevSame && nextSame ? "inset-x-0" : prevSame ? "inset-x-0 rounded-r-md ltr:mr-0.5" : nextSame ? "inset-x-0 rounded-l-md ltr:ml-0.5" : "inset-x-1 rounded-md"}`}
                          style={{ background: colorOf.get(c.main.id) ?? "#888" }}>
                          {!prevSame && first(c.main.name)}
                          {c.pinned && !prevSame && <span title="Pinned" className="text-[8px]">📌</span>}
                          {c.assistants.length > 0 && !nextSame && (
                            <span className="rounded-full bg-white px-1 text-[8.5px] font-extrabold text-foreground">+{c.assistants.length}</span>
                          )}
                        </span>
                      ) : c.tie ? (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning" title="Two teachers are eligible — click to pick">
                          pick…
                        </span>
                      ) : (
                        <span className="text-faint">·</span>
                      )}
                      {popover?.subjectId === sub.id && popover.classId === col.id && (
                        <TeacherPopover teachers={c.tie ? c.pool.map((p) => ({ ...teachers.find((t) => t.id === p.id)!, name: `${p.name}${p.role === "assistant" ? " (assistant)" : ""}` })) : teachers}
                          query={query} setQuery={setQuery}
                          onPick={(tid) => assignSubject(tid, sub.id, sel.classIds.length > 1 ? sel.classIds : [col.id])}
                          onClose={() => { setPopover(null); clearSel(); }} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded-[3px] bg-primary/15 align-[-2px]" />class-teaching column — one drop covers every subject</span>
        <span><i className="mr-1.5 inline-block h-3 w-3 rounded-[3px] bg-warning-soft align-[-2px]" />swept selection — drop a teacher on it</span>
        <span>📌 pinned to that exact class · same teacher, same color everywhere</span>
      </div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-md)]">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Click-to-type: a small search-and-pick list anchored to the cell. */
function TeacherPopover({ teachers, query, setQuery, onPick, onClose }: {
  teachers: MatrixTeacher[]; query: string; setQuery: (q: string) => void;
  onPick: (id: string) => void; onClose: () => void;
}) {
  const shown = teachers.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-full z-40 mt-1 w-48 -translate-x-1/2 rounded-lg border border-border bg-card p-1.5 text-left shadow-[var(--shadow-lg)]">
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); if (e.key === "Enter" && shown[0]) onPick(shown[0].id); }}
        placeholder="Type a name…"
        className="mb-1 w-full rounded-md border border-border bg-card px-2 py-1 text-[12.5px] outline-none focus:border-primary" />
      <div className="max-h-44 overflow-y-auto">
        {shown.map((t) => (
          <button key={t.id} type="button" onClick={() => onPick(t.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[12.5px] font-medium hover:bg-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />{t.name}
          </button>
        ))}
        {shown.length === 0 && <p className="px-2 py-1 text-[12px] text-muted-foreground">No match.</p>}
      </div>
      <button type="button" onClick={onClose}
        className="mt-1 w-full rounded-md px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-muted">
        Cancel (Esc)
      </button>
    </div>
  );
}
