"use client";
import { useState } from "react";

/** The tab checkboxes with one-click presets; the form posts t_<key>=on. */
export function TabPicker({ tabs, presets, initial }: {
  tabs: { key: string; label: string }[];
  presets: Record<string, { label: string; tabs: string[] }>;
  initial: string[];
}) {
  const [on, setOn] = useState<Set<string>>(new Set(initial));
  const toggle = (k: string) => setOn((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 text-[12.5px]">
        <button type="button" onClick={() => setOn(new Set(tabs.map((t) => t.key)))} className="rounded-full border border-border px-2.5 py-1 hover:bg-muted">Owner · everything</button>
        {Object.entries(presets).map(([k, p]) => (
          <button key={k} type="button" onClick={() => setOn(new Set(p.tabs))} className="rounded-full border border-border px-2.5 py-1 hover:bg-muted">{p.label}</button>
        ))}
      </div>
      <div className="mt-2 grid gap-1 sm:grid-cols-3">
        {tabs.map((t) => (
          <label key={t.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name={`t_${t.key}`} checked={on.has(t.key)} onChange={() => toggle(t.key)} />
            {t.label}
          </label>
        ))}
      </div>
    </div>
  );
}
