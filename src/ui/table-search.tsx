"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/** The search box every list starts with. Bound to a URL param so refresh,
 *  back and shared links keep the search; the page filters from searchParams. */
export function TableSearch({ placeholder = "Type a name…", param = "q" }: { placeholder?: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get(param) ?? "";
  const [value, setValue] = useState(current);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v.trim()) next.set(param, v.trim()); else next.delete(param);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <form role="search" className="border-b border-border p-3"
      onSubmit={(e) => { e.preventDefault(); if (timer.current) clearTimeout(timer.current); go(value); }}>
      <label className="flex h-12 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25">
        <Search size={18} className="shrink-0 text-muted-foreground" />
        <span className="sr-only">Search</span>
        <input type="search" name={param} value={value} placeholder={placeholder} enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
          onChange={(e) => {
            setValue(e.target.value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => go(e.target.value), 350);
          }} />
      </label>
    </form>
  );
}
