"use client";
import { useEffect, useRef, useState } from "react";

/* A hair-thin (2px) loading bar living on the top bar's bottom edge. It
 * watches the app's real network activity — navigations, server actions,
 * refreshes — trickles while work is in flight and sweeps to done. The
 * 150ms grace means instant responses never flash it. Background things
 * (route prefetches, the LiveSync heartbeat) are deliberately ignored. */

const START = "pv:load-start";
const END = "pv:load-end";

declare global { interface Window { __pvProgressPatched?: boolean } }

function patchFetchOnce() {
  if (window.__pvProgressPatched) return;
  window.__pvProgressPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let tracked = false;
    try {
      const url = typeof input === "string" ? input
        : input instanceof URL ? input.href : input.url;
      const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const prefetch = h.has("next-router-prefetch") || h.get("purpose") === "prefetch";
      const sameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
      tracked = sameOrigin && !prefetch && !url.includes("/api/live/");
    } catch { tracked = false; }
    if (tracked) window.dispatchEvent(new Event(START));
    const p = orig(input, init);
    if (tracked) p.finally(() => window.dispatchEvent(new Event(END)));
    return p;
  };
}

export function RouteProgress() {
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(false);
  const inflight = useRef(0);
  const timers = useRef<{ show?: number; trickle?: number; hide?: number; reset?: number; cap?: number }>({});

  useEffect(() => {
    patchFetchOnce();
    const t = timers.current;
    const clearAll = () => {
      for (const k of Object.keys(t) as (keyof typeof t)[]) {
        if (t[k]) { clearInterval(t[k]); clearTimeout(t[k]); t[k] = undefined; }
      }
    };
    const finish = () => {
      clearAll();
      setWidth((w) => (w > 0 ? 100 : 0));
      t.hide = window.setTimeout(() => setShown(false), 350);
      t.reset = window.setTimeout(() => setWidth(0), 700);
    };
    const onStart = () => {
      inflight.current++;
      if (inflight.current !== 1) return;
      clearAll();
      // only surface work that actually takes a moment
      t.show = window.setTimeout(() => {
        setShown(true);
        setWidth(12);
        t.trickle = window.setInterval(() => {
          setWidth((w) => Math.min(90, w + Math.max(0.6, (90 - w) * 0.09)));
        }, 220);
      }, 150);
      t.cap = window.setTimeout(() => { inflight.current = 0; finish(); }, 20000);
    };
    const onEnd = () => {
      inflight.current = Math.max(0, inflight.current - 1);
      if (inflight.current === 0) finish();
    };
    window.addEventListener(START, onStart);
    window.addEventListener(END, onEnd);
    return () => {
      window.removeEventListener(START, onStart);
      window.removeEventListener(END, onEnd);
      clearAll();
    };
  }, []);

  return (
    <div aria-hidden data-progress=""
      className="pointer-events-none absolute inset-x-0 -bottom-px z-40 h-[2px]">
      <div
        className="h-full bg-primary transition-[width,opacity] duration-300 ease-out"
        style={{ width: `${width}%`, opacity: shown ? 1 : 0 }} />
    </div>
  );
}
