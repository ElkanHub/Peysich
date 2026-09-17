"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { captureInstallPrompt, useOnlineStatus } from "./client";
import { flushRegisters, pendingRegisters, QUEUE_EVENT } from "./offline-queue";

/* ── PWA provider ───────────────────────────────────────────────────────────
   Mounted once in the root layout. Registers the service worker (production
   only — dev stays uncached), watches for a newer build and offers it as a
   toast rather than yanking the page away, and pins an honest connectivity
   chip: OFFLINE says what you're looking at is the last thing we saw.    */

export function PwaProvider() {
  const online = useOnlineStatus();
  const router = useRouter();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [backOnline, setBackOnline] = useState(false);
  const [queued, setQueued] = useState(0);
  const [flushed, setFlushed] = useState(0);
  const wasOffline = useRef(false);

  // offline register saves: count them, send them when we can
  useEffect(() => {
    if (typeof indexedDB === "undefined") return;
    const count = () => pendingRegisters().then((l) => setQueued(l.length)).catch(() => {});
    const flush = () => flushRegisters().then((r) => {
      if (r.sent) { setFlushed(r.sent); setTimeout(() => setFlushed(0), 3500); }
      count();
    }).catch(() => {});
    count();
    if (navigator.onLine) flush();
    window.addEventListener("online", flush);
    window.addEventListener(QUEUE_EVENT, count);
    return () => { window.removeEventListener("online", flush); window.removeEventListener(QUEUE_EVENT, count); };
  }, []);

  useEffect(() => {
    captureInstallPrompt();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;
    const watch = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener("updatefound", () => {
        const nw = r.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          // "installed" with a live controller = a NEW version is parked behind the old one
          if (nw.state === "installed" && navigator.serviceWorker.controller) setWaiting(nw);
        });
      });
    };
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((r) => { reg = r; watch(r); }).catch(() => {});
    // the new worker takes over → load the new build, once
    let reloading = false;
    const onControl = () => { if (reloading) return; reloading = true; window.location.reload(); };
    navigator.serviceWorker.addEventListener("controllerchange", onControl);
    // look for updates when the app comes back to the foreground and every half hour
    const check = () => { if (!document.hidden) reg?.update().catch(() => {}); };
    document.addEventListener("visibilitychange", check);
    const iv = setInterval(check, 30 * 60 * 1000);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControl);
      document.removeEventListener("visibilitychange", check);
      clearInterval(iv);
    };
  }, []);

  // coming back online: refresh what's on screen and say so briefly
  useEffect(() => {
    if (!online) { wasOffline.current = true; return; }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setBackOnline(true);
    router.refresh();
    const t = setTimeout(() => setBackOnline(false), 2800);
    return () => clearTimeout(t);
  }, [online, router]);

  const applyUpdate = () => {
    if (!waiting) return;
    setApplying(true);
    waiting.postMessage({ type: "SKIP_WAITING" });
    // belt and braces: if the controller never changes (Safari quirks), reload anyway
    setTimeout(() => window.location.reload(), 4000);
  };

  return (
    <>
      {/* connectivity chip — top centre, under the phone status bar, above every page */}
      <div aria-live="polite"
        className={cn(
          "pointer-events-none fixed inset-x-0 z-[80] flex justify-center px-4 transition-all duration-300 print:hidden",
          "top-[calc(var(--sat)+6.75rem)] lg:top-[3.75rem]", // under the top bar AND the breadcrumb row
          !online || backOnline || flushed > 0 ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
        )}>
        {!online ? (
          <span className="flex items-center gap-2 rounded-full bg-warning-soft px-3.5 py-2 text-[13px] font-semibold text-warning shadow-[var(--shadow-md)]">
            <WifiOff size={14} />
            {queued > 0 ? `Offline — ${queued} register${queued === 1 ? "" : "s"} waiting to send` : "Offline — showing what you last saw"}
          </span>
        ) : flushed > 0 ? (
          <span className="flex items-center gap-2 rounded-full bg-success-soft px-3.5 py-2 text-[13px] font-semibold text-success shadow-[var(--shadow-md)]">
            <Wifi size={14} /> {flushed === 1 ? "Register sent ✓" : `${flushed} registers sent ✓`}
          </span>
        ) : backOnline ? (
          <span className="flex items-center gap-2 rounded-full bg-success-soft px-3.5 py-2 text-[13px] font-semibold text-success shadow-[var(--shadow-md)]">
            <Wifi size={14} /> Back online — refreshed
          </span>
        ) : null}
      </div>

      {/* update toast — never forced; the person picks the moment */}
      {waiting && !dismissed && (
        <div role="status"
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-foreground px-4 py-3 text-background shadow-[var(--shadow-lg)] print:hidden sm:inset-x-auto sm:right-5">
          <RefreshCw size={16} className={cn("shrink-0 text-[#d98ab4]", applying && "animate-spin")} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-tight">A new version of SchoolSpec is ready</p>
            <p className="text-[12.5px] opacity-70">Takes a second. Your work is saved.</p>
          </div>
          <button type="button" onClick={() => setDismissed(true)}
            className="rounded-full px-2.5 py-1.5 text-[13px] font-medium opacity-70 hover:opacity-100">
            Later
          </button>
          <button type="button" onClick={applyUpdate} disabled={applying}
            className="rounded-full bg-background px-3.5 py-1.5 text-[13px] font-semibold text-foreground disabled:opacity-60">
            {applying ? "Updating…" : "Update"}
          </button>
        </div>
      )}
    </>
  );
}
