"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { markInstallationDone, moveSchoolStage } from "../install-actions";

export type BoardCard = {
  id: string; name: string; stage: string; days: number; balance: string;
  next: string; paused: boolean; installation: string;
};

/** The pipeline as a table: one column per stage, ruled off from its
 *  neighbours, every school a card. Schools move themselves as things happen
 *  to them; a card can also be dragged to another column, and it stays there
 *  until the school's own facts change.
 *  ponytail: native drag and drop, which a touch screen does not do — on a
 *  phone, open the school; add a "Move to" menu on the card if that is missed. */
export function PipelineBoard({ stages, cards }: { stages: [key: string, label: string][]; cards: BoardCard[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  // where a dropped card shows while the server catches up
  const [moved, setMoved] = useState<Record<string, string>>({});
  const stageOf = (c: BoardCard) => moved[c.id] ?? c.stage;

  const drop = (stage: string, id: string) => {
    setOver(null);
    const card = cards.find((c) => c.id === id);
    if (!card || stageOf(card) === stage) return;
    setMoved((m) => ({ ...m, [id]: stage }));
    start(async () => { await moveSchoolStage(id, stage); router.refresh(); });
  };

  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-border bg-card shadow-[var(--shadow-sm)]">
      <div className="grid min-w-max auto-cols-[13.5rem] grid-flow-col divide-x divide-border">
        {stages.map(([key, label]) => {
          const here = cards.filter((c) => stageOf(c) === key);
          return (
            <div key={key} className={cn("flex min-h-64 flex-col transition-colors", over === key && "bg-brand-soft")}
              onDragOver={(e) => { e.preventDefault(); setOver(key); }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={(e) => { e.preventDefault(); drop(key, e.dataTransfer.getData("text/plain")); }}>
              <p className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {label}<span data-nums="" className="text-foreground">{here.length}</span>
              </p>
              <div className="flex-1 space-y-2 p-2">
                {here.map((c) => (
                  <div key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                    className="cursor-grab rounded-md border border-border bg-card p-2.5 text-[13px] shadow-[var(--shadow-sm)] hover:border-border-strong active:cursor-grabbing">
                    <Link href={`/platform/schools/${c.id}`} className="block text-[14px] font-semibold text-primary hover:underline">{c.name}</Link>
                    <p className="mt-0.5 text-muted-foreground" data-nums="">{c.days} day{c.days === 1 ? "" : "s"} here · {c.balance}</p>
                    <p className="text-muted-foreground">{c.paused ? <b className="text-warning">Messages paused</b> : c.next}</p>
                    {c.installation === "paid" && (
                      <form action={markInstallationDone.bind(null, c.id)} className="mt-1.5 border-t border-border pt-1.5">
                        <label className="flex cursor-pointer items-center gap-1.5 font-medium">
                          <input type="checkbox" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
                          Installed and trained
                        </label>
                      </form>
                    )}
                    {(c.installation === "requested" || c.installation === "offered") && (
                      <p className="mt-1.5 border-t border-border pt-1.5 text-warning">Installation: waiting for payment</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
