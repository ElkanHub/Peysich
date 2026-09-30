import type { Metadata } from "next";
import Link from "next/link";
import { PaperShell } from "@/ui/paper-shell";
import { UPDATED } from "./prose";

export const metadata: Metadata = { robots: { index: true, follow: true } };

const DOCS = [
  ["/legal/terms", "Terms of service"],
  ["/legal/privacy", "Privacy policy"],
  ["/legal/data-processing", "Data processing agreement"],
  ["/legal/cookies", "Cookies & local storage"],
  ["/legal/refunds", "Refunds & cancellation"],
] as const;

/** The legal pages share the public site’s paper and one small side nav. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PaperShell current="legal">
      <div className="mk-wrap grid gap-10 pb-16 pt-16 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <p className="mk-hand !text-[12px]">the documents</p>
          <ul className="mt-3 space-y-1.5">
            {DOCS.map(([href, label]) => (
              <li key={href}><Link href={href} className="text-[15px] font-medium underline-offset-4 hover:underline">{label}</Link></li>
            ))}
          </ul>
          <p className="mk-hand mt-8 !text-[11px]">last updated · {UPDATED}</p>
        </aside>
        <article className="max-w-[72ch]">{children}</article>
      </div>
    </PaperShell>
  );
}
