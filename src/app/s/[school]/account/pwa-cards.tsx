"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Download, Share, CheckCircle2 } from "lucide-react";
import { Card, btnCls, btnGhostCls } from "@/ui/kit";
import { cn } from "@/lib/utils";
import { promptInstall, useStandalone, useInstallable, useClientValue } from "@/pwa/client";

/* ── My Account · Notifications + Install ───────────────────────────────────
   Both are honest about the device: an iPhone in Safari can't push until the
   app is on the home screen, a desktop browser installs from its own menu,
   and a school whose keys aren't set yet hears that plainly. */

function toKey(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "loading" | "unsupported" | "needs-install" | "server-off" | "denied" | "off" | "on";

export function NotificationsCard() {
  const standalone = useStandalone();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState(isIOS && !standalone ? "needs-install" : "unsupported"); return;
      }
      const cfg = await fetch("/api/push").then((r) => r.json()).catch(() => ({ enabled: false }));
      if (!cfg.enabled) { setState("server-off"); return; }
      setPublicKey(cfg.publicKey);
      if (Notification.permission === "denied") { setState("denied"); return; }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, [standalone]);

  const turnOn = async () => {
    setBusy(true); setNote("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey!) });
      const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), ua: navigator.userAgent }) });
      if (!r.ok) throw new Error();
      setState("on"); setNote("On. You'll hear about announcements, releases and reminders here.");
    } catch { setNote("That didn't go through — try once more."); }
    finally { setBusy(false); }
  };
  const turnOff = async () => {
    setBusy(true); setNote("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off"); setNote("Off for this device.");
    } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setNote("");
    const r = await fetch("/api/push", { method: "PUT" }).then((r) => r.json()).catch(() => ({ sent: 0 }));
    setNote(r.sent ? "Sent — it should appear in a moment." : "Nothing sent. Turn notifications on first.");
    setBusy(false);
  };

  const Icon = state === "on" ? BellRing : state === "denied" ? BellOff : Bell;
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          state === "on" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Notifications</h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {state === "loading" && "Checking this device…"}
            {state === "on" && "On for this device — announcements, report releases and reminders arrive even when the app is closed."}
            {state === "off" && "Get announcements, report card releases and register reminders on this device."}
            {state === "denied" && "Notifications are blocked for this site in your browser settings. Allow them there, then come back."}
            {state === "server-off" && "Notifications aren't switched on for SchoolSpec yet — the platform team needs to add its push keys (docs/CONNECTIONS.md §5)."}
            {state === "needs-install" && "On iPhone and iPad, notifications need the app on your home screen first: tap Share, then “Add to Home Screen”, and open SchoolSpec from there."}
            {state === "unsupported" && "This browser can't receive notifications. Chrome, Edge or Samsung Internet on Android, or the installed app on iOS 16.4+, all can."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {state === "off" && <button type="button" onClick={turnOn} disabled={busy} className={btnCls}>{busy ? "Turning on…" : "Turn on notifications"}</button>}
            {state === "on" && <>
              <button type="button" onClick={test} disabled={busy} className={btnGhostCls}>Send a test</button>
              <button type="button" onClick={turnOff} disabled={busy} className="px-2 text-[13px] font-medium text-muted-foreground hover:text-danger">Turn off</button>
            </>}
          </div>
          {note && <p className="mt-2 text-[13px] text-muted-foreground" aria-live="polite">{note}</p>}
        </div>
      </div>
    </Card>
  );
}

export function InstallCard() {
  const standalone = useStandalone();
  const installable = useInstallable();
  const isIOS = useClientValue(() => /iP(hone|ad|od)/.test(navigator.userAgent), false);
  const [done, setDone] = useState(false);
  if (standalone) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-soft text-success"><CheckCircle2 size={18} /></span>
          <div><h2 className="font-semibold">Installed</h2>
            <p className="text-[13.5px] text-muted-foreground">You&apos;re using SchoolSpec as an app. Updates arrive on their own — you&apos;ll be asked before one applies.</p></div>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-container text-on-brand-container"><Download size={18} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Install SchoolSpec</h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {isIOS
              ? "Put it on your home screen: tap the Share button, then “Add to Home Screen”. It opens full-screen, like any app."
              : installable
                ? "One tap puts SchoolSpec on your home screen or desktop — full-screen, faster, and it keeps working when the signal drops."
                : "Open the browser menu and choose “Install app” (Chrome, Edge) — or on a phone, “Add to Home Screen”."}
          </p>
          {isIOS && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[12.5px] font-medium">
              <Share size={13} /> Share → Add to Home Screen
            </p>
          )}
          {installable && !isIOS && (
            <button type="button" className={cn(btnCls, "mt-3")} disabled={done}
              onClick={async () => { const o = await promptInstall(); if (o === "accepted") setDone(true); }}>
              {done ? "Installing…" : "Install app"}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
