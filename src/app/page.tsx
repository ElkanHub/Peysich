import Link from "next/link";
import Image from "next/image";
import {
  CalendarCheck, GraduationCap, Wallet, Megaphone, ShieldCheck, Layers,
  Users, BookOpen, HeartHandshake, Sparkles, Check, Lock, Server, History,
  MessageSquareText, ArrowRight,
} from "lucide-react";
import { LogoLockup } from "@/ui/logo";
import { LeadForm } from "./lead-form";
import { FeatureTabs } from "./feature-tabs";

/* The wine the whole app runs on, as marketing gradients. */
const GRAD_TEXT =
  "bg-[linear-gradient(100deg,#5e1d3e,#8a2f5c_55%,#b0447a)] bg-clip-text text-transparent " +
  "dark:bg-[linear-gradient(100deg,#c9789f,#d98ab4_55%,#e6a9c8)]";
const GRAD_PANEL = "bg-[linear-gradient(135deg,#37023c,#5e1d3e_55%,#4a1730)]";

const STATS = [
  ["30s", "to mark a whole register"],
  ["1 click", "from scores to report cards"],
  ["13", "modules — pay for what you use"],
  ["4 roles", "admin, teacher, parent, student"],
] as const;

const BENEFITS = [
  { icon: CalendarCheck, t: "30-second attendance", d: "Everyone starts present — teachers tap only the exceptions. Guardians get absence SMS instantly, and the GES-style record book keeps the whole year." },
  { icon: GraduationCap, t: "Report cards in one click", d: "Continuous assessment + exams on your own grading scheme, released test by test, printed beautifully under your school's brand." },
  { icon: Wallet, t: "Fees parents actually pay", d: "Mobile money from any phone, partial payments welcome, receipts kept forever — and the dashboard shows collected vs outstanding live." },
  { icon: Megaphone, t: "Reach every parent", d: "Announcements that must be acknowledged, events on a shared calendar, SMS and email blasts signed with your school's name." },
  { icon: Layers, t: "Pay only for what you use", d: "Modules switch on and off per school. Start with records and attendance, grow into timetables, admissions, transport and more." },
  { icon: ShieldCheck, t: "Your school, your subdomain", d: "yourschool.peysich.com — isolated data, daily backups, and records archived term by term, year by year." },
];

const ROLES = [
  { icon: Users, t: "Admins run the morning in 90 seconds", d: "A live board of every register, fees collected vs outstanding, one-tap teacher reminders and decision-ready KPIs." },
  { icon: BookOpen, t: "Teachers get their day, not paperwork", d: "Their registers, their lessons, their score sheets — scoped to exactly the classes they teach, nothing else." },
  { icon: HeartHandshake, t: "Parents see their children, only theirs", d: "Attendance, homework, released results and fees per child — strictly scoped, with SMS when it matters." },
  { icon: Sparkles, t: "Students get a dashboard that moves them", d: "\"Do today\" pulls overdue homework and unread notices to the top — personal, official, action-first." },
];

const TRUST = [
  { icon: Lock, t: "Isolated per school", d: "Every school lives on its own subdomain with bank-grade separation — one school can never see another's data." },
  { icon: ShieldCheck, t: "Role-scoped everywhere", d: "Teachers see their classes, parents their children, students themselves. Scoping is enforced on every page and every action." },
  { icon: Server, t: "Backed up daily", d: "Your records are backed up every day, and published report cards are immutable snapshots that keep their history." },
  { icon: History, t: "An archive that lasts", d: "Attendance books, score sheets and reports stay findable per term and per academic year — reference for years to come." },
];

