"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { staff, classes, subjects, teachingAssignments, staffTeaching, adminAccess } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { createSchoolLogin } from "@/core/accounts";
import { ACCESS_PRESETS } from "@/core/access-const";
import { sendSms } from "@/lib/notify";
import { withFlash } from "@/lib/flash";
import { uid } from "@/lib/utils";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const TYPES = ["teaching", "admin", "support"];
const EMPLOYMENT = ["full_time", "part_time", "contract"];
/** What a login opens. "none" is stored — it is a real choice, not a gap. */
const ROLES = ["teacher", "admin", "bursar", "none"];
/** The default login for each kind of work: least access that does the job. */
const ROLE_FOR: Record<string, string> = { teaching: "teacher", admin: "bursar", support: "none" };

async function ownStaff(slug: string, id: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(staff)
    .where(and(eq(staff.id, id), eq(staff.schoolId, school.id)));
  if (!s) redirect("/staff");
  return { school, s };
}

type StaffRow = typeof staff.$inferSelect;

/** Create the portal login a staff record asks for. A bursar is an admin
 *  LIMITED to the Bursar preset (Team & access grants) — never a full admin.
 *  Returns the credentials, or why nothing was made. */
async function makeStaffLogin(
  school: { id: string; slug: string }, s: StaffRow,
): Promise<{ error: string } | { loginAs: string; password: string }> {
  if (s.userId) return { error: "Already has a login" };
  if (s.staffRole === "none") return { error: "Marked as no login — change what they can open first" };
  const r = await createSchoolLogin({
    schoolId: school.id, schoolSlug: school.slug, name: s.name,
    role: s.staffRole === "teacher" ? "teacher" : "admin",
    email: s.email, phone: s.phone,
    username: s.email ? s.email.split("@")[0] : `staff.${(s.staffNo ?? s.id.slice(0, 6)).toLowerCase()}`,
  });
  if ("error" in r) return r;
  if (s.staffRole === "bursar") await db.insert(adminAccess).values({
    userId: r.userId, schoolId: school.id,
    tabs: JSON.stringify(ACCESS_PRESETS.bursar.tabs), feeActions: JSON.stringify(ACCESS_PRESETS.bursar.fees),
  }).onConflictDoNothing();
  await db.update(staff).set({ userId: r.userId }).where(eq(staff.id, s.id));
  return { loginAs: r.loginAs, password: r.password };
}

/** Text the login to the person's phone. Returns the sentence for the toast. */
async function smsLogin(school: { id: string; slug: string; name: string }, s: StaffRow, who: string) {
  if (!s.phone) return ` Add a phone to send ${who} a login, or create one on this page.`;
  const r = await makeStaffLogin(school, s);
  if ("error" in r) return ` No login: ${r.error.toLowerCase()}.`;
  const status = await sendSms({
    schoolId: school.id, to: s.phone, kind: "login", senderId: school.name,
    body: `${school.name}: your SchoolSpec login is ${r.loginAs}, password ${r.password}. Please change it after signing in.`,
  });
  return status === "sent"
    ? ` Login sent by SMS to ${s.phone}.`
    : ` Login created — SMS is not set up, so reset the password on this page to hand it over.`;
}

/** ONE screen: name, phone, what they do, and whether to text them a login.
 *  `draftId` is an old wizard draft being finished on the same row. */
export async function addStaff(slug: string, draftId: string | null, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const name = str(f, "name");
  if (!name) redirect(withFlash("/staff/new", "A full name is needed.", { error: true }));
  const staffType = TYPES.includes(String(f.get("staffType"))) ? String(f.get("staffType")) : "teaching";
  const staffRole = ROLE_FOR[staffType];
  const phone = str(f, "phone");
  const draft = draftId
    ? (await db.select().from(staff).where(and(eq(staff.id, draftId), eq(staff.schoolId, school.id))))[0]
    : null;
  let id: string;
  if (draft && draft.status !== "active") {
    id = draft.id;
    await db.update(staff).set({ name, phone, staffType, staffRole, status: "active", onboardingStep: null })
      .where(eq(staff.id, id));
  } else {
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(staff)
      .where(eq(staff.schoolId, school.id));
    id = uid();
    await db.insert(staff).values({
      id, schoolId: school.id, name, phone, staffType, staffRole,
      staffNo: `STF${String(Number(n) + 1).padStart(4, "0")}`,
      joinedOn: new Date().toISOString().slice(0, 10),
    });
  }
  let note = "";
  if (f.get("sendLogin") === "on" && staffRole !== "none") {
    const [s] = await db.select().from(staff).where(eq(staff.id, id));
    note = await smsLogin(school, s, "them");
  }
  revalidatePath("/staff");
  redirect(withFlash(`/staff/${id}`, `${name} added.${note}`));
}

