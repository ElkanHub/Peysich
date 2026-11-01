import { LogoLockup } from "./logo";

/* ── The door ───────────────────────────────────────────────────────────────
   Sign-in and sign-up share one frame: an ink rail that says what the app
   is (desktop) or a slim ink band (phone), and a paper column for the form.
   Public-facing, so it stays light inside a dark document (.light-scope).
   Safe-area aware — in the installed app the band tucks under the status
   bar and the form clears the home indicator.

   The rail is a SCENE: a cut-out photograph of the people the app is for,
   a headline and one line. The rail's right edge is cut on a slant and the
   figures rise over the words, so the picture sits in front of the page
   rather than behind it. A fresh load picks one of three — the same habit
   as the dashboard photograph — chosen by a two-line inline script before
   first paint, so the static page still varies and never flashes. */

export const doorInputCls =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-[15px] text-foreground outline-none transition " +
  "placeholder:text-faint focus:border-primary focus:ring-4 focus:ring-primary/10";
export const doorBtnCls =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground " +
  "shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90 disabled:opacity-60";
export const doorGhostCls =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-[15px] font-semibold " +
  "transition-colors hover:bg-muted disabled:opacity-60";

const SCENES: { key: string; file: string; top?: string; title: React.ReactNode; line: string }[] = [
  {
    key: "students", file: "students.webp",
    title: <>Every child, <em className="not-italic text-[#e9a9c9]">seen every day.</em></>,
    line: "Register, scores, report cards and fees — one calm place, any phone.",
  },
  {
    key: "teacher", file: "teacher.webp",
    title: <>Less paperwork. <em className="not-italic text-[#e9a9c9]">More teaching.</em></>,
    line: "Mark the class from your phone; the report cards write themselves.",
  },
  {
    key: "staff", file: "staff.webp", top: "36%",
    title: <>One school. One system. <em className="not-italic text-[#e9a9c9]">Every role.</em></>,
    line: "Head, teachers, parents and students — one sign-in, each their own view.",
  },
  {
    key: "parent", file: "door-parent.webp", top: "30%",
    title: <>Her day at school, <em className="not-italic text-[#e9a9c9]">on your phone.</em></>,
    line: "Attendance, fees and the report card, the moment the school records them.",
  },
  {
    key: "head", file: "door-head.webp", top: "30%",
    title: <>Run the school <em className="not-italic text-[#e9a9c9]">from one place.</em></>,
    line: "Registers, scores, fees and messages — the whole morning in ninety seconds.",
  },
  {
    key: "kids", file: "door-kids.webp", top: "30%",
    title: <>Every child, <em className="not-italic text-[#e9a9c9]">counted in.</em></>,
    line: "Register, scores, report cards and fees — one calm place, any phone.",
  },
];

/** Show only the chosen scene; with no script at all, the first one. The
 *  attribute sits on <main>, so the desktop rail and the phone scene pick
 *  the same one. */
const SCENE_CSS =
  ".door-scene{display:none}" +
  SCENES.map((s) => `[data-scene="${s.key}"] .door-scene[data-k="${s.key}"]{display:block}`).join("") +
  `main:not([data-scene]) .door-scene[data-k="${SCENES[0].key}"]{display:block}`;
/** The phone cut-out fades at its foot into the ink, so the sheet can rise over it. */
const PHONE_MASK_IMG = "linear-gradient(to bottom, #000 72%, transparent 100%)";
const PHONE_MASK: React.CSSProperties = { maskImage: PHONE_MASK_IMG, WebkitMaskImage: PHONE_MASK_IMG };
/** Feather the cut-out's sides: the generated PNGs carry a soft halo whose
 *  edge would otherwise read as a faint rectangle on the ink. */
const MASK_IMG = "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 10%)";
const MASK: React.CSSProperties = { maskImage: MASK_IMG, WebkitMaskImage: MASK_IMG, maskComposite: "intersect", WebkitMaskComposite: "source-in" };
/** The slant: the rail's right edge runs from the top corner to a point
 *  short of it at the floor, like a page lifted at one corner. */
