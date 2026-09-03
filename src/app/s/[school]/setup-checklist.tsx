"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Card } from "@/ui/kit";

/* ── Setup checklist ────────────────────────────────────────────────────────
   The tour shows where things live; this finishes the job. Every item reads
   REAL state — "add students" ticks itself because students exist, never
   because it was clicked. Once complete (or dismissed) it stays gone on
   this device.                                                            */

export type SetupItem = { key: string; label: string; href: string; done: boolean };

export function SetupChecklist({ schoolName, items }: { schoolName: string; items: SetupItem[] }) {
  const [hidden, setHidden] = useState(true); // avoid a flash before we read storage
  const key = "peysich-setup-dismissed";

  useEffect(() => {
    try { setHidden(!!localStorage.getItem(key)); } catch { setHidden(false); }
  }, []);

  const done = items.filter((i) => i.done).length;
  const complete = done === items.length;
  if (hidden || complete) return null;

  const dismiss = () => {
    try { localStorage.setItem(key, "1"); } catch { /* fine */ }
    setHidden(true);
  };

  return (
    <Card className="mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Get {schoolName} ready</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground" data-nums="">{done} of {items.length} done</p>
        </div>
        <button type="button" aria-label="Dismiss checklist" onClick={dismiss}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X size={15} /></button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="mt-3 grid gap-1 text-[14px] sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key} className="py-1">
            {i.done
              ? <span className="text-muted-foreground"><span className="mr-1.5 font-bold text-success">✓</span>{i.label}</span>
              : <Link href={i.href} className="font-medium text-primary hover:underline">
                  <span className="mr-1.5 text-muted-foreground">○</span>{i.label} →
                </Link>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
