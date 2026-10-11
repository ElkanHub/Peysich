"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { btnCls } from "@/ui/kit";

export type Promo = { id: string; title: string; body: string; ctaLabel: string | null; ctaUrl: string | null; imageUrl: string | null; everyHours: number };

/** A promo takes the screen on a fresh open, once per `everyHours`, until it
 *  ends. The announcement notice goes first; this waits for it. The "seen"
 *  stamp lives on the device (docs/12 §3.9). */
export function PromoGate({ promos }: { promos: Promo[] }) {
  const [show, setShow] = useState<Promo | null>(null);
  useEffect(() => {
    if (!promos.length) return;
    const due = promos.find((p) => {
      try { const last = Number(localStorage.getItem(`schoolspec-promo:${p.id}`) ?? 0); return Date.now() - last > p.everyHours * 3600_000; }
      catch { return true; }
    });
    if (!due) return;
    let cancelled = false;
    const open = () => {
      if (cancelled) return;
      // the announcement notice and the first-run tour take the screen first
      if (document.querySelector("[data-gate='announcements']") || document.documentElement.hasAttribute("data-tour")) { setTimeout(open, 1500); return; }
      setShow(due);
    };
    const t = setTimeout(open, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [promos]);
  if (!show) return null;
  const close = () => { try { localStorage.setItem(`schoolspec-promo:${show.id}`, String(Date.now())); } catch { /* private mode */ } setShow(null); };
  const external = !!show.ctaUrl && /^https?:/.test(show.ctaUrl);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-lg">
        <button onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-[var(--shadow-sm)] hover:text-foreground"><X size={18} /></button>
        {show.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={show.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
        )}
        <div className="p-6">
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-primary">From SchoolSpec</p>
          <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-.02em]">{show.title}</h2>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{show.body}</p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button onClick={close} className="text-sm text-muted-foreground hover:text-foreground">Not now</button>
            {show.ctaUrl && show.ctaLabel && (external
              ? <a href={show.ctaUrl} target="_blank" rel="noopener" onClick={close} className={btnCls}>{show.ctaLabel}</a>
              : <Link href={show.ctaUrl} onClick={close} className={btnCls}>{show.ctaLabel}</Link>)}
          </div>
        </div>
      </div>
    </div>
  );
}
