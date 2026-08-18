import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/core/session";
import { LogoMark } from "@/ui/logo";

/** Platform plane: platform_admin only. Ink chrome to match the product. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if ((session.user as { role: string }).role !== "platform_admin") redirect("/sign-in");
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink-border bg-ink">
        <div className="mx-auto flex h-13 max-w-6xl items-center gap-6 px-6">
          <span className="flex items-center gap-2.5">
            <LogoMark size={26} />
            <span className="text-[13px] font-semibold text-ink-text-strong">Peysich Console</span>
          </span>
          <nav className="flex items-center gap-1 text-[13px]">
            <Link href="/platform" className="rounded-md px-3 py-1.5 font-medium text-ink-text transition-colors hover:bg-ink-2 hover:text-ink-text-strong">Schools</Link>
            <Link href="/platform/audit" className="rounded-md px-3 py-1.5 font-medium text-ink-text transition-colors hover:bg-ink-2 hover:text-ink-text-strong">Audit</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
