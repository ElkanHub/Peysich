import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta, BASE } from "@/lib/seo";
import { SiteShell } from "@/ui/site-shell";

export const metadata: Metadata = pageMeta({
  title: "Textbooks", path: "/textbooks",
  description: "SchoolSpec Textbooks: online learning resources written to the Ghana Education Service curriculum for every subject from Creche to JHS 3, free to read on any phone, with pictures and videos that play inside the page. Coming to SchoolSpec.",
});

const SUBJECTS: [string, string, string][] = [
  ["Mathematics", "#1F6F78", "Writing now"], ["English Language", "#8A3B12", "Writing now"],
  ["Science", "#2E6B3A", "Next"], ["RME", "#6B3F8A", "Next"],
  ["Our World, Our People", "#8a6b12", "Planned"], ["Computing", "#12608a", "Planned"],
  ["Creative Arts", "#8a1244", "Planned"], ["Ghanaian Language", "#4a4a4a", "Planned"],
];

/** The branded cover, drawn in CSS so the shelf renders instantly on 2G. */
function Cover({ subject, level, spine, big }: { subject: string; level: string; spine: string; big?: boolean }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl bg-card ${big ? "aspect-[3/4.15] w-full max-w-[320px] shadow-[var(--shadow-lg)]" : "aspect-[3/4.15] shadow-[var(--shadow-md)]"}`}>
      <div style={{ background: spine }} className={`flex items-center justify-between text-white ${big ? "px-4 py-2.5" : "h-3.5"}`}>
        {big && <><span className="text-[10px] font-semibold uppercase tracking-wider">Ghana Education Service curriculum</span><span className="text-[11px] font-semibold">{level}</span></>}
      </div>
      <div className={`relative flex flex-1 flex-col ${big ? "gap-1.5 p-5" : "gap-1 p-3"}`}>
        <span style={{ color: spine }} className="text-[11px] font-semibold uppercase tracking-[.12em]">{level}{big ? " · Term 1–3" : ""}</span>
        <p className={`font-semibold leading-[.95] tracking-[-.03em] ${big ? "text-[44px]" : "text-[19px]"}`}>{subject}</p>
        {big && <p className="text-[15px] text-muted-foreground">Numbers, fractions, measurement, shapes and data, with worked examples and videos</p>}
        {big && (
          <svg viewBox="0 0 300 130" className="mt-auto h-[38%] w-full border-t border-border" aria-hidden="true">
            <g stroke={spine} strokeWidth="2" fill="none">
              <rect x="20" y="30" width="120" height="30" /><line x1="60" y1="30" x2="60" y2="60" /><line x1="100" y1="30" x2="100" y2="60" />
              <circle cx="220" cy="70" r="40" /><path d="M220 30 A40 40 0 0 1 260 70 L220 70 Z" fill={spine} opacity=".8" />
              <rect x="20" y="80" width="120" height="30" /><line x1="80" y1="80" x2="80" y2="110" />
            </g>
            <rect x="20" y="30" width="40" height="30" fill="#E58A2E" opacity=".85" /><rect x="20" y="80" width="60" height="30" fill="#E58A2E" opacity=".85" />
          </svg>
        )}
      </div>
      {big && <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[12px] font-semibold"><span>SchoolSpec Textbooks</span><span className="font-normal text-faint">ed. 2026</span></div>}
    </div>
  );
}

export default function Textbooks() {
  const jsonLd = {
    "@context": "https://schema.org", "@type": "WebPage", url: `${BASE}/textbooks`, name: "SchoolSpec Textbooks",
    description: metadata.description, isPartOf: { "@id": `${BASE}/#site` },
    about: { "@type": "LearningResource", name: "SchoolSpec Textbooks", educationalLevel: "Creche to JHS 3",
      educationalUse: "reading", inLanguage: "en-GH", isAccessibleForFree: true,
      teaches: "The Ghana Education Service curriculum for basic schools", provider: { "@id": `${BASE}/#org` } },
  };
  return (
    <SiteShell current="textbooks">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="px-3 pt-4 sm:px-4 sm:pt-5">
        <div className="lp-wrap grid items-center gap-10 rounded-[28px] bg-card px-6 py-10 shadow-[var(--shadow-md)] sm:rounded-[36px] sm:px-10 lg:grid-cols-[11fr_9fr] lg:px-16 lg:py-14">
          <div>
            <p className="lp-eyebrow">Coming to SchoolSpec · Creche to JHS 3</p>
            <h1 className="mt-3 max-w-[14ch] text-[clamp(36px,5.6vw,72px)] font-semibold leading-[1.02] tracking-[-.04em] text-balance">Every subject, one book, on every phone in the school.</h1>
            <p className="mt-6 max-w-[34em] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">Online learning resources written to the Ghana Education Service curriculum, updated the week a directive changes, free to read for every teacher, pupil and parent on SchoolSpec. Pictures where the printed books have pictures. Videos where a picture is not enough.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="lp-btn">Start free and be first to read</Link>
              <a href="mailto:hello@schoolspec.com?subject=Textbooks" className="lp-btn-ghost">Write a chapter with us</a>
            </div>
            <ul className="mt-10 grid max-w-[520px] gap-x-6 gap-y-3 border-t border-border pt-6 text-[14.5px] font-medium sm:grid-cols-2">
              {["Written to the GES curriculum", "Free to read, on any phone, offline too", "Videos play inside the page", "Updated, never out of print"].map((t) => (
                <li key={t} className="flex gap-2.5"><span className="text-primary">✓</span>{t}</li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center rounded-[20px] bg-brand-soft p-8 sm:p-12">
            <Cover subject="Mathematics" level="B4" spine="#1F6F78" big />
          </div>
        </div>
      </section>

      <section className="lp-wrap px-4 pt-20 sm:pt-28">
        <h2 className="text-[clamp(28px,3.6vw,44px)] font-semibold leading-tight tracking-[-.03em]">Basic 4 first. The whole ladder next.</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Creche", "Nursery", "KG 1–2", "Basic 1–6", "JHS 1–3"].map((l) => <span key={l} className="rounded-full bg-card px-3.5 py-1.5 text-[13px] font-medium shadow-[var(--shadow-sm)]">{l}</span>)}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {SUBJECTS.map(([s, c, st]) => (
            <div key={s}>
              <Cover subject={s} level="B4" spine={c} />
              <p className={`mt-3 text-[13px] font-semibold ${st === "Writing now" ? "text-success" : "text-muted-foreground"}`}>{st}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-wrap grid gap-5 px-4 pt-20 sm:pt-28 md:grid-cols-3">
        {[
          ["Read-only, on purpose", "Nothing to fill in, nothing to submit. The book is for reading; the exercise book stays paper. That keeps every page fast on a 2G phone."],
          ["Two ways to read", "Scroll, page after page like a PDF. Or open it like a book and turn the pages, which is the one pupils choose."],
          ["Every chapter cites the curriculum", "Strand, sub-strand, edition and revision at the end of each chapter, so a teacher can cite it and see when it changed."],
        ].map(([h, p], i) => (
          <div key={h} className="rounded-[28px] bg-card p-7 shadow-[var(--shadow-sm)]">
            <p className="lp-eyebrow">0{i + 1}</p>
            <h3 className="mt-3 text-[22px] font-semibold leading-tight tracking-[-.02em]">{h}</h3>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted-foreground">{p}</p>
          </div>
        ))}
      </section>

      <section className="lp-wrap max-w-[70ch] px-4 pb-20 pt-16 sm:pb-28">
        <p className="text-[15px] leading-relaxed text-muted-foreground">SchoolSpec Textbooks are online learning resources written by SchoolSpec to follow the Ghana Education Service curriculum. They are not published, prescribed or approved by GES or NaCCA, and they are written to support, not replace, the books your school already uses.</p>
      </section>
    </SiteShell>
  );
}
