import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMeta, BASE } from "@/lib/seo";
import { allPosts, getPost, longDate } from "@/lib/blog";
import { PaperShell } from "@/ui/paper-shell";

export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) return {};
  const m = pageMeta({ title: p.title, description: p.description, path: `/blog/${p.slug}` });
  return { ...m, openGraph: { ...m.openGraph, type: "article", publishedTime: p.date, authors: [p.author], tags: p.tags } };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) notFound();
  const others = allPosts().filter((o) => o.slug !== p.slug).slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: p.description,
    datePublished: p.date, dateModified: p.date, inLanguage: "en-GH", wordCount: p.words, keywords: p.tags.join(", "),
    author: { "@type": "Person", name: p.author }, publisher: { "@id": `${BASE}/#org` },
    image: `${BASE}/og.jpg`, mainEntityOfPage: `${BASE}/blog/${p.slug}`, isPartOf: { "@id": `${BASE}/blog#blog` },
  };
  return (
    <PaperShell current="blog">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mk-wrap max-w-[760px] pt-16">
        <p className="mk-hand !text-[12px]"><Link href="/blog" className="underline-offset-4 hover:underline">Blog</Link> · {p.tags.join(" · ")}</p>
        <h1 className="mt-3 text-[clamp(34px,5vw,60px)] font-medium leading-[1] tracking-[-.03em] text-balance">{p.title}</h1>
        <p className="mt-4 text-[19px] leading-relaxed text-[#3a3138]">{p.description}</p>
        <p className="mt-4 font-mono text-[12.5px] text-[#5f5359]">{p.author} · {longDate(p.date)} · {p.minutes} min read</p>
        <div className="prose-paper mt-10" dangerouslySetInnerHTML={{ __html: p.html }} />
        <aside className="mt-14 border border-[#221a22] bg-white p-6 shadow-[6px_6px_0_#221a22]">
          <p className="mk-hand !text-[12px]">the app this was written for</p>
          <p className="mt-2 text-[17px]">SchoolSpec runs the register, report cards, fees and parent SMS for basic schools in Ghana, on any phone. 14 days free, set up with you in an hour.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/signup" className="mk-btn mk-btn-solid"><i aria-hidden>→</i><span>Start free</span></Link>
            <Link href="/#features" className="mk-btn"><i aria-hidden>▶</i><span>See how it works</span></Link>
          </div>
        </aside>
      </article>
      {others.length > 0 && (
        <section className="mk-wrap pt-16 max-w-[760px]">
          <p className="mk-hand !text-[12px]">read next</p>
          <ul className="mt-3 divide-y divide-dashed divide-[#221a22]">
            {others.map((o) => (
              <li key={o.slug} className="py-3.5">
                <Link href={`/blog/${o.slug}`} className="text-[18px] font-medium underline-offset-4 hover:underline">{o.title}</Link>
                <p className="mt-1 text-[14.5px] text-[#5f5359]">{o.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PaperShell>
  );
}
