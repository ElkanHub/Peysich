/* Phase 0 seed: plans + two demo schools with different module sets + users.
   Run: npm run db:seed  (idempotent-ish: skips if schools exist) */
import { db } from "./index";
import { plans, schools, schoolModules } from "./schema";
import { auth } from "@/core/auth";
import { uid } from "@/lib/utils";
import { eq } from "drizzle-orm";

async function main() {
  await db.insert(plans).values([
    { key: "trial", name: "Trial", moduleKeys: ["attendance", "assessment", "comms"], studentCap: 50, pricePerTermPesewas: 0 },
    { key: "starter", name: "Starter", moduleKeys: ["attendance", "assessment", "comms"], studentCap: 200, pricePerTermPesewas: 37500 },
    { key: "standard", name: "Standard", moduleKeys: ["attendance", "assessment", "comms", "timetable", "homework", "fees"], studentCap: 600, storageCapMb: 10240, pricePerTermPesewas: 97500 },
    { key: "premium", name: "Premium", moduleKeys: ["attendance", "assessment", "comms", "timetable", "homework", "fees", "admissions", "library", "transport", "inventory", "hr", "analytics"], studentCap: null, storageCapMb: 51200, pricePerTermPesewas: 200000 },
  ]).onConflictDoNothing();

  const existing = await db.select().from(schools).limit(1);
  if (existing.length) { console.log("Schools exist — skipping."); return; }

  const a = uid(), b = uid();
  await db.insert(schools).values([
    { id: a, name: "St. Mary's Basic School", slug: "stmarys", status: "active", planKey: "standard" },
    { id: b, name: "Little Stars Preschool", slug: "littlestars", status: "active", planKey: "starter" },
  ]);
  // switchboard demo: force fees OFF for stmarys, force timetable ON for littlestars
  await db.insert(schoolModules).values([
    { schoolId: a, moduleKey: "fees", mode: "off", updatedBy: "seed" },
    { schoolId: b, moduleKey: "timetable", mode: "on", updatedBy: "seed" },
  ]);

  // users via better-auth API (hashes passwords properly)
  const mk = (email: string, name: string) =>
    auth.api.signUpEmail({ body: { email, password: "password123", name } });
  const users: [string, string, string, string | null][] = [
    ["platform@peysich.test", "Platform Owner", "platform_admin", null],
    ["admin@stmarys.test", "Ama Admin", "admin", a],
    ["teacher@stmarys.test", "Kofi Teacher", "teacher", a],
    ["admin@littlestars.test", "Esi Admin", "admin", b],
  ];
  const { user } = await import("./schema");
  for (const [email, name, role, schoolId] of users) {
    await mk(email, name);
    await db.update(user).set({ role, schoolId }).where(eq(user.email, email));
  }
  console.log("Seeded: 2 schools, 4 users (password: password123)");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
