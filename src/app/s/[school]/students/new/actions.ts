"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  students, guardians, studentGuardians, enrollments, academicYears,
  classes, feeStructures, feeInvoices,
} from "@/db/schema";
import { requireSchool, getCurrentTerm } from "@/core/school-context";
import { createSchoolLogin } from "@/core/accounts";
import { notify } from "@/messaging/notify";
import { setWhatsApp } from "@/messaging/channels";
import { withFlash } from "@/lib/flash";
import { uid } from "@/lib/utils";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const RELATIONS = ["parent", "mother", "father", "grandparent", "aunt", "uncle", "sibling", "other"];
const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

/** ONE screen: five things, one Save. Creates the child, links the parent
 *  (deduped on phone), enrols them in the current year, creates this term's
 *  bill from the class fee plan and texts the parent a portal login.
 *  `draftId` is a draft the Admissions module pre-filled — same row, now made
 *  active — so nothing typed there is retyped here. */
export async function admitStudent(slug: string, draftId: string | null, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const back = `/students/new${draftId ? `?draft=${draftId}` : ""}`;
  const fail: (msg: string) => never = (msg) => redirect(withFlash(back, msg, { error: true }));

  const firstName = str(f, "firstName"), lastName = str(f, "lastName");
  const sex = String(f.get("sex"));
  const parentName = str(f, "parentName"), parentPhone = str(f, "parentPhone");
  if (!firstName || !lastName) fail("First and last name are needed.");
  if (sex !== "male" && sex !== "female") fail("Choose Boy or Girl.");
  if (!parentName || !parentPhone) fail("The parent's name and phone are needed.");
  const [cls] = await db.select().from(classes)
    .where(and(eq(classes.id, String(f.get("classId"))), eq(classes.schoolId, school.id)));
  if (!cls) fail("Choose a class.");

  const [{ act }] = await db.select({ act: sql<number>`count(*)` }).from(students)
    .where(and(eq(students.schoolId, school.id), eq(students.status, "active")));
  if (Number(act) >= school.studentCap)
    fail("Student limit reached for your plan — upgrade in Billing to admit more.");

  const today = new Date().toISOString().slice(0, 10);
  const draft = draftId
    ? (await db.select().from(students).where(and(
        eq(students.id, draftId), eq(students.schoolId, school.id))))[0]
    : null;
  let id: string;
  if (draft && draft.status !== "active") {
    id = draft.id;
    await db.update(students).set({
      firstName, lastName, sex, classId: cls.id,
      status: "active", admissionStep: null, admittedOn: draft.admittedOn ?? today,
    }).where(eq(students.id, id));
  } else {
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(students)
      .where(eq(students.schoolId, school.id));
    id = uid();
    await db.insert(students).values({
      id, schoolId: school.id,
      admissionNo: `ADM${String(Number(n) + 1).padStart(4, "0")}`,
      firstName, lastName, sex, classId: cls.id, admittedOn: today,
    });
  }

  // the parent — a phone already on file means a sibling's parent: reuse
  let [g] = await db.select().from(guardians)
    .where(and(eq(guardians.schoolId, school.id), eq(guardians.phone, parentPhone)));
  if (!g) {
    const gid = uid();
    const relation = str(f, "relation");
    await db.insert(guardians).values({
      id: gid, schoolId: school.id, name: parentName, phone: parentPhone,
      relation: relation && RELATIONS.includes(relation) ? relation : "parent",
      contactPref: "portal",
    });
    [g] = await db.select().from(guardians).where(eq(guardians.id, gid));
  }
  if (f.get("whatsappConsent") === "on") await setWhatsApp(school.id, "guardian", g.id, parentPhone, true);
  const [hasPrimary] = await db.select({ id: studentGuardians.guardianId }).from(studentGuardians)
    .where(and(eq(studentGuardians.studentId, id), eq(studentGuardians.isPrimary, true)));
  await db.insert(studentGuardians)
    .values({ studentId: id, guardianId: g.id, isPrimary: !hasPrimary || hasPrimary.id === g.id })
    .onConflictDoNothing();

  const [year] = await db.select().from(academicYears)
    .where(and(eq(academicYears.schoolId, school.id), eq(academicYears.isCurrent, true)));
  if (year) await db.insert(enrollments).values({
    id: uid(), schoolId: school.id, studentId: id, yearId: year.id, classId: cls.id,
  }).onConflictDoNothing();

  // this term's bill, from the class fee plan
  const term = await getCurrentTerm(school.id);
  let total = 0;
  if (term) {
    const items = await db.select().from(feeStructures).where(and(
      eq(feeStructures.schoolId, school.id), eq(feeStructures.termId, term.id),
      eq(feeStructures.levelId, cls.levelId)));
    total = items.reduce((a, it) => a + it.amountPesewas, 0);
    if (total) await db.insert(feeInvoices)
      .values({ id: uid(), schoolId: school.id, studentId: id, termId: term.id, totalPesewas: total })
      .onConflictDoNothing();
  }

  // the parent's portal login, texted to the phone just typed
  let loginNote = "";
  if (!g.userId) {
    const r = await createSchoolLogin({
      schoolId: school.id, schoolSlug: school.slug, name: g.name, role: "parent",
      email: g.email, phone: g.phone, username: `p${g.phone.replace(/\D/g, "")}`,
    });
    if (!("error" in r)) {
      await db.update(guardians).set({ userId: r.userId }).where(eq(guardians.id, g.id));
      const { status } = await notify({
        school, to: { kind: "guardian", id: g.id }, kind: "parent_login", senderId: school.name,
        vars: { login: r.loginAs, password: r.password },
      });
      loginNote = status === "sent"
        ? ` ${g.name} will get a message with the login.`
        : status === "held"
          ? ` ${g.name}'s login is ready — not enough messaging balance to text it. Top up under Billing, or reset the password from the parent's page.`
          : ` ${g.name}'s login is ready — SMS is not set up, so reset the password from the parent's page to hand it over.`;
    }
  }

  const her = sex === "female" ? "Her" : "His";
  const bill = total && term ? ` ${her} ${term.name} bill of ${ghs(total)} is ready.` : "";
  revalidatePath("/students");
  redirect(withFlash(`/students/${id}`, `${firstName} ${lastName} is in ${cls.name}.${bill}${loginNote}`));
}

/** Drop a draft the Admissions module started. Not a delete: the row flips to
 *  "discarded" so the Undo toast can flip it back (students/[id]/undo). */
export async function discardAdmission(slug: string, id: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  // ponytail: discarded rows stay (invisible — every query filters on status);
  // sweep them nightly if they ever pile up
  await db.update(students).set({ status: "discarded" }).where(and(
    eq(students.id, id), eq(students.schoolId, school.id), eq(students.status, "draft")));
  revalidatePath("/students");
  redirect(withFlash("/students", "Draft removed.", { undo: `/students/${id}/undo` }));
}
