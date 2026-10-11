import { Flash } from "@/ui/feedback";
import { AppNav } from "@/ui/nav";
import { Breadcrumbs } from "@/ui/breadcrumbs";
import { CONSOLE_TABS, getConsoleGrants, requireConsoleUser } from "@/core/console";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Console", robots: { index: false, follow: false } };

/** Platform plane: the operations console. platform_admin only; a member
 *  sees the tabs they were granted (docs/12 §3.1), an owner sees them all. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const u = await requireConsoleUser();
  const grants = await getConsoleGrants(u.id);
  const nav = CONSOLE_TABS.filter((t) => !grants || grants.has(t.key)).map((t) => ({ label: t.label, href: t.href }));
  return (
    <div className="flex min-h-screen">
      <AppNav schoolName="SchoolSpec Console" subtitle="Platform" role={grants ? "console member" : "platform admin"}
        userName={u.name} items={nav} accountHref="/platform/account" />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 mt-[calc(3.25rem+var(--sat))] flex h-12 items-center border-b border-border bg-card/85 px-4 backdrop-blur lg:mt-0 lg:px-8">
          <Breadcrumbs root="Console" />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}
      <Flash /></main>
      </div>
    </div>
  );
}
