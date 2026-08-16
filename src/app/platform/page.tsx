import { db } from "@/db";
import { schools } from "@/db/schema";

export default async function PlatformHome() {
  const rows = await db.select().from(schools).limit(50);
  return (
    <div>
      <h1 className="text-2xl font-semibold">Schools</h1>
      <table className="mt-4 w-full max-w-2xl text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2">Name</th><th>Slug</th><th>Status</th><th>Plan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-border">
              <td className="py-2">{s.name}</td>
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
