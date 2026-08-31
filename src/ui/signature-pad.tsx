"use client";
import { useEffect, useRef, useState } from "react";

/* The signing pad — draw with a mouse, finger or stylus. Strokes render
 * with quadratic smoothing on a transparent canvas, so the exported PNG
 * sits directly ON the signing line of every paper. Used in Settings
 * (modal) and on the public phone-signing page. */

type Pt = { x: number; y: number };
const INK = "#1b2559"; // dark pen blue — reads as real ink on white paper

export function SignaturePad({ onSave, saving, saveLabel = "Save signature" }: {
  onSave: (file: File) => void; saving?: boolean; saveLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const strokes = useRef<Pt[][]>([]);
  const live = useRef<Pt[] | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // crisp on retina, responsive to the wrapper's width
  const fit = () => {
    const c = canvasRef.current, w = wrapRef.current;
    if (!c || !w) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = w.clientWidth, cssH = Math.max(160, Math.round(cssW / 2.6));
    c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
    c.style.width = `${cssW}px`; c.style.height = `${cssH}px`;
    c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  };
  useEffect(() => {
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const path = (g: CanvasRenderingContext2D, pts: Pt[]) => {
    if (pts.length < 2) {
      const p = pts[0];
      if (p) { g.beginPath(); g.arc(p.x, p.y, 1.4, 0, Math.PI * 2); g.fillStyle = INK; g.fill(); }
      return;
    }
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      g.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    g.strokeStyle = INK; g.lineWidth = 2.4; g.lineCap = "round"; g.lineJoin = "round";
    g.stroke();
  };

  const redraw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, c.width, c.height);
    for (const s of strokes.current) path(g, s);
    if (live.current) path(g, live.current);
  };

  const pt = (e: React.PointerEvent): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clear = () => { strokes.current = []; live.current = null; setHasInk(false); redraw(); };
  const undo = () => { strokes.current.pop(); setHasInk(strokes.current.length > 0); redraw(); };

  /** Export the ink cropped to its bounding box (+padding), transparent PNG. */
  const save = () => {
    const c = canvasRef.current;
    if (!c || !strokes.current.length) return;
    const dpr = window.devicePixelRatio || 1;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of strokes.current) for (const p of s) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    const pad = 8;
    const sx = Math.max(0, (minX - pad) * dpr), sy = Math.max(0, (minY - pad) * dpr);
    const sw = Math.min(c.width - sx, (maxX - minX + pad * 2) * dpr);
    const sh = Math.min(c.height - sy, (maxY - minY + pad * 2) * dpr);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw)); out.height = Math.max(1, Math.round(sh));
    out.getContext("2d")!.drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height);
    out.toBlob((blob) => {
      if (blob) onSave(new File([blob], "signature.png", { type: "image/png" }));
    }, "image/png");
  };

  return (
    <div ref={wrapRef}>
      <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-border bg-white">
        {/* the baseline guide people naturally sign along */}
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-neutral-300" />
        {!hasInk && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] text-neutral-400">
            Sign here with your finger, stylus or mouse
          </p>
        )}
        <canvas ref={canvasRef} data-signpad="" className="block w-full touch-none select-none"
          onPointerDown={(e) => {
            e.preventDefault();
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            live.current = [pt(e)]; redraw();
          }}
          onPointerMove={(e) => {
            if (!live.current) return;
            live.current.push(pt(e)); redraw();
          }}
          onPointerUp={() => {
            if (!live.current) return;
            strokes.current.push(live.current); live.current = null;
            setHasInk(true); redraw();
          }}
          onPointerCancel={() => { live.current = null; redraw(); }} />
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <button type="button" onClick={undo} disabled={!hasInk || saving}
          className="rounded-md border border-border px-3 py-1.5 text-[13px] font-medium hover:bg-muted disabled:opacity-40">
          Undo
        </button>
        <button type="button" onClick={clear} disabled={!hasInk || saving}
          className="rounded-md border border-border px-3 py-1.5 text-[13px] font-medium hover:bg-muted disabled:opacity-40">
          Clear
        </button>
        <button type="button" onClick={save} disabled={!hasInk || saving} data-signpad-save=""
          className="ml-auto rounded-md bg-primary px-4 py-1.5 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? "Saving…" : saveLabel}
        </button>
      </div>
    </div>
  );
}
