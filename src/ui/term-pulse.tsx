"use client";
import { useEffect, useState } from "react";
import { CalendarRange, Clock } from "lucide-react";

/** The slim orientation strip every dashboard carries: where we are in the
 *  term (Week N of M) and where we are in the school day (closes at…, time
 *  left) — ticking live on the client. */
export function TermPulse({ termName, week, total, phase, open, close, off, endsFmt }: {
  termName: string;
  week: number | null; total: number;
  /** "starts 1 Sep" before the term, "ended" after — null while inside it */
  phase: string | null;
  open: string; close: string;
  /** weekend / holiday note for today, null on a school day */
  off: string | null;
  endsFmt: string;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  let clock = "";
  let tone = "text-muted-foreground";
  if (off) { clock = off; }
  else if (now) {
    const mins = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = open.split(":").map(Number);
    const [ch, cm] = close.split(":").map(Number);
    const openM = oh * 60 + om, closeM = ch * 60 + cm;
    if (mins < openM) clock = `School opens ${open}`;
    else if (mins < closeM) {
      const left = closeM - mins;
      const h = Math.floor(left / 60), m2 = left % 60;
      clock = `Closes ${close} · ${h ? `${h}h ` : ""}${m2}m left`;
      tone = left <= 60 ? "font-medium text-warning" : "text-muted-foreground";
    } else clock = `School's closed for today (ran ${open}–${close})`;
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-4 py-2 text-[13.5px] shadow-[var(--shadow-sm)]">
      <span className="flex items-center gap-1.5">
        <CalendarRange size={13} className="text-primary" />
        {phase === "ended" ? (
          <span><b>{termName}</b> has ended — records stay in the book</span>
        ) : phase ? (
          <span><b>{termName}</b> {phase}</span>
        ) : (
          <span data-nums="">
            <b>Week {week}</b> of {total} · {termName} · ends {endsFmt}
          </span>
        )}
      </span>
      <span className="hidden h-3 w-px bg-border sm:block" />
      <span className={`flex items-center gap-1.5 ${tone}`} data-nums="">
        <Clock size={13} />
        {clock || "…"}
      </span>
    </div>
  );
}
