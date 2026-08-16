import { redirect } from "next/navigation";
import { getSession } from "@/core/session";

/** Platform plane: platform_admin only. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if ((session.user as { role: string }).role !== "platform_admin") redirect("/sign-in");
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card px-6 py-3 font-semibold">
        Peysich Platform Console
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
