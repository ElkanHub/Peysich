import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta, BASE } from "@/lib/seo";
import { allBooks, getBook, levelName, SUBJECTS } from "@/lib/books";
import { Reader } from "@/ui/reader";

/* A mini book, read without signing in. Static at build time; the link is
 * the whole access control: anyone with it can read, nobody can copy. */

type Params = Promise<{ level: string; subject: string }>;

export function generateStaticParams() {
  return allBooks().map((b) => ({ level: b.level, subject: b.subject }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { level, subject } = await params;
  const b = getBook(level, subject);
  if (!b) return {};
  return pageMeta({
    title: `${b.title} · ${levelName(b.level)} ${SUBJECTS[b.subject][0]}`,
    description: b.description, path: `/textbooks/${b.level}/${b.subject}`,
  });
}

export default async function BookPage({ params }: { params: Params }) {
  const { level, subject } = await params;
  const b = getBook(level, subject);
  if (!b) notFound();
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Book", name: b.title, description: b.description,
    inLanguage: "en-GH", isAccessibleForFree: true, bookFormat: "EBook", numberOfPages: b.pages.length + 1,
    educationalLevel: levelName(b.level), about: SUBJECTS[b.subject][0],
    author: { "@id": `${BASE}/#org` }, publisher: { "@id": `${BASE}/#org` },
    url: `${BASE}/textbooks/${b.level}/${b.subject}`,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Reader back="/textbooks" book={{
        title: b.title, topic: b.topic, description: b.description, color: b.color,
        levelName: levelName(b.level), subjectName: SUBJECTS[b.subject][0], pages: b.pages,
      }} />
    </>
  );
}
