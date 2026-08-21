import { pgTable, text, timestamp, integer, boolean, date, jsonb, real, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./platform";

const sid = () => text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" });

// ── timetable ──
export const dayEnum = pgEnum("weekday", ["mon", "tue", "wed", "thu", "fri"]);

/* Sections group levels the way Ghanaian schools reason about them:
 * preschool (creche→KG2), primary (B1–B6), jhs (B7–B9). Day shape, teaching
 * mode and subject sets are all decided per section — the ONE place these
 * live. Derived from levels.code, no extra column needed. */

/** Per-section teaching mode: class_teacher = one teacher owns the whole
 *  class's week (no subject teachers walk in); subject_teaching = subject
 *  teachers rotate per the allocations grid. */
export const sectionConfig = pgTable("section_config", {
  id: text("id").primaryKey(), schoolId: sid(),
  section: text("section").notNull(), // preschool | primary | jhs
  mode: text("mode").notNull().default("subject_teaching"), // class_teacher | subject_teaching
  /** Rating labels for skills-based (preschool) assessment, in ascending order. */
  skillScale: jsonb("skill_scale").$type<string[]>().notNull()
    .default(["Emerging", "Developing", "Secure"]),
}, (t) => [uniqueIndex("secconf_school_section").on(t.schoolId, t.section)]);

/* ── assessment scheme: WHAT counts toward the terminal 100%, per section.
 *    Named by the school ("Class Test 1" vs "Class Assessment 1"), weighted,
 *    exactly one exam component; weights must total 100. ── */
export const assessmentComponents = pgTable("assessment_components", {
  id: text("id").primaryKey(), schoolId: sid(),
  section: text("section").notNull(),
  name: text("name").notNull(),
  weight: integer("weight").notNull(), // marks out of 100 this component carries
  sortOrder: integer("sort_order").notNull().default(0),
  isExam: boolean("is_exam").notNull().default(false),
}, (t) => [uniqueIndex("acomp_unique").on(t.schoolId, t.section, t.name)]);

/** One sheet = class × subject × term × component: what it was marked over
 *  and whether the teacher has submitted (submitted → teacher read-only). */
export const scoreSheets = pgTable("score_sheets", {
  id: text("id").primaryKey(), schoolId: sid(),
  termId: text("term_id").notNull(),
  classId: text("class_id").notNull(),
  subjectId: text("subject_id").notNull(),
  componentId: text("component_id").notNull()
    .references(() => assessmentComponents.id, { onDelete: "cascade" }),
  outOf: integer("out_of").notNull().default(100), // teacher marked over this
  submitted: boolean("submitted").notNull().default(false),
  submittedBy: text("submitted_by"),
  submittedAt: timestamp("submitted_at"),
}, (t) => [uniqueIndex("sheet_unique").on(t.termId, t.classId, t.subjectId, t.componentId)]);

/** Raw marks as the teacher gave them (over the sheet's outOf); conversion
 *  to the component's weight happens at read time so the maths always tallies. */
export const componentScores = pgTable("component_scores", {
  id: text("id").primaryKey(), schoolId: sid(),
  termId: text("term_id").notNull(),
  classId: text("class_id").notNull(),
  subjectId: text("subject_id").notNull(),
  componentId: text("component_id").notNull()
    .references(() => assessmentComponents.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull(),
  raw: real("raw").notNull(),
  /** Child did not write this test — entered as “–”, prints as “–”, counts 0. */
  absent: boolean("absent").notNull().default(false),
  enteredBy: text("entered_by").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("cscore_unique").on(t.studentId, t.termId, t.subjectId, t.componentId),
  index("cscore_school_term").on(t.schoolId, t.termId, t.classId, t.subjectId),
  index("cscore_student").on(t.schoolId, t.studentId, t.termId),
]);

/** Families see a component's marks only once the admin publishes it. */
export const scorePublications = pgTable("score_publications", {
  id: text("id").primaryKey(), schoolId: sid(),
  termId: text("term_id").notNull(),
  componentId: text("component_id").notNull()
    .references(() => assessmentComponents.id, { onDelete: "cascade" }),
  publishedBy: text("published_by").notNull(),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("spub_unique").on(t.termId, t.componentId)]);

/** The day skeleton per section: assembly, teaching periods, breaks, lunch.
 *  Every timetable grid renders from these — the X-axis single source. */
export const periodSlots = pgTable("period_slots", {
  id: text("id").primaryKey(), schoolId: sid(),
  section: text("section").notNull(),
  name: text("name").notNull(), // "Period 1", "Assembly", "Lunch"
  kind: text("kind").notNull().default("teaching"), // teaching | assembly | break | lunch
  startMin: integer("start_min").notNull(),
  endMin: integer("end_min").notNull(),
  sortOrder: integer("sort_order").notNull(),
}, (t) => [index("pslots_school_section").on(t.schoolId, t.section, t.sortOrder)]);

/** Which subjects a section takes — classes inherit this list. */
export const sectionSubjects = pgTable("section_subjects", {
  id: text("id").primaryKey(), schoolId: sid(),
  section: text("section").notNull(),
  subjectId: text("subject_id").notNull(),
}, (t) => [uniqueIndex("secsub_unique").on(t.schoolId, t.section, t.subjectId)]);

/** A single class deviating from its section's subject list (add or remove
 *  one subject) — the exception, never the rule. */
export const classSubjectOverrides = pgTable("class_subject_overrides", {
  id: text("id").primaryKey(), schoolId: sid(),
  classId: text("class_id").notNull(),
  subjectId: text("subject_id").notNull(),
  action: text("action").notNull(), // add | remove
}, (t) => [uniqueIndex("csov_unique").on(t.classId, t.subjectId)]);

/** One placed lesson: class × day × slot → subject. NO teacher column —
 *  WHO teaches is derived from Teaching & allocations (or the class teacher
 *  in class_teacher mode), so it can never contradict the allocations grid. */
export const timetableEntries = pgTable("timetable_entries", {
  id: text("id").primaryKey(), schoolId: sid(),
  classId: text("class_id").notNull(),
  subjectId: text("subject_id").notNull(),
  slotId: text("slot_id").notNull().references(() => periodSlots.id, { onDelete: "cascade" }),
  day: dayEnum("day").notNull(),
}, (t) => [
  uniqueIndex("tte_class_day_slot").on(t.classId, t.day, t.slotId),
  index("tte_school_class").on(t.schoolId, t.classId),
  index("tte_school_subject").on(t.schoolId, t.subjectId),
]);

/** @deprecated replaced by timetableEntries + periodSlots; kept only so old
 *  rows survive until the column is dropped in a later migration. */
export const lessons = pgTable("lessons", {
  id: text("id").primaryKey(), schoolId: sid(),
  classId: text("class_id").notNull(),
  subjectId: text("subject_id").notNull(),
  teacherId: text("teacher_id"), // staff.id
  day: dayEnum("day").notNull(),
  startMin: integer("start_min").notNull(), // minutes from midnight
  endMin: integer("end_min").notNull(),
}, (t) => [
  index("lessons_school_class").on(t.schoolId, t.classId, t.day),
  index("lessons_school_teacher").on(t.schoolId, t.teacherId, t.day),
]);

/** Who has seen which announcement — powers the on-open attention modal
 *  and the unread badge on the Announcements tab. */
export const announcementAcks = pgTable("announcement_acks", {
  id: text("id").primaryKey(), schoolId: sid(),
  announcementId: text("announcement_id").notNull(),
  userId: text("user_id").notNull(),
  ackedAt: timestamp("acked_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("ack_unique").on(t.announcementId, t.userId)]);

// ── homework ──
export const assignments = pgTable("assignments", {
  id: text("id").primaryKey(), schoolId: sid(),
  classId: text("class_id").notNull(), subjectId: text("subject_id").notNull(),
  title: text("title").notNull(), instructions: text("instructions"),
  dueDate: date("due_date").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("asg_school_class").on(t.schoolId, t.classId, t.dueDate)]);

export const submissions = pgTable("submissions", {
  assignmentId: text("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull(), schoolId: sid(),
  fileUrl: text("file_url"), note: text("note"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  mark: integer("mark"), feedback: text("feedback"),
}, (t) => [uniqueIndex("subm_pk").on(t.assignmentId, t.studentId)]);

// ── comms ──
export const announcements = pgTable("announcements", {
  id: text("id").primaryKey(), schoolId: sid(),
  title: text("title").notNull(), body: text("body").notNull(),
  classId: text("class_id"), // null = school-wide (video's model)
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("ann_school").on(t.schoolId, t.createdAt)]);

export const events = pgTable("events", {
  id: text("id").primaryKey(), schoolId: sid(),
  title: text("title").notNull(), description: text("description"),
  classId: text("class_id"), // null = school-wide
  startsAt: timestamp("starts_at").notNull(), endsAt: timestamp("ends_at"),
}, (t) => [index("events_school").on(t.schoolId, t.startsAt)]);

export const smsLog = pgTable("sms_log", {
  id: text("id").primaryKey(), schoolId: sid(),
  to: text("to").notNull(), body: text("body").notNull(),
  kind: text("kind").notNull(), // absence|fees|blast|report
  status: text("status").notNull().default("queued"), // queued|sent|failed
  costPesewas: integer("cost_pesewas").notNull().default(9), // re-billed w/ margin
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("sms_school").on(t.schoolId, t.createdAt)]);

// ── fees ──
export const feeStructures = pgTable("fee_structures", {
  id: text("id").primaryKey(), schoolId: sid(),
  termId: text("term_id").notNull(), levelId: text("level_id").notNull(),
  name: text("name").notNull(), // "Tuition", "Feeding", "PTA"
  amountPesewas: integer("amount_pesewas").notNull(),
}, (t) => [index("fees_school_term").on(t.schoolId, t.termId, t.levelId)]);

export const invoiceStatus = pgEnum("invoice_status", ["unpaid", "part_paid", "paid"]);
export const feeInvoices = pgTable("fee_invoices", {
  id: text("id").primaryKey(), schoolId: sid(),
  studentId: text("student_id").notNull(), termId: text("term_id").notNull(),
  totalPesewas: integer("total_pesewas").notNull(),
  paidPesewas: integer("paid_pesewas").notNull().default(0),
  status: invoiceStatus("status").notNull().default("unpaid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("inv_student_term").on(t.studentId, t.termId),
  index("inv_school_status").on(t.schoolId, t.status),
]);

export const feePayments = pgTable("fee_payments", {
  id: text("id").primaryKey(), schoolId: sid(),
  invoiceId: text("invoice_id").notNull().references(() => feeInvoices.id, { onDelete: "cascade" }),
  amountPesewas: integer("amount_pesewas").notNull(),
  method: text("method").notNull().default("momo"), // momo|cash|card
  reference: text("reference").notNull().unique(),
  recordedBy: text("recorded_by"), // staff id for cash entries
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("pay_school").on(t.schoolId, t.createdAt)]);

/** Parent online fee payment intents (reference → invoice to credit on success). */
export const feeCheckouts = pgTable("fee_checkouts", {
  reference: text("reference").primaryKey(),
  schoolId: sid(),
  invoiceId: text("invoice_id").notNull(),
  amountPesewas: integer("amount_pesewas").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
