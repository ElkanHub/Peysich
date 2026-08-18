import { registry } from "@/modules/registry";
import type { Role } from "@/modules/types";
import { AppNav, type NavEntry } from "./nav";
import { Breadcrumbs } from "./breadcrumbs";

const CORE_NAV: { label: string; href: string; roles: Role[] }[] = [
  { label: "Dashboard", href: "", roles: ["admin", "teacher", "student", "parent"] },
  { label: "Students", href: "/students", roles: ["admin", "teacher"] },
  { label: "Guardians", href: "/guardians", roles: ["admin"] },
  { label: "Staff", href: "/staff", roles: ["admin"] },
  { label: "Settings", href: "/settings", roles: ["admin"] },
  { label: "Billing", href: "/billing", roles: ["admin"] },
];

/** App shell: ink sidebar (nav composed from core + enabled modules — off means
 *  ABSENT), breadcrumb topbar, mobile drawer. Nothing ever moves. */
export function Shell({ schoolName, role, userName, modules, children }: {
  schoolName: string; role: string; userName: string;
  modules: Set<string>; children: React.ReactNode;
}) {
  const moduleNav: NavEntry[] = [...registry.values()]
    .filter((m) => modules.has(m.key))
    .flatMap((m) => m.nav.filter((n) => n.roles.includes(role as Role)));
  const items: NavEntry[] = [
    ...CORE_NAV.filter((n) => n.roles.includes(role as Role)),
    ...moduleNav,
  ];

  return (
    <div className="flex min-h-screen">
      <AppNav schoolName={schoolName} role={role} userName={userName} items={items} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 mt-13 flex h-12 items-center border-b border-border bg-card/85 px-4 backdrop-blur lg:mt-0 lg:px-8">
          <Breadcrumbs root={schoolName} />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
