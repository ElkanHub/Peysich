"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import type { Section } from "./steps";
import { Steps } from "./how-to-button";

/** Every step for this person, top to bottom, with a search box that
 *  filters as you type. Each entry has an anchor (#id) so the "Show me
 *  how" button can land on it. */
export function HelpList({ sections }: { sections: Section[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const hit = (t: string) => t.toLowerCase().includes(needle);
  const shown = needle
    ? sections.map((s) => ({ ...s, items: s.items.filter((i) => hit(i.title) || hit(i.why) || hit(i.where) || i.steps.some(hit)) })).filter((s) => s.items.length)
    : sections;

  return (
    <div>
      <label className="relative block">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to do? e.g. record a payment"
          className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-[16px] shadow-[var(--shadow-sm)] outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" />
      </label>

      {!needle && (
        <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-2">
          {sections.map((s) => (
            <a key={s.key} href={`#${s.key}`} className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[14px] font-medium hover:bg-muted">{s.title}</a>
          ))}
        </nav>
      )}

      {shown.length === 0 && <p className="mt-8 text-[16px] text-muted-foreground">Nothing matches “{q}”. Try another word, or tap a section above.</p>}

      {shown.map((s) => (
        <section key={s.key} id={s.key} className="mt-10 scroll-mt-24">
          <h2 className="text-[22px] font-bold tracking-tight">{s.title}</h2>
          <div className="mt-3 space-y-3">
            {s.items.map((it) => (
              <article key={it.id} id={it.id} className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
                <h3 className="text-[18px] font-semibold leading-snug">{it.title}</h3>
                <p className="mt-1 text-[15px] text-muted-foreground">{it.why}</p>
                <Steps it={it} className="mt-3" />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
