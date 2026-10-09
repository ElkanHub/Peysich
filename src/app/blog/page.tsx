import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta, BASE } from "@/lib/seo";
import { allPosts, longDate } from "@/lib/blog";
import { SiteShell } from "@/ui/site-shell";

export const metadata: Metadata = pageMeta({
  title: "Blog", path: "/blog",
  description: "Plain-English notes on running a basic school in Ghana: registers, report cards, fees, mobile money, and the head teacher's morning. From the people who build SchoolSpec.",
});

export default function BlogIndex() {
  const posts = allPosts();
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Blog", "@id": `${BASE}/blog#blog`, url: `${BASE}/blog`,
    name: "The SchoolSpec blog", publisher: { "@id": `${BASE}/#org` },
    blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${BASE}/blog/${p.slug}`, datePublished: p.date })),
  };
  return (
    <SiteShell current="blog">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="px-3 pt-4 sm:px-4 sm:pt-5">
        <div className="lp-wrap rounded-[28px] bg-card px-6 py-12 shadow-[var(--shadow-md)] sm:rounded-[36px] sm:px-10 lg:px-16 lg:py-16">
          <p className="lp-eyebrow">The blog</p>
          <h1 className="mt-3 max-w-[16ch] text-[clamp(36px,5.6vw,72px)] font-semibold leading-[1.02] tracking-[-.04em] text-balance">Running a school, one useful thing at a time.</h1>
          <p className="mt-5 max-w-[36em] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">Registers, report cards, fees, parents. Written for heads, teachers and bursars in Ghana, in plain English, with the arithmetic shown.</p>
        </div>
      </section>
      <section className="lp-wrap grid gap-5 px-4 pb-20 pt-5 sm:pb-28 md:grid-cols-2">
        {posts.map((p, i) => (
          <article key={p.slug} className={`flex flex-col rounded-[28px] bg-card p-7 shadow-[var(--shadow-sm)] sm:p-8 ${i === 0 ? "md:col-span-2 lg:p-12" : ""}`}>
            <p className="lp-eyebrow">{p.tags.join(" · ")} · {p.minutes} min</p>
            <h2 className={`mt-3 font-semibold leading-[1.08] tracking-[-.03em] text-balance ${i === 0 ? "max-w-[22ch] text-[clamp(28px,3.6vw,44px)]" : "text-[24px]"}`}>
              <Link href={`/blog/${p.slug}`} className="hover:text-primary">{p.title}</Link>
            </h2>
            <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-muted-foreground">{p.description}</p>
            <p className="mt-auto pt-5 text-[13px] text-faint">{p.author} · {longDate(p.date)}</p>
          </article>
        ))}
      </section>
    </SiteShell>
  );
}
