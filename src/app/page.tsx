import Link from "next/link";
import Image from "next/image";
import { Architects_Daughter } from "next/font/google";
import { LogoMark } from "@/ui/logo";
import { LeadForm } from "./lead-form";
import { Riso } from "./riso";
import { PlanBuilder } from "@/modules/plans/builder";
import { getPublicPlans } from "@/core/plans-cache";
import { submitPublicPlanRequest } from "./plan-request-actions";
import {
  ADDON_MODULES, ADDON_PRICES, BASE_PESEWAS, CORE_MODULES, MODULE_LABELS, SIZE_BANDS,
} from "@/core/plan-const";

/* The marketing page runs on its own "drafting paper" language (kraft ground,
 * squared grid, hand-lettered notes, risograph frames) — see the .mk-* block in
 * globals.css. Generated art lives in public/marketing/ under the filenames in
 * docs/MARKETING_IMAGES.md; until a file lands, its frame shows the filename. */
const hand = Architects_Daughter({ weight: "400", subsets: ["latin"], variable: "--font-hand" });

const TRIAL_DAYS = 14;

const FEATURES = [
  {
    n: "①", tag: "mornings, marked", h: "The 30-second register",
    p: "Everyone starts present. The teacher taps only the exceptions, the record book writes itself, and guardians of absentees have an SMS before first period.",
    cta: "See it marked", more: "works offline too", file: "feat-register.png",
    alt: "A teacher's hand marking the register on a phone, the class beyond",
  },
  {
    n: "②", tag: "papers that sign themselves", h: "Report cards in one click",
    p: "Scores in; totals, grades and positions out on your own scheme — printed under your crest with the class teacher's signature, the head's signature and the stamp already in place.",
    cta: "See a report card", more: "released test by test, when you say", file: "feat-reports.png",
    alt: "A printed report card with stamp and pen",
  },
  {
    n: "③", tag: "every cedi, accounted for", h: "Fees parents actually pay",
    p: "Mobile money from any phone, partial payments welcome, receipts kept forever — and the owner sees collected versus outstanding, live.",
    cta: "See the fees desk", more: "MTN MoMo · AT Money · cards", file: "feat-fees.png",
    alt: "A mother and child on the veranda, paying fees by phone",
  },
  {
    n: "④", tag: "reach every parent", h: "Parents who never miss a notice",
    p: "Announcements that must be acknowledged, a shared calendar, and SMS signed with the school's name — to the phone they already carry.",
    cta: "See announcements", more: "push notifications in the installed app", file: "feat-parents.png",
    alt: "A trader reading a school message at her stall",
  },
  {
    n: "⑤", tag: "the week, without clashes", h: "A timetable that catches the clash",
    p: "Place lessons into the school's own day plan; double-bookings are refused before they happen. Teachers, classes and rooms each get their own view.",
    cta: "See the timetable", more: "", file: "feat-timetable.png",
    alt: "A staff room with the timetable pinned on the corkboard",
  },
];

