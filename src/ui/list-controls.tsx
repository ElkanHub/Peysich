"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { cn, PER_PAGE } from "@/lib/utils";
import { btnGhostCls } from "./kit";

/* URL-driven search + filters + pagination. Every control shows a pending
   spinner while the filtered list loads — the user always gets feedback. */

export function SearchBox({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form className="relative max-md:min-w-0 max-md:flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        const v = (e.currentTarget[0] as HTMLInputElement).value;
        const p = new URLSearchParams(window.location.search);
        v ? p.set("search", v) : p.delete("search");
        p.delete("page");
        start(() => router.push(`${window.location.pathname}?${p}`));
      }}
    >
      <input
        defaultValue={typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("search") ?? "" : ""}
        placeholder={placeholder}
        className="w-56 rounded-md border border-border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40 max-md:h-10 max-md:w-full max-md:text-[15px]"
      />
      {pending && <Loader2 size={14} className="absolute right-2.5 top-2.5 animate-spin text-primary" />}
    </form>
  );
}

/** URL-driven filter dropdown — applies immediately, spinner while loading. */
export function FilterSelect({ name, options, allLabel }: {
  name: string; options: { value: string; label: string }[]; allLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span className="relative inline-flex items-center">
      <select
        disabled={pending}
        defaultValue={typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get(name) ?? "" : ""}
        onChange={(e) => {
          const v = e.target.value;
          const p = new URLSearchParams(window.location.search);
          v ? p.set(name, v) : p.delete(name);
          p.delete("page");
          start(() => router.push(`${window.location.pathname}?${p}`));
        }}
        className={cn(
          "rounded-md border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40",
          pending && "pr-7 opacity-70",
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {pending && <Loader2 size={14} className="absolute right-2 animate-spin text-primary" />}
    </span>
  );
}

export { PER_PAGE };

export type FilterDef = { name: string; allLabel: string; options: { value: string; label: string }[] };

/** The list filters, both ways: inline selects on a desktop, and on a phone
 *  one "Filter" button (with a count of what is set) that opens a bottom
 *  sheet of option pills. Both write the same URL params, so the page's
 *  searchParams reading does not change. `current` is what the page read. */
export function Filters({ filters, current }: { filters: FilterDef[]; current: Record<string, string | undefined> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map((f) => [f.name, current[f.name] ?? ""])));
  const set = Object.values(draft).filter(Boolean).length;
  const apply = () => {
    const p = new URLSearchParams(window.location.search);
    for (const f of filters) draft[f.name] ? p.set(f.name, draft[f.name]) : p.delete(f.name);
    p.delete("page");
    setOpen(false);
    start(() => router.push(`${window.location.pathname}?${p}`));
  };
  return (
    <>
      <span className="hidden items-center gap-2 md:flex">
        {filters.map((f) => <FilterSelect key={f.name} name={f.name} allLabel={f.allLabel} options={f.options} />)}
      </span>
      <button type="button" onClick={() => setOpen(true)} aria-label="Filter"
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-[var(--shadow-sm)] md:hidden">
        {pending ? <Loader2 size={16} className="animate-spin text-primary" /> : <SlidersHorizontal size={17} />}
        {set > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground" data-nums="">{set}</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Filter">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/50" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-card px-4 pb-[calc(1.25rem+var(--sab))] pt-2.5 shadow-[var(--shadow-lg)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" />
            <p className="mb-3 text-[17px] font-semibold">Filter</p>
            {filters.map((f) => (
              <div key={f.name} className="mb-4">
                <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{f.allLabel}</p>
                <div className="flex flex-wrap gap-2">
                  {[{ value: "", label: f.allLabel }, ...f.options].map((o) => {
                    const on = (draft[f.name] ?? "") === o.value;
                    return (
                      <button key={o.value} type="button" onClick={() => setDraft((d) => ({ ...d, [f.name]: o.value }))}
                        className={cn("h-9 rounded-full border px-3.5 text-[14px] font-medium",
                          on ? "border-ink bg-ink text-ink-text-strong" : "border-border bg-card")}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button type="button" onClick={apply} className={cn(btnGhostCls, "h-12 w-full bg-primary text-[15px] text-primary-foreground hover:bg-brand-strong")}>Show results</button>
          </div>
        </div>
      )}
    </>
  );
}

export function Pagination({ page, count, perPage = PER_PAGE }: { page: number; count: number; perPage?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pages = Math.max(1, Math.ceil(count / perPage));
  const go = (p: number) => {
    const sp = new URLSearchParams(window.location.search);
    sp.set("page", String(p));
    start(() => router.push(`${window.location.pathname}?${sp}`));
  };
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <button disabled={page <= 1 || pending} onClick={() => go(page - 1)} className={cn(btnGhostCls, "disabled:opacity-40")}>Prev</button>
      <span className="flex items-center gap-2 text-muted-foreground">
        {pending && <Loader2 size={13} className="animate-spin text-primary" />}
        Page {page} of {pages} · {count} total
      </span>
      <button disabled={page >= pages || pending} onClick={() => go(page + 1)} className={cn(btnGhostCls, "disabled:opacity-40")}>Next</button>
    </div>
  );
}
