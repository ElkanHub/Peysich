"use server";
import { redirect } from "next/navigation";
import { requireSchool } from "@/core/school-context";
import { installFee, setInstallation } from "@/core/installation";
import { withFlash } from "@/lib/flash";
import { initCheckout, onlinePayEnabled } from "@/lib/paystack";
import { uid } from "@/lib/utils";

/** The school asks SchoolSpec to come, set it up and train the staff. */
export async function requestInstallation(slug: string) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  const r = await setInstallation(school.id, "requested", ["none"]);
  if (r) {
    await r.logTimeline(school.id, "installation", "The school asked for installation and training", user.name);
    const { opsAlert } = await import("@/messaging/outbox");
    await opsAlert(`Installation asked for: ${school.name}${school.ownerPhone ? ` · ${school.ownerPhone}` : ""}. Call to agree a day.`);
  }
  redirect(withFlash("/billing", "Asked. We will call you to agree a day. You can pay now or when we call."));
}

/** Open Paystack for the installation fee. The billing page credits it on the way back. */
export async function payInstallation(slug: string) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  const fee = await installFee(school);
  if (!["requested", "offered"].includes(school.installation) || fee <= 0)
    redirect(withFlash("/billing", "There is no installation fee to pay. Nothing was charged.", { error: true }));
  if (!onlinePayEnabled)
    redirect(withFlash("/billing", "Online payment is not switched on yet. Pay us directly and we will record it. Call us.", { error: true }));
  const reference = `ins_${uid()}`;
  const { checkoutUrl } = await initCheckout({
    email: (user as { email?: string }).email ?? `${slug}@schoolspec.com`, amountPesewas: fee, reference,
    callbackUrl: `/billing?install=${reference}`, metadata: { kind: "install", schoolId: school.id },
  });
  redirect(checkoutUrl);
}
