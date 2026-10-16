import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import { LEVEL_TEMPLATE } from "./levels";

/* ── A mini book is one Markdown file ───────────────────────────────────
   content/books/<level>-<subject>.md: front matter, then pages split by a
   line that is exactly `===`. Read at build time (format: content/books/README.md).
   Each page is a list of blocks: prose (Markdown → HTML), an @image or an
   @video directive. The cover is not in the file — the reader draws it. */

export const SUBJECTS = {
  maths: ["Mathematics", "#1F6F78"], english: ["English Language", "#8A3B12"],
  science: ["Science", "#2E6B3A"], social: ["Social Studies", "#8a6b12"], computing: ["Computing", "#12608a"],
} as const;
export type SubjectId = keyof typeof SUBJECTS;
export const LEVELS = LEVEL_TEMPLATE.map(([id, name]) => [id, name.replace(/ \(B\d\)$/, "")] as [string, string]);
export const levelName = (id: string) => LEVELS.find(([l]) => l === id)?.[1] ?? id;

export type Block =
  | { type: "md"; html: string }
  | { type: "image"; src: string; caption: string; credit: string; source: string }
  | { type: "video"; id: string; title: string; channel: string };

export type Book = {
  level: string; subject: SubjectId; title: string; topic: string; description: string; color: string;
  pages: Block[][]; words: number;
};

const DIR = join(process.cwd(), "content", "books");

function blocks(page: string): Block[] {
  const out: Block[] = [];
  let md: string[] = [];
  const flush = () => {
    const text = md.join("\n").trim();
    if (text) out.push({ type: "md", html: marked.parse(text, { async: false }) as string });
    md = [];
  };
  for (const line of page.split("\n")) {
    const m = line.match(/^@(image|video)\s+(.+)$/);
    if (!m) { md.push(line); continue; }
    flush();
    const [a = "", b = "", c = "", d = ""] = m[2].split("|").map((s) => s.trim());
    if (m[1] === "image") out.push({ type: "image", src: a, caption: b, credit: c, source: d });
    else out.push({ type: "video", id: a, title: b, channel: c });
  }
  flush();
  return out;
}

function parse(file: string, raw: string): Book {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`content/books/${file} has no front matter`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const body = m[2].replace(/\r\n/g, "\n").trim();
  const pages = body.split(/\n===\n/).map((p) => p.trim()).filter(Boolean);
  const subject = meta.subject as SubjectId;
  if (!SUBJECTS[subject]) throw new Error(`content/books/${file}: unknown subject "${meta.subject}"`);
  return {
    level: meta.level, subject, title: meta.title ?? file, topic: meta.topic ?? "",
    description: meta.description ?? "", color: meta.color ?? SUBJECTS[subject][1],
    pages: pages.map(blocks), words: body.split(/\s+/).length,
  };
}

/** Every published book, shelf order: level ladder, then subject order. */
export function allBooks(): Book[] {
  const levelIx = (l: string) => LEVELS.findIndex(([id]) => id === l);
  const subjIx = (s: string) => Object.keys(SUBJECTS).indexOf(s);
  return readdirSync(DIR).filter((f) => /^[a-z0-9]+-[a-z]+\.md$/.test(f))
    .map((f) => parse(f, readFileSync(join(DIR, f), "utf8")))
    .sort((a, b) => levelIx(a.level) - levelIx(b.level) || subjIx(a.subject) - subjIx(b.subject));
}

export function getBook(level: string, subject: string): Book | null {
  if (!/^[a-z0-9]+$/.test(level) || !/^[a-z]+$/.test(subject)) return null;
  try { return parse(`${level}-${subject}.md`, readFileSync(join(DIR, `${level}-${subject}.md`), "utf8")); } catch { return null; }
}
