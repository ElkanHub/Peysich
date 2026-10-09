import { Archive } from "lucide-react";
import { fmtDay } from "@/core/terms";

/** The one banner a page carries when it is reading a term that is not the
 *  working one: which term, that it is closed, and that nothing changes here. */
export function TermBanner({ term }: {
  term: { name: string; state: string; closedAt: Date | null; year: { name: string } } | null | undefined;
}) {
  if (!term) return null;
  const when = term.closedAt ? ` · closed ${fmtDay(term.closedAt.toISOString().slice(0, 10))}` : "";
  return (
    <p className="mb-4 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-[13.5px] text-muted-foreground">
      <Archive size={14} className="shrink-0" />
      <span><b className="text-foreground">{term.name}, {term.year.name}</b>{when} · read only. Nothing here can be sent or changed.</span>
    </p>
  );
}