/** "Create login" on the Staff File — same rules as the one-screen form. */
export async function issueStaffLogin(slug: string, id: string) {
  const { school, s } = await ownStaff(slug, id);
  const r = await makeStaffLogin(school, s);
  revalidatePath(`/staff/${id}`);
  return r;
}

/** Drop a draft: a status flip, so the Undo toast can flip it back (staff/[id]/undo). */
export async function discardOnboarding(slug: string, id: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  // ponytail: discarded rows stay (invisible — every query filters on status)
  await db.update(staff).set({ status: "discarded" }).where(and(
    eq(staff.id, id), eq(staff.schoolId, school.id), eq(staff.status, "draft")));
  revalidatePath("/staff");
  redirect(withFlash("/staff", "Draft removed.", { undo: `/staff/${id}/undo` }));
}

/** Staff File edits — one action per card, flash on save. */
export async function updateStaffCard(slug: string, id: string, card: string, f: FormData) {
  const { s } = await ownStaff(slug, id);
  if (card === "personal") await db.update(staff).set({
    name: str(f, "name") ?? s.name, phone: str(f, "phone"), email: str(f, "email"),
    dob: str(f, "dob"), nationality: str(f, "nationality"), idNumber: str(f, "idNumber"),
    address: str(f, "address"),
    emergencyName: str(f, "emergencyName"), emergencyPhone: str(f, "emergencyPhone"),
  }).where(eq(staff.id, id));
  if (card === "employment") {
    const staffType = String(f.get("staffType") ?? ""), employmentType = String(f.get("employmentType") ?? "");
    await db.update(staff).set({
      staffNo: str(f, "staffNo") ?? s.staffNo, designation: str(f, "designation"),
      staffType: TYPES.includes(staffType) ? staffType : s.staffType,
      employmentType: EMPLOYMENT.includes(employmentType) ? employmentType : s.employmentType,
      joinedOn: str(f, "joinedOn"), probationEnd: str(f, "probationEnd"),
    }).where(eq(staff.id, id));
  }
  if (card === "qualifications") {
    const competencies: string[] = [];
    for (const [k] of f.entries()) if (k.startsWith("comp_")) competencies.push(k.slice(5));
    await db.update(staff).set({
      qualification: str(f, "qualification"), institution: str(f, "institution"),
      licenseNo: str(f, "licenseNo"), competencies,
    }).where(eq(staff.id, id));
  }
  if (card === "payroll") {
    const salary = Number(f.get("salaryGhs"));
    await db.update(staff).set({
      bankName: str(f, "bankName"), bankBranch: str(f, "bankBranch"),
      accountNo: str(f, "accountNo"), ssnitNo: str(f, "ssnitNo"), tinNo: str(f, "tinNo"),
      salaryPesewas: salary > 0 ? Math.round(salary * 100) : null,
    }).where(eq(staff.id, id));
  }
  // what a login opens — settable until a login exists (then it lives on the account)
  if (card === "access" && !s.userId) {
    const role = String(f.get("staffRole") ?? "");
    if (ROLES.includes(role)) await db.update(staff).set({ staffRole: role }).where(eq(staff.id, id));
  }
  revalidatePath(`/staff/${id}`);
  redirect(withFlash(`/staff/${id}`, "Saved."));
}

export async function setStaffPhoto(slug: string, id: string, fileKey: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  if (!fileKey.startsWith(`school/${school.id}/`)) return { error: "Invalid file" };
  await db.update(staff).set({ photoUrl: fileKey })
    .where(and(eq(staff.id, id), eq(staff.schoolId, school.id)));
  revalidatePath(`/staff/${id}`);
  return { ok: true };
}

/** Offboarding-lite: status transition, never a delete. Releases the class-
 *  teacher role and every subject allocation so the gaps show for refilling. */
