import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta, BASE } from "@/lib/seo";
import { PaperShell } from "@/ui/paper-shell";

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
    <div className={`flex flex-col overflow-hidden border border-[#221a22] bg-[#FFFDF8] ${big ? "aspect-[3/4.15] w-full max-w-[300px] rotate-[-1.5deg] shadow-[8px_8px_0_#221a22]" : "aspect-[3/4.15] shadow-[5px_5px_0_#221a22]"}`}>
      <div style={{ background: spine }} className={`flex items-center justify-between text-white ${big ? "px-3.5 py-2.5" : "h-3.5"}`}>
        {big && <><span className="font-mono text-[10px] uppercase tracking-wider">Ghana Education Service curriculum</span><span className="font-mono text-[10px]">{level}</span></>}
      </div>
      <div className={`relative flex flex-1 flex-col ${big ? "gap-1.5 p-4" : "gap-1 p-3"}`}>
        <span style={{ color: spine }} className="font-mono text-[10px] uppercase tracking-[.12em]">{level}{big ? " · Term 1–3" : ""}</span>
        <p className={`font-medium leading-[.95] tracking-[-.02em] ${big ? "text-[44px]" : "text-[20px]"}`}>{subject}</p>
        {big && <p className="text-[15px] italic text-[#5f5359]">Numbers, fractions, measurement, shapes and data, with worked examples and videos</p>}
        {big && (
          <>
            <span className="absolute right-3 bottom-[40%] -rotate-3 border-2 border-[#5E1D3E] px-2 py-0.5 font-mono text-[10px] tracking-[.1em] text-[#5E1D3E]">ONLINE LEARNING RESOURCE</span>
            <svg viewBox="0 0 300 130" className="mt-auto h-[38%] w-full border-t border-[#e6dfd3]" aria-hidden="true">
              <g stroke={spine} strokeWidth="2" fill="none">
                <rect x="20" y="30" width="120" height="30" /><line x1="60" y1="30" x2="60" y2="60" /><line x1="100" y1="30" x2="100" y2="60" />
                <circle cx="220" cy="70" r="40" /><path d="M220 30 A40 40 0 0 1 260 70 L220 70 Z" fill={spine} opacity=".8" />
                <rect x="20" y="80" width="120" height="30" /><line x1="80" y1="80" x2="80" y2="110" />
              </g>
              <rect x="20" y="30" width="40" height="30" fill="#E58A2E" opacity=".85" /><rect x="20" y="80" width="60" height="30" fill="#E58A2E" opacity=".85" />
            </svg>
          </>
        )}
      </div>
      {big && <div className="flex items-center justify-between border-t border-[#221a22] px-3.5 py-2 text-[12px] font-bold"><span>▣ SchoolSpec Textbooks</span><span className="font-mono font-normal text-[#5f5359]">ed. 2026</span></div>}
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
    <PaperShell current="textbooks">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mk-wrap grid items-center gap-10 pt-16 md:grid-cols-[1.1fr_.9fr]">
        <div>
          <p className="mk-hand">coming to schoolspec · creche → jhs 3</p>
          <h1 className="mt-2 text-[clamp(40px,6.2vw,84px)] font-medium leading-[.96] tracking-[-.035em] text-balance">Every subject, one book, on every phone in the school.</h1>
          <p className="mt-5 max-w-[34em] text-[19px] text-[#3a3138]">Online learning resources written to the Ghana Education Service curriculum, updated the week a directive changes, free to read for every teacher, pupil and parent on SchoolSpec. Pictures where the printed books have pictures. Videos where a picture is not enough.</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {["Written to the GES curriculum", "Free to read, on any phone, offline too", "Videos play inside the page", "Updated, never out of print"].map((t) => (
              <span key={t} className="inline-flex items-center gap-2 border border-[#221a22] bg-white px-3.5 py-2 text-[14px] font-semibold shadow-[3px_3px_0_#221a22]"><i className="h-3 w-3 bg-[#E58A2E]" aria-hidden />{t}</span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="mk-btn mk-btn-solid"><i aria-hidden>→</i><span>Start free and be first to read</span></Link>
            <a href="mailto:hello@schoolspec.com?subject=Textbooks" className="mk-btn"><i aria-hidden>✎</i><span>Write a chapter with us</span></a>
          </div>
        </div>
        <div className="relative px-2 py-5 sm:px-6">
          <span aria-hidden className="absolute left-1 top-4 h-6 w-[90px] -rotate-[38deg] bg-[#E58A2E]/60" />
          <span aria-hidden className="absolute right-4 top-4 h-6 w-[90px] rotate-[38deg] bg-[#E58A2E]/60" />
          <Cover subject="Mathematics" level="B4" spine="#1F6F78" big />
        </div>
      </section>

      <section className="mk-wrap pt-20">
        <p className="mk-hand">the shelf, as it will look</p>
        <h2 className="mt-2 text-[clamp(28px,3.6vw,44px)] font-medium leading-tight tracking-[-.03em]">Basic 4 first. The whole ladder next.</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Creche", "Nursery", "KG 1–2", "Basic 1–6", "JHS 1–3"].map((l) => <span key={l} className="border border-dashed border-[#221a22] bg-white/50 px-2.5 py-1 font-mono text-[12px]">{l}</span>)}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {SUBJECTS.map(([s, c, st]) => (
            <div key={s}>
              <Cover subject={s} level="B4" spine={c} />
              <p className={`mt-2 text-[12.5px] font-semibold ${st === "Writing now" ? "text-[#2E6B3A]" : "text-[#5f5359]"}`}>{st}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-wrap pt-20 grid gap-5 md:grid-cols-3">
        {[
          ["Read-only, on purpose", "Nothing to fill in, nothing to submit. The book is for reading; the exercise book stays paper. That keeps every page fast on a 2G phone."],
          ["Two ways to read", "Scroll, page after page like a PDF. Or open it like a book and turn the pages, which is the one pupils choose."],
          ["Every chapter cites the curriculum", "Strand, sub-strand, edition and revision at the end of each chapter, so a teacher can cite it and see when it changed."],
        ].map(([h, p]) => (
          <div key={h} className="border border-[#221a22] bg-white p-5 shadow-[5px_5px_0_#221a22]">
            <h3 className="text-[20px] font-medium leading-tight">{h}</h3>
            <p className="mt-2 text-[15.5px] text-[#3a3138]">{p}</p>
          </div>
        ))}
      </section>

      <section className="mk-wrap pt-16 max-w-[70ch]">
        <p className="mk-hand">a note on what these are</p>
        <p className="mt-2 text-[16px] text-[#3a3138]">SchoolSpec Textbooks are online learning resources written by SchoolSpec to follow the Ghana Education Service curriculum. They are not published, prescribed or approved by GES or NaCCA, and they are written to support, not replace, the books your school already uses.</p>
      </section>
    </PaperShell>
  );
}
