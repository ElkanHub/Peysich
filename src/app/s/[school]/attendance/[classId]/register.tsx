"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRegister } from "../actions";
import { enqueueRegister } from "@/pwa/offline-queue";
import { cn } from "@/lib/utils";
import { btnCls, btnGhostCls } from "@/ui/kit";

const NEXT: Record<string, string> = { present: "absent", absent: "late", late: "present" };
const STYLE: Record<string, string> = {
  present: "border-border bg-card",
  absent: "border-danger/50 bg-danger/10",
  late: "border-warning/50 bg-warning/10",
};

/** Whole row is the tap target; default present; save posts only statuses.
 *  `date` (admin corrections from the record book) rides along as a field —
 *  omitted, the action marks today. */
export function Register({ slug, classId, className, roster, initial, date }: {
  slug: string; classId: string; className: string;
  roster: { id: string; firstName: string; lastName: string }[];
  initial: Record<string, string>;
  date?: string;
}) {
  const [st, setSt] = useState<Record<string, string>>(
    Object.fromEntries(roster.map((r) => [r.id, initial[r.id] ?? "present"])));
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState(false);
  const router = useRouter();
  const absent = Object.values(st).filter((s) => s === "absent").length;

  // no signal → keep it on this phone; PwaProvider sends it the moment we're back
  const keepForLater = async () => {
    await enqueueRegister({ slug, classId, className, date, statuses: st });
    setQueued(true);
  };

  if (queued) {
    return (
      <div className="rounded-2xl bg-warning-soft p-5" role="status">
        <p className="font-semibold text-warning">Saved on this phone ✓</p>
        <p className="mt-1 text-[14px] text-warning/90">
          {className}: {absent} absent. There&apos;s no connection right now, so the register is
          waiting here and will reach the school the moment you&apos;re back online — nothing
          more to do.
        </p>
        <button type="button" onClick={() => router.push("/attendance")} className={cn(btnGhostCls, "mt-4")}>
          Back to attendance
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-1.5">
        {roster.map((r) => (
          <button key={r.id} type="button"
            onClick={() => setSt({ ...st, [r.id]: NEXT[st[r.id]] })}
            className={cn("flex h-12 w-full items-center justify-between rounded-md border px-4 text-sm", STYLE[st[r.id]])}>
            <span className="font-medium">{r.lastName}, {r.firstName}</span>
            <span className={cn("text-xs uppercase tracking-wide",
              st[r.id] === "present" ? "text-success" : st[r.id] === "absent" ? "text-danger" : "text-warning")}>
              {st[r.id]}
            </span>
          </button>
        ))}
      </div>
      <button disabled={pending} className={btnCls + " mt-4 w-full"}
        onClick={() => start(async () => {
          const f = new FormData();
          if (date) f.set("date", date);
          for (const [id, s] of Object.entries(st)) f.set(`st_${id}`, s);
          if (!navigator.onLine) { await keepForLater(); return; }
          let r: Awaited<ReturnType<typeof saveRegister>>;
          try { r = await saveRegister(slug, classId, f); }
          catch (e) {
            // the request itself died (signal dropped mid-save) — not a refusal
            if (!navigator.onLine || /fetch|network|Failed to/i.test(String(e))) { await keepForLater(); return; }
            throw e;
          }
          if (r && "err" in r) { router.push(`/attendance?err=${r.err}`); return; }
          router.push(date ? `/attendance/register?c=${classId}` : "/attendance");
        })}>
        {pending ? "Saving…" : `Save register (${absent} absent)`}
      </button>
    </div>
  );
}