export async function markStaffLeft(slug: string, id: string, f: FormData) {
  const { school, s } = await ownStaff(slug, id);
  if (s.status !== "active") redirect(`/staff/${id}`);
  await db.update(staff).set({
    status: "left",
    exitDate: str(f, "exitDate") ?? new Date().toISOString().slice(0, 10),
    exitNote: str(f, "exitNote"),
  }).where(eq(staff.id, id));
  await db.update(classes).set({ classTeacherId: null })
    .where(and(eq(classes.schoolId, school.id), eq(classes.classTeacherId, id)));
  await db.update(classes).set({ formMasterId: null })
    .where(and(eq(classes.schoolId, school.id), eq(classes.formMasterId, id)));
  await db.delete(teachingAssignments).where(and(
    eq(teachingAssignments.schoolId, school.id), eq(teachingAssignments.teacherId, id)));
  await db.delete(staffTeaching).where(and(
    eq(staffTeaching.schoolId, school.id), eq(staffTeaching.staffId, id)));
  revalidatePath("/staff");
  redirect(withFlash(`/staff/${id}`, `${s.name} marked as left. Their classes are free to reassign.`, { undo: `/staff/${id}/undo` }));
}

export async function reinstateStaff(slug: string, id: string) {
  const { s } = await ownStaff(slug, id);
  if (s.status !== "left") return;
  await db.update(staff).set({ status: "active", exitDate: null, exitNote: null })
    .where(eq(staff.id, id));
  revalidatePath("/staff");
  revalidatePath(`/staff/${id}`);
}

/* ── Allocations ─────────────────────────────────────────────────────── */

/** Assign (or clear) the teacher for one class-subject cell. */
export async function setAllocation(slug: string, classId: string, subjectId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const teacherId = String(f.get("teacherId") ?? "");
  const [c] = await db.select({ id: classes.id }).from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  if (!c) return;
  if (!teacherId) {
    await db.delete(teachingAssignments).where(and(
      eq(teachingAssignments.classId, classId), eq(teachingAssignments.subjectId, subjectId)));
  } else {
    await db.insert(teachingAssignments)
      .values({ id: uid(), schoolId: school.id, teacherId, classId, subjectId })
      .onConflictDoUpdate({
        target: [teachingAssignments.classId, teachingAssignments.subjectId],
        set: { teacherId },
      });
  }
  revalidatePath("/staff/allocations");
}

/** The primary-school shortcut: class teacher takes every subject. */
export async function fillClassWithTeacher(slug: string, classId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [c] = await db.select().from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  if (!c?.classTeacherId) redirect(`/staff/allocations?err=noteacher`);
  const subs = await db.select().from(subjects).where(eq(subjects.schoolId, school.id));
  for (const sub of subs) {
    await db.insert(teachingAssignments)
      .values({ id: uid(), schoolId: school.id, teacherId: c.classTeacherId!, classId, subjectId: sub.id })
      .onConflictDoUpdate({
        target: [teachingAssignments.classId, teachingAssignments.subjectId],
        set: { teacherId: c.classTeacherId! },
      });
  }
  revalidatePath("/staff/allocations");
  redirect(withFlash("/staff/allocations", "The class teacher now takes every subject.") + `#class-${classId}`);
}

/* ── Teacher PROFILES — who a teacher IS, set once, everything derived ── */

/** Add a role to a teacher's profile: main class teacher (one per class),
 *  class assistant (any number), or subject teacher (subject + levels,
 *  main/assistant). */
