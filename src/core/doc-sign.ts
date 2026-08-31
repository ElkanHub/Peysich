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