const ROLES = [
  { file: "role-head.png", h: "Owners & heads", p: "The morning in 90 seconds: every register, money in vs owing, the decisions waiting." },
  { file: "role-teacher.png", h: "Teachers", p: "Their classes, their registers, their score sheets — no one else's paperwork." },
  { file: "role-parent.png", h: "Parents", p: "Their children only: attendance, homework, results, and exactly what's owed." },
  { file: "role-student.png", h: "Students", p: "A “do today” list that puts overdue homework and unread notices first." },
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

function Btn({ href, children, solid, icon = "→", className = "" }: {
  href: string; children: React.ReactNode; solid?: boolean; icon?: string; className?: string;
}) {
  const cls = `mk-btn ${solid ? "mk-btn-solid" : ""} ${className}`;
  const inner = <><i aria-hidden>{icon}</i><span>{children}</span></>;
  return href.startsWith("#") ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>;
}

const H2 = "text-[clamp(40px,5.6vw,78px)] font-medium leading-[.98] tracking-[-.035em] text-balance";

export default async function Home() {
  const plans = (await getPublicPlans()).filter((p) => p.pricePerMonthPesewas > 0);
  const year = new Date().getFullYear();

  return (
    <main className={`light-scope mk-paper min-h-dvh text-[#221a22] ${hand.variable}`}>
      {/* ── floating nav card ── */}
      <div className="sticky top-3.5 z-30 flex justify-center px-4">
        <nav className="flex items-center gap-5 border border-[#221a22] bg-white py-2 pl-3.5 pr-3 shadow-[0_1px_0_#221a22] sm:gap-7" aria-label="Main">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <LogoMark size={22} /> SchoolSpec
          </Link>
          <div className="hidden gap-[18px] font-mono text-[13px] md:flex">
            <a href="#features" className="hover:underline underline-offset-4">Features</a>
            <a href="#pricing" className="hover:underline underline-offset-4">Pricing</a>
            <a href="#faq" className="hover:underline underline-offset-4">FAQs</a>
            <Link href="/sign-in" className="hover:underline underline-offset-4">Sign in</Link>
          </div>
          <Btn href="/signup" solid>Start free</Btn>
        </nav>
      </div>

      {/* ── hero ── */}
      <section className="relative mk-wrap pt-[70px] text-center">
        <span className="mk-hand absolute left-6 top-6 hidden !text-[12px] md:block">07:30 · assembly</span>
        <span className="mk-hand absolute right-6 top-6 hidden !text-[12px] md:block">hello@schoolspec.app</span>
        <p className="mk-hand mk-hand-u -rotate-[4deg] lg:absolute lg:left-[6%] lg:top-[92px]">GES-structured</p>
        <h1 className="mx-auto mt-2 max-w-[12ch] text-[clamp(46px,8.6vw,124px)] font-medium leading-[.98] tracking-[-.035em] text-balance">
          Run the school at the speed of the morning
        </h1>
        <p className="mk-hand mk-hand-u mt-2 rotate-[3deg] lg:absolute lg:right-[5%] lg:top-[250px]">→ not paperwork</p>
        <Riso file="hero-morning.png" ratio="8/3" priority className="mt-[30px]"
          alt="A head teacher at the desk in the morning, register open, the compound through the louvres"
          caption="Attendance, results, fees and parents — one calm place." />
        <dl className="mt-14 grid grid-cols-2 border-y border-dashed border-[#221a22] text-left md:grid-cols-4">
          {[["30s", "to mark a whole register"], ["1 click", "from scores to report cards"], ["MoMo", "fees parents can actually pay"], ["Creche → JHS 3", "the GES structure, built in"]].map(([n, l], i) => (
            <div key={l} className={`px-[18px] py-[22px] ${i % 2 === 0 ? "border-r border-dashed border-[#221a22]" : ""} ${i === 1 ? "md:border-r" : ""} ${i === 3 ? "md:border-r-0" : ""}`}>
              <dt className="text-[26px] font-medium tracking-[-.03em] sm:text-[34px]">{n}</dt>
              <dd className="font-mono text-[12px] text-[#5f5359]">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── features, alternating ── */}
      <section id="features" className="mk-wrap scroll-mt-24">
        {FEATURES.map((f, i) => (
          <article key={f.h} className="grid items-center gap-7 py-[70px] md:grid-cols-[5fr_7fr] md:gap-12 md:py-[110px]">
            <div className={i % 2 === 1 ? "md:order-2" : ""}>
              <p className="mk-hand"><span className="mr-2 text-[#221a22]">{f.n}</span>{f.tag}</p>
              <h2 className={`${H2} mb-[18px] mt-2.5`}>{f.h}</h2>
              <p className="max-w-[30em] text-[17px] text-[#5f5359]">{f.p}</p>
              <Btn href="#demo" icon="▶" className="mt-[26px]">{f.cta}</Btn>
              {f.more && <span className="mk-hand mt-3.5 block !text-[12px]">↘ {f.more}</span>}
            </div>
            <Riso file={f.file} alt={f.alt} />
          </article>
        ))}
      </section>

      {/* ── roles band ── */}
      <section id="roles" className="border-y border-dashed border-[#221a22] bg-[#DCD1BE] py-[90px]">
        <div className="mk-wrap">
          <p className="mk-hand">one sign-in · your own view</p>
          <h2 className="mt-2.5 max-w-[16ch] text-[clamp(36px,5vw,64px)] font-medium leading-[.98] tracking-[-.035em] text-balance">
            Four people open SchoolSpec. Each one sees their own school.
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-[18px] md:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.h}>
                <Riso file={r.file} ratio="1/1" alt={r.h} />
                <h3 className="mt-3 text-[17px] font-semibold">{r.h}</h3>
                <p className="mt-1 text-[14px] text-[#5f5359]">{r.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── proof: the real app, pinned to the paper ── */}
      <section id="demo" className="mk-wrap scroll-mt-24 py-[110px] text-center">
        <p className="mk-hand">the real thing, pinned up</p>
        <h2 className={`${H2} mt-2.5`}>Not a mock-up. This morning&apos;s dashboard.</h2>
        <figure className="relative mx-auto mt-9 max-w-[1000px] -rotate-[.6deg] border border-[#221a22] bg-white p-2.5 shadow-[6px_6px_0_#221a22]">
          <span aria-hidden className="absolute -top-3 left-1/2 h-7 w-[110px] -translate-x-1/2 -rotate-2 bg-[#E58A2E]/55" />
          <Image src="/shots/hero-dashboard.png" alt="The head teacher's dashboard in SchoolSpec: today's registers, fees collected versus outstanding, and the decisions waiting"
            width={2040} height={1275} className="w-full border border-[#d6cfd4]" sizes="(max-width: 1040px) 100vw, 1000px" />
        </figure>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Btn href="/signup" solid>Start free — {TRIAL_DAYS} days</Btn>
          <Btn href="#contact" icon="☎">Get a walkthrough</Btn>
        </div>
      </section>

      {/* ── pricing, from the live plans ── */}
      <section id="pricing" className="mk-wrap scroll-mt-24 py-[100px]">
        <h2 className="text-center text-[clamp(24px,3vw,34px)] font-medium tracking-[-.02em] text-balance">
          Get <u className="decoration-[#E58A2E] decoration-[3px] underline-offset-[5px]">{TRIAL_DAYS} days free</u> when you start today.
        </h2>
        <div className="mt-11 grid gap-3.5 md:grid-cols-3 md:items-center md:gap-0">
          {plans.map((p, i) => {
            // each card lists what it adds on top of the one before it
            const prev = plans[i - 1];
            const extras = p.moduleKeys.filter((k) => !prev || !prev.moduleKeys.includes(k)).map((k) => MODULE_LABELS[k] ?? k);
            const rows = prev ? [`Everything in ${prev.name}`, ...extras] : extras;
            const pop = p.key === "standard";
            const ink = p.key === "premium";
            const tone = pop ? "bg-[#5E1D3E] text-white border-[#3d1128] md:min-h-[440px]" : ink ? "bg-[#221a22] text-white" : "bg-[#E8DFD0] md:min-h-[390px]";
            const sub = pop ? "text-[#e8c8da]" : ink ? "text-[#bfb3bb]" : "text-[#5f5359]";
            return (
              <div key={p.key} className={`flex flex-col border border-[#221a22] px-[34px] pb-10 pt-[38px] text-center ${tone}`}>
                <h3 className="text-[26px] font-semibold tracking-[-.02em]">{p.name}</h3>
                <p className={`mt-1.5 font-mono text-[13px] ${sub}`}>
                  {ghs(p.pricePerMonthPesewas)} / month · {p.studentCap ? `up to ${p.studentCap} students` : "unlimited students"}
                </p>
                <p className={`font-mono text-[11.5px] ${sub}`}>or {ghs(p.pricePerYearPesewas)} / year — 2 months free</p>
                <ul className="mb-[30px] mt-[26px] text-left">
                  {rows.map((r) => (
                    <li key={r} className="border-b border-dashed border-current py-2 text-[14px] font-medium">
                      <span className="opacity-70">✓ </span>{r}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <Btn href="/signup">{pop ? "Start free" : ink ? "Talk to us" : "Sign up"}</Btn>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-9 text-center font-mono text-[12px] text-[#5f5359]">
          Every plan lists what it leaves out too · build your own below · cancel any time.
        </p>

        {/* build-your-own — the same builder schools use inside the app */}
        <div id="builder" className="mx-auto mt-16 max-w-4xl scroll-mt-24">
          <p className="mk-hand text-center">none of these fit?</p>
          <h3 className="mt-2 text-center text-[clamp(28px,3.4vw,40px)] font-medium leading-tight tracking-[-.03em]">Build your own plan.</h3>
          <p className="mx-auto mt-2 max-w-[38em] text-center text-[15px] text-[#5f5359]">
            Tick exactly what your school needs and see a live estimate. Send it in and we&apos;ll call you within one working day to agree the final price.
          </p>
          <div className="mt-8 border border-[#221a22] bg-white p-6 shadow-[6px_6px_0_#221a22] sm:p-8">
            <PlanBuilder mode="public"
              coreLabels={CORE_MODULES.map((k) => MODULE_LABELS[k])}
              addons={ADDON_MODULES.map((k) => ({ key: k, label: MODULE_LABELS[k], pricePesewas: ADDON_PRICES[k] }))}
              bands={SIZE_BANDS} basePesewas={BASE_PESEWAS}
              action={submitPublicPlanRequest} />
          </div>
        </div>
      </section>

      {/* ── contact band ── */}
      <section id="contact" className="scroll-mt-24 border-y border-dashed border-[#221a22] bg-[#DCD1BE] py-[90px]">
        <div className="mk-wrap grid items-center gap-10 md:grid-cols-[5fr_7fr]">
          <div>
            <p className="mk-hand">talk to a person</p>
            <h2 className={`${H2} mt-2.5`}>Get a walkthrough on your own school.</h2>
            <p className="mt-5 max-w-[30em] text-[17px] text-[#5f5359]">
              Leave your number and we call to walk you through SchoolSpec on your school&apos;s real structure — classes, report cards, fees, everything. Set up and live in under an hour.
            </p>
            <p className="mk-hand mt-6 !text-[12px]">↘ or write to hello@schoolspec.app</p>
          </div>
          <div className="border border-[#221a22] bg-white p-3 shadow-[6px_6px_0_#221a22]">
            <LeadForm />
          </div>
        </div>
      </section>

      {/* ── faq ── */}
      <section id="faq" className="mk-wrap grid scroll-mt-24 gap-5 py-[100px] md:grid-cols-[5fr_7fr] md:gap-12">
        <div>
          <p className="mk-hand">need help?</p>
          <h2 className={`${H2} mt-2.5`}>Fair questions, straight answers</h2>
          <a href="mailto:hello@schoolspec.app" className="mk-hand mk-hand-u mt-6 inline-block !text-[12px]">→ hello@schoolspec.app</a>
        </div>
        <div>
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-dashed border-[#221a22]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="flex h-[22px] w-[26px] shrink-0 items-center justify-center bg-[#5E1D3E] text-[13px] text-white transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <p className="max-w-[60ch] pb-[18px] text-[15px] text-[#5f5359]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── footer: the blueprint ── */}
      <footer className="relative overflow-hidden bg-[#5E1D3E] pb-10 pt-[120px] text-white">
        <div aria-hidden className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(rgba(255,255,255,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.13)_1px,transparent_1px)] bg-[size:44px_44px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marketing/campus-lines.png" alt="" loading="lazy" decoding="async"
            className="mx-auto h-full w-auto max-w-[1100px] object-contain opacity-90" />
        </div>
        <div className="mk-wrap relative">
          <div className="relative mt-[180px] overflow-hidden bg-[#3d1128] px-6 pb-8 pt-11 sm:px-[60px] sm:pt-[70px]">
            <span aria-hidden className="pointer-events-none absolute -bottom-10 left-[30px] text-[clamp(120px,22vw,300px)] font-semibold leading-none tracking-[-.05em] text-white/[.06]">SchoolSpec</span>
            <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
              <div>
                <span className="flex items-center gap-2 font-semibold"><LogoMark size={22} variant="light" /> SchoolSpec</span>
                <p className="mt-4 max-w-[18ch] text-[clamp(22px,2.6vw,30px)] font-medium leading-tight tracking-[-.02em]">
                  Run the school at the speed of the morning, not the paperwork.
                </p>
              </div>
              <div>
                <h5 className="mb-2.5 font-mono text-[12px] tracking-[.06em] text-[#E58A2E]">Quick links</h5>
                <a href="#features" className="block py-[3px] text-[14px]">Features</a>
                <a href="#pricing" className="block py-[3px] text-[14px]">Pricing</a>
                <a href="#faq" className="block py-[3px] text-[14px]">FAQs</a>
                <Link href="/sign-in" className="block py-[3px] text-[14px]">Sign in</Link>
                <Link href="/signup" className="block py-[3px] text-[14px]">Start free</Link>
              </div>
              <div>
                <h5 className="mb-2.5 font-mono text-[12px] tracking-[.06em] text-[#E58A2E]">Connect</h5>
                <a href="mailto:hello@schoolspec.app" className="block py-[3px] text-[14px]">hello@schoolspec.app</a>
                <a href="#contact" className="block py-[3px] text-[14px]">Request a walkthrough</a>
              </div>
            </div>
            <div className="relative mt-10 flex flex-wrap gap-[18px] text-[12.5px] text-[#dbb7cb]">
              <span>© {year} SchoolSpec · Made for schools in Ghana</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
