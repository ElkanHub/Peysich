"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/** The phone's way back: on any page below the module root, a chevron to the
 *  module root (/students/abc → /students); on a module root, to Home. The
 *  breadcrumb trail is desktop-only, so this is the only "up" a phone gets.
 *  Hidden at lg and on Home itself. */
export function PhoneBack() {
  const pathname = usePathname();
  let parts = pathname.split("/").filter(Boolean);
  let base = "";
  if (parts[0] === "s" && parts.length >= 2) { base = `/${parts[0]}/${parts[1]}`; parts = parts.slice(2); }
  else if (parts[0] === "platform") { base = "/platform"; parts = parts.slice(1); }
  if (parts.length === 0) return null;
  const href = parts.length > 1 ? `${base}/${parts[0]}` : (base || "/");
  return (
    <Link href={href} aria-label="Back"
      className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-card shadow-[var(--shadow-sm)] lg:hidden">
      <ChevronLeft size={20} />
    </Link>
  );
}
