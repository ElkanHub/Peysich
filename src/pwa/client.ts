"use client";
import { useSyncExternalStore } from "react";

/* Browser facts, read the React way: useSyncExternalStore gives the server
 * a safe default and the client the truth after hydration — no effect,
 * no flash, no cascading render. */

const onlineSub = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};
/** Live connectivity. navigator.onLine is honest about "definitely offline"
 *  and optimistic about "online", which is the right bias for a banner. */
export const useOnlineStatus = () =>
  useSyncExternalStore(onlineSub, () => navigator.onLine, () => true);

const MQ = "(display-mode: standalone)";
const standaloneSub = (cb: () => void) => {
  const mq = window.matchMedia(MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** True when running as an installed app (home-screen / desktop window). */
export const useStandalone = () =>
  useSyncExternalStore(standaloneSub,
    () => window.matchMedia(MQ).matches || (navigator as { standalone?: boolean }).standalone === true,
    () => false);

const noop = () => () => {};
/** A one-off browser value (a query flag, a UA sniff) with a server default. */
export const useClientValue = <T,>(read: () => T, serverValue: T) =>
  useSyncExternalStore(noop, read, () => serverValue);

/* ── install prompt (Chromium) ──────────────────────────────────────────────
   The browser fires beforeinstallprompt once, early; we keep it and let the
   Account page (and anything else) ask for it later. */
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferredPrompt: BIP | null = null;
export const INSTALLABLE_EVENT = "schoolspec:installable";

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BIP;
    window.dispatchEvent(new Event(INSTALLABLE_EVENT));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event(INSTALLABLE_EVENT));
  });
}
export const canPromptInstall = () => deferredPrompt !== null;
const installSub = (cb: () => void) => {
  window.addEventListener(INSTALLABLE_EVENT, cb);
  return () => window.removeEventListener(INSTALLABLE_EVENT, cb);
};
/** Whether the browser is offering to install right now. */
export const useInstallable = () => useSyncExternalStore(installSub, canPromptInstall, () => false);
export async function promptInstall() {
  if (!deferredPrompt) return "unavailable" as const;
  const p = deferredPrompt;
  deferredPrompt = null;
  await p.prompt();
  const { outcome } = await p.userChoice;
  window.dispatchEvent(new Event(INSTALLABLE_EVENT));
  return outcome;
}
