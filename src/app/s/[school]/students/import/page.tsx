import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { PageHeader } from "@/ui/kit";
import { ExcelImport } from "./excel";

/** Installation import: download the Excel collection sheet, gather the data
 *  at the school, upload the filled sheet — the roster lands in one pass. */
export default async function ImportStudents({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const cls = await db.select({ name: classes.name }).from(classes)
    .where(eq(classes.schoolId, school.id));
  return (
    <div className="max-w-3xl">
      <PageHeader title="Import students"
        sub="For first installation: collect the roster on the Excel sheet, then upload it here." />
      <ExcelImport slug={slug} schoolName={school.name} classNames={cls.map((c) => c.name)} />
    </div>
  );
}
