"use client";
import { useState, useTransition } from "react";
import { saveSkillRatings } from "../../skills-actions";
import { btnCls } from "@/ui/kit";
import { cn } from "@/lib/utils";

const CYCLE: Record<string, string> = { "": "emerging", emerging: "developing", developing: "secure", secure: "" };
const STYLE: Record<string, string> = {
  emerging: "bg-warning/15 text-warning",
  developing: "bg-primary/10 text-primary",
  secure: "bg-success/15 text-success",
};

export function SkillsGrid({ slug, classId, domains, roster, initial }: {
  slug: string; classId: string;
  domains: { id: string; name: string }[];
  roster: { id: string; firstName: string; lastName: string }[];
  initial: Record<string, string>;
}) {
  const [cells, setCells] = useState<Record<string, string>>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
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
                        onClick={() => { setCells({ ...cells, [k]: CYCLE[v] }); setSaved(false); }}
                        className={cn("w-24 rounded py-1 text-xs",
                          v ? STYLE[v] : "bg-muted text-muted-foreground")}>
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
