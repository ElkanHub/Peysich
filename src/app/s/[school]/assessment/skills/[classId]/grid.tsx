"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { saveSkillRatings, type SaveResult } from "../../skills-actions";
import { cn } from "@/lib/utils";

// fixed tone ramp; the LABELS come from the school's configurable scale
const TONES = [
  "bg-warning/15 text-warning",
  "bg-primary/10 text-primary",
  "bg-success/15 text-success",
  "bg-brand-soft text-primary",
  "bg-muted text-foreground",
];
type RowStatus = "saving" | "saved" | "error";

/** Preschool grid: tap a box to cycle the scale; every tap saves that one cell. */
export function SkillsGrid({ slug, classId, domains, roster, initial, scale, closed }: {
  slug: string; classId: string;
  domains: { id: string; name: string }[];
  roster: { id: string; firstName: string; lastName: string }[];
  initial: Record<string, string>;
  scale: string[];
  closed: boolean;
}) {
  const [cells, setCells] = useState<Record<string, string>>(initial);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inflight = useRef<Record<string, number>>({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const next = (v: string) => {
    const i = scale.indexOf(v);
    return i === -1 ? scale[0] : i === scale.length - 1 ? "" : scale[i + 1];
  };
  const tone = (v: string) => {
    const i = scale.indexOf(v);
    return i === -1 ? "bg-muted text-muted-foreground" : TONES[i % TONES.length];
  };

  const save = async (rid: string, k: string, v: string) => {
    delete timers.current[k];
    inflight.current[rid] = (inflight.current[rid] ?? 0) + 1;
    setRowStatus((s) => ({ ...s, [rid]: "saving" }));
    let res: SaveResult;
    try { res = await saveSkillRatings(slug, classId, { [k]: v }); }
    catch { res = { ok: false, error: "Not saved — check your connection and tap again" }; }
    inflight.current[rid] -= 1;
    if (res.ok) {
      setRowErr((e) => ({ ...e, [rid]: "" }));
      if (inflight.current[rid] === 0) setRowStatus((s) => ({ ...s, [rid]: "saved" }));
    } else {
      setRowErr((e) => ({ ...e, [rid]: res.error }));
      setRowStatus((s) => ({ ...s, [rid]: "error" }));
    }
  };
  const tap = (rid: string, k: string, v: string) => {
    setCells((c) => ({ ...c, [k]: v }));
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(() => save(rid, k, v), 500); // a few quick taps → one save
  };

  return (
    <div>
      {closed && (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">This term is closed — ratings can no longer change.</p>
      )}
      <div className="overflow-x-auto rounded-lg bg-card shadow-[var(--shadow-md)]">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-[13px] text-muted-foreground">
              <th className="px-3 py-2">Child</th>
              {domains.map((d) => <th key={d.id} className="px-2 py-2 text-center">{d.name}</th>)}
              <th className="px-2 py-2"><span className="sr-only">Saved</span></th>
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => {
              const st = rowStatus[r.id];
              return (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5 font-medium">{r.lastName}, {r.firstName}</td>
                  {domains.map((d) => {
                    const k = `${r.id}:${d.id}`;
                    const v = cells[k] ?? "";
                    return (
                      <td key={d.id} className="px-1 py-1 text-center">
                        <button type="button" disabled={closed} onClick={() => tap(r.id, k, next(v))}
                          aria-label={`${r.firstName} · ${d.name}: ${v || "not rated"} — tap to change`}
                          className={cn("min-h-10 min-w-28 rounded-md px-2 py-1.5 text-[14px] font-medium disabled:opacity-60", tone(v))}>
                          {v || "—"}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-[12.5px]" aria-live="polite">
                    {st === "saving" && <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 size={12} className="animate-spin" />saving…</span>}
                    {st === "saved" && <span className="inline-flex items-center gap-0.5 text-success"><Check size={14} />saved</span>}
                    {st === "error" && <span className="font-medium text-danger">{rowErr[r.id] || "not saved"}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[13.5px] text-muted-foreground">
        Tap a box to choose {scale.join(" · ")}; tap again after the last one to clear it. Every tap saves itself.
      </p>
    </div>
  );
}
