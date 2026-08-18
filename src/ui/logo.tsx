/** Peysich mark — PLACEHOLDER until the real logo SVG lands (then only this
 *  file and app/icon.svg change; every usage site stays put).
 *  Mark: an open book forming a rising step — education + growth. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--brand, #4f46e5)" />
      <path d="M7 22.5V10.8c0-.6.5-1.1 1.1-1L15 11v12l-6.9-1.2c-.6-.1-1.1.1-1.1.7z" fill="#fff" opacity=".92" />
      <path d="M25 22.5V10.8c0-.6-.5-1.1-1.1-1L17 11v12l6.9-1.2c.6-.1 1.1.1 1.1.7z" fill="#fff" opacity=".65" />
      <path d="M11 15.5l3-.5v2l-3 .5v-2zm10-1.8l-3 .5v2l3-.5v-2z" fill="var(--brand, #4f46e5)" />
    </svg>
  );
}

export function LogoLockup({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`font-semibold tracking-tight ${dark ? "text-ink-text-strong" : "text-foreground"}`}
        style={{ fontSize: size * 0.68 }}>
        Peysich
      </span>
    </span>
  );
}
