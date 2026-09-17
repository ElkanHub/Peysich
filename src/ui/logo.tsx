import { MARK_VIEWBOX, MARK_BODY, MARK_WEDGE_TOP, MARK_WEDGE_BOTTOM, WINE, INK } from "./mark-paths.mjs";

/** SchoolSpec brand mark — a stepped S with two wine wedges. `variant="light"`
 *  (white body) for dark surfaces, `variant="dark"` (near-black body) for
 *  light surfaces, `variant="auto"` follows the canvas; the wine never changes. */
export function LogoMark({ size = 28, variant = "dark", className }: {
  size?: number; variant?: "light" | "dark" | "auto"; className?: string;
}) {
  const body = variant === "light" ? "#FFFFFF"
    : variant === "auto" ? "var(--foreground)" : "#0A0A0A";
  return (
    <svg width={size} height={size} viewBox={MARK_VIEWBOX} fill="none"
      className={className} aria-hidden>
      <path d={MARK_BODY} fill={body} />
      <path d={MARK_WEDGE_TOP} fill={WINE} />
      <path d={MARK_WEDGE_BOTTOM} fill={WINE} />
    </svg>
  );
}

/** App-icon style: the mark on a rounded ink tile (favicon, avatars, dark chrome). */
export function LogoTile({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" className={className} aria-hidden>
      <rect width="512" height="512" rx="112" fill={INK} />
      <g transform="translate(64 64) scale(2)">
        <path d={MARK_BODY} fill="#FFFFFF" />
        <path d={MARK_WEDGE_TOP} fill={WINE} />
        <path d={MARK_WEDGE_BOTTOM} fill={WINE} />
      </g>
    </svg>
  );
}

export const BRAND_NAME = "SchoolSpec";

export function LogoLockup({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} variant={dark ? "light" : "auto"} />
      <span className={`font-semibold tracking-tight ${dark ? "text-ink-text-strong" : "text-foreground"}`}
        style={{ fontSize: size * 0.72 }}>
        {BRAND_NAME}
      </span>
    </span>
  );
}
