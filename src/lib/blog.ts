import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

/* ── The blog is a folder of Markdown files ──────────────────────────────
   content/blog/<slug>.md with a small front matter block. Read at build
   time; nothing touches the database. A post is published the moment the
   file is committed. */

export type Post = {
  slug: string; title: string; description: string; date: string; author: string;
  tags: string[]; html: string; words: number; minutes: number;
};

const DIR = join(process.cwd(), "content", "blog");

function parse(slug: string, raw: string): Post {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`content/blog/${slug}.md has no front matter`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const body = m[2].trim();
  const words = body.split(/\s+/).length;
  return {
    slug, title: meta.title ?? slug, description: meta.description ?? "", date: meta.date ?? "",
    author: meta.author ?? "SchoolSpec", tags: (meta.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    html: marked.parse(body, { async: false }) as string, words, minutes: Math.max(1, Math.round(words / 200)),
  };
}

export function allPosts(): Post[] {
  return readdirSync(DIR).filter((f) => f.endsWith(".md"))
    .map((f) => parse(f.replace(/\.md$/, ""), readFileSync(join(DIR, f), "utf8")))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): Post | null {
  try { return parse(slug, readFileSync(join(DIR, `${slug}.md`), "utf8")); } catch { return null; }
}

export const longDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
