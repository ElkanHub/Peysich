/** Peysich brand mark — derived from the official logo: a block "P" with a
 *  wine accent. `variant="light"` (white P) for dark surfaces, `variant="dark"`
 *  (near-black P) for light surfaces; the wine block is constant.
 *  Geometry traced from the source files (4096px masters, normalized ÷4). */
const WINE = "#5E1D3E";

export function LogoMark({ size = 28, variant = "dark", className }: {
  size?: number; variant?: "light" | "dark"; className?: string;
}) {
  const p = variant === "light" ? "#FFFFFF" : "#0A0A0A";
  return (
    <svg width={size} height={size} viewBox="0 0 375 375" fill="none"
      className={className} aria-hidden>
      {/* P: top block + descending stem (sharp corners, as designed) */}
      <path d="M96 0H278V193H188V375H96V0Z" fill={p} />
      {/* wine accent block, aligned to the P's right edge and baseline */}
      <rect x="198" y="209" width="80" height="166" rx="17" fill={WINE} />
    </svg>
  );
}

/** App-icon style: mark on a rounded ink tile (favicon, avatars, dark chrome). */
export function LogoTile({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" className={className} aria-hidden>
      <rect width="512" height="512" rx="112" fill="#1A1218" />
      <g transform="translate(100 68) scale(0.83)">
        <path d="M96 0H278V193H188V375H96V0Z" fill="#FFFFFF" />
        <rect x="198" y="209" width="80" height="166" rx="17" fill={WINE} />
      </g>
    </svg>
  );
}

export function LogoLockup({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} variant={dark ? "light" : "dark"} />
      <span className={`font-semibold tracking-tight ${dark ? "text-ink-text-strong" : "text-foreground"}`}
        style={{ fontSize: size * 0.72 }}>
        Peysich
      </span>
    </span>
  );
}
