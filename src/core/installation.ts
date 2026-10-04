import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { plans, schools } from "@/db/schema";
import { invalidateSchool } from "./tenant";

/* ── Installation and training ──────────────────────────────────────────────
   One price, done in person: SchoolSpec goes to the school, sets everything
   up with its data and trains the staff. A school reaches it two ways — it
   asks from the app (it found us on the web), or we offer it (we went to the
   school) — and both end the same: the fee is paid, we do the work, and the
   box is ticked in the console.

     none → requested | offered → paid → done

   Once it is done, the school's own setup steps count as done: we did them. */

export type Installation = "none" | "requested" | "offered" | "paid" | "done";
export const INSTALLATION_WORDS: Record<string, string> = {
  none: "Not asked for", requested: "Asked for by the school", offered: "Offered, waiting for payment",
  paid: "Paid, to be done", done: "Done",
};
/** In hand: asked for, offered or paid, and not yet done. */
export const installing = (s: { installation: string }) => ["requested", "offered", "paid"].includes(s.installation);

type School = { id: string; planKey: string; installFeePesewas: number };

/** The fee for this school: the one quoted to it, else its plan's, else Starter's. */
export async function installFee(school: School): Promise<number> {
  if (school.installFeePesewas > 0) return school.installFeePesewas;
  const rows = await db.select({ key: plans.key, fee: plans.installFeePesewas }).from(plans)
    .where(inArray(plans.key, [school.planKey, "starter"]));
  return rows.find((r) => r.key === school.planKey && r.fee > 0)?.fee ?? rows.find((r) => r.key === "starter")?.fee ?? 0;
}

/** Move a school's installation on, only from the states it may come from.
 *  Returns the school when this call made the move — so a webhook and a
 *  callback page arriving together record the payment once. */
export async function setInstallation(schoolId: string, to: Installation, from: Installation[], feePesewas?: number) {
  const [s] = await db.update(schools)
    .set({ installation: to, ...(feePesewas ? { installFeePesewas: feePesewas } : {}), updatedAt: new Date() })
    .where(and(eq(schools.id, schoolId), inArray(schools.installation, from))).returning();
  if (!s) return null;
  invalidateSchool(s.slug);
  const { logTimeline, refreshStage } = await import("@/messaging/platform");
  await refreshStage(schoolId);
  return { school: s, logTimeline };
}

/** The fee has arrived (Paystack, or cash recorded in the console). Idempotent. */
export async function markInstallationPaid(schoolId: string, how: string, by?: string) {
  const r = await setInstallation(schoolId, "paid", ["none", "requested", "offered"]);
  if (!r) return false;
  const { notifyPlatform } = await import("@/messaging/platform");
  const { opsAlert } = await import("@/messaging/outbox");
  const fee = `GHS ${((await installFee(r.school)) / 100).toLocaleString()}`;
  await r.logTimeline(schoolId, "installation", `Installation and training paid: ${fee} (${how})`, by);
  await opsAlert(`Installation paid: ${r.school.name} — ${fee}. Agree a day and go.`);
  await notifyPlatform(r.school, {
    label: "Installation paid",
    email: {
      subject: "Receipt: installation and training for {{name}}",
      text: `Hello {{first}},\nWe received ${fee} for installing SchoolSpec at {{name}} and training your staff. We will call you to agree the day.\nThank you.`,
    },
  });
  return true;
}
