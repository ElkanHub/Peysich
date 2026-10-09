import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMeta, BASE } from "@/lib/seo";
import { allPosts, getPost, longDate } from "@/lib/blog";
import { SiteShell } from "@/ui/site-shell";

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
    <SiteShell current="blog">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="px-3 pt-4 sm:px-4 sm:pt-5">
        <div className="lp-wrap rounded-[28px] bg-card px-6 py-12 shadow-[var(--shadow-md)] sm:rounded-[36px] sm:px-10 lg:px-16 lg:py-16">
          <div className="mx-auto max-w-[720px]">
            <p className="lp-eyebrow"><Link href="/blog" className="hover:underline underline-offset-4">Blog</Link> · {p.tags.join(" · ")}</p>
            <h1 className="mt-3 text-[clamp(32px,4.8vw,56px)] font-semibold leading-[1.04] tracking-[-.035em] text-balance">{p.title}</h1>
            <p className="mt-5 text-[18px] leading-relaxed text-muted-foreground">{p.description}</p>
            <p className="mt-5 text-[13px] text-faint">{p.author} · {longDate(p.date)} · {p.minutes} min read</p>
            <div className="lp-prose mt-10" dangerouslySetInnerHTML={{ __html: p.html }} />
          </div>
        </div>
      </article>
      <section className="lp-wrap grid gap-5 px-4 pb-20 pt-5 sm:pb-28 lg:grid-cols-[7fr_5fr]">
        <aside className="rounded-[28px] bg-primary p-7 text-white shadow-[var(--shadow-lg)] sm:p-10">
          <h2 className="text-[clamp(24px,2.8vw,34px)] font-semibold leading-[1.08] tracking-[-.03em] text-balance">The app this was written for.</h2>
          <p className="mt-4 max-w-[36em] text-[16px] leading-relaxed text-[#e8c8da]">SchoolSpec runs the register, report cards, fees and parent SMS for basic schools in Ghana, on any phone. 14 days free, set up with you in an hour.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className="lp-btn !bg-white !text-primary hover:!bg-brand-soft">Start free</Link>
            <Link href="/#features" className="lp-btn-ghost !border-white/30 !bg-transparent !text-white hover:!bg-white/10">See how it works</Link>
          </div>
        </aside>
        {others.length > 0 && (
          <div className="rounded-[28px] bg-card px-7 py-3 shadow-[var(--shadow-sm)] sm:px-8">
            {others.map((o) => (
              <Link key={o.slug} href={`/blog/${o.slug}`} className="group block border-b border-border py-5 last:border-0">
                <p className="text-[17px] font-semibold leading-snug tracking-[-.01em] group-hover:text-primary">{o.title}</p>
                <p className="mt-1 text-[14.5px] leading-relaxed text-muted-foreground">{o.description}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </SiteShell>
  );
}
