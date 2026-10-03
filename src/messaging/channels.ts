import { db } from "@/db";
import { contactChannels } from "@/db/schema";
import { waNumber } from "./providers/whatsapp";

type Owner = "guardian" | "staff";

/** Store a WhatsApp number and its consent for a guardian or staff member.
 *  Used by the save action (./contacts.ts), the admission form and the import
 *  sheet. Not a server action: callers do their own permission check. */
export async function setWhatsApp(schoolId: string, ownerKind: Owner, ownerId: string, phone: string | null, consent: boolean) {
  const whatsapp = phone?.trim() ? waNumber(phone) : null;
  await db.insert(contactChannels)
    .values({ ownerKind, ownerId, schoolId, whatsapp, whatsappConsent: consent && !!whatsapp })
    .onConflictDoUpdate({
      target: [contactChannels.ownerKind, contactChannels.ownerId],
      set: { whatsapp, whatsappConsent: consent && !!whatsapp },
    });
}
