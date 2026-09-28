"use client";
import { ChildAvatar } from "@/ui/child-avatar";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { saveRegister } from "../actions";
import { enqueueRegister } from "@/pwa/offline-queue";
import { withFlash } from "@/lib/flash";
import { cn } from "@/lib/utils";
import { btnCls, btnGhostCls } from "@/ui/kit";

const STATUSES = ["present", "absent", "late"] as const;
const LABEL: Record<string, string> = { present: "Present", absent: "Absent", late: "Late" };
// chosen = filled colour + tick + the word; never colour alone
const ON: Record<string, string> = {
  present: "border-success bg-success text-white",
  absent: "border-danger bg-danger text-white",
  late: "border-warning bg-warning text-white",
};

// the action's refusals, in the teacher's words (shown as an error toast)
const REFUSED: Record<string, string> = {
  weekend: "That day is a weekend — school records run Monday to Friday only.",
  holiday: "That day is marked as a holiday, so there is no register to keep.",
  notallowed: "Only an admin can correct a past day's register.",
};

/** One row per child, three labelled buttons: Present · Absent · Late.
 *  Everyone starts Present. Save posts every child's status as `st_<id>`.
 *  `date` (admin corrections from the record book) rides along as a field —
 *  omitted, the action marks today. `saved` means the register is already
 *  in: rows lock behind Edit under a green banner. */
export function Register({ slug, classId, className, roster, initial, date, saved }: {
  slug: string; classId: string; className: string;
  roster: { id: string; firstName: string; lastName: string; photoUrl: string | null }[];
  initial: Record<string, string>;
  date?: string;
  saved?: { at: string; told: number };
}) {
  const [st, setSt] = useState<Record<string, string>>(
    Object.fromEntries(roster.map((r) => [r.id, initial[r.id] ?? "present"])));
  const [locked, setLocked] = useState(!!saved);
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState(false);
  const router = useRouter();
  const absent = Object.values(st).filter((s) => s === "absent").length;
  const here = `/attendance/${classId}${date ? `?date=${date}` : ""}`;

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

  const save = () => start(async () => {
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
    if (r && "err" in r && typeof r.err === "string") {
      router.push(withFlash(here, REFUSED[r.err] ?? "That didn’t go through — nothing was saved.", { error: true }));
      return;
    }
    const told = r?.told ?? 0;
    const msg = told > 0
      ? `Register saved. ${told} parent${told === 1 ? "" : "s"} told.`
      : r?.absent ? "Register saved. No new absences, so no SMS sent." : "Register saved. Everyone present.";
    // stay here — the page reloads what was saved and locks the rows
    setLocked(true);
    router.push(withFlash(here, msg));
    router.refresh();
  });

  return (
    <div>
      {saved && locked && (
        <div role="status" className="mb-4 rounded-2xl bg-success-soft p-5">
          <p className="text-[19px] font-bold leading-snug text-success">
            Saved at {saved.at}. {saved.told} parent{saved.told === 1 ? "" : "s"} told.
          </p>
          <p className="mt-1 text-[15px] text-success/90">Tap Edit to correct.</p>
          <button type="button" onClick={() => setLocked(false)} className={cn(btnGhostCls, "mt-4 h-12 px-6 text-[15px]")}>
            Edit
          </button>
        </div>
      )}

      <ul className={cn("space-y-2", locked && "pointer-events-none opacity-50")}>
        {roster.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <ChildAvatar photoUrl={r.photoUrl} initials={`${r.firstName[0] ?? ""}${r.lastName[0] ?? ""}`} className="h-11 w-11 shrink-0" />
              <p className="text-[18px] font-medium leading-tight">{r.lastName}, {r.firstName}</p>
            </div>
            <div role="radiogroup" aria-label={`${r.firstName} ${r.lastName}`} className="mt-2 grid grid-cols-3 gap-2">
              {STATUSES.map((s) => {
                const on = st[r.id] === s;
                return (
                  <button key={s} type="button" role="radio" aria-checked={on} disabled={locked}
                    onClick={() => setSt({ ...st, [r.id]: s })}
                    className={cn(
                      "inline-flex h-12 items-center justify-center gap-1.5 rounded-lg border text-[15px] font-semibold",
                      on ? ON[s] : "border-border bg-background text-muted-foreground",
                    )}>
                    {on && <Check size={18} strokeWidth={3} aria-hidden />}
                    {LABEL[s]}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      {!locked && (
        <button type="button" disabled={pending} onClick={save}
          className={cn(btnCls, "mt-4 h-14 w-full text-[16px]")}>
          {pending ? "Saving…"
            : absent === 0 ? "Save register · everyone present"
            : `Save register · ${absent} absent · their parents get an SMS`}
        </button>
      )}
    </div>
  );
}
