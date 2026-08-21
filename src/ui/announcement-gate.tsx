"use client";
import { useEffect, useState, useTransition } from "react";
import { Megaphone, Loader2 } from "lucide-react";
import { acknowledgeAnnouncements } from "@/app/s/[school]/comms/actions";
import { btnCls } from "@/ui/kit";

type Item = { id: string; title: string; body: string; audience: string; date: string };

/** On-open notice: unread announcements take the screen once per browser
 *  session until acknowledged. While already in the app, new ones only bump
 *  the Announcements badge — no interruptions mid-task. */
export function AnnouncementGate({ slug, items }: { slug: string; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!items.length) return;
    try {
      if (sessionStorage.getItem("peysich-ann-gate") === "shown") return;
      sessionStorage.setItem("peysich-ann-gate", "shown");
      setOpen(true);
    } catch { setOpen(true); }
  }, [items.length]);

  if (!open || !items.length) return null;

  const ack = () => start(async () => {
    await acknowledgeAnnouncements(slug, items.map((i) => i.id));
    setOpen(false);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-5 shadow-lg">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-primary">
            <Megaphone size={17} />
          </span>
          <div>
            <h2 className="font-semibold leading-tight">While you were away</h2>
            <p className="text-[12.5px] text-muted-foreground" data-nums="">
              {items.length} announcement{items.length === 1 ? "" : "s"} for you
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          {items.map((i) => (
            <div key={i.id} className="rounded-lg border-l-4 border-primary bg-muted/40 px-3.5 py-2.5">
              <p className="font-medium">{i.title}
                <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">{i.audience} · {i.date}</span>
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{i.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <button onClick={() => setOpen(false)} disabled={pending}
            className="text-sm text-muted-foreground hover:text-foreground">Later</button>
          <button onClick={ack} disabled={pending}
            className={btnCls + " inline-flex items-center gap-1.5 disabled:opacity-60"}>
            {pending && <Loader2 size={13} className="animate-spin" />}
            {pending ? "Saving…" : "Acknowledge"}
          </button>
        </div>
      </div>
    </div>
  );
}
