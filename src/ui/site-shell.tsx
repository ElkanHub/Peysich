import Link from "next/link";
import { Menu, X } from "lucide-react";
import { LogoMark } from "@/ui/logo";

/* The public site's chrome: the rounded nav card and the blueprint footer,
 * shared by the landing page, the blog, the textbooks page and the legal
 * pages so the whole public face reads as one thing. Runs on the Assembly
 * tokens plus the .lp-* rules in globals.css. */

const NAV = [
  ["/#features", "Features"], ["/#pricing", "Pricing"], ["/#faq", "FAQs"],
  ["/textbooks", "Textbooks"], ["/blog", "Blog"],
] as const;

export type Current = "blog" | "textbooks" | "legal";

export function SiteNav({ current }: { current?: Current }) {
  const cls = (href: string, base: string) =>
    `${base} ${current && href === `/${current}` ? "text-foreground" : ""}`;
  return (
    <div className="sticky top-3 z-30 px-3 sm:px-4">
      <nav aria-label="Main" className="lp-wrap relative flex items-center justify-between gap-4 rounded-full border border-border bg-card/90 py-2 pl-4 pr-2 shadow-[var(--shadow-md)] backdrop-blur">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <LogoMark size={24} /> SchoolSpec
        </Link>
        <div className="hidden items-center gap-7 text-[14px] font-medium text-muted-foreground md:flex">
          {NAV.map(([href, label]) => <Link key={href} href={href} className={cls(href, "hover:text-foreground")}>{label}</Link>)}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="hidden text-[14px] font-medium text-muted-foreground hover:text-foreground sm:block sm:px-3">Sign in</Link>
          <Link href="/signup" className="lp-btn">Start free</Link>
          {/* phone menu: native details, no script */}
          <details className="group md:hidden">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full hover:bg-muted [&::-webkit-details-marker]:hidden" aria-label="Menu">
              <Menu size={20} className="group-open:hidden" /><X size={20} className="hidden group-open:block" />
            </summary>
            <div className="absolute inset-x-0 top-[calc(100%+8px)] grid gap-1 rounded-[20px] border border-border bg-card p-2 shadow-[var(--shadow-lg)]">
              {[...NAV, ["/sign-in", "Sign in"] as const].map(([href, label]) => (
                <Link key={href} href={href} className="rounded-xl px-4 py-3 text-[15px] font-medium hover:bg-muted">{label}</Link>
              ))}
            </div>
          </details>
        </div>
      </nav>
    </div>
  );
}

/** The blueprint footer: kept exactly as it was on the drafting-paper site. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-[#5E1D3E] pb-10 pt-[120px] text-white">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(rgba(255,255,255,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.13)_1px,transparent_1px)] bg-[size:44px_44px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/marketing/campus-lines.webp" alt="" loading="lazy" decoding="async"
          className="mx-auto h-full w-auto max-w-[1100px] object-contain opacity-90 mix-blend-lighten" />
      </div>
      <div className="mk-wrap relative">
        <div className="relative mt-[180px] overflow-hidden bg-[#3d1128] px-6 pb-8 pt-11 sm:px-[60px] sm:pt-[70px]">
          <span aria-hidden className="pointer-events-none absolute -bottom-10 left-[30px] text-[clamp(120px,22vw,300px)] font-semibold leading-none tracking-[-.05em] text-white/[.06]">SchoolSpec</span>
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <span className="flex items-center gap-2 font-semibold"><LogoMark size={22} variant="light" /> SchoolSpec</span>
              <p className="mt-4 max-w-[18ch] text-[clamp(22px,2.6vw,30px)] font-medium leading-tight tracking-[-.02em]">
                Run the school at the speed of the morning, not the paperwork.
              </p>
            </div>
            <div>
              <h5 className="mb-2.5 font-mono text-[12px] tracking-[.06em] text-[#E58A2E]">Quick links</h5>
              <Link href="/#features" className="block py-[3px] text-[14px]">Features</Link>
              <Link href="/#pricing" className="block py-[3px] text-[14px]">Pricing</Link>
              <Link href="/#faq" className="block py-[3px] text-[14px]">FAQs</Link>
              <Link href="/textbooks" className="block py-[3px] text-[14px]">Textbooks</Link>
              <Link href="/blog" className="block py-[3px] text-[14px]">Blog</Link>
              <Link href="/sign-in" className="block py-[3px] text-[14px]">Sign in</Link>
              <Link href="/signup" className="block py-[3px] text-[14px]">Start free</Link>
            </div>
            <div>
              <h5 className="mb-2.5 font-mono text-[12px] tracking-[.06em] text-[#E58A2E]">Connect</h5>
              <a href="mailto:hello@schoolspec.com" className="block py-[3px] text-[14px]">hello@schoolspec.com</a>
              <Link href="/#contact" className="block py-[3px] text-[14px]">Request a walkthrough</Link>
              <h5 className="mb-2.5 mt-6 font-mono text-[12px] tracking-[.06em] text-[#E58A2E]">Legal</h5>
              <Link href="/legal/privacy" className="block py-[3px] text-[14px]">Privacy policy</Link>
              <Link href="/legal/terms" className="block py-[3px] text-[14px]">Terms of service</Link>
              <Link href="/legal/refunds" className="block py-[3px] text-[14px]">Refunds & cancellation</Link>
              <Link href="/legal/cookies" className="block py-[3px] text-[14px]">Cookies</Link>
            </div>
          </div>
          <div className="relative mt-10 flex flex-wrap gap-[18px] text-[12.5px] text-[#dbb7cb]">
            <span>© {year} SchoolSpec · Made for schools in Ghana</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** A public page: nav, the page's own sections, the footer. */
export function SiteShell({ children, current }: { children: React.ReactNode; current?: Current }) {
  return (
    <main className="light-scope min-h-dvh bg-background text-foreground">
      <SiteNav current={current} />
      {children}
      <SiteFooter />
    </main>
  );
}