export async function addTeachingRole(slug: string, staffId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [me] = await db.select({ id: staff.id }).from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.schoolId, school.id)));
  if (!me) redirect(`/staff/allocations`);
  const what = String(f.get("what") || "");
  const classId = String(f.get("classId") || "");
  const subjectId = String(f.get("subjectId") || "");
  const levelIds = f.getAll("levelIds").map(String).filter(Boolean);

  if (what === "class-main" && classId) {
    await db.update(classes).set({ classTeacherId: staffId })
      .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  } else if (what === "class-assist" && classId) {
    const dup = await db.select({ id: staffTeaching.id }).from(staffTeaching).where(and(
      eq(staffTeaching.schoolId, school.id), eq(staffTeaching.staffId, staffId),
      eq(staffTeaching.kind, "class"), eq(staffTeaching.classId, classId)));
    if (!dup.length) await db.insert(staffTeaching).values({
      id: uid(), schoolId: school.id, staffId, kind: "class", classId, role: "assistant",
    });
  } else if (what === "subject" && subjectId && levelIds.length) {
    // one row per teacher × subject — re-adding replaces the levels/role
    await db.delete(staffTeaching).where(and(
      eq(staffTeaching.schoolId, school.id), eq(staffTeaching.staffId, staffId),
      eq(staffTeaching.kind, "subject"), eq(staffTeaching.subjectId, subjectId)));
    await db.insert(staffTeaching).values({
      id: uid(), schoolId: school.id, staffId, kind: "subject", subjectId,
      levelIds: JSON.stringify(levelIds),
      role: String(f.get("role")) === "assistant" ? "assistant" : "main",
    });
  } else {
    redirect(`/staff/allocations?err=roleform`);
  }
  revalidatePath("/staff/allocations");
  redirect(withFlash("/staff/allocations", "Teaching role added."));
}

export async function removeTeachingRole(slug: string, roleId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.delete(staffTeaching).where(and(
    eq(staffTeaching.id, roleId), eq(staffTeaching.schoolId, school.id)));
  revalidatePath("/staff/allocations");
  redirect(withFlash("/staff/allocations", "Teaching role removed."));
}

/** Release the MAIN class-teacher seat of a class. */
export async function clearMainClassTeacher(slug: string, classId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(classes).set({ classTeacherId: null })
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  revalidatePath("/staff/allocations");
  redirect(withFlash("/staff/allocations", "Class teacher seat cleared."));
}

/** The pastoral tag — every class's responsible teacher. Empty means
 *  "auto": the class teacher carries it (class-teaching mode). */
export async function setFormMaster(slug: string, classId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(classes)
    .set({ formMasterId: String(f.get("staffId") || "") || null })
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  revalidatePath("/staff/allocations");
  redirect(withFlash("/staff/allocations", "Form master saved."));
}

/* ── the Allocation Matrix — one grid, whole school. Every drop writes the
 *    SAME profile rows the engine derives from; pins appear only where a
 *    drop needs to be class-exact (partial level, or a second main). ── */

async function mergeSubjectRole(
  schoolId: string, staffId: string, subjectId: string, role: string, addLevelIds: string[],
) {
  const rows = await db.select().from(staffTeaching).where(and(
    eq(staffTeaching.schoolId, schoolId), eq(staffTeaching.staffId, staffId),
    eq(staffTeaching.kind, "subject"), eq(staffTeaching.subjectId, subjectId),
    eq(staffTeaching.role, role)));
  const parse = (raw: string | null) => {
    try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) ? (a as string[]) : []; } catch { return []; }
  };
  const levels = new Set([...(rows[0] ? parse(rows[0].levelIds) : []), ...addLevelIds]);
  if (rows[0]) {
    await db.update(staffTeaching).set({ levelIds: JSON.stringify([...levels]) })
      .where(eq(staffTeaching.id, rows[0].id));
  } else {
    await db.insert(staffTeaching).values({
      id: uid(), schoolId, staffId, kind: "subject", subjectId,
      levelIds: JSON.stringify([...levels]), role,
    });
  }
}

/** A sweep-drop on a subject row: teacher × subject × the swept classes. */
export async function matrixAssignSubject(
  slug: string, teacherId: string, subjectId: string, classIds: string[], role: "main" | "assistant",
) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [me] = await db.select({ id: staff.id }).from(staff)
    .where(and(eq(staff.id, teacherId), eq(staff.schoolId, school.id)));
  if (!me || !classIds.length) return { ok: false as const };
  const cls = await db.select().from(classes).where(eq(classes.schoolId, school.id));
  const swept = cls.filter((c) => classIds.includes(c.id));
  const sweptLevels = [...new Set(swept.map((c) => c.levelId))];
  await mergeSubjectRole(school.id, teacherId, subjectId, role, sweptLevels);

  if (role === "main") {
    // pin exactly the swept classes when the drop must be class-exact:
    // the level has classes outside the sweep, or another main covers it
    const others = await db.select().from(staffTeaching).where(and(
      eq(staffTeaching.schoolId, school.id), eq(staffTeaching.kind, "subject"),
      eq(staffTeaching.subjectId, subjectId), eq(staffTeaching.role, "main")));
    const parse = (raw: string | null) => {
      try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) ? (a as string[]) : []; } catch { return []; }
    };
    for (const c of swept) {
      const levelClassCount = cls.filter((x) => x.levelId === c.levelId).length;
      const sweptAtLevel = swept.filter((x) => x.levelId === c.levelId).length;
      const rival = others.some((r) => r.staffId !== teacherId && parse(r.levelIds).includes(c.levelId));
      if (rival || sweptAtLevel < levelClassCount) {
        await db.insert(teachingAssignments)
          .values({ id: uid(), schoolId: school.id, teacherId, classId: c.id, subjectId })
          .onConflictDoUpdate({
            target: [teachingAssignments.classId, teachingAssignments.subjectId],
            set: { teacherId },
          });
      } else {
        // sole main over the whole level — the profile is enough; drop stale pins
        await db.delete(teachingAssignments).where(and(
          eq(teachingAssignments.classId, c.id), eq(teachingAssignments.subjectId, subjectId)));
      }
    }
  }
  revalidatePath("/staff/allocations");
  return { ok: true as const };
}

