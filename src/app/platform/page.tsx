import Link from "next/link";
import { db } from "@/db";
import { schools } from "@/db/schema";

export default async function PlatformHome() {
  const rows = await db.select().from(schools).limit(50);
  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Schools</h1>
        <Link href="/platform/schools/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          New school
        </Link>
      </div>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2">Name</th><th>Slug</th><th>Status</th><th>Plan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-border hover:bg-muted">
              <td className="py-2">
                <Link href={`/platform/schools/${s.id}`} className="font-medium text-primary">{s.name}</Link>
              </td>
              <td>{s.slug}</td><td>{s.status}</td><td>{s.planKey}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="mt-4 text-muted-foreground">No schools yet. Run `npm run db:seed`.</p>
      )}
    </div>
  );
}
