/* `npm run check:books` — every book parses and keeps the README's rules:
   enough pages, well-formed directives, the three closing pages in order. */
import assert from "node:assert/strict";
import { allBooks, getBook } from "./books";

const books = allBooks();
assert.ok(books.length > 0, "no books found");
const bad: string[] = [];
for (const b of books) try {
  const id = `${b.level}-${b.subject}`;
  assert.equal(getBook(b.level, b.subject)?.title, b.title, `${id}: file name and front matter disagree`);
  assert.ok(b.pages.length >= 30, `${id}: only ${b.pages.length} pages`);
  assert.ok(b.title && b.description && /^#[0-9a-f]{6}$/i.test(b.color), `${id}: front matter incomplete`);
  for (const [i, page] of b.pages.entries()) for (const blk of page) {
    if (blk.type === "image") assert.ok(/^https:\/\/upload\.wikimedia\.org\//.test(blk.src) && blk.caption && blk.credit && blk.source, `${id} p${i + 2}: bad @image`);
    if (blk.type === "video") assert.ok(/^[\w-]{11}$/.test(blk.id) && blk.title && blk.channel, `${id} p${i + 2}: bad @video`);
    if (blk.type === "md") assert.ok(!/^@/m.test(blk.html.replace(/<[^>]+>/g, "")), `${id} p${i + 2}: stray @directive in prose`);
  }
  const tail = b.pages.slice(-3).map((p) => (p[0]?.type === "md" ? p[0].html : ""));
  assert.ok(/Learn more/.test(tail[0]) && /Watch more/.test(tail[1]) && /Think about it/.test(tail[2]), `${id}: closing pages out of order`);
  assert.ok(b.pages.flat().some((x) => x.type === "image"), `${id}: no images`);
  assert.ok(b.pages.flat().some((x) => x.type === "video"), `${id}: no videos`);
} catch (e) { bad.push((e as Error).message); }
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
console.log(`books ok: ${books.length} books, ${books.reduce((n, b) => n + b.pages.length, 0)} pages, ${books.reduce((n, b) => n + b.words, 0)} words`);
