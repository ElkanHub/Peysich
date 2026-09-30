import Link from "next/link";
import { Architects_Daughter } from "next/font/google";
import { LogoMark } from "@/ui/logo";

const hand = Architects_Daughter({ weight: "400", subsets: ["latin"], variable: "--font-hand" });

/** The marketing paper (kraft ground, squared grid, hand notes) with the
 *  floating nav card — shared by the legal pages, the blog and the
 *  textbooks page, so the public site reads as one thing. */
export function PaperShell({ children, current }: { children: React.ReactNode; current?: "blog" | "textbooks" | "legal" }) {
  const item = (href: string, label: string, key: string) => (
    <Link href={href} className={`font-mono text-[13px] underline-offset-4 hover:underline ${current === key ? "underline" : ""}`}>{label}</Link>
  );
  return (
    <main className={`light-scope mk-paper min-h-dvh text-[#221a22] ${hand.variable}`}>
      <div className="sticky top-3.5 z-30 flex justify-center px-4">
        <nav className="flex items-center gap-4 border border-[#221a22] bg-white py-2 pl-3.5 pr-3 shadow-[0_1px_0_#221a22] sm:gap-6" aria-label="Main">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight"><LogoMark size={22} /> SchoolSpec</Link>
          <div className="hidden gap-4 sm:flex">
            {item("/textbooks", "Textbooks", "textbooks")}
            {item("/blog", "Blog", "blog")}
            {item("/sign-in", "Sign in", "sign-in")}
          </div>
          <Link href="/signup" className="mk-btn mk-btn-solid"><i aria-hidden>→</i><span>Start free</span></Link>
        </nav>
      </div>
      {children}
      <footer className="mk-wrap pb-12 pt-10 text-[13px] text-[#5f5359]">
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-dashed border-[#221a22] pt-5">
          <span>© {new Date().getFullYear()} SchoolSpec · Made for schools in Ghana</span>
          <Link href="/legal/privacy" className="underline-offset-4 hover:underline">Privacy</Link>
          <Link href="/legal/terms" className="underline-offset-4 hover:underline">Terms</Link>
          <Link href="/legal" className="underline-offset-4 hover:underline">All legal pages</Link>
          <a href="mailto:hello@schoolspec.com" className="underline-offset-4 hover:underline">hello@schoolspec.com</a>
        </div>
      </footer>
    </main>
  );
}
