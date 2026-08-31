"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  applicants, applicantNotes, applicantGuardians, students, guardians,
  studentGuardians, academicYears, schools,
} from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { invalidateSchool } from "@/core/tenant";
import { uid } from "@/lib/utils";
import { sendSms, sendEmail } from "@/lib/notify";
import { getIntakeConfig, parseDocs, type IntakeDoc } from "@/modules/admissions/config";

const touch = (extra?: string) => {
  revalidatePath(`/admissions`);
  if (extra) revalidatePath(extra);
};
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

async function ownApplicant(slug: string, id: string) {
  const ctx = await requireModule(slug, "admissions", ["admin"]);
  const [a] = await db.select().from(applicants)
    .where(and(eq(applicants.id, id), eq(applicants.schoolId, ctx.school.id)));
  if (!a) redirect(`/admissions`);
  return { ...ctx, a };
}

// ── the application itself ─────────────────────────────────────────────
export async function addApplicant(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  const name = str(f, "name"), phone = str(f, "guardianPhone");
  if (!name || !phone) redirect(`/admissions/new?err=req`);
  const [year] = await db.select().from(academicYears)
    .where(and(eq(academicYears.schoolId, school.id), eq(academicYears.isCurrent, true)));
  const id = uid();
  await db.insert(applicants).values({
    id, schoolId: school.id, name, levelId: String(f.get("levelId")),
    guardianName: str(f, "guardianName"), guardianPhone: phone,
    dob: str(f, "dob"), sex: str(f, "sex"), prevSchool: str(f, "prevSchool"),
    source: str(f, "source"), yearId: year?.id ?? null,
  });
  await db.insert(applicantGuardians).values({
    id: uid(), schoolId: school.id, applicantId: id,
    name: str(f, "guardianName") ?? "Guardian", phone,
    email: str(f, "guardianEmail"), relation: str(f, "relation") ?? "parent",
  });
  touch();
  redirect(`/admissions/${id}?flash=saved`);
}

export async function updateApplicant(slug: string, id: string, f: FormData) {
  const { school } = await ownApplicant(slug, id);
  await db.update(applicants).set({
    name: str(f, "name") ?? undefined,
    guardianName: str(f, "guardianName"), guardianPhone: str(f, "guardianPhone") ?? undefined,
    levelId: String(f.get("levelId")),
    dob: str(f, "dob"), sex: str(f, "sex"), prevSchool: str(f, "prevSchool"), source: str(f, "source"),
  }).where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  touch(`/admissions/${id}`);
  redirect(`/admissions/${id}?flash=saved`);
}

// ── stage moves — every move stamps stageAt so "days in stage" is honest ─
export async function moveStage(slug: string, id: string, status: string, f?: FormData) {
  const { school } = await ownApplicant(slug, id);
  const allowed = ["new", "screening", "offer", "admitted", "waitlist", "rejected"];
  if (!allowed.includes(status)) redirect(`/admissions/${id}`);
  const patch: Record<string, unknown> = { status, stageAt: new Date() };
  if (status === "rejected" || status === "waitlist") {
    patch.decidedAt = new Date();
    patch.decisionReason = f ? str(f, "reason") : null;
  }
  await db.update(applicants).set(patch)
    .where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  touch(`/admissions/${id}`);
  redirect(`/admissions/${id}?flash=saved`);
}

// ── screening ──────────────────────────────────────────────────────────
export async function saveScreening(slug: string, id: string, f: FormData) {
  const { school, a } = await ownApplicant(slug, id);
  const rawScore = String(f.get("testScore") ?? "").trim();
  await db.update(applicants).set({
    interviewAt: str(f, "interviewAt"),
    testScore: rawScore === "" ? null : Math.max(0, Math.round(Number(rawScore))),
    // recording screening work moves a New applicant forward automatically
    ...(a.status === "new" ? { status: "screening", stageAt: new Date() } : {}),
  }).where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  touch(`/admissions/${id}`);
  redirect(`/admissions/${id}?flash=saved`);
}

export async function toggleDoc(slug: string, id: string, key: string) {
  const { school, a } = await ownApplicant(slug, id);
  const docs = parseDocs(a.docs);
  docs[key] = !docs[key];
  await db.update(applicants).set({ docs: JSON.stringify(docs) })
    .where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  touch(`/admissions/${id}`);
  redirect(`/admissions/${id}`);
}

