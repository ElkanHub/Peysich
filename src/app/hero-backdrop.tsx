"use client";
import { useEffect, useRef } from "react";

const CELL = 96;
const TINTS = ["var(--brand-soft)", "var(--brand-container)"];

/** Drafting-paper backdrop: a two-tier grid with checkered cells that are
 *  dense at the right edge and thin out to nothing halfway across.
 *  ponytail: painted in JS — the density ramp is per-cell, not a repeat. */
export function HeroBackdrop() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paint = () => {
      const el = host.current;
      if (!el) return;
      const { width: w, height: h } = el.getBoundingClientRect();
      const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
      const reach = w * 0.5;
      let html = "";
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          if ((x + y) % 2) continue;                 // checkerboard parity
          const inset = w - (x + 1) * CELL;          // px in from the right
          if (inset > reach) continue;
          const keep = 1 - inset / reach;            // 1 at the edge → 0 at 50%
          const n = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
          if (n > keep) continue;
          html += `<i style="left:${x * CELL}px;top:${y * CELL}px;background:${TINTS[n < keep * 0.35 ? 1 : 0]}"></i>`;
        }
      }
      el.innerHTML = html;
    };
    paint();
    addEventListener("resize", paint);
    return () => removeEventListener("resize", paint);
  }, []);

  return (
    <>
      <div ref={host} aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden [&>i]:absolute [&>i]:h-24 [&>i]:w-24" />
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px,transparent 1px)," +
            "linear-gradient(90deg,var(--border) 1px,transparent 1px)," +
            "linear-gradient(var(--brand-soft) 1px,transparent 1px)," +
            "linear-gradient(90deg,var(--brand-soft) 1px,transparent 1px)",
          backgroundSize: "96px 96px,96px 96px,16px 16px,16px 16px",
        }} />
    </>
  );
}
