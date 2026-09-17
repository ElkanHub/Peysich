"use client";
import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, ArrowLeft, Wifi } from "lucide-react";
import { LogoMark } from "@/ui/logo";
import { btnCls, btnGhostCls } from "@/ui/kit";
import { useOnlineStatus } from "@/pwa/client";

const STILL_WORKS = [
  "Pages you opened recently — dashboard, registers, student files",
  "The menu, your account, and anything already on screen",
];

export function OfflineClient() {
  const online = useOnlineStatus();
  const [tries, setTries] = useState(0);
  const [checking, setChecking] = useState(false);

  // the moment the network is back, the page you wanted comes back with it
  useEffect(() => {
    if (!online) return;
    const t = setTimeout(() => window.location.reload(), 900);
    return () => clearTimeout(t);
  }, [online]);

  const retry = async () => {
    setChecking(true); setTries((n) => n + 1);
    try {
      const r = await fetch("/manifest.webmanifest", { cache: "no-store" });
      if (r.ok) { window.location.reload(); return; }
    } catch { /* still offline */ }
    setTimeout(() => setChecking(false), 600);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex items-center gap-2.5 px-6 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <LogoMark size={26} variant="auto" />
        <span className="font-semibold tracking-tight">SchoolSpec</span>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <div className="w-full max-w-sm">
          <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${online ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
            {online ? <Wifi size={26} /> : <WifiOff size={26} />}
          </span>
          <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-tight">
            {online ? "Back online" : "You're offline"}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            {online
              ? "Bringing back the page you were opening…"
              : "This page hasn't been saved on this device yet, so it needs a connection. Nothing you did is lost."}
          </p>
          {!online && (
            <div className="mt-5 rounded-xl bg-muted p-4">
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Still works offline</p>
              <ul className="mt-2 space-y-1.5 text-[13.5px]">
                {STILL_WORKS.map((s) => (
                  <li key={s} className="flex gap-2"><span className="text-success">✓</span>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={retry} disabled={checking || online} className={btnCls}>
              <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
              {checking ? "Checking…" : tries > 0 ? "Try again" : "Try again"}
            </button>
            <button type="button" onClick={() => window.history.back()} className={btnGhostCls}>
              <ArrowLeft size={14} /> Go back
            </button>
          </div>
          <p className="mt-4 text-[12.5px] text-muted-foreground" aria-live="polite">
            {online ? "Connected." : "We'll reconnect on our own the moment the network returns."}
          </p>
        </div>
      </div>
    </main>
  );
}
