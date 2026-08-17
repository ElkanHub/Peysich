"use client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { btnGhostCls } from "./kit";

/* URL-driven search + pagination (the video's patterns, doc 06). */

export function SearchBox({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = (e.currentTarget[0] as HTMLInputElement).value;
        const p = new URLSearchParams(window.location.search);
        v ? p.set("search", v) : p.delete("search");
        p.delete("page");
        router.push(`${window.location.pathname}?${p}`);
      }}
    >
      <input
        defaultValue={typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("search") ?? "" : ""}
        placeholder={placeholder}
        className="w-56 rounded-md border border-border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
    </form>
  );
}

export const PER_PAGE = 15;

export function Pagination({ page, count }: { page: number; count: number }) {
  const router = useRouter();
  const pages = Math.max(1, Math.ceil(count / PER_PAGE));
  const go = (p: number) => {
    const sp = new URLSearchParams(window.location.search);
    sp.set("page", String(p));
    router.push(`${window.location.pathname}?${sp}`);
  };
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <button disabled={page <= 1} onClick={() => go(page - 1)} className={cn(btnGhostCls, "disabled:opacity-40")}>Prev</button>
      <span className="text-muted-foreground">Page {page} of {pages} · {count} total</span>
      <button disabled={page >= pages} onClick={() => go(page + 1)} className={cn(btnGhostCls, "disabled:opacity-40")}>Next</button>
    </div>
  );
}
