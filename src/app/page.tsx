import Link from "next/link";
import { CalendarCheck, GraduationCap, Wallet, Megaphone, ShieldCheck, Layers } from "lucide-react";
import { LogoLockup } from "@/ui/logo";
import { LeadForm } from "./lead-form";

const FEATURES = [
  { icon: CalendarCheck, t: "30-second attendance", d: "Everyone starts present — teachers tap only the exceptions. Parents get absence alerts instantly." },
  { icon: GraduationCap, t: "Report cards in one click", d: "Continuous assessment + exams, your grading scheme, beautifully branded terminal reports." },
  { icon: Wallet, t: "Fees parents actually pay", d: "Mobile money from any phone, partial payments welcome, receipts kept forever." },
  { icon: Megaphone, t: "Reach every parent", d: "Announcements, events and SMS — school-wide or per class, from one screen." },
  { icon: Layers, t: "Pay only for what you use", d: "Modules switch on and off per school. Grow into timetables, admissions, transport and more." },
  { icon: ShieldCheck, t: "Your school, your subdomain", d: "yourschool.peysich.com — isolated data, daily backups, bank-grade separation between schools." },
];

const PLANS = [
  ["Starter", "375", "Records, attendance, report cards & announcements", false],
  ["Standard", "975", "Everything in Starter + timetable, homework, fees (MoMo) & SMS", true],
  ["Premium", "2,000", "Everything + admissions, library, transport, HR & analytics", false],
] as const;

export default function Home() {
  return (
    <main className="bg-background">
      {/* nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <LogoLockup size={30} />
        <nav className="flex items-center gap-3">
          <Link href="/sign-in" className="rounded-md px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-strong">
            Start free trial
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-brand-soft blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-16 text-center lg:pt-24">
          <p className="mx-auto mb-4 w-fit rounded-full border border-border bg-card px-3 py-1 text-[12px] font-medium text-muted-foreground shadow-[var(--shadow-sm)]">
            For preschool → JHS · Built for Ghana 🇬🇭
          </p>
          <h1 className="text-[40px] font-semibold leading-[1.1] tracking-tight lg:text-[52px]">
            The calm way to run<br />a modern school.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            Attendance, report cards, fees and parent communication — in one place,
            on your school&apos;s own subdomain, at a price that makes sense per term.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/signup" className="rounded-md bg-primary px-6 py-3 text-[15px] font-medium text-primary-foreground shadow-[var(--shadow-md)] transition-all hover:bg-brand-strong">
              Start your 14-day free trial
            </Link>
            <Link href="/sign-in" className="rounded-md border border-border bg-card px-6 py-3 text-[15px] font-medium shadow-[var(--shadow-sm)] transition-colors hover:bg-muted">
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-[12px] text-faint">No card required · set up in under an hour</p>
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-primary">
                <Icon size={18} />
              </span>
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* pricing */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-center text-[28px] font-semibold tracking-tight">Simple pricing, per term</h2>
        <p className="mt-2 text-center text-[14px] text-muted-foreground">
          Because schools budget by term — not by month.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PLANS.map(([name, price, desc, popular]) => (
            <div key={name}
              className={`relative rounded-lg border bg-card p-6 shadow-[var(--shadow-sm)] ${popular ? "border-primary shadow-[var(--shadow-md)]" : "border-border"}`}>
              {popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
              <p className="font-semibold">{name}</p>
              <p className="mt-2 text-[30px] font-semibold tracking-tight" data-nums="">
                GHS {price}<span className="text-[13px] font-normal text-muted-foreground">/term</span>
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
              <Link href="/signup"
                className={`mt-5 block rounded-md py-2 text-center text-sm font-medium transition-colors ${popular ? "bg-primary text-primary-foreground hover:bg-brand-strong" : "border border-border hover:bg-muted"}`}>
                Get started
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          Bigger school or specific needs? <span className="font-medium text-foreground">Custom plans</span> compose exactly the modules you want.
        </p>
      </section>

      {/* lead capture */}
      <section id="demo" className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-[26px] font-semibold tracking-tight">Prefer a walkthrough first?</h2>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
              Leave your number and we&apos;ll call to show you Peysich on your own school&apos;s
              structure — classes, report cards, fees, everything.
            </p>
          </div>
          <LeadForm />
        </div>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-[12px] text-muted-foreground">
          <LogoLockup size={22} />
          <p>© {new Date().getFullYear()} Peysich — school management for preschool to JHS</p>
        </div>
      </footer>
    </main>
  );
}
