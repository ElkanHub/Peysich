import { redirect } from "next/navigation";
import { getSession } from "@/core/session";
import { AppNav } from "@/ui/nav";
import { Breadcrumbs } from "@/ui/breadcrumbs";

const NAV = [
  { label: "Overview", href: "/platform" },
  { label: "Schools", href: "/platform/schools" },
  { label: "Onboarding", href: "/platform/onboarding" },
  { label: "Leads", href: "/platform/leads" },
  { label: "Subscriptions", href: "/platform/subscriptions" },
  { label: "Financials", href: "/platform/financials" },
  { label: "Broadcast", href: "/platform/broadcast" },
  { label: "All users", href: "/platform/users" },
  { label: "Audit log", href: "/platform/audit" },
  { label: "Settings", href: "/platform/settings" },
];

/** Platform plane: the operations console. platform_admin only. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const u = session.user as { role: string; name: string };
  if (u.role !== "platform_admin") redirect("/sign-in");
  return (
    <div className="flex min-h-screen">
      <AppNav schoolName="Peysich Console" subtitle="Platform" role="platform admin"
        userName={u.name} items={NAV} accountHref="/platform/account" />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 mt-13 flex h-12 items-center border-b border-border bg-card/85 px-4 backdrop-blur lg:mt-0 lg:px-8">
          <Breadcrumbs root="Console" />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
