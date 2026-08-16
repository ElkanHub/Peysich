import { notFound, redirect } from "next/navigation";
import { getSchoolBySlug } from "@/core/tenant";
import { getSession } from "@/core/session";
import { getEnabledModules } from "@/core/entitlements";

/**
 * Tenant gate: resolves the school from the subdomain (middleware rewrote it
 * into the [school] segment), requires a session belonging to THIS school,
 * and loads the enabled-module set. Deep role/module checks per page.
 */
export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ school: string }>;
}) {
  const { school: slug } = await params;
  const school = await getSchoolBySlug(slug);
  if (!school || school.status === "archived") notFound();

  const session = await getSession();
  if (!session) redirect("/sign-in");
  const u = session.user as { schoolId?: string | null; role: string };
  // platform staff may enter any school (impersonation, audited later)
  if (u.schoolId !== school.id && u.role !== "platform_admin") redirect("/sign-in");

  const modules = await getEnabledModules(school.id);

  return (
    <div className="min-h-screen">
      {/* AppShell (sidebar from module registry) lands with Phase 1 UI pass */}
      <header className="border-b border-border bg-card px-6 py-3">
        <span className="font-semibold">{school.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {school.status} · modules: {[...modules].join(", ") || "core"}
        </span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
