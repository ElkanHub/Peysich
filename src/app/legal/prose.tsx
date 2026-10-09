import Link from "next/link";

/* Plain, readable legal prose in the public site's card language. No
 * numbered clause soup: headings, short paragraphs, lists and the odd table. */

export const UPDATED = "30 September 2026";

/** Who "we" is in every document. Kept deliberately simple: the operator's
 *  name, where it works from, and how to reach it. When a company is
 *  incorporated, change legalName here and every page follows. */
export const CO = {
  legalName: "SchoolSpec",
  address: "Accra, Ghana",
  email: "hello@schoolspec.com",
  privacyEmail: "privacy@schoolspec.com",
  site: "schoolspec.com",
};

export function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 id={id} className="mt-12 scroll-mt-28 text-[26px] font-semibold leading-tight tracking-[-.025em] first:mt-0">{children}</h2>;
}
export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-7 text-[19px] font-semibold">{children}</h3>;
}
export function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`mt-4 text-[17px] leading-relaxed ${className}`}>{children}</p>;
}
export function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-4 space-y-2 pl-5 text-[17px] leading-relaxed">
      {items.map((it, i) => <li key={i} className="list-disc">{it}</li>)}
    </ul>
  );
}
export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[15.5px] leading-snug">
        <thead><tr>{head.map((h) => <th key={h} className="border-b-2 border-foreground py-2 pr-4 text-left text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-border py-2.5 pr-4 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
export function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 rounded-2xl border-l-4 border-primary bg-brand-soft px-5 py-4 text-[16px] leading-relaxed">{children}</p>;
}
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-medium text-primary underline underline-offset-4">{children}</Link>;
}
export function Summary({ items }: { items: string[] }) {
  return (
    <div className="mt-6 rounded-[20px] bg-brand-soft p-6">
      <p className="lp-eyebrow">The short version</p>
      <ul className="mt-3 space-y-2 text-[16px] leading-relaxed">
        {items.map((it) => <li key={it} className="flex gap-3"><span className="mt-[9px] inline-block h-2 w-2 shrink-0 rounded-full bg-primary" />{it}</li>)}
      </ul>
    </div>
  );
}