const PLANS = [
  {
    name: "Starter", price: "99", popular: false,
    tagline: "The office essentials, digital at last",
    feats: ["Student records & files", "30-second attendance + record book", "Report cards & releases", "Announcements & acknowledgements"],
  },
  {
    name: "Standard", price: "249", popular: true,
    tagline: "The whole school day, connected",
    feats: ["Everything in Starter", "Timetable, calendar & clash detection", "Homework records for parents", "Fees with Mobile Money", "SMS & email blasts"],
  },
  {
    name: "Premium", price: "499", popular: false,
    tagline: "Every department on one platform",
    feats: ["Everything in Standard", "Admissions pipeline", "Library & transport", "Staff HR", "Advanced analytics"],
  },
] as const;

export default function Home() {
  return (
    <main className="bg-background">
      {/* ── nav ── */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <LogoLockup size={30} />
          <nav className="hidden items-center gap-6 text-[14px] font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#roles" className="transition-colors hover:text-foreground">For your school</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            <a href="#trust" className="transition-colors hover:text-foreground">Security</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/sign-in" className="rounded-md px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Sign in
            </Link>
            <a href="#demo" className="hidden rounded-md border border-border bg-card px-4 py-2 text-sm font-medium shadow-[var(--shadow-sm)] transition-colors hover:bg-muted sm:block">
              Get a demo
            </a>
            <Link href="/signup" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-strong">
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* ── hero ── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute -top-40 left-1/2 h-[560px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,#f0dbe7,transparent)] dark:bg-[radial-gradient(closest-side,#33202b,transparent)]" />
        <div aria-hidden className="absolute -right-40 top-64 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,#efe4f1,transparent)] opacity-80 dark:bg-[radial-gradient(closest-side,#2a1c30,transparent)]" />

        <div className="relative mx-auto max-w-4xl px-6 pt-16 text-center lg:pt-24">
          <p className="mx-auto mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-card px-3.5 py-1.5 text-[13px] font-medium shadow-[var(--shadow-sm)]">
            <span className={`font-semibold ${GRAD_TEXT}`}>Built for Ghana 🇬🇭</span>
            <span className="text-faint">·</span>
            <span className="text-muted-foreground">GES structure, Creche → JHS</span>
          </p>
          <h1 className="text-[42px] font-semibold leading-[1.08] tracking-tight lg:text-[58px]">
            Discover the calmer way<br />
            to run <span className={GRAD_TEXT}>your whole school.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            Attendance, assessment, report cards, fees and parent communication flowing
            together on your school&apos;s own subdomain — a next-generation platform
            at a price that makes sense every month.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup"
              className={`group inline-flex items-center gap-2 rounded-lg px-7 py-3.5 text-[15px] font-semibold text-white shadow-[var(--shadow-lg)] transition-transform hover:scale-[1.02] ${GRAD_PANEL}`}>
              Start your 14-day free trial
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#demo" className="rounded-lg border border-border bg-card px-7 py-3.5 text-[15px] font-medium shadow-[var(--shadow-sm)] transition-colors hover:bg-muted">
              Get a demo
            </a>
          </div>
          <p className="mt-4 text-[13px] text-faint">No card required · set up in under an hour · cancel any time</p>
        </div>

        {/* the product, front and centre */}
        <div className="relative mx-auto mt-14 max-w-5xl px-6 pb-10">
          <div aria-hidden className={`absolute inset-x-10 top-8 -bottom-2 rounded-[36px] opacity-[0.16] blur-2xl ${GRAD_PANEL}`} />
          <figure className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_80px_-24px_rgb(55_2_60/0.45)]">
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-danger/50" />
              <span className="h-3 w-3 rounded-full bg-warning/50" />
              <span className="h-3 w-3 rounded-full bg-success/50" />
              <span className="ml-3 rounded-md bg-card px-3 py-1 text-[12px] text-faint" data-nums="">stmarys.peysich.com</span>
            </div>
            <Image src="/shots/hero-dashboard.png" alt="The Peysich admin dashboard: live attendance, fees and the term pulse"
              width={2040} height={1275} priority className="w-full" />
          </figure>
          {/* floating proof chips */}
          <div className="absolute -left-2 top-1/3 hidden w-56 rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-lg)] lg:block">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success-soft text-success"><MessageSquareText size={13} /></span>
              Absence SMS sent ✓
            </p>
            <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">3 guardians alerted the moment the register was saved.</p>
          </div>
          <div className="absolute -right-2 top-2/3 hidden w-56 rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-lg)] lg:block">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-white ${GRAD_PANEL}`}><ClockIcon /></span>
              Week 4 of 13 · Term 1
            </p>
            <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">Every dashboard knows where the term stands — and when school closes today.</p>
          </div>
        </div>
      </section>

      {/* ── stats band ── */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-8 px-6 py-10 md:grid-cols-4">
          {STATS.map(([n, l]) => (
            <div key={l} className="text-center">
              <p className={`text-[32px] font-semibold tracking-tight ${GRAD_TEXT}`} data-nums="">{n}</p>
              <p className="mt-1 text-[13.5px] text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── feature tabs ── */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className={`text-[13px] font-semibold uppercase tracking-widest ${GRAD_TEXT}`}>The platform</p>
          <h2 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight">
            Everything a school runs on, flowing together.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            No patchwork of spreadsheets and WhatsApp groups. One source of truth for the
            registers, the marks, the money and the messages.
          </p>
        </div>
        <FeatureTabs />
      </section>

      {/* ── roles ── */}
      <section id="roles" className="relative scroll-mt-20 overflow-hidden border-y border-border bg-card">
        <div aria-hidden className="absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,var(--brand-soft),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[6fr_6fr]">
          <div>
            <p className={`text-[13px] font-semibold uppercase tracking-widest ${GRAD_TEXT}`}>One school, four experiences</p>
            <h2 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight">
              Everyone opens the same app.<br />Nobody sees the same thing.
            </h2>
            <div className="mt-7 space-y-5">
              {ROLES.map(({ icon: Icon, t, d }) => (
                <div key={t} className="flex items-start gap-3.5">
                  <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[var(--shadow-md)] ${GRAD_PANEL}`}>
                    <Icon size={17} />
                  </span>
                  <div>
                    <p className="font-semibold leading-snug">{t}</p>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-muted-foreground">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-lg)]">
              <Image src="/shots/student-dashboard.png" alt="The student dashboard: identity card, KPIs and a Do-today list"
                width={2040} height={1275} className="w-full" />
            </figure>
            <figure className="absolute -bottom-8 -left-6 hidden w-64 overflow-hidden rounded-lg border border-border shadow-[var(--shadow-lg)] md:block">
              <Image src="/shots/dark-dashboard.png" alt="Peysich in dark mode" width={2040} height={1275} className="w-full" />
              <figcaption className="bg-card px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground">Dark mode included</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ── benefits grid ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className={`text-[13px] font-semibold uppercase tracking-widest ${GRAD_TEXT}`}>Why schools switch</p>
          <h2 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight">
            Streamlined school days, smarter decisions.
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="group rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-lg)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon size={18} />
              </span>
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── trust ── */}
      <section id="trust" className={`scroll-mt-20 ${GRAD_PANEL}`}>
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-[13px] font-semibold uppercase tracking-widest text-white/60">Trust & security</p>
            <h2 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-white">
              A school&apos;s records deserve a vault, not a folder.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Icon size={16} />
                </span>
                <h3 className="mt-3.5 font-semibold text-white">{t}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/70">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── pricing ── */}
      <section id="pricing" className="mx-auto max-w-5xl scroll-mt-20 px-6 py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className={`text-[13px] font-semibold uppercase tracking-widest ${GRAD_TEXT}`}>Pricing</p>
          <h2 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight">Simple pricing, per month.</h2>
          <p className="mt-3 text-[14.5px] text-muted-foreground">
            Pay monthly, or yearly with two months free. Cancel any time.
          </p>
        </div>
        <div className="grid items-stretch gap-5 md:grid-cols-3">
          {PLANS.map(({ name, price, tagline, feats, popular }) => (
            <div key={name}
              className={`relative flex flex-col rounded-2xl p-[1.5px] ${popular ? GRAD_PANEL + " shadow-[var(--shadow-lg)]" : ""}`}>
              <div className={`flex h-full flex-col rounded-[15px] bg-card p-6 ${popular ? "" : "border border-border shadow-[var(--shadow-sm)]"}`}>
                {popular && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11.5px] font-semibold text-white shadow-[var(--shadow-md)] ${GRAD_PANEL}`}>
                    Most popular
                  </span>
                )}
                <p className="font-semibold">{name}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{tagline}</p>
                <p className="mt-4 text-[34px] font-semibold tracking-tight" data-nums="">
                  <span className={popular ? GRAD_TEXT : ""}>GHS {price}</span>
                  <span className="text-[14px] font-normal text-muted-foreground">/month</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {feats.map((f2) => (
                    <li key={f2} className="flex items-start gap-2 text-[13.5px] leading-snug">
                      <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      {f2}
                    </li>
                  ))}
                </ul>
                <Link href="/signup"
                  className={`mt-6 block rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${popular
                    ? "text-white shadow-[var(--shadow-md)] hover:scale-[1.01] " + GRAD_PANEL
                    : "border border-border hover:bg-muted"}`}>
                  Get started
                </Link>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-7 text-center text-[14px] text-muted-foreground">
          Bigger school or specific needs? <span className="font-medium text-foreground">Custom plans</span> compose exactly the modules you want.
        </p>
      </section>

      {/* ── final CTA + lead capture ── */}
      <section id="demo" className="relative scroll-mt-20 overflow-hidden border-t border-border bg-card">
        <div aria-hidden className="absolute -right-52 -top-40 h-[480px] w-[480px] rounded-full bg-[radial-gradient(closest-side,var(--brand-soft),transparent)]" />
        <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 md:grid-cols-2">
          <div>
            <p className={`text-[13px] font-semibold uppercase tracking-widest ${GRAD_TEXT}`}>Get a demo</p>
            <h2 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight">
              Ready to see Peysich<br />in action?
            </h2>
            <p className="mt-3 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">
              Leave your number and we&apos;ll call to walk you through Peysich on your own
              school&apos;s structure — classes, report cards, fees, everything.
            </p>
            <ul className="mt-6 space-y-2.5">
              {["A walkthrough on your school's real structure", "Honest advice on which plan fits", "Set up and live in under an hour"].map((f2) => (
                <li key={f2} className="flex items-start gap-2.5 text-[14px]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {f2}
                </li>
              ))}
            </ul>
          </div>
          <LeadForm />
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <LogoLockup size={26} />
              <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
                School management for preschool to JHS — built for how Ghanaian
                schools actually run.
              </p>
            </div>
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-wider text-faint">Product</p>
              <ul className="mt-3 space-y-2 text-[13.5px] text-muted-foreground">
                <li><a href="#features" className="transition-colors hover:text-foreground">Features</a></li>
                <li><a href="#roles" className="transition-colors hover:text-foreground">For your school</a></li>
                <li><a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a></li>
                <li><a href="#trust" className="transition-colors hover:text-foreground">Security</a></li>
              </ul>
            </div>
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-wider text-faint">Get started</p>
              <ul className="mt-3 space-y-2 text-[13.5px] text-muted-foreground">
                <li><Link href="/signup" className="transition-colors hover:text-foreground">Start free trial</Link></li>
                <li><a href="#demo" className="transition-colors hover:text-foreground">Get a demo</a></li>
                <li><Link href="/sign-in" className="transition-colors hover:text-foreground">Sign in</Link></li>
              </ul>
            </div>
          </div>
          <p className="mt-10 border-t border-border pt-5 text-[13px] text-muted-foreground">
            © {new Date().getFullYear()} Peysich. Made for schools in Ghana 🇬🇭
          </p>
        </div>
      </footer>
    </main>
  );
}

/** Tiny clock glyph for the floating chip (keeps lucide imports lean). */
function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
