"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HowTo, Section } from "./steps";
import { Rich } from "./rich";

type ForPage = typeof import("./steps").forPage;
/** The steps are 40 KB of text — fetched the first time the panel opens,
 *  not on every page load. */
let forPage: ForPage | null = null;

/** The one button that is on EVERY page, in the same place, in the school's
 *  colour: "Show me how". It drops down only the steps that belong to the
 *  page you are on. At the bottom, the way to every step, top to bottom. */
export function HowToButton({ role }: { role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(!!forPage);
  const sections: Section[] = loaded && forPage ? forPage(role, pathname) : [];

  useEffect(() => {
    if (!open) return;
    if (!forPage) import("./steps").then((m) => { forPage = m.forPage; setLoaded(true); });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  // a new page closes the panel — tracked by comparing, not by an effect
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) { setSeenPath(pathname); setOpen(false); setOpenId(null); }

  if (role === "platform_admin") return null;
  const items = sections.flatMap((s) => s.items);
  const first = sections[0];

  return (
    <div className="relative shrink-0" ref={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog"
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary pl-3 pr-3.5 text-[14px] font-semibold text-primary-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-strong">
        <LifeBuoy size={16} /> Show me how
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 lg:bg-transparent" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="How to do things on this page"
            className="fixed inset-x-3 top-[calc(3.25rem+var(--sat)+3.5rem)] z-50 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-lg)] lg:absolute lg:inset-x-auto lg:right-0 lg:top-[calc(100%+8px)] lg:w-[460px]">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="text-[15px] font-bold">On this page</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"><X size={18} /></button>
            </div>

            {!loaded ? (
              <p className="px-4 py-5 text-[15px] text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-5 text-[15px] text-muted-foreground">Nothing to do here but read. Every step for the whole app is one tap below.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((it) => <Item key={it.id} it={it} open={openId === it.id} onToggle={() => setOpenId(openId === it.id ? null : it.id)} />)}
              </ul>
            )}

            <div className="border-t border-border bg-muted/50 px-4 py-3">
              <Link href={`/help${first ? `#${first.key}` : ""}`} onClick={() => setOpen(false)}
                className="flex h-11 items-center justify-center rounded-full border border-border bg-card text-[15px] font-semibold hover:bg-muted">
                See every step, top to bottom →
              </Link>
              <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event("schoolspec:tour")); }}
                className="mt-2 block w-full text-center text-[14px] font-medium text-muted-foreground hover:text-foreground">
                Show me around the app instead
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Item({ it, open, onToggle }: { it: HowTo; open: boolean; onToggle: () => void }) {
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/60">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-snug">{it.title}</span>
          <span className="mt-0.5 block text-[14px] text-muted-foreground">{it.why}</span>
        </span>
        <ChevronDown size={18} className={cn("mt-1 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <Steps it={it} className="px-4 pb-4" />}
    </li>
  );
}

/** The steps themselves — shared with the /help page so they read the same. */
export function Steps({ it, className }: { it: HowTo; className?: string }) {
  return (
    <div className={cn("text-[15.5px] leading-relaxed", className)}>
      <p className="text-[14px] font-medium text-muted-foreground">Where: {it.where}</p>
      <ol className="mt-2 space-y-2">
        {it.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-primary">{i + 1}</span>
            <span><Rich text={s} /></span>
          </li>
        ))}
      </ol>
      {it.then && <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-[14.5px] text-success"><Rich text={it.then} /></p>}
      {it.note && <p className="mt-2 text-[14px] text-muted-foreground"><Rich text={it.note} /></p>}
    </div>
  );
}
