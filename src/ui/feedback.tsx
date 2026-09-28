"use client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Action feedback kit ────────────────────────────────────────────────────
   Every action the user takes must answer three questions without them
   guessing: is it working? did it work? if not, why (in plain words)?     */

/** Drop-in replacement for a submit <button> inside a <form action={…}>:
 *  disables itself and shows a spinner while the server action runs. */
export function SubmitButton({ children, className, pendingText, ...rest }: {
  children: React.ReactNode; className?: string; pendingText?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending} {...rest}
      className={cn(className, "inline-flex items-center justify-center gap-1.5 disabled:opacity-60")}>
      {pending && <Loader2 size={13} className="shrink-0 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

const FLASH_TEXT: Record<string, { tone: "success" | "error"; text: string }> = {
  saved: { tone: "success", text: "Saved." },
  linked: { tone: "success", text: "Linked." },
  done: { tone: "success", text: "Done." },
  error: { tone: "error", text: "That didn’t go through — nothing was saved. Please try again." },
};

type Msg = { tone: "success" | "error"; text: string; undo?: string };

/** Toast driven by a ?flash= URL param set by server actions on redirect
 *  (see lib/flash.ts). A legacy key, or a sentence — "!" prefix = error.
 *  An optional &undo= URL renders an Undo button that POSTs there.
 *  Shows once, then cleans the URL so refresh/back don’t replay it.
 *  Stays 6s (errors 9s) — long enough to read, and to reach Undo. */
export function Flash() {
  const [msg, setMsg] = useState<Msg | null>(null);
  const [undone, setUndone] = useState(false);

  useEffect(() => {
    const read = () => {
      const p = new URLSearchParams(window.location.search);
      const code = p.get("flash");
      if (!code) return;
      const undo = p.get("undo") ?? undefined;
      const known = FLASH_TEXT[code] ?? FLASH_TEXT[code.split(":")[0]];
      setMsg(known ? { ...known, undo } : code.startsWith("!")
        ? { tone: "error", text: code.slice(1), undo }
        : { tone: "success", text: code, undo });
      setUndone(false);
      p.delete("flash"); p.delete("undo");
      const q = p.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
    };
    read();
    // server-action redirects land as soft navigations — watch for them
    const iv = setInterval(read, 400);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.tone === "error" ? 9000 : 6000);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;
  return (
    <div aria-live="polite" role="status"
      className="fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-[15px] font-medium leading-snug text-background shadow-[var(--shadow-lg)] lg:bottom-6 lg:left-auto lg:right-6 lg:w-auto lg:translate-x-0">
      {msg.tone === "success"
        ? <CheckCircle2 size={20} className="shrink-0 text-[#5fcfa2]" />
        : <AlertTriangle size={20} className="shrink-0 text-[#f2a6a2]" />}
      <span className="flex-1">{undone ? "Undone." : msg.text}</span>
      {msg.undo && !undone && (
        <form method="post" action={msg.undo}
          onSubmit={async (e) => {
            e.preventDefault();
            await fetch(msg.undo!, { method: "POST" });
            setUndone(true);
            window.location.reload();
          }}>
          <button type="submit" className="rounded-full border border-background/40 px-3 py-1 text-[14px] font-semibold hover:bg-background/10">
            Undo
          </button>
        </form>
      )}
    </div>
  );
}
