"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn, PER_PAGE } from "@/lib/utils";
import { btnGhostCls } from "./kit";

/* URL-driven search + filters + pagination. Every control shows a pending
   spinner while the filtered list loads — the user always gets feedback. */

export function SearchBox({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form className="relative"
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
        className="w-56 rounded-md border border-border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
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

export function Pagination({ page, count }: { page: number; count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pages = Math.max(1, Math.ceil(count / PER_PAGE));
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
