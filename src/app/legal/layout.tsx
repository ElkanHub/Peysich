import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/ui/site-shell";
import { UPDATED } from "./prose";

export const metadata: Metadata = { robots: { index: true, follow: true } };

const DOCS = [
  ["/legal/terms", "Terms of service"],
  ["/legal/privacy", "Privacy policy"],
  ["/legal/data-processing", "Data processing agreement"],
  ["/legal/cookies", "Cookies & local storage"],
  ["/legal/refunds", "Refunds & cancellation"],
] as const;

/** The legal pages share the public site's chrome and one small side nav. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell current="legal">
      <div className="lp-wrap grid gap-5 px-3 pb-20 pt-4 sm:px-4 sm:pt-5 md:grid-cols-[240px_1fr]">
        <aside className="rounded-[28px] bg-card p-6 shadow-[var(--shadow-sm)] md:sticky md:top-24 md:self-start">
          <p className="lp-eyebrow">The documents</p>
          <ul className="mt-3 space-y-1">
            {DOCS.map(([href, label]) => (
              <li key={href}><Link href={href} className="block rounded-xl px-3 py-2 text-[15px] font-medium hover:bg-muted">{label}</Link></li>
            ))}
          </ul>
          <p className="mt-6 px-3 text-[13px] text-faint">Last updated {UPDATED}</p>
        </aside>
        <article className="rounded-[28px] bg-card px-6 py-10 shadow-[var(--shadow-md)] sm:rounded-[36px] sm:px-10 lg:px-16 lg:py-14">
          <div className="max-w-[72ch]">{children}</div>
        </article>
      </div>
    </SiteShell>
  );
}
