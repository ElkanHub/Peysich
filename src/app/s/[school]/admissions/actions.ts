"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  applicants, applicantNotes, students, guardians, studentGuardians,
  academicYears, schools,
} from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { invalidateSchool } from "@/core/tenant";
import { uid } from "@/lib/utils";
import { sendSms } from "@/lib/notify";
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

// ── offer ──────────────────────────────────────────────────────────────
export async function makeOffer(slug: string, id: string, f: FormData) {
  const { school, a } = await ownApplicant(slug, id);
  const deadline = str(f, "deadline");
  await db.update(applicants).set({
    status: "offer", stageAt: new Date(), offerAt: new Date(), offerDeadline: deadline,
  }).where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  await sendSms({
    schoolId: school.id, to: a.guardianPhone, kind: "admission-offer",
    body: `${school.name}: good news — ${a.name} has been offered a place. ` +
      `Please visit the school office to confirm${deadline ? ` by ${deadline}` : ""}.`,
    senderId: school.name,
  });
  touch(`/admissions/${id}`);
  redirect(`/admissions/${id}?flash=done`);
}

export async function resendOfferSms(slug: string, id: string) {
  const { school, a } = await ownApplicant(slug, id);
  await sendSms({
    schoolId: school.id, to: a.guardianPhone, kind: "admission-offer",
    body: `${school.name}: reminder — ${a.name}'s place is reserved. ` +
      `Please confirm at the school office${a.offerDeadline ? ` by ${a.offerDeadline}` : ""}.`,
    senderId: school.name,
  });
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
  // carry the guardian over — reuse an existing guardian with this phone
  // (that's what made the "sibling here" chip light up)
  if (a.guardianPhone) {
    const [existing] = await db.select().from(guardians).where(and(
      eq(guardians.schoolId, school.id), eq(guardians.phone, a.guardianPhone)));
    const gid = existing?.id ?? uid();
    if (!existing) await db.insert(guardians).values({
      id: gid, schoolId: school.id, name: a.guardianName ?? "Guardian", phone: a.guardianPhone,
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
