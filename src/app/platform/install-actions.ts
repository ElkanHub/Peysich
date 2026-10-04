"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { getSession } from "@/core/session";
import { installFee, markInstallationPaid, setInstallation } from "@/core/installation";
import { withFlash } from "@/lib/flash";
import { logTimeline, notifyPlatform, STAGES, STAGE_WORDS } from "@/messaging/platform";
import { schoolUrl } from "@/messaging/render";

async function requirePlatformAdmin() {
  const session = await getSession();
  const u = session?.user as { id: string; role: string; name: string } | undefined;
  if (!u || u.role !== "platform_admin") throw new Error("Forbidden");
  return u;
}
const back = (id: string) => `/platform/schools/${id}`;

/** Offer installation and training: sets the fee and sends the school the
 *  payment message with its link. Also re-sends it to a school that asked. */
export async function offerInstallation(schoolId: string, f: FormData) {
  const u = await requirePlatformAdmin();
  const [before] = await db.select().from(schools).where(eq(schools.id, schoolId));
  if (!before) redirect("/platform/schools");
  const typed = Math.round(Number(f.get("feeGhs") ?? 0) * 100);
  const fee = typed > 0 ? typed : await installFee(before);
  if (fee <= 0) redirect(withFlash(back(schoolId), "Type the fee first. Nothing was sent.", { error: true }));
  const r = await setInstallation(schoolId, before.installation === "requested" ? "requested" : "offered", ["none", "requested", "offered"], fee);
  if (!r) redirect(withFlash(back(schoolId), "This school's installation is already paid or done. Nothing was sent.", { error: true }));
  const ghs = `GHS ${(fee / 100).toLocaleString()}`;
  const on = await notifyPlatform(r.school, {
    label: `Installation and training offered: ${ghs}`,
    email: {
      subject: "Installation and training for {{name}}",
      text: `Hello {{first}},\nWe will come to {{name}}, set SchoolSpec up with your classes, children, fees and teachers, and train your staff to use it.\nIt is one price, paid once: ${ghs}.`,
      cta: { label: `Pay ${ghs}`, url: schoolUrl(r.school.slug, "/billing#installation") },
    },
  });
  await logTimeline(schoolId, "installation", `Offered at ${ghs}`, u.name);
  revalidatePath(back(schoolId));
  redirect(withFlash(back(schoolId), on.length
    ? `Offer sent by email with the payment link: ${ghs}.`
    : `Offer saved at ${ghs}, but there is no email to send it to. The school can pay from its Billing page.`));
}

/** The school paid by cash or transfer: record it. */
export async function recordInstallationPaid(schoolId: string) {
  const u = await requirePlatformAdmin();
  const ok = await markInstallationPaid(schoolId, "recorded in the console", u.name);
  revalidatePath(back(schoolId));
  redirect(withFlash(back(schoolId), ok ? "Payment recorded. The school gets a receipt by email." : "Already paid or done.", { error: !ok }));
}

/** The box: installation and training are done. From here the school's own
 *  setup steps count as done, because we did them. */
export async function markInstallationDone(schoolId: string) {
  const u = await requirePlatformAdmin();
  const r = await setInstallation(schoolId, "done", ["requested", "offered", "paid"]);
  if (r) await logTimeline(schoolId, "installation", "Installation and training done", u.name);
  revalidatePath(back(schoolId));
  revalidatePath("/platform/schools");
  redirect(withFlash(back(schoolId), r ? "Marked done. The school's setup steps now show as done." : "Nothing to mark."));
}

/** A card dragged on the board. The daily sweep leaves it there until the
 *  school's own facts change. Returns nothing: the board refreshes itself. */
export async function moveSchoolStage(schoolId: string, stage: string) {
  const u = await requirePlatformAdmin();
  if (!(STAGES as readonly string[]).includes(stage)) return;
  const [s] = await db.select({ stage: schools.stage }).from(schools).where(eq(schools.id, schoolId));
  if (!s || s.stage === stage) return;
  await db.update(schools).set({ stage, stageSince: new Date() }).where(eq(schools.id, schoolId));
  await logTimeline(schoolId, "stage", `${STAGE_WORDS[s.stage] ?? s.stage} → ${STAGE_WORDS[stage]} (moved by hand)`, u.name);
  revalidatePath("/platform/schools");
}
