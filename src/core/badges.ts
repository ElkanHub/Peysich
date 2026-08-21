import { and, eq, sql, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { classes, students, staff, assignments, submissions, feeInvoices } from "@/db/schema";
import { getCurrentTerm, getTeacherScope } from "./school-context";

/** Attention counts for the sidebar, keyed by nav href. Only things a person
 *  should act on TODAY earn a badge — registers not yet in, admissions and
 *  onboardings left half-done, invoices still owing, homework waiting to be
 *  marked. Kept to a handful of indexed count queries; refreshed live by the
 *  same pulse that refreshes the page. */
export async function getNavBadges(
  schoolId: string, role: string, userId: string,
): Promise<Record<string, number>> {
  const today = new Date().toISOString().slice(0, 10);
  const badges: Record<string, number> = {};

  if (role === "admin") {
    const [[unmarked], [drafts], [staffDrafts], term] = await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(classes).where(and(
        eq(classes.schoolId, schoolId),
        sql`exists (select 1 from students s where s.class_id = ${classes.id} and s.status = 'active')`,
        sql`not exists (select 1 from attendance_records a where a.class_id = ${classes.id} and a.date = ${today})`,
      )),
      db.select({ n: sql<number>`count(*)` }).from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.status, "draft"))),
      db.select({ n: sql<number>`count(*)` }).from(staff)
        .where(and(eq(staff.schoolId, schoolId), eq(staff.status, "draft"))),
      getCurrentTerm(schoolId),
    ]);
    badges["/attendance"] = Number(unmarked.n);
    badges["/students"] = Number(drafts.n);
    badges["/staff"] = Number(staffDrafts.n);
    if (term) {
      const [owing] = await db.select({ n: sql<number>`count(*)` }).from(feeInvoices)
        .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.termId, term.id),
          sql`${feeInvoices.paidPesewas} < ${feeInvoices.totalPesewas}`));
      badges["/fees"] = Number(owing.n);
    }
    return badges;
  }

  if (role === "teacher") {
    const scope = await getTeacherScope(schoolId, userId);
    if (!scope) return badges;
    const homerooms = [...scope.homeroomIds];
    const myClasses = [...scope.allClassIds];
    const [[unmarked], [toMark]] = await Promise.all([
      homerooms.length
        ? db.select({ n: sql<number>`count(*)` }).from(classes).where(and(
            inArray(classes.id, homerooms),
            sql`exists (select 1 from students s where s.class_id = ${classes.id} and s.status = 'active')`,
            sql`not exists (select 1 from attendance_records a where a.class_id = ${classes.id} and a.date = ${today})`,
          ))
        : [{ n: 0 }],
      myClasses.length
        ? db.select({ n: sql<number>`count(distinct ${assignments.id})` }).from(assignments)
            .innerJoin(submissions, and(
              eq(submissions.assignmentId, assignments.id), isNull(submissions.mark)))
            .where(and(eq(assignments.schoolId, schoolId), inArray(assignments.classId, myClasses)))
        : [{ n: 0 }],
    ]);
    badges["/attendance"] = Number(unmarked.n);
    badges["/homework"] = Number(toMark.n);
  }

  return badges;
}
