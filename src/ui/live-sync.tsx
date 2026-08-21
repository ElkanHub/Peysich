"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 5000;

/** Keeps every open page live. Polls the school's pulse version (a single
 *  counter bumped by the database on any write) and re-renders the server
 *  components in place when it moves — a register saved on the teacher's
 *  phone shows up on the admin's screen within seconds, no reload. Client
 *  state (open forms, toggles) survives because this is a soft refresh. */
export function LiveSync({ slug }: { slug: string }) {
  const router = useRouter();
  const last = useRef<number | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden || busy.current) return;
      busy.current = true;
      try {
        const r = await fetch(`/api/live/${slug}`, { cache: "no-store" });
        if (r.ok) {
          const { v } = (await r.json()) as { v: number };
          if (last.current !== null && v !== last.current) router.refresh();
          last.current = v;
        }
      } catch {
        // offline or server napping — try again next tick, never surface this
      } finally {
        busy.current = false;
      }
    };
    const id = setInterval(tick, POLL_MS);
    const onWake = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    tick();
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [slug, router]);

  return null;
}
