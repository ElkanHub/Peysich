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
export function SubmitButton({ children, className, pendingText }: {
  children: React.ReactNode; className?: string; pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending}
      className={cn(className, "inline-flex items-center justify-center gap-1.5 disabled:opacity-60")}>
      {pending && <Loader2 size={13} className="shrink-0 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

const FLASH_TEXT: Record<string, { tone: "success" | "error"; text: string }> = {
  saved: { tone: "success", text: "Saved ✓" },
  linked: { tone: "success", text: "Linked ✓" },
  done: { tone: "success", text: "Done ✓" },
  error: { tone: "error", text: "That didn’t go through — nothing was saved. Please try again." },
};

/** Toast driven by a ?flash= URL param set by server actions on redirect.
 *  Shows once, then cleans the URL so refresh/back don’t replay it. */
export function Flash() {
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const read = () => {
      const p = new URLSearchParams(window.location.search);
      const code = p.get("flash");
      if (!code) return;
      setMsg(FLASH_TEXT[code] ?? FLASH_TEXT[code.split(":")[0]] ?? null);
      p.delete("flash");
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
    const t = setTimeout(() => setMsg(null), msg.tone === "error" ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;
  return (
    <div aria-live="polite"
      className={cn(
        "fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-[var(--shadow-md)]",
        msg.tone === "success" ? "bg-success text-white" : "bg-danger text-white",
      )}>
      {msg.tone === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {msg.text}
    </div>
  );
}