// ── offer — the exact text is the admin's to edit; it goes through every
//    channel the guardian list carries: SMS to each phone, email to each
//    address. The sent text is stored for viewing and editable on resend. ──
async function sendOfferEverywhere(
  school: { id: string; name: string }, applicantId: string, message: string,
) {
  const gs = await db.select().from(applicantGuardians)
    .where(eq(applicantGuardians.applicantId, applicantId));
  const phones = [...new Set(gs.map((g) => g.phone).filter(Boolean))];
  const emails = [...new Set(gs.map((g) => g.email).filter((e): e is string => Boolean(e)))];
  for (const to of phones) {
    await sendSms({ schoolId: school.id, to, kind: "admission-offer", body: message, senderId: school.name });
  }
  for (const to of emails) {
    await sendEmail(to, `Admission offer — ${school.name}`,
      `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
        <h2 style="margin:0 0 8px">${school.name}</h2>
        <p style="font-size:15px;line-height:1.6;white-space:pre-line">${message}</p>
        <p style="color:#888;font-size:12px;margin-top:20px">Sent via Peysich on behalf of ${school.name}.</p>
      </div>`, school.name);
  }
  return { phones: phones.length, emails: emails.length };
}

export async function makeOffer(slug: string, id: string, f: FormData) {
  const { school, a } = await ownApplicant(slug, id);
  const deadline = str(f, "deadline");
  const message = str(f, "message")
    ?? `${school.name}: Good news — ${a.name} has been offered a place. Please visit the school office to confirm${deadline ? ` by ${deadline}` : ""}.`;
  await db.update(applicants).set({
    status: "offer", stageAt: new Date(), offerAt: new Date(),
    offerDeadline: deadline, offerMessage: message,
  }).where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  await sendOfferEverywhere(school, id, message);
  touch(`/admissions/${id}`);
  redirect(`/admissions/${id}?flash=done`);
}

/** Resend — the message arrives prefilled with what was sent and can be
 *  reworded before it goes out again. */
export async function resendOffer(slug: string, id: string, f: FormData) {
  const { school, a } = await ownApplicant(slug, id);
  const message = str(f, "message") ?? a.offerMessage
    ?? `${school.name}: reminder — ${a.name}'s place is reserved. Please confirm at the school office${a.offerDeadline ? ` by ${a.offerDeadline}` : ""}.`;
  await db.update(applicants).set({ offerMessage: message })
    .where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  await sendOfferEverywhere(school, id, message);
  touch(`/admissions/${id}`);
  redirect(`/admissions/${id}?flash=done`);
}

// ── the guardian list — as many as the family has ──────────────────────
export async function addApplicantGuardian(slug: string, id: string, f: FormData) {
  const { school } = await ownApplicant(slug, id);
  const name = str(f, "name"), phone = str(f, "phone");
  if (name && phone) {
    await db.insert(applicantGuardians).values({
      id: uid(), schoolId: school.id, applicantId: id, name, phone,
      email: str(f, "email"), relation: str(f, "relation") ?? "parent", sortOrder: 1,
    });
  }
  touch(`/admissions/${id}`);
  redirect(`/admissions/${id}?flash=saved`);
}

export async function removeApplicantGuardian(slug: string, id: string, guardianRowId: string) {
  const { school } = await ownApplicant(slug, id);
  const rows = await db.select().from(applicantGuardians)
    .where(eq(applicantGuardians.applicantId, id));
  if (rows.length > 1) { // the file always keeps at least one contact
    await db.delete(applicantGuardians).where(and(
      eq(applicantGuardians.id, guardianRowId), eq(applicantGuardians.schoolId, school.id)));
  }
  touch(`/admissions/${id}`);
  redirect(`/admissions/${id}?flash=done`);
}

