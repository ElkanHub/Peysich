import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { presignDownload, r2Enabled } from "@/lib/r2";

/* Signatures & the school stamp (schools.settings.docSign) — collected once,
 * rendered on every outgoing paper so documents leave READY, printed or
 * digital. Two signatures exist: the head teacher's and the main admin's.
 * Wherever the head teacher's signature belongs but hasn't been collected
 * yet, the main admin's signs in its place. */

export type DocSignConfig = {
  headStaffId: string | null; // the staff member designated Head Teacher
  adminName: string;          // whose name sits under the fallback signature
  headSigKey: string | null;  // R2 keys, uploaded under Settings
  adminSigKey: string | null;
  stampKey: string | null;
};

export function getDocSignConfig(settings: unknown): DocSignConfig {
  const raw = (settings as { docSign?: Partial<DocSignConfig> } | null)?.docSign ?? {};
  return {
    headStaffId: typeof raw.headStaffId === "string" && raw.headStaffId ? raw.headStaffId : null,
    adminName: typeof raw.adminName === "string" ? raw.adminName : "",
    headSigKey: typeof raw.headSigKey === "string" && raw.headSigKey ? raw.headSigKey : null,
    adminSigKey: typeof raw.adminSigKey === "string" && raw.adminSigKey ? raw.adminSigKey : null,
    stampKey: typeof raw.stampKey === "string" && raw.stampKey ? raw.stampKey : null,
  };
}

export type DocSign = {
  /** Name under the Head Teacher line — follows whoever's signature shows. */
  headName: string | null;
  headSigUrl: string | null;
  /** True when the main admin is signing in the head teacher's place. */
  adminSigning: boolean;
  stampUrl: string | null;
};

/** Who signs the class line on a paper. Class-teaching classes: the class
 *  teacher. Subject-teaching classes: the FORM MASTER is in charge, so their
 *  signature signs — and the label says which office it is, with the name
 *  shown clearly under it. */
export type ClassSigner = { label: "Class Teacher" | "Form Master"; name: string | null; sigUrl: string | null };

export async function getClassSigner(schoolId: string, classId: string | null): Promise<ClassSigner> {
  const fallback: ClassSigner = { label: "Class Teacher", name: null, sigUrl: null };
  if (!classId) return fallback;
  const { getStructure } = await import("@/core/academics");
  const S = await getStructure(schoolId);
  const cls = S.classById.get(classId);
  if (!cls) return fallback;
  const classMode = S.modeBySection.get(S.sectionOfClass(cls)) === "class_teacher";
  const staffId = classMode ? cls.classTeacherId : S.formMasterOf(classId);
  const label = classMode ? "Class Teacher" as const : "Form Master" as const;
  if (!staffId) return { label, name: null, sigUrl: null };
  const [s] = await db.select({ name: staff.name, sigKey: staff.signatureKey }).from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.schoolId, schoolId)));
  const sigUrl = s?.sigKey && r2Enabled ? await presignDownload(s.sigKey).catch(() => null) : null;
  return { label, name: s?.name ?? null, sigUrl };
}

export async function getDocSign(school: { id: string; settings: unknown }): Promise<DocSign> {
  const cfg = getDocSignConfig(school.settings);
  let headStaffName: string | null = null;
  if (cfg.headStaffId) {
    const [s] = await db.select({ name: staff.name }).from(staff)
      .where(and(eq(staff.id, cfg.headStaffId), eq(staff.schoolId, school.id)));
    headStaffName = s?.name ?? null;
  }
  const sigKey = cfg.headSigKey ?? cfg.adminSigKey;
  const adminSigning = !cfg.headSigKey && Boolean(cfg.adminSigKey);
  const presign = async (key: string | null) =>
    key && r2Enabled ? await presignDownload(key).catch(() => null) : null;
  return {
    headName: cfg.headSigKey ? (headStaffName ?? (cfg.adminName || null))
      : adminSigning ? (cfg.adminName || headStaffName) : headStaffName,
    headSigUrl: await presign(sigKey),
    adminSigning,
    stampUrl: await presign(cfg.stampKey),
  };
}
