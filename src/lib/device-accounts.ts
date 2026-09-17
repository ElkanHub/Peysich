"use client";
import { useSyncExternalStore } from "react";

/** Accounts remembered on THIS device, so switching (e.g. a teacher who is
 *  also a parent) is two taps instead of typing. Client-only localStorage —
 *  we keep the sign-in identifier and display name, NEVER a password. */
export type DeviceAccount = { id: string; name?: string | null; at: number };

const KEY = "schoolspec.accounts";
const OLD_KEY = "peysich.accounts"; // pre-rebrand devices — read once, then superseded
const EVENT = "schoolspec:accounts";
const EMPTY: DeviceAccount[] = [];

function parse(raw: string): DeviceAccount[] {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter((a): a is DeviceAccount => Boolean(a && typeof a.id === "string" && a.id))
      : [];
  } catch { return []; }
}

export function loadAccounts(): DeviceAccount[] {
  try { return parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || "[]"); }
  catch { return []; }
}

function write(list: DeviceAccount[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage may be blocked — a convenience only */ }
  window.dispatchEvent(new Event(EVENT));
}

export function rememberAccount(a: { id: string; name?: string | null }) {
  const rest = loadAccounts().filter((x) => x.id.toLowerCase() !== a.id.toLowerCase());
  write([{ ...a, at: Date.now() }, ...rest].slice(0, 5));
}

export function forgetAccount(id: string) {
  write(loadAccounts().filter((x) => x.id !== id));
}

// snapshot must be referentially stable between reads of the same storage
let cacheRaw: string | null = null;
let cacheVal: DeviceAccount[] = EMPTY;
const snapshot = () => {
  let raw = "[]";
  try { raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || "[]"; } catch { /* blocked */ }
  if (raw !== cacheRaw) { cacheRaw = raw; cacheVal = parse(raw); }
  return cacheVal;
};
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
};
/** The remembered accounts, live — updates when one is added or forgotten. */
export const useDeviceAccounts = () => useSyncExternalStore(subscribe, snapshot, () => EMPTY);