// ── the decision: Admit → a PRE-FILLED student draft in the existing
//    Students wizard. Nothing is retyped; the wizard mints the admission
//    number and the review step stays human. ───────────────────────────
export async function admitApplicant(slug: string, id: string) {
  const { school, a } = await ownApplicant(slug, id);
  if (a.admittedStudentId) redirect(`/students/new?draft=${a.admittedStudentId}`);
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(students)
    .where(eq(students.schoolId, school.id));
  const [firstName, ...rest] = a.name.split(/\s+/);
  const sid = uid();
  await db.insert(students).values({
    id: sid, schoolId: school.id,
    admissionNo: `ADM${String(Number(n) + 1).padStart(4, "0")}`,
    firstName, lastName: rest.join(" ") || firstName,
    sex: a.sex === "female" ? "female" : "male",
    dob: a.dob, status: "draft", admissionStep: 1,
  });
  // carry EVERY guardian over — reuse an existing guardian with the same
  // phone (that's what made the "sibling here" chip light up)
  const apgs = await db.select().from(applicantGuardians)
    .where(eq(applicantGuardians.applicantId, id));
  const carry = apgs.length ? apgs : (a.guardianPhone
    ? [{ name: a.guardianName ?? "Guardian", phone: a.guardianPhone, email: null, relation: "parent" }] : []);
  for (const g of carry) {
    const [existing] = await db.select().from(guardians).where(and(
      eq(guardians.schoolId, school.id), eq(guardians.phone, g.phone)));
    const gid = existing?.id ?? uid();
    if (!existing) await db.insert(guardians).values({
      id: gid, schoolId: school.id, name: g.name, phone: g.phone,
      email: g.email ?? null, relation: g.relation ?? "parent",
    });
    await db.insert(studentGuardians).values({ studentId: sid, guardianId: gid })
      .onConflictDoNothing();
  }
  await db.update(applicants).set({
    status: "admitted", stageAt: new Date(), decidedAt: new Date(), admittedStudentId: sid,
  }).where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  touch(`/admissions/${id}`);
  redirect(`/students/new?draft=${sid}&step=2`);
}

// ── notes ──────────────────────────────────────────────────────────────
export async function addNote(slug: string, id: string, f: FormData) {
  const { school, user } = await ownApplicant(slug, id);
  const body = str(f, "body");
  if (body) await db.insert(applicantNotes).values({
    id: uid(), schoolId: school.id, applicantId: id, body, byName: user.name,
  });
  touch(`/admissions/${id}`);
  redirect(`/admissions/${id}?flash=saved`);
}

// ── intake settings ────────────────────────────────────────────────────
export async function saveIntakeSettings(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  const prev = getIntakeConfig(school.settings);
  const seats: Record<string, number> = {};
  for (const [k, v] of f.entries()) {
    if (k.startsWith("seat_")) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) seats[k.slice(5)] = Math.round(n);
    }
  }
  const settings = {
    ...(school.settings as Record<string, unknown>),
    intake: {
      ...prev,
      open: f.get("open") === "on",
      closesOn: String(f.get("closesOn") ?? "").slice(0, 10),
      seats,
      testRequired: f.get("testRequired") === "on",
      testMax: Math.max(1, Number(f.get("testMax")) || 100),
      testCutoff: Math.max(0, Number(f.get("testCutoff")) || 0),
    },
  };
  await db.update(schools).set({ settings }).where(eq(schools.id, school.id));
  invalidateSchool(slug);
  touch(`/admissions/setup`);
  redirect(`/admissions/setup?flash=saved`);
}

export async function addIntakeDoc(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  const cfg = getIntakeConfig(school.settings);
  const label = str(f, "label");
  if (label) {
    const doc: IntakeDoc = {
      key: `d${Date.now().toString(36)}`, label, note: str(f, "note") ?? "all levels",
    };
    const settings = {
      ...(school.settings as Record<string, unknown>),
      intake: { ...cfg, docs: [...cfg.docs, doc] },
    };
    await db.update(schools).set({ settings }).where(eq(schools.id, school.id));
    invalidateSchool(slug);
  }
  touch(`/admissions/setup`);
  redirect(`/admissions/setup?flash=saved`);
}

export async function removeIntakeDoc(slug: string, key: string) {
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  const cfg = getIntakeConfig(school.settings);
  const settings = {
    ...(school.settings as Record<string, unknown>),
    intake: { ...cfg, docs: cfg.docs.filter((d) => d.key !== key) },
  };
  await db.update(schools).set({ settings }).where(eq(schools.id, school.id));
  invalidateSchool(slug);
  touch(`/admissions/setup`);
  redirect(`/admissions/setup?flash=saved`);
}
