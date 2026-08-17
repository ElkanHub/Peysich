import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { students, staff, classes, academicYears } from "@/db/schema";
import { requireSchool, getCurrentTerm } from "@/core/school-context";
import { Card, PageHeader } from "@/ui/kit";

export default async function Dashboard({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireSchool(slug);
  const term = await getCurrentTerm(school.id);

  const [[st], [sf], [cl], [yr]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
    db.select({ n: sql<number>`count(*)` }).from(staff).where(eq(staff.schoolId, school.id)),
    db.select({ n: sql<number>`count(*)` }).from(classes).where(eq(classes.schoolId, school.id)),
    db.select({ n: sql<number>`count(*)` }).from(academicYears).where(eq(academicYears.schoolId, school.id)),
  ]);

  // Empty dashboard IS the setup checklist (doc 10 admin flow A)
  const setupNeeded = user.role === "admin" && (Number(yr.n) === 0 || Number(cl.n) === 0 || Number(st.n) === 0);

  return (
    <div>
      <PageHeader title="Dashboard"
        sub={term ? `${term.year?.name} · ${term.name}` : "No academic year set up yet"} />
      {setupNeeded && (
        <Card className="mb-5">
          <p className="font-medium">Get {school.name} running</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            {Number(yr.n) === 0 && <li><Link className="text-primary underline-offset-2 hover:underline" href="/settings">Set up your academic year & term dates</Link></li>}
            {Number(cl.n) === 0 && <li><Link className="text-primary underline-offset-2 hover:underline" href="/settings">Choose your levels — classes & subjects are created for you</Link></li>}
            <li><Link className="text-primary underline-offset-2 hover:underline" href="/staff">Add your staff</Link></li>
            {Number(st.n) === 0 && <li><Link className="text-primary underline-offset-2 hover:underline" href="/students/import">Import students (CSV)</Link> or <Link className="text-primary underline-offset-2 hover:underline" href="/students/new">add them one by one</Link></li>}
          </ol>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[["Students", st.n, "/students"], ["Staff", sf.n, "/staff"],
          ["Classes", cl.n, "/settings"], ["Years", yr.n, "/settings"]].map(([l, n, href]) => (
          <Link key={String(l)} href={String(href)}>
            <Card><p className="text-sm text-muted-foreground">{l}</p>
              <p className="mt-1 text-3xl font-semibold">{String(n)}</p></Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
