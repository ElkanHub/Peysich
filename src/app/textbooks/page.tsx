import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta, BASE } from "@/lib/seo";
import { SiteShell } from "@/ui/site-shell";
import { allBooks, LEVELS, SUBJECTS, type Book } from "@/lib/books";

export const metadata: Metadata = pageMeta({
  title: "Textbooks", path: "/textbooks",
  description: "SchoolSpec Textbooks: free mini books on one topic per subject for every class from Creche to JHS 3, written to the Ghana Education Service curriculum. Read on any phone, no sign-in, with pictures and videos that play inside the page.",
});

/** The branded cover, drawn in CSS so the shelf renders instantly on 2G. */
function Cover({ book, subject, level }: { book?: Book; subject: string; level: string }) {
  const color = book?.color ?? SUBJECTS[subject as keyof typeof SUBJECTS][1];
  const name = SUBJECTS[subject as keyof typeof SUBJECTS][0];
  const inner = (
    <div className={`flex aspect-[3/4.15] flex-col overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-md)] transition ${book ? "group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-lg)]" : "opacity-55"}`}>
      <div style={{ background: color }} className="h-3.5" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span style={{ color }} className="text-[10.5px] font-semibold uppercase tracking-[.12em]">{name}</span>
        <p className="text-[17px] font-semibold leading-[1.05] tracking-[-.02em] text-balance">{book?.title ?? "Coming"}</p>
        {book && <p className="mt-auto line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">{book.topic}</p>}
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[10.5px] font-semibold"><span>SchoolSpec</span><span className="font-normal text-faint">{level}</span></div>
    </div>
  );
  return book ? <Link href={`/textbooks/${book.level}/${book.subject}`} className="group block">{inner}</Link> : inner;
}

export default function Textbooks() {
  const books = allBooks();
  const jsonLd = {
    "@context": "https://schema.org", "@type": "CollectionPage", url: `${BASE}/textbooks`, name: "SchoolSpec Textbooks",
    description: metadata.description, isPartOf: { "@id": `${BASE}/#site` },
    about: { "@type": "LearningResource", name: "SchoolSpec Textbooks", educationalLevel: "Creche to JHS 3",
      educationalUse: "reading", inLanguage: "en-GH", isAccessibleForFree: true,
      teaches: "The Ghana Education Service curriculum for basic schools", provider: { "@id": `${BASE}/#org` } },
  };
  const first = books[0];
  return (
    <SiteShell current="textbooks">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="px-3 pt-4 sm:px-4 sm:pt-5">
        <div className="lp-wrap grid items-center gap-10 rounded-[28px] bg-card px-6 py-10 shadow-[var(--shadow-md)] sm:rounded-[36px] sm:px-10 lg:grid-cols-[11fr_9fr] lg:px-16 lg:py-14">
          <div>
            <p className="lp-eyebrow">Free to read · Creche to JHS 3 · {books.length} mini books</p>
            <h1 className="mt-3 max-w-[14ch] text-[clamp(36px,5.6vw,72px)] font-semibold leading-[1.02] tracking-[-.04em] text-balance">One topic, one small book, on every phone in the school.</h1>
            <p className="mt-6 max-w-[34em] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">Mini books written to the Ghana Education Service curriculum: one topic per subject for every class, explained properly, with pictures and videos that play inside the page. No sign-in. Open a book, read it, share the link.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {first && <Link href={`/textbooks/${first.level}/${first.subject}`} className="lp-btn">Open the first book</Link>}
              <a href="#shelf" className="lp-btn-ghost">Pick a class</a>
            </div>
            <ul className="mt-10 grid max-w-[520px] gap-x-6 gap-y-3 border-t border-border pt-6 text-[14.5px] font-medium sm:grid-cols-2">
              {["Written to the GES curriculum", "Free to read, no sign-in", "Scroll it, or flip it like a book", "Videos play inside the page"].map((t) => (
                <li key={t} className="flex gap-2.5"><span className="text-primary">✓</span>{t}</li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-[20px] bg-brand-soft p-6 sm:p-8">
            {books.slice(0, 6).map((b) => <Cover key={b.level + b.subject} book={b} subject={b.subject} level={LEVELS.find(([l]) => l === b.level)?.[1] ?? b.level} />)}
          </div>
        </div>
      </section>

      <section id="shelf" className="lp-wrap px-4 pt-20 sm:pt-28">
        <h2 className="text-[clamp(28px,3.6vw,44px)] font-semibold leading-tight tracking-[-.03em]">Pick a class.</h2>
        <p className="mt-3 max-w-[50ch] text-[16px] text-muted-foreground">Five subjects per class, one topic each, pitched at that class. The same idea grows with the child: shapes in Nursery, fractions in Basic 4, Pythagoras in JHS 3.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {LEVELS.map(([id, name]) => <a key={id} href={`#${id}`} className="rounded-full bg-card px-3.5 py-1.5 text-[13px] font-medium shadow-[var(--shadow-sm)] hover:bg-brand-soft">{name}</a>)}
        </div>
        {LEVELS.map(([id, name]) => (
          <div key={id} id={id} className="mt-12 scroll-mt-24">
            <h3 className="text-[22px] font-semibold tracking-[-.02em]">{name}</h3>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {(Object.keys(SUBJECTS) as (keyof typeof SUBJECTS)[]).map((s) => (
                <Cover key={s} subject={s} level={name} book={books.find((b) => b.level === id && b.subject === s)} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="lp-wrap grid gap-5 px-4 pt-20 sm:pt-28 md:grid-cols-3">
        {[
          ["Read-only, on purpose", "Nothing to fill in, nothing to download, nothing to copy. The book is for reading; the exercise book stays paper. That keeps every page fast on a 2G phone."],
          ["Two ways to read", "Scroll, page after page like a PDF. Or open it like a book and turn the pages, which is the one pupils choose."],
          ["Every picture is credited", "Photos come from Wikimedia Commons under free licences and say so under each one. Videos are YouTube's and play with YouTube's player, labelled as the channel's work."],
        ].map(([h, p], i) => (
          <div key={h} className="rounded-[28px] bg-card p-7 shadow-[var(--shadow-sm)]">
            <p className="lp-eyebrow">0{i + 1}</p>
            <h3 className="mt-3 text-[22px] font-semibold leading-tight tracking-[-.02em]">{h}</h3>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted-foreground">{p}</p>
          </div>
        ))}
      </section>

      <section className="lp-wrap max-w-[70ch] px-4 pb-20 pt-16 sm:pb-28">
        <p className="text-[15px] leading-relaxed text-muted-foreground">SchoolSpec Textbooks are online learning resources written by SchoolSpec to follow the Ghana Education Service curriculum. They are not published, prescribed or approved by GES or NaCCA, and they are written to support, not replace, the books your school already uses. The text is SchoolSpec&apos;s and is free to read, not to copy or reprint.</p>
      </section>
    </SiteShell>
  );
}
