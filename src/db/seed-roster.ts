/* Phase 1 seed: realistic roster for stmarys (exit-test data).
   Run: npx tsx --env-file=.env src/db/seed-roster.ts */
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import {
  schools, academicYears, terms, levels, classes, subjects,
  staff, students, guardians, studentGuardians, enrollments,
} from "./schema";
import { uid } from "@/lib/utils";
import { LEVEL_TEMPLATE } from "@/lib/levels";

const FIRST = ["Ama", "Kofi", "Esi", "Kwame", "Akosua", "Yaw", "Adwoa", "Kwabena", "Abena", "Kojo", "Efua", "Kwesi", "Aba", "Kwaku", "Akua", "Fiifi", "Araba", "Ekow", "Maame", "Paa"];
const LAST = ["Mensah", "Owusu", "Asante", "Boateng", "Osei", "Appiah", "Agyemang", "Addo", "Ofori", "Amoah", "Darko", "Ansah", "Sarpong", "Bonsu", "Frimpong"];

async function main() {
  const [school] = await db.select().from(schools).where(eq(schools.slug, "stmarys"));
  if (!school) throw new Error("Run db:seed first");
  const existing = await db.select().from(academicYears).where(eq(academicYears.schoolId, school.id));
  if (existing.length) { console.log("Roster exists — skipping."); return; }

  const yearId = uid();
  await db.insert(academicYears).values({
    id: yearId, schoolId: school.id, name: "2025/2026",
    startsAt: "2025-09-02", endsAt: "2026-07-30", isCurrent: true,
  });
  await db.insert(terms).values([
    { id: uid(), schoolId: school.id, yearId, name: "Term 1", startsAt: "2025-09-02", endsAt: "2025-12-18", isCurrent: false },
    { id: uid(), schoolId: school.id, yearId, name: "Term 2", startsAt: "2026-01-06", endsAt: "2026-04-02", isCurrent: true },
    { id: uid(), schoolId: school.id, yearId, name: "Term 3", startsAt: "2026-04-20", endsAt: "2026-07-30", isCurrent: false },
  ]);

  const classIds: string[] = [];
  for (let i = 0; i < LEVEL_TEMPLATE.length; i++) {
    const [code, name, preschool] = LEVEL_TEMPLATE[i];
    const levelId = uid();
    await db.insert(levels).values({ id: levelId, schoolId: school.id, code, name, sortOrder: i, preschool });
    const cid = uid();
    await db.insert(classes).values({ id: cid, schoolId: school.id, levelId, name: `${name} A` });
    classIds.push(cid);
  }
  const GES = ["English Language", "Mathematics", "Science", "Our World Our People",
    "Religious & Moral Education", "Creative Arts", "Ghanaian Language", "Computing", "Social Studies"];
  await db.insert(subjects).values(GES.map((name) => ({ id: uid(), schoolId: school.id, name })));

  await db.insert(staff).values(Array.from({ length: 18 }, (_, i) => ({
    id: uid(), schoolId: school.id,
    name: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
    staffRole: i === 0 ? "admin" : i === 1 ? "bursar" : "teacher",
    phone: `02411122${String(i).padStart(2, "0")}`,
  })));

  let adm = 1; let r = 7; const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (const cid of classIds) {
    const n = 12 + Math.floor(rand() * 8); // 12–20 per class ≈ 220 students
    for (let i = 0; i < n; i++) {
      const sidv = uid();
      const fn = FIRST[Math.floor(rand() * FIRST.length)];
      const ln = LAST[Math.floor(rand() * LAST.length)];
      await db.insert(students).values({
        id: sidv, schoolId: school.id, admissionNo: `ADM${String(adm++).padStart(4, "0")}`,
        firstName: fn, lastName: ln, sex: rand() > 0.5 ? "male" : "female", classId: cid,
      });
      await db.insert(enrollments).values({
        id: uid(), schoolId: school.id, studentId: sidv, yearId, classId: cid,
      });
      const phone = `024${String(1000000 + Math.floor(rand() * 8999999))}`;
      let [g] = await db.select().from(guardians)
        .where(and(eq(guardians.schoolId, school.id), eq(guardians.phone, phone)));
      if (!g) {
        const gid = uid();
        await db.insert(guardians).values({ id: gid, schoolId: school.id, name: `${FIRST[Math.floor(rand() * FIRST.length)]} ${ln}`, phone });
        [g] = await db.select().from(guardians).where(eq(guardians.id, gid));
      }
      await db.insert(studentGuardians).values({ studentId: sidv, guardianId: g.id });
    }
  }
  console.log(`Roster seeded: ${adm - 1} students across ${classIds.length} classes`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
