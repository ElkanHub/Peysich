"use client";
import { useState, useTransition } from "react";
import { saveSkillRatings } from "../../skills-actions";
import { btnCls } from "@/ui/kit";
import { cn } from "@/lib/utils";

// fixed tone ramp; the LABELS come from the school's configurable scale
const TONES = [
  "bg-warning/15 text-warning",
  "bg-primary/10 text-primary",
  "bg-success/15 text-success",
  "bg-brand-soft text-primary",
  "bg-muted text-foreground",
];

export function SkillsGrid({ slug, classId, domains, roster, initial, scale }: {
  slug: string; classId: string;
  domains: { id: string; name: string }[];
  roster: { id: string; firstName: string; lastName: string }[];
  initial: Record<string, string>;
  scale: string[];
}) {
  const [cells, setCells] = useState<Record<string, string>>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const next = (v: string) => {
    const i = scale.indexOf(v);
    return i === -1 ? scale[0] : i === scale.length - 1 ? "" : scale[i + 1];
  };
  const tone = (v: string) => {
    const i = scale.indexOf(v);
    return i === -1 ? "bg-muted text-muted-foreground" : TONES[i % TONES.length];
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-lg bg-card shadow-[var(--shadow-md)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Child</th>
              {domains.map((d) => <th key={d.id} className="px-2 py-2 text-center">{d.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5 font-medium">{r.lastName}, {r.firstName}</td>
                {domains.map((d) => {
                  const k = `${r.id}:${d.id}`;
                  const v = cells[k] ?? "";
                  return (
                    <td key={d.id} className="px-1 py-1 text-center">
                      <button type="button"
                        onClick={() => { setCells({ ...cells, [k]: next(v) }); setSaved(false); }}
                        className={cn("w-24 rounded py-1 text-xs", tone(v))}>
                        {v || "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button disabled={pending} className={btnCls + " mt-4"}
        onClick={() => start(async () => {
          await saveSkillRatings(slug, classId, cells);
          setSaved(true);
        })}>
        {pending ? "Saving…" : saved ? "Saved ✓" : "Save ratings"}
      </button>
    </div>
  );
}
