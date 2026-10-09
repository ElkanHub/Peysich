import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SiteNav, SiteFooter } from "@/ui/site-shell";
import { LeadForm } from "./lead-form";
import { PlanBuilder } from "@/modules/plans/builder";
import { getPublicPlans } from "@/core/plans-cache";
import { submitPublicPlanRequest } from "./plan-request-actions";
import {
  ADDON_MODULES, ADDON_PRICES, BASE_PESEWAS, CORE_MODULES, MODULE_LABELS, SIZE_BANDS,
} from "@/core/plan-const";
import { BASE, pageMeta } from "@/lib/seo";

/* The marketing page runs on the Assembly tokens (globals.css) with a
 * rounder, card-on-ground language scoped to .lp-*. The footer is the one
 * piece kept from the drafting-paper era, unchanged. */

export const metadata: Metadata = pageMeta({
  absoluteTitle: "SchoolSpec — school management system for basic schools in Ghana",
  title: "SchoolSpec",
  description: "Mark the register in 30 seconds, print report cards under your crest in one click, record fees with an SMS receipt to the parent, and keep parents in the loop. For basic schools in Ghana, Creche to JHS 3, on any phone.",
  path: "/",
});

const TRIAL_DAYS = 14;


const FEATURES = [
  {
    h: "The 30-second register",
    p: "Everyone starts present. The teacher taps only the exceptions, the record book writes itself, and guardians of absentees have an SMS before first period. Works offline.",
    shot: "record-book.png", alt: "The attendance record book in SchoolSpec",
  },
  {
    h: "Report cards in one click",
    p: "Scores in; totals, grades and positions out on your own scheme. Printed under your crest with the class teacher's signature, the head's signature and the stamp in place.",
    shot: "reports.png", alt: "Report cards in SchoolSpec",
  },
  {
    h: "Fees parents actually pay",
    p: "Mobile money from any phone, partial payments welcome, receipts by SMS. The owner sees collected versus outstanding, live.",
    shot: "mobile-dashboard.png", alt: "Collected versus outstanding fees on the phone dashboard", phone: true,
  },
  {
    h: "Parents who never miss a notice",
    p: "Announcements that must be acknowledged, a shared calendar, and SMS signed with the school's name, to the phone they already carry.",
    shot: "comms.png", alt: "Announcements in SchoolSpec",
  },
  {
    h: "A timetable that catches the clash",
    p: "Place lessons into the school's own day plan. Double-bookings are refused before they happen. Teachers, classes and rooms each get their own view.",
    shot: "calendar.png", alt: "The school calendar in SchoolSpec",
  },
];

const ROLES = [
  { file: "arch-head.webp", w: 421, h: 761, p: "The morning in 90 seconds: every register, money in versus owing, the decisions waiting." },
  { file: "arch-teacher.webp", w: 440, h: 673, p: "Their classes, their registers, their score sheets. No one else's paperwork." },
  { file: "arch-parent.webp", w: 404, h: 737, p: "Their children only: attendance, homework, results, and exactly what's owed." },
  { file: "arch-student.webp", w: 416, h: 666, p: "A “do today” list that puts overdue homework and unread notices first." },
];

const FAQ = [
  ["We keep everything in exercise books. How do we start?",
    "Import students from a spreadsheet or add them one by one — most schools mark their first register the next morning. Classes and subjects are created for you when you choose your levels."],
  ["Do parents need smartphones?",
    "No. Fees work from any phone with mobile money, and everything important reaches parents by SMS. The app is a bonus, not a requirement."],
  ["Is our data safe — and ours?",
    "Every school lives on its own subdomain with isolated data and daily backups. Report cards are immutable snapshots; the archive stays findable term by term."],
  ["What happens if the signal drops mid-register?",
    "The register is saved on the phone and sends itself the moment the network returns. Nothing is lost."],
  ["What if we downgrade or leave?",
    "Modules outside the smaller plan close, but nothing is deleted. Cancelling is on your billing page, in plain sight."],
];

const ghs = (pesewas: number) => `GHS ${Math.round(pesewas / 100).toLocaleString()}`;

function Btn({ href, children, ghost, className = "" }: {
  href: string; children: React.ReactNode; ghost?: boolean; className?: string;
}) {
  const cls = `${ghost ? "lp-btn-ghost" : "lp-btn"} ${className}`;
  return href.startsWith("#") ? <a href={href} className={cls}>{children}</a> : <Link href={href} className={cls}>{children}</Link>;
}

const H2 = "text-[clamp(32px,4.4vw,56px)] font-semibold leading-[1.02] tracking-[-.035em] text-balance";

