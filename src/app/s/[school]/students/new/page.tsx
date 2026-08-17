import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { StudentForm } from "./form";

export default async function NewStudent({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const cls = await db.select().from(classes).where(eq(classes.schoolId, school.id));
  return <StudentForm slug={slug} classes={cls.map((c) => ({ id: c.id, name: c.name }))} />;
}
