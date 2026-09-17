import { LogoLockup, LogoMark } from "./logo";

/* ── The door ───────────────────────────────────────────────────────────────
   Sign-in and sign-up share one frame: an ink rail that says what the app
   is (desktop) or a slim ink band (phone), and a paper column for the form.
   Public-facing, so it stays light inside a dark document (.light-scope).
   Safe-area aware — in the installed app the band tucks under the status
   bar and the form clears the home indicator. */

export const doorInputCls =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-[15px] text-foreground outline-none transition " +
  "placeholder:text-faint focus:border-primary focus:ring-4 focus:ring-primary/10";
export const doorBtnCls =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground " +
  "shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90 disabled:opacity-60";
export const doorGhostCls =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-[15px] font-semibold " +
  "transition-colors hover:bg-muted disabled:opacity-60";

const ROLES = ["Head", "Teacher", "Parent", "Student"];

export function Door({ side, children, footer }: {
  side: { title: string; body: string };
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="light-scope min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ink rail — the statement */}
      <aside className="relative hidden overflow-hidden bg-ink p-10 text-ink-text lg:flex lg:flex-col lg:justify-between">
        <LogoMark size={520} variant="light"
          className="pointer-events-none absolute -bottom-32 -right-24 opacity-[0.045]" />
        <div aria-hidden className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />
        <LogoLockup size={30} dark />
        <div className="relative max-w-md">
          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight text-ink-text-strong">{side.title}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-text/80">{side.body}</p>
          <div className="mt-8">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-text/50">One sign-in · your own view</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <span key={r} className="rounded-full border border-ink-border px-3 py-1 text-[13px] font-medium text-ink-text">{r}</span>
              ))}
            </div>
          </div>
        </div>
        <p className="relative text-[12.5px] text-ink-text/50">© {new Date().getFullYear()} SchoolSpec · Made for schools in Ghana</p>
      </aside>

      {/* phone: a slim ink band carries the brand under the status bar */}
      <div className="flex items-center bg-ink px-5 pb-4 pt-[calc(var(--sat)+1.1rem)] lg:hidden">
        <LogoLockup size={26} dark />
      </div>

      <section className="flex flex-col px-5 pb-[calc(var(--sab)+2rem)] pt-8 sm:px-10 lg:justify-center lg:py-12">
        <div className="mx-auto w-full max-w-[400px]">{children}</div>
        {footer && <div className="mx-auto mt-10 w-full max-w-[400px] text-[13px] text-muted-foreground">{footer}</div>}
      </section>
    </main>
  );
}
