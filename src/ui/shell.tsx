import Link from "next/link";
import { registry } from "@/modules/registry";
import type { Role } from "@/modules/types";
import { SignOutButton } from "./signout";

const CORE_NAV: { label: string; href: string; roles: Role[] }[] = [
  { label: "Dashboard", href: "", roles: ["admin", "teacher", "student", "parent"] },
  { label: "Students", href: "/students", roles: ["admin", "teacher"] },
  { label: "Guardians", href: "/guardians", roles: ["admin"] },
  { label: "Staff", href: "/staff", roles: ["admin"] },
  { label: "Settings", href: "/settings", roles: ["admin"] },
  { label: "Billing", href: "/billing", roles: ["admin"] },
];

/** App shell: fixed sidebar (nav composed from core + enabled modules for this
 *  role — disabled modules are ABSENT, not greyed), fixed topbar. Nothing moves. */
export function Shell({ schoolName, role, userName, modules, children }: {
  schoolName: string; role: string; userName: string;
  modules: Set<string>; children: React.ReactNode;
}) {
  const moduleNav = [...registry.values()]
    .filter((m) => modules.has(m.key))
    .flatMap((m) => m.nav.filter((n) => n.roles.includes(role as Role)));
  const coreNav = CORE_NAV.filter((n) => n.roles.includes(role as Role));

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-4">
          <p className="truncate font-semibold">{schoolName}</p>
          <p className="text-xs text-muted-foreground">Peysich</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {[...coreNav, ...moduleNav].map((n) => (
            <Link key={n.href} href={`/${n.href.replace(/^\//, "")}` || "/"}
              className="block rounded-md px-3 py-2 text-sm hover:bg-muted">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3 text-sm">
          <Link href="/account" className="truncate font-medium hover:underline">{userName}</Link>
          <p className="sr-only">{userName}</p>
          <p className="text-xs capitalize text-muted-foreground">{role}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
