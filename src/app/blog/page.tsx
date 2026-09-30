import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta, BASE } from "@/lib/seo";
import { allPosts, longDate } from "@/lib/blog";
import { PaperShell } from "@/ui/paper-shell";

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
    <PaperShell current="blog">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mk-wrap pt-16">
        <p className="mk-hand">notes from the school office</p>
        <h1 className="mt-2 max-w-[16ch] text-[clamp(40px,6vw,80px)] font-medium leading-[.98] tracking-[-.035em] text-balance">Running a school, one useful thing at a time.</h1>
        <p className="mt-5 max-w-[36em] text-[18px] text-[#3a3138]">Registers, report cards, fees, parents. Written for heads, teachers and bursars in Ghana, in plain English, with the arithmetic shown.</p>
      </section>
      <section className="mk-wrap pt-12 grid gap-5 md:grid-cols-2">
        {posts.map((p, i) => (
          <article key={p.slug} className={`border border-[#221a22] bg-white p-6 shadow-[6px_6px_0_#221a22] ${i === 0 ? "md:col-span-2" : ""}`}>
            <p className="mk-hand !text-[12px]">{p.tags.join(" · ")} · {p.minutes} min</p>
            <h2 className={`mt-2 font-medium leading-tight tracking-[-.025em] text-balance ${i === 0 ? "text-[clamp(28px,3.6vw,44px)]" : "text-[24px]"}`}>
              <Link href={`/blog/${p.slug}`} className="hover:underline underline-offset-4">{p.title}</Link>
            </h2>
            <p className="mt-3 max-w-[60ch] text-[16px] text-[#5f5359]">{p.description}</p>
            <p className="mt-4 font-mono text-[12px] text-[#5f5359]">{p.author} · {longDate(p.date)}</p>
          </article>
        ))}
      </section>
    </PaperShell>
  );
}