/** A drop on a class-teaching column: main takes the seat, assistants stack. */
export async function matrixAssignClass(
  slug: string, teacherId: string, classId: string, role: "main" | "assistant",
) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [me] = await db.select({ id: staff.id }).from(staff)
    .where(and(eq(staff.id, teacherId), eq(staff.schoolId, school.id)));
  if (!me) return { ok: false as const };
  if (role === "main") {
    await db.update(classes).set({ classTeacherId: teacherId })
      .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  } else {
    const dup = await db.select({ id: staffTeaching.id }).from(staffTeaching).where(and(
      eq(staffTeaching.schoolId, school.id), eq(staffTeaching.staffId, teacherId),
      eq(staffTeaching.kind, "class"), eq(staffTeaching.classId, classId)));
    if (!dup.length) await db.insert(staffTeaching).values({
      id: uid(), schoolId: school.id, staffId: teacherId, kind: "class", classId, role: "assistant",
    });
  }
  revalidatePath("/staff/allocations");
  return { ok: true as const };
}

/** Clear one subject cell: drop the pin if one exists; otherwise take this
 *  class's level out of the resolved teacher's profile row for that role. */
export async function matrixClearCell(slug: string, subjectId: string, classId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [pin] = await db.select().from(teachingAssignments).where(and(
    eq(teachingAssignments.schoolId, school.id),
    eq(teachingAssignments.classId, classId), eq(teachingAssignments.subjectId, subjectId)));
  if (pin) {
    await db.delete(teachingAssignments).where(eq(teachingAssignments.id, pin.id));
    revalidatePath("/staff/allocations");
    return { ok: true as const };
  }
  const [c] = await db.select().from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  if (!c) return { ok: false as const };
  const rows = await db.select().from(staffTeaching).where(and(
    eq(staffTeaching.schoolId, school.id), eq(staffTeaching.kind, "subject"),
    eq(staffTeaching.subjectId, subjectId)));
  const parse = (raw: string | null) => {
    try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) ? (a as string[]) : []; } catch { return []; }
  };
  for (const r of rows) {
    const lv = parse(r.levelIds);
    if (!lv.includes(c.levelId)) continue;
    const left = lv.filter((l) => l !== c.levelId);
    if (left.length) await db.update(staffTeaching)
      .set({ levelIds: JSON.stringify(left) }).where(eq(staffTeaching.id, r.id));
    else await db.delete(staffTeaching).where(eq(staffTeaching.id, r.id));
  }
  revalidatePath("/staff/allocations");
  return { ok: true as const };
}

/** Clear a person off a class column (main seat or an assistant). */
export async function matrixClearClass(slug: string, classId: string, staffId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [c] = await db.select().from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  if (!c) return { ok: false as const };
  if (c.classTeacherId === staffId) {
    await db.update(classes).set({ classTeacherId: null }).where(eq(classes.id, classId));
  } else {
    await db.delete(staffTeaching).where(and(
      eq(staffTeaching.schoolId, school.id), eq(staffTeaching.staffId, staffId),
      eq(staffTeaching.kind, "class"), eq(staffTeaching.classId, classId)));
  }
  revalidatePath("/staff/allocations");
  return { ok: true as const };
}
