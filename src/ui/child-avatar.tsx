import { cn } from "@/lib/utils";

/** A child's face with the money dot: red = fees outstanding, and it simply
 *  disappears once the balance is settled. Size via className (h-* w-* text-*). */
export function ChildAvatar({ photoUrl, initials, owing = false, className }: {
  photoUrl?: string | null; initials: string; owing?: boolean; className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-brand-soft font-semibold uppercase text-primary ring-1 ring-primary/15">
        {photoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          : initials}
      </span>
      {owing && (
        <span aria-label="fees outstanding" title="Fees outstanding"
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-card" />
      )}
    </span>
  );
}
