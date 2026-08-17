import { db } from "@/db";
import { schools, user, pendingCheckouts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applySubscription } from "@/core/billing";
import { uid } from "@/lib/utils";
async function main() {
  const [u] = await db.select().from(user).where(eq(user.email, "owner@newschool.test"));
  let [ex] = await db.select().from(schools).where(eq(schools.slug, "brightfuture"));
  const id = ex?.id ?? uid();
  if (!ex) {
    const trialEnds = new Date(); trialEnds.setDate(trialEnds.getDate() + 14);
    await db.insert(schools).values({ id, name: "Bright Future Academy", slug: "brightfuture", planKey: "trial", status: "trial", trialEndsAt: trialEnds });
  }
  await db.update(user).set({ role: "admin", schoolId: id }).where(eq(user.id, u.id));
  const ref = `sub_${uid()}`;
  await db.insert(pendingCheckouts).values({ reference: ref, schoolId: id, planKey: "standard" });
  await applySubscription(id, "standard", ref);
  await applySubscription(id, "standard", ref); // idempotency
  const [s] = await db.select().from(schools).where(eq(schools.id, id));
  console.log(`school=${s.slug} plan=${s.planKey} status=${s.status} cap=${s.studentCap}`);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
