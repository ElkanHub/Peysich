import { LogoLockup } from "./logo";

/* ── The door ───────────────────────────────────────────────────────────────
   Sign-in and sign-up share one frame: an ink rail that says what the app
   is (desktop) or a slim ink band (phone), and a paper column for the form.
   Public-facing, so it stays light inside a dark document (.light-scope).
   Safe-area aware — in the installed app the band tucks under the status
   bar and the form clears the home indicator.

   The rail is a SCENE: a cut-out photograph of the people the app is for
   and the pitch written to them. A fresh load picks one of three — the same
   habit as the dashboard photograph — chosen by a two-line inline script
   before first paint, so the static page still varies and never flashes. */

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

const SCENES = [
  {
    key: "students", file: "students.webp",
    eyebrow: "For every child",
    title: <>Every child, <em className="not-italic text-[#e9a9c9]">seen every day.</em></>,
    body: "The register is in by 8:05. The scores add up. The report card prints under your crest — and the parent already knows.",
    proof: ["30-second register", "GES-style report cards", "Fee receipts by SMS"],
  },
  {
    key: "teacher", file: "teacher.webp",
    eyebrow: "For the teacher",
    title: <>Less paperwork. <em className="not-italic text-[#e9a9c9]">More teaching.</em></>,
    body: "Mark the class from your phone, enter scores once, and let the report cards and the parents' messages write themselves.",
    proof: ["Works offline", "Any phone", "Nothing to install"],
  },
  {
    key: "staff", file: "staff.webp",
    eyebrow: "For the whole school",
    title: <>One school. One system. <em className="not-italic text-[#e9a9c9]">Every role.</em></>,
    body: "Head, teachers, parents and students sign in to the same school — each sees exactly what is theirs, nothing more.",
    proof: ["Creche to JHS 3", "Set up in a morning", "Made in Ghana"],
  },
];

/** Show only the chosen scene; with no script at all, the first one. */
const SCENE_CSS =
  ".door-scene{display:none}" +
  SCENES.map((s) => `[data-scene="${s.key}"] .door-scene[data-k="${s.key}"]{display:block}`).join("") +
  `aside:not([data-scene]) .door-scene[data-k="${SCENES[0].key}"]{display:block}`;
/** Feather the cut-out on all four sides: the generated PNGs carry a soft
 *  halo whose edge would otherwise read as a faint rectangle on the ink. */
const MASK_IMG = "linear-gradient(to bottom, transparent 0%, #000 38%, #000 100%), linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%)";
const MASK: React.CSSProperties = { maskImage: MASK_IMG, WebkitMaskImage: MASK_IMG, maskComposite: "intersect", WebkitMaskComposite: "source-in" };
const PICK_JS =
  `var a=document.currentScript.parentNode;a.setAttribute("data-scene",${JSON.stringify(SCENES.map((s) => s.key))}[Math.floor(Math.random()*${SCENES.length})])`;

export function Door({ side, children, footer }: {
  /** One line the page adds under the pitch — what THIS door is for. */
  side?: { note: string };
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="light-scope min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ink rail — the statement */}
      <aside suppressHydrationWarning
        className="relative hidden overflow-hidden bg-ink text-ink-text lg:flex lg:flex-col">
        <style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />
        <div className="relative z-[2] p-10 pb-0"><LogoLockup size={30} dark /></div>

        {SCENES.map((s) => (
          <div key={s.key} data-k={s.key} className="door-scene">
            {/* the photograph: cut out, anchored to the floor of the rail, fading
                into the ink at the top so the words always have a clean field */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 top-[50%]">
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 85%, color-mix(in srgb, var(--primary) 45%, transparent), transparent 70%)" }} />
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative cut-out, one of three */}
              <img src={`/door/${s.file}`} alt="" loading="lazy" decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-top"
                style={MASK} />
              <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-ink via-ink/75 to-transparent" />
            </div>

            <div className="relative z-[2] max-w-[420px] px-10 pt-10">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e9a9c9]">{s.eyebrow}</p>
              <h1 className="mt-2.5 text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink-text-strong">{s.title}</h1>
              <p className="mt-3.5 text-[15px] leading-relaxed text-ink-text/85">{s.body}</p>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] font-medium text-ink-text/70">
                {s.proof.map((p) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#e9a9c9]" />{p}
                  </li>
                ))}
              </ul>
              {side && <p className="mt-5 border-l-2 border-ink-border pl-3 text-[13.5px] leading-snug text-ink-text/60">{side.note}</p>}
            </div>
          </div>
        ))}
        <script dangerouslySetInnerHTML={{ __html: PICK_JS }} />

        <div className="relative z-[2] mt-auto flex items-end justify-between gap-4 p-10 pt-0">
          <div>
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-text/50">One sign-in · your own view</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <span key={r} className="rounded-full border border-ink-border bg-ink/60 px-3 py-1 text-[13px] font-medium text-ink-text backdrop-blur-sm">{r}</span>
              ))}
            </div>
          </div>
          <p className="shrink-0 text-[12.5px] text-ink-text/50">© {new Date().getFullYear()} SchoolSpec</p>
        </div>
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
