"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRegister } from "../actions";
import { cn } from "@/lib/utils";
import { btnCls } from "@/ui/kit";

const NEXT: Record<string, string> = { present: "absent", absent: "late", late: "present" };
const STYLE: Record<string, string> = {
  present: "border-border bg-card",
  absent: "border-danger/50 bg-danger/10",
  late: "border-warning/50 bg-warning/10",
};

/** Whole row is the tap target; default present; save posts only statuses.
 *  `date` (admin corrections from the record book) rides along as a field —
 *  omitted, the action marks today. */
export function Register({ slug, classId, roster, initial, date }: {
  slug: string; classId: string;
  roster: { id: string; firstName: string; lastName: string }[];
  initial: Record<string, string>;
  date?: string;
}) {
  const [st, setSt] = useState<Record<string, string>>(
    Object.fromEntries(roster.map((r) => [r.id, initial[r.id] ?? "present"])));
  const [pending, start] = useTransition();
  const router = useRouter();
  const absent = Object.values(st).filter((s) => s === "absent").length;

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
          const r = await saveRegister(slug, classId, f);
          if (r && "err" in r) { router.push(`/attendance?err=${r.err}`); return; }
          router.push(date ? `/attendance/register?c=${classId}` : "/attendance");
        })}>
        {pending ? "Saving…" : `Save register (${absent} absent)`}
      </button>
    </div>
  );
}