const SLANT: React.CSSProperties = { clipPath: "polygon(0 0, 100% 0, 86% 100%, 0 100%)" };
const PICK_JS =
  `var a=document.currentScript.parentNode;a.setAttribute("data-scene",${JSON.stringify(SCENES.map((s) => s.key))}[Math.floor(Math.random()*${SCENES.length})])`;

export function Door({ children, footer }: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main suppressHydrationWarning className="light-scope min-h-dvh bg-ink text-foreground lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:bg-background">
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />
      {/* ink rail — the statement */}
      <aside style={SLANT}
        className="relative hidden overflow-hidden bg-ink text-ink-text lg:flex lg:flex-col">
        <div className="relative z-[2] p-10 pb-0"><LogoLockup size={30} dark /></div>

        {SCENES.map((s) => (
          <div key={s.key} data-k={s.key} className="door-scene">
            <div className="relative z-[2] max-w-[480px] px-10 pt-9">
              <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.025em] text-ink-text-strong">{s.title}</h1>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-text/80">{s.line}</p>
            </div>

            {/* the photograph: cut out, anchored to the floor, raised IN FRONT of
                the words so the figures overlap the last line — depth, not wallpaper */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[3]" style={{ top: s.top ?? "27%" }}>
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 85%, color-mix(in srgb, var(--primary) 45%, transparent), transparent 70%)" }} />
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative cut-out, one of three */}
              <img src={`/door/${s.file}`} alt="" loading="lazy" decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-top drop-shadow-[0_-18px_40px_rgba(0,0,0,0.55)]"
                style={MASK} />
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
            </div>
          </div>
        ))}

        <p className="relative z-[4] mt-auto p-10 pt-0 text-[12.5px] text-ink-text/55">© {new Date().getFullYear()} SchoolSpec · Made for schools in Ghana</p>
      </aside>

      {/* phone: the same scene, on top — the people, the line, and the sheet
          rising over their feet. The scene is the top 46% of the screen. */}
      <div className="relative h-[min(46dvh,440px)] min-h-[300px] overflow-hidden bg-ink text-ink-text lg:hidden">
        <div className="relative z-[2] px-5 pt-[calc(var(--sat)+1rem)]"><LogoLockup size={24} dark /></div>
        {SCENES.map((s) => (
          <div key={s.key} data-k={s.key} className="door-scene">
            <div className="relative z-[2] max-w-[330px] px-5 pt-4">
              <h1 className="text-[26px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-text-strong">{s.title}</h1>
              <p className="mt-2 max-w-[26ch] text-[13.5px] leading-snug text-ink-text/80">{s.line}</p>
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%]"
              style={{ background: "radial-gradient(ellipse 70% 60% at 50% 95%, color-mix(in srgb, var(--primary) 55%, transparent), transparent 70%)" }} />
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative cut-out, one of six */}
            <img src={`/door/${s.file}`} alt="" loading="lazy" decoding="async"
              className="pointer-events-none absolute bottom-0 left-1/2 h-[66%] w-auto max-w-none -translate-x-1/2 object-contain object-bottom"
              style={PHONE_MASK} />
          </div>
        ))}
      </div>
      <script dangerouslySetInnerHTML={{ __html: PICK_JS }} />

      <section className="relative z-[4] -mt-6 flex flex-col rounded-t-[26px] bg-background px-5 pb-[calc(var(--sab)+2rem)] pt-7 sm:px-10 lg:mt-0 lg:justify-center lg:rounded-none lg:py-12">
        <div className="mx-auto w-full max-w-[400px]">{children}</div>
        {footer && <div className="mx-auto mt-10 w-full max-w-[400px] text-[13px] text-muted-foreground">{footer}</div>}
      </section>
    </main>
  );
}
