import type { Metadata } from "next";
import Link from "next/link";
import { Architects_Daughter } from "next/font/google";
import { LogoMark } from "@/ui/logo";
import { UPDATED } from "./prose";

const hand = Architects_Daughter({ weight: "400", subsets: ["latin"], variable: "--font-hand" });

export const metadata: Metadata = { robots: { index: true, follow: true } };

const DOCS = [
  ["/legal/terms", "Terms of service"],
  ["/legal/privacy", "Privacy policy"],
  ["/legal/data-processing", "Data processing agreement"],
  ["/legal/cookies", "Cookies & local storage"],
  ["/legal/refunds", "Refunds & cancellation"],
] as const;

/** The legal pages share the marketing page’s paper and one small nav. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={`light-scope mk-paper min-h-dvh text-[#221a22] ${hand.variable}`}>
      <div className="sticky top-3.5 z-30 flex justify-center px-4">
        <nav className="flex items-center gap-5 border border-[#221a22] bg-white py-2 pl-3.5 pr-3 shadow-[0_1px_0_#221a22]" aria-label="Main">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight"><LogoMark size={22} /> SchoolSpec</Link>
          <Link href="/legal" className="font-mono text-[13px] hover:underline underline-offset-4">Legal</Link>
          <Link href="/sign-in" className="font-mono text-[13px] hover:underline underline-offset-4">Sign in</Link>
        </nav>
      </div>
      <div className="mk-wrap grid gap-10 pb-24 pt-16 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <p className="mk-hand !text-[12px]">the documents</p>
          <ul className="mt-3 space-y-1.5">
            {DOCS.map(([href, label]) => (
              <li key={href}><Link href={href} className="text-[15px] font-medium underline-offset-4 hover:underline">{label}</Link></li>
            ))}
          </ul>
          <p className="mk-hand mt-8 !text-[11px]">last updated · {UPDATED}</p>
          <p className="mt-3 text-[13px] text-[#5f5359]">Questions: <a href="mailto:hello@schoolspec.com" className="underline underline-offset-4">hello@schoolspec.com</a></p>
        </aside>
        <article className="max-w-[72ch]">{children}</article>
      </div>
    </main>
  );
}
