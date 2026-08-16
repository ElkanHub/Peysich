import { getSession } from "@/core/session";

export default async function SchoolDashboard() {
  const session = await getSession();
  const u = session!.user as { name: string; role: string };
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">
        Welcome, {u.name} ({u.role}). Role dashboards arrive in Phase 1–2.
      </p>
    </div>
  );
}
