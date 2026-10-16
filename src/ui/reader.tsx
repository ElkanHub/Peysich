"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Play, Rows3, BookOpen, Minus, Plus } from "lucide-react";
import type { Block } from "@/lib/books";

/* ── The reader ──────────────────────────────────────────────────────────
   Two ways to read one book: Scroll (pages stacked, like a PDF) and Flip
   (one page at a time with a page-turn, like a Kindle). The book is static
   HTML passed in from the server; nothing here fetches.

   Read-only on purpose: text cannot be selected, copied, dragged or
   printed, and images cannot be saved from the page. These are locks on the
   page, not on the reader's eyes. ponytail: a screenshot still works —
   that is every website; DRM is not a thing a web page can promise. */

export type ReaderBook = {
  title: string; topic: string; description: string; color: string;
  levelName: string; subjectName: string; pages: Block[][];
};
type Mode = "scroll" | "flip";
const SIZES = [16, 18, 20.5] as const;

export function Reader({ book, back }: { book: ReaderBook; back: string }) {
  const [mode, setMode] = useState<Mode>("scroll");
  const [size, setSize] = useState(1);
  const total = book.pages.length + 1; // + the cover

  // restore the reader's preferences once on the client (never on the server: no hydration mismatch)
  useEffect(() => {
    try {
      const m = localStorage.getItem("schoolspec-reader-mode");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (m === "flip" || m === "scroll") setMode(m);
      const s = Number(localStorage.getItem("schoolspec-reader-size"));
      if (s >= 0 && s < SIZES.length) setSize(s);
    } catch {}
  }, []);
  const pick = (m: Mode) => { setMode(m); try { localStorage.setItem("schoolspec-reader-mode", m); } catch {} };
  const resize = (d: number) => {
    const s = Math.min(SIZES.length - 1, Math.max(0, size + d));
    setSize(s); try { localStorage.setItem("schoolspec-reader-size", String(s)); } catch {}
  };

  // the locks: no copy, no right-click save, no drag, no Ctrl+S / Ctrl+P
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "c", "a", "u"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const stop = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div className="light-scope book-reader flex min-h-dvh flex-col bg-background text-foreground"
      style={{ ["--page-font" as string]: `${SIZES[size]}px` }}
      onContextMenu={stop} onCopy={stop} onCut={stop} onDragStart={stop}>
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center gap-2 px-3 py-2 sm:px-4">
          <Link href={back} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted" aria-label="All textbooks"><ArrowLeft size={18} /></Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold leading-tight">{book.title}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{book.levelName} · {book.subjectName}</p>
          </div>
          <div className="flex items-center rounded-full border border-border bg-background p-0.5" role="group" aria-label="Text size">
            <button onClick={() => resize(-1)} disabled={size === 0} className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30 hover:bg-muted" aria-label="Smaller text"><Minus size={14} /></button>
            <button onClick={() => resize(1)} disabled={size === SIZES.length - 1} className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30 hover:bg-muted" aria-label="Larger text"><Plus size={14} /></button>
          </div>
          <div className="flex items-center rounded-full border border-border bg-background p-0.5" role="group" aria-label="Reading mode">
            {([["scroll", Rows3, "Scroll"], ["flip", BookOpen, "Flip"]] as const).map(([m, Icon, label]) => (
              <button key={m} onClick={() => pick(m)} aria-pressed={mode === m}
                className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium ${mode === m ? "bg-primary text-white" : "hover:bg-muted"}`}>
                <Icon size={14} /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <span className="hidden text-[11px] font-semibold tracking-wide text-faint sm:block" aria-label="SchoolSpec Textbooks">SchoolSpec</span>
        </div>
      </header>

      {mode === "scroll" ? <ScrollMode book={book} total={total} /> : <FlipMode book={book} total={total} />}

      <p className="print-only p-10 text-center text-[15px]">This book is for reading on SchoolSpec and cannot be printed.</p>
      <footer className="mt-auto px-4 py-6 text-center text-[11.5px] text-faint">
        <span className="font-semibold tracking-wide text-muted-foreground">SchoolSpec</span> Textbooks · free to read, not for copying. Pictures and videos belong to the people credited on each page.
      </footer>
    </div>
  );
}

/* ── Scroll: every page stacked, like a PDF ─────────────────────────────── */
function ScrollMode({ book, total }: { book: ReaderBook; total: number }) {
  return (
    <div className="mx-auto w-full max-w-[720px] px-3 py-4 sm:px-4 sm:py-6">
      <div className="grid gap-4 sm:gap-6">
        <Sheet n={1} total={total}><Cover book={book} /></Sheet>
        {book.pages.map((p, i) => <Sheet key={i} n={i + 2} total={total}><Page blocks={p} /></Sheet>)}
      </div>
    </div>
  );
}

/* ── Flip: one page at a time, turned like paper ────────────────────────── */
function FlipMode({ book, total }: { book: ReaderBook; total: number }) {
  const [at, setAt] = useState(0);
  const [turn, setTurn] = useState<{ dir: 1 | -1; from: number } | null>(null);
  const touch = useRef<number | null>(null);
  const render = (i: number) => (i === 0 ? <Cover book={book} /> : <Page blocks={book.pages[i - 1]} />);

  useEffect(() => {
    try {
      const p = Number(sessionStorage.getItem(`schoolspec-page:${location.pathname}`));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (p > 0 && p < total) setAt(p);
    } catch {}
  }, [total]);
  useEffect(() => { try { sessionStorage.setItem(`schoolspec-page:${location.pathname}`, String(at)); } catch {} }, [at]);

  const go = (dir: 1 | -1) => {
    if (turn) return;
    const to = at + dir;
    if (to < 0 || to >= total) return;
    setTurn({ dir, from: at });
    setAt(to);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  // during a turn: the page beneath is where we are going; the sheet on top
  // is the page we are leaving (forward) or returning to (back)
  const top = turn ? (turn.dir === 1 ? turn.from : at) : null;
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-3 py-3 sm:px-4 sm:py-5">
      <div className="flip-stage relative flex-1" style={{ perspective: "2400px" }}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current; touch.current = null;
          if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
        }}>
        <div className="absolute inset-0 overflow-y-auto overscroll-contain rounded-2xl bg-card shadow-[var(--shadow-md)]">
          {render(at)}
          <PageNo n={at + 1} total={total} />
        </div>
        {top !== null && turn && (
          <div key={`${turn.from}-${turn.dir}`} onAnimationEnd={() => setTurn(null)}
            className={`absolute inset-0 overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-lg)] ${turn.dir === 1 ? "flip-fwd" : "flip-back"}`}>
            {render(top)}
            <PageNo n={top + 1} total={total} />
            <div aria-hidden className="flip-shade pointer-events-none absolute inset-0" />
          </div>
        )}
        {/* tap zones: left third back, right third forward; the middle scrolls a long page */}
        <button onClick={() => go(-1)} aria-label="Previous page" className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize opacity-0" />
        <button onClick={() => go(1)} aria-label="Next page" className="absolute inset-y-0 right-0 w-1/4 cursor-e-resize opacity-0" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button onClick={() => go(-1)} disabled={at === 0} className="flex h-10 items-center gap-1 rounded-full border border-border bg-card px-3 text-[13px] font-medium disabled:opacity-30 hover:bg-muted"><ChevronLeft size={16} /> Back</button>
        <input type="range" min={0} max={total - 1} value={at} onChange={(e) => setAt(Number(e.target.value))} aria-label="Page" className="min-w-0 flex-1 accent-[var(--primary)]" />
        <button onClick={() => go(1)} disabled={at === total - 1} className="flex h-10 items-center gap-1 rounded-full border border-border bg-card px-3 text-[13px] font-medium disabled:opacity-30 hover:bg-muted">Next <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

/* ── One page's content ─────────────────────────────────────────────────── */
function Page({ blocks }: { blocks: Block[] }) {
  return (
    <div className="book-page px-5 py-6 sm:px-9 sm:py-9">
      {blocks.map((b, i) =>
        b.type === "md" ? <div key={i} className="book-prose" dangerouslySetInnerHTML={{ __html: b.html }} />
        : b.type === "image" ? <Figure key={i} {...b} />
        : <Video key={i} {...b} />)}
    </div>
  );
}

function Figure({ src, caption, credit, source }: Extract<Block, { type: "image" }>) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <figure className="my-5">
      <div className="overflow-hidden rounded-xl bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={caption} loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)}
          className="pointer-events-none mx-auto max-h-[52vh] w-auto max-w-full object-contain" />
      </div>
      <figcaption className="mt-2 text-[12.5px] leading-snug text-muted-foreground">
        {caption}
        <span className="block text-[11px] text-faint">
          {credit.startsWith("SchoolSpec") ? credit : <>Picture: {credit} · via <a href={source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Wikimedia Commons</a></>}
        </span>
      </figcaption>
    </figure>
  );
}

/** A YouTube video that plays where it sits. Nothing loads until the tap:
 *  a poster first, then the privacy-enhanced embed. */
function Video({ id, title, channel }: Extract<Block, { type: "video" }>) {
  const [on, setOn] = useState(false);
  return (
    <figure className="my-5">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        {on ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full" />
        ) : (
          <button onClick={() => setOn(true)} className="group absolute inset-0 flex items-center justify-center" aria-label={`Play: ${title}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[#1a1218] shadow-[var(--shadow-lg)] transition group-hover:scale-105"><Play size={26} className="ml-1" fill="currentColor" /></span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-[12.5px] leading-snug text-muted-foreground">
        {title}
        <span className="block text-[11px] text-faint">Video by {channel} on YouTube. Not made by SchoolSpec; it plays here with YouTube&apos;s player.</span>
      </figcaption>
    </figure>
  );
}

/* ── Cover, sheet frame, page number ────────────────────────────────────── */
function Cover({ book }: { book: ReaderBook }) {
  return (
    <div className="flex min-h-[70vh] flex-col" style={{ background: book.color }}>
      <div className="flex items-center justify-between px-6 py-4 text-[11px] font-semibold uppercase tracking-[.14em] text-white/80 sm:px-9">
        <span>SchoolSpec Textbooks</span><span>{book.levelName}</span>
      </div>
      <div className="flex flex-1 flex-col justify-center px-6 py-10 text-white sm:px-9">
        <p className="text-[12px] font-semibold uppercase tracking-[.14em] text-white/80">{book.subjectName}</p>
        <h1 className="mt-3 text-[clamp(34px,7vw,56px)] font-semibold leading-[1.02] tracking-[-.035em] text-balance">{book.title}</h1>
        {book.topic && <p className="mt-3 text-[16px] font-medium text-white/85">{book.topic}</p>}
        <p className="mt-6 max-w-[34em] text-[15.5px] leading-relaxed text-white/85">{book.description}</p>
      </div>
      <div className="flex items-center justify-between border-t border-white/20 px-6 py-3 text-[12px] text-white/80 sm:px-9">
        <span>A mini book · free to read</span><span>ed. {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}

function Sheet({ n, total, children }: { n: number; total: number; children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-md)]" id={`p${n}`}>
      {children}
      <PageNo n={n} total={total} />
    </section>
  );
}

const PageNo = ({ n, total }: { n: number; total: number }) => (
  <p className="px-5 pb-4 text-right text-[11.5px] text-faint sm:px-9">{n === 1 ? "" : `${n} / ${total}`}</p>
);
