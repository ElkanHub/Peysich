"use client";
import { useRef, useState } from "react";
import { placeEntry, clearEntry, setEntryTeacher } from "./actions";
import { SubmitButton } from "@/ui/feedback";

/* Inline slot editing — the cell IS the editor. Click a period and a small
 * panel opens right there: one click on a subject places (or replaces) the
 * lesson, Remove clears it, and when several teachers are eligible the
 * period's teacher is picked in the same panel. No scrolling to a card. */

export type SlotSubject = { id: string; name: string; teacher: string | null };
export type SlotEntry = {
  id: string; subjectId: string; chosen: boolean;
  teacherName: string | null;
  pool: { id: string; name: string; role: string }[];
};

export function SlotEditor({ slug, classId, day, slotId, base, label, entry, subjects }: {
  slug: string; classId: string; day: string; slotId: string; base: string;
  /** abbreviated subject label for the cell, or null when the period is free */
  label: string | null;
  entry: SlotEntry | null;
  subjects: SlotSubject[];
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, up: false, maxH: 320 });
  const btn = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) {
      // open downward when there's room, otherwise flip above the cell —
      // and never let the panel run past the viewport edge
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 280 && above > below;
      setPos({
        x: Math.min(Math.max(8 + 128, r.left + r.width / 2), window.innerWidth - 8 - 128),
        y: up ? r.top - 4 : r.bottom + 4,
        up,
        maxH: Math.max(180, Math.min(420, up ? above : below)),
      });
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <button ref={btn} type="button" onClick={toggle} data-slot={`${day}:${slotId}`}
        title={entry ? `${subjects.find((s) => s.id === entry.subjectId)?.name ?? ""}${entry.teacherName ? ` — ${entry.teacherName}` : ""}` : "Place a lesson"}
        className="block w-full px-1 py-2 text-center hover:bg-primary/10">
        {label
          ? <span className="font-medium">{label}</span>
          : <span className="text-faint">+</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 flex w-64 flex-col rounded-lg border border-border bg-card p-1.5 text-left shadow-[var(--shadow-lg)]"
            style={{
              left: pos.x, top: pos.y, maxHeight: pos.maxH,
              transform: pos.up ? "translate(-50%, -100%)" : "translateX(-50%)",
            }}>
            {entry?.teacherName && (
              <p className="px-2 pb-1 pt-0.5 text-[11.5px] text-muted-foreground">
                Taught by <b className="text-foreground">{entry.teacherName}</b>
                {entry.chosen && " (chosen for this period)"}
              </p>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {subjects.map((s) => (
                <form key={s.id} action={placeEntry.bind(null, slug, classId, day, slotId)}>
                  <input type="hidden" name="subjectId" value={s.id} />
                  <input type="hidden" name="back" value={base} />
                  <SubmitButton pendingText="Placing…"
                    className={`flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted ${
                      entry?.subjectId === s.id ? "bg-brand-soft font-semibold text-primary" : "font-medium"}`}>
                    <span className="min-w-0 truncate">
                      {entry?.subjectId === s.id && "✓ "}{s.name}
                    </span>
                    <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
                      {s.teacher ?? "no teacher yet"}
                    </span>
                  </SubmitButton>
                </form>
              ))}
            </div>
            {entry && entry.pool.length > 1 && (
              <form action={setEntryTeacher.bind(null, slug, entry.id)}
                className="mt-1 flex items-center gap-1.5 border-t border-border px-1 pt-1.5">
                <input type="hidden" name="back" value={base} />
                <select name="teacherId" defaultValue={entry.chosen ? undefined : ""}
                  className="min-w-0 flex-1 rounded-md border border-border bg-card px-1.5 py-1 text-[12px]">
                  <option value="">Auto teacher</option>
                  {entry.pool.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.role === "assistant" ? " (assistant)" : ""}
                    </option>
                  ))}
                </select>
                <SubmitButton pendingText="…"
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-[12px] font-medium hover:bg-muted">
                  Set
                </SubmitButton>
              </form>
            )}
            {entry && (
              <form action={clearEntry.bind(null, slug, entry.id)} className="mt-1 border-t border-border pt-1">
                <input type="hidden" name="back" value={base} />
                <SubmitButton pendingText="Removing…"
                  className="w-full rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-danger hover:bg-danger/10">
                  Remove this lesson
                </SubmitButton>
              </form>
            )}
          </div>
        </>
      )}
    </>
  );
}