export default async function Home() {
  const plans = (await getPublicPlans()).filter((p) => p.pricePerTermPesewas > 0);
  const cheapest = Math.min(...plans.map((p) => p.pricePerTermPesewas)) / 100;
  const dearest = Math.max(...plans.map((p) => p.pricePerTermPesewas)) / 100;
  // structured data: what Google shows as a rich result and what assistants
  // read; kept in step with the visible page (same FAQ array, live prices)
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Organization", "@id": `${BASE}/#org`,
      name: "SchoolSpec", url: BASE, logo: `${BASE}/icons/icon-512.png`, email: "hello@schoolspec.com",
      areaServed: { "@type": "Country", name: "Ghana" },
      description: "School management software for basic schools in Ghana: attendance, report cards, fees and parent SMS." },
    { "@context": "https://schema.org", "@type": "WebSite", "@id": `${BASE}/#site`, url: BASE, name: "SchoolSpec",
      publisher: { "@id": `${BASE}/#org` }, inLanguage: "en-GH" },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "SchoolSpec",
      applicationCategory: "EducationalApplication", operatingSystem: "Web, Android, iOS",
      url: BASE, image: `${BASE}/og.jpg`, publisher: { "@id": `${BASE}/#org` },
      description: "Mark the register in 30 seconds, print report cards under your crest in one click, record fees with an SMS receipt to the parent, and keep parents in the loop. Creche to JHS 3.",
      featureList: ["30-second attendance register with absence SMS to parents", "Report cards on the GES structure, signed and stamped",
        "Fees recorded and receipted by SMS", "Announcements and SMS to every parent", "Timetable that catches clashes", "Works offline on any phone"],
      offers: plans.length ? { "@type": "AggregateOffer", priceCurrency: "GHS", lowPrice: cheapest, highPrice: dearest,
        offerCount: plans.length, url: `${BASE}/#pricing`,
        offers: plans.map((p) => ({ "@type": "Offer", name: p.name, price: p.pricePerTermPesewas / 100, priceCurrency: "GHS",
          priceSpecification: { "@type": "UnitPriceSpecification", price: p.pricePerTermPesewas / 100, priceCurrency: "GHS",
            unitText: "school term (4 months)", billingIncrement: 1 } })) } : undefined },
    { "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ];

  return (
    <main className="light-scope min-h-dvh bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SiteNav />

      {/* ── hero: the white card ── */}
      <section className="px-3 pt-4 sm:px-4 sm:pt-5">
        <div className="lp-wrap grid items-center gap-10 rounded-[28px] bg-card px-6 py-10 shadow-[var(--shadow-md)] sm:rounded-[36px] sm:px-10 lg:grid-cols-[11fr_9fr] lg:gap-8 lg:px-16 lg:py-14">
          <div>
            <h1 className="max-w-[14ch] text-[clamp(38px,5.6vw,72px)] font-semibold leading-[1.02] tracking-[-.04em] text-balance">
              The school management system built for schools in Ghana
            </h1>
            <p className="mt-6 max-w-[34em] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">
              Mark the register in 30 seconds, print report cards under your crest, collect fees by mobile money and keep every parent informed. Creche to JHS 3, on any phone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Btn href="/signup">Start free for {TRIAL_DAYS} days</Btn>
              <Btn href="#contact" ghost>Get a walkthrough</Btn>
            </div>
            <dl className="mt-10 grid max-w-[460px] grid-cols-3 gap-4 border-t border-border pt-6">
              {[["30s", "to mark a register"], ["1 click", "to report cards"], ["Any phone", "MoMo fees + SMS"]].map(([n, l]) => (
                <div key={n}>
                  <dt className="text-[24px] font-semibold tracking-[-.03em] sm:text-[28px]">{n}</dt>
                  <dd className="text-[13px] text-muted-foreground">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Image src="/marketing/hero-people.webp" alt="A head teacher, a student and a teacher, each in their own colour" priority
            width={1265} height={992} sizes="(max-width: 1024px) 92vw, 44vw" className="mx-auto w-full max-w-[560px] lg:max-w-none" />
        </div>
      </section>

      {/* ── features ── */}
      <section id="features" className="lp-wrap scroll-mt-28 px-4 py-20 sm:py-28">
        <h2 className={`${H2} mx-auto max-w-[20ch] text-center`}>Everything the office does on paper, done before the bell.</h2>
        <div className="mt-14 grid gap-5">
          {FEATURES.map((f, i) => (
            <article key={f.h} className="grid items-center gap-8 overflow-hidden rounded-[28px] bg-card p-6 shadow-[var(--shadow-sm)] sm:p-8 lg:grid-cols-2 lg:gap-12 lg:p-12">
              <div className={i % 2 ? "lg:order-2" : ""}>
                <p className="text-[13px] font-semibold uppercase tracking-[.12em] text-primary">0{i + 1}</p>
                <h3 className="mt-3 text-[clamp(26px,3vw,36px)] font-semibold leading-[1.08] tracking-[-.03em]">{f.h}</h3>
                <p className="mt-4 max-w-[36em] text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">{f.p}</p>
              </div>
              <div className={`flex justify-center rounded-[20px] bg-brand-soft p-4 sm:p-6 ${f.phone ? "max-h-[420px] overflow-hidden" : ""}`}>
                <Image src={`/shots/${f.shot}`} alt={f.alt} loading="lazy"
                  width={f.phone ? 780 : 2040} height={f.phone ? 1688 : 1275} sizes="(max-width: 1024px) 92vw, 46vw"
                  className={`rounded-xl shadow-[var(--shadow-lg)] ${f.phone ? "w-[220px] sm:w-[260px]" : "w-full"}`} />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── roles: the dark band ── */}
      <section id="roles" className="px-3 sm:px-4">
        <div className="lp-wrap overflow-hidden rounded-[28px] bg-ink pt-12 text-ink-text-strong sm:rounded-[36px] sm:pt-16 lg:pt-20">
          <div className="grid gap-8 px-6 sm:px-10 lg:grid-cols-[1fr_1fr] lg:gap-12 lg:px-16">
            <h2 className="text-[clamp(34px,4.8vw,64px)] font-semibold uppercase leading-[.98] tracking-[-.03em] text-balance">
              One sign-in. Each person sees their own school.
            </h2>
            <div className="lg:pt-2">
              <p className="max-w-[36em] text-[16px] leading-relaxed text-ink-text sm:text-[17px]">
                The head, the teachers, the parents and the students open the same SchoolSpec and get exactly what belongs to them, and nothing that doesn&apos;t.
              </p>
              <Btn href="/signup" className="mt-6 !bg-white !text-ink hover:!bg-ink-text">See it on your school</Btn>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-2 items-end gap-3 px-4 sm:px-8 lg:mt-14 lg:grid-cols-4 lg:gap-5 lg:px-12">
            {ROLES.map((r) => (
              <figure key={r.file} className="flex flex-col">
                <Image src={`/marketing/${r.file}`} alt="" loading="lazy" width={r.w} height={r.h}
                  sizes="(max-width: 1024px) 46vw, 23vw" className="mx-auto w-full max-w-[300px]" />
                <figcaption className="min-h-[5.2em] px-1 pb-8 pt-4 text-[14px] leading-relaxed text-ink-text">{r.p}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── proof: the real dashboard ── */}
      <section id="demo" className="lp-wrap scroll-mt-28 px-4 py-20 text-center sm:py-28">
        <h2 className={`${H2} mx-auto max-w-[18ch]`}>Not a mock-up. This morning&apos;s dashboard.</h2>
        <div className="mx-auto mt-10 max-w-[1000px] rounded-[24px] bg-card p-2 shadow-[var(--shadow-lg)] sm:p-3">
          <Image src="/shots/hero-dashboard.png" alt="The head teacher's dashboard in SchoolSpec: today's registers, fees collected versus outstanding, and the decisions waiting"
            width={2040} height={1275} className="w-full rounded-[16px] border border-border" sizes="(max-width: 1040px) 100vw, 1000px" />
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Btn href="/signup">Start free for {TRIAL_DAYS} days</Btn>
          <Btn href="#contact" ghost>Get a walkthrough</Btn>
        </div>
      </section>

      {/* ── pricing, from the live plans ── */}
      <section id="pricing" className="lp-wrap scroll-mt-28 px-4 pb-20 sm:pb-28">
        <h2 className={`${H2} mx-auto max-w-[18ch] text-center`}>Plans by school size. {TRIAL_DAYS} days free on every one.</h2>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {plans.map((p, i) => {
            // each card lists what it adds on top of the one before it
            const prev = plans[i - 1];
            const extras = p.moduleKeys.filter((k) => !prev || !prev.moduleKeys.includes(k)).map((k) => MODULE_LABELS[k] ?? k);
            const rows = prev ? [`Everything in ${prev.name}`, ...extras] : extras;
            const pop = p.key === "standard";
            return (
              <div key={p.key} className={`flex flex-col rounded-[28px] p-7 sm:p-8 ${pop ? "bg-primary text-white shadow-[var(--shadow-lg)]" : "bg-card shadow-[var(--shadow-sm)]"}`}>
                <h3 className="text-[22px] font-semibold tracking-[-.02em]">{p.name}</h3>
                <p className={`mt-1 text-[14px] ${pop ? "text-[#e8c8da]" : "text-muted-foreground"}`}>
                  {p.studentCap ? `Up to ${p.studentCap} students` : "Unlimited students"}
                </p>
                <p className="mt-5 text-[34px] font-semibold tracking-[-.03em]">{ghs(p.pricePerTermPesewas)}<span className="text-[15px] font-medium opacity-70"> / term</span></p>
                <p className={`text-[13px] ${pop ? "text-[#e8c8da]" : "text-muted-foreground"}`}>or {ghs(p.pricePerYearPesewas)} for the academic year</p>
                <ul className="my-7 grid gap-2.5 text-[14.5px]">
                  {rows.map((r) => <li key={r} className="flex gap-2.5"><span className={pop ? "text-[#e8c8da]" : "text-primary"}>✓</span>{r}</li>)}
                </ul>
                <div className="mt-auto">
                  <Btn href="/signup" ghost={!pop} className={pop ? "w-full !bg-white !text-primary hover:!bg-brand-soft" : "w-full"}>Start free</Btn>
                </div>
              </div>
            );
          })}
        </div>

        {/* build-your-own — the same builder schools use inside the app */}
        <div id="builder" className="mx-auto mt-16 max-w-4xl scroll-mt-28">
          <h3 className="text-center text-[clamp(26px,3.2vw,38px)] font-semibold leading-tight tracking-[-.03em]">None of these fit? Build your own plan.</h3>
          <p className="mx-auto mt-3 max-w-[38em] text-center text-[15px] text-muted-foreground">
            Tick exactly what your school needs and see a live estimate. Send it in and we call you within one working day to agree the final price.
          </p>
          <div className="mt-8 rounded-[28px] bg-card p-5 shadow-[var(--shadow-sm)] sm:p-8">
            <PlanBuilder mode="public"
              coreLabels={CORE_MODULES.map((k) => MODULE_LABELS[k])}
              addons={ADDON_MODULES.map((k) => ({ key: k, label: MODULE_LABELS[k], pricePesewas: ADDON_PRICES[k] }))}
              bands={SIZE_BANDS} basePesewas={BASE_PESEWAS}
              action={submitPublicPlanRequest} />
          </div>
        </div>
      </section>

      {/* ── faq ── */}
      <section id="faq" className="lp-wrap grid scroll-mt-28 gap-8 px-4 pb-20 sm:pb-28 md:grid-cols-[5fr_7fr] md:gap-12">
        <div>
          <h2 className={H2}>Fair questions, straight answers</h2>
          <a href="mailto:hello@schoolspec.com" className="mt-5 inline-block text-[15px] font-medium text-primary underline underline-offset-4">hello@schoolspec.com</a>
        </div>
        <div className="rounded-[28px] bg-card px-6 py-2 shadow-[var(--shadow-sm)] sm:px-8">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-border last:border-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-[60ch] pb-5 text-[15px] leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── contact ── */}
      <section id="contact" className="lp-wrap scroll-mt-28 px-4 pb-20 sm:pb-28">
        <div className="grid items-center gap-10 rounded-[28px] bg-card p-6 shadow-[var(--shadow-sm)] sm:p-10 md:grid-cols-[5fr_7fr] lg:p-14">
          <div>
            <h2 className={H2}>Get a walkthrough on your own school.</h2>
            <p className="mt-5 max-w-[30em] text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
              Leave your number and we call to walk you through SchoolSpec on your school&apos;s real structure: classes, report cards, fees, everything. Set up and live in under an hour.
            </p>
          </div>
          <LeadForm />
        </div>
      </section>

      {/* ── the meeting: light above, wine below, the name behind the head ── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[62%] bg-primary" />
        <div className="lp-wrap relative px-4 pt-6 sm:pt-10">
          <p aria-hidden className="select-none text-center text-[clamp(56px,16.5vw,250px)] font-semibold leading-none tracking-[-.06em] text-foreground">
            SchoolSpec
          </p>
          <Image src="/marketing/meeting.webp" alt="A head teacher standing at the staff-room table, the teachers around her" loading="lazy"
            width={1672} height={861} sizes="(max-width: 1280px) 100vw, 1200px"
            className="relative mx-auto -mt-[7%] w-full max-w-[1100px] [mask-image:linear-gradient(to_bottom,black_78%,transparent)]" />
          <div className="relative pb-14 pt-10 text-center text-white sm:pb-20">
            <h2 className="mx-auto max-w-[22ch] text-[clamp(28px,4vw,52px)] font-semibold leading-[1.05] tracking-[-.03em] text-balance">
              Set up in an hour. Running by Monday&apos;s assembly.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Btn href="/signup" className="!bg-white !text-primary hover:!bg-brand-soft">Start free for {TRIAL_DAYS} days</Btn>
              <Btn href="#contact" ghost className="!border-white/30 !bg-transparent !text-white hover:!bg-white/10">Request a walkthrough</Btn>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
