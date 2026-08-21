import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { routes, routeStudents, students } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { addRoute, assignToRoute } from "./actions";
import { Card, Field, PageHeader, inputCls, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

export default async function Transport({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireModule(slug, "transport", ["admin"]);
  const [rts, assigned] = await Promise.all([
    db.select().from(routes).where(eq(routes.schoolId, school.id)),
    db.select({
      routeId: routeStudents.routeId, firstName: students.firstName, lastName: students.lastName,
    }).from(routeStudents)
      .innerJoin(students, eq(routeStudents.studentId, students.id))
      .where(and(eq(routeStudents.schoolId, school.id), eq(students.status, "active"))),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Transport" sub={`${rts.length} routes`} />
      <div className="grid gap-4 md:grid-cols-2">
        {rts.map((r) => {
          const kids = assigned.filter((a) => a.routeId === r.id);
          return (
            <Card key={r.id}>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.driverName ?? "No driver"} {r.driverPhone && `· ${r.driverPhone}`} · {kids.length} students</p>
              <ul className="mt-2 text-sm text-muted-foreground">
                {kids.slice(0, 8).map((k, i) => <li key={i}>{k.lastName}, {k.firstName}</li>)}
                {kids.length > 8 && <li>… +{kids.length - 8} more</li>}
              </ul>
              <form action={assignToRoute.bind(null, slug, r.id)} className="mt-2 flex gap-1">
                <input name="admissionNo" placeholder="ADM0001"
                  className="w-24 rounded-md border border-border px-2 py-1 text-xs" />
                <SubmitButton className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Assign</SubmitButton>
              </form>
            </Card>
          );
        })}
      </div>
      <Card className="mt-5">
        <form action={addRoute.bind(null, slug)} className="flex items-end gap-2">
          <Field label="Route name"><input name="name" placeholder="Route 1 — Adenta" required className={inputCls} /></Field>
          <Field label="Driver"><input name="driverName" className={inputCls} /></Field>
          <Field label="Driver phone"><input name="driverPhone" className={inputCls} /></Field>
          <SubmitButton className={btnCls}>Add route</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
