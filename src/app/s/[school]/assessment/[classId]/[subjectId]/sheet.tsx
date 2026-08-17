"use client";
import { useRef, useTransition, useState } from "react";
import { saveScores } from "../../actions";
import { btnCls } from "@/ui/kit";

/** Keyboard-first score grid: type, Enter → next row. Autosubmits all on save. */
export function ScoreSheet({ slug, assessmentId, maxScore, locked, roster, initial }: {
  slug: string; assessmentId: string; maxScore: number; locked: boolean;
  roster: { id: string; firstName: string; lastName: string }[];
  initial: Record<string, number>;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const filled = roster.filter((r) => initial[r.id] !== undefined).length;

  return (
    <form action={(f) => start(async () => { await saveScores(slug, assessmentId, f); setSaved(true); })}>
      <p className="mb-2 text-sm text-muted-foreground">
        {filled}/{roster.length} entered · out of {maxScore}
        {saved && <span className="ml-2 text-success">Saved ✓</span>}
      </p>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {roster.map((r, i) => (
          <div key={r.id} className="flex h-11 items-center justify-between border-b border-border px-4 last:border-0">
            <span className="text-sm font-medium">{r.lastName}, {r.firstName}</span>
            <input
              ref={(el) => { refs.current[i] = el; }}
              name={`sc_${r.id}`} type="number" min={0} max={maxScore}
              defaultValue={initial[r.id] ?? ""} disabled={locked}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); refs.current[i + 1]?.focus(); }
              }}
              className="w-20 rounded-md border border-border px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
            />
          </div>
        ))}
      </div>
      {!locked && (
        <button disabled={pending} className={btnCls + " mt-4"}>
          {pending ? "Saving…" : "Save scores"}
        </button>
      )}
    </form>
  );
}
