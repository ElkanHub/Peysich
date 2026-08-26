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
  /** Optional per-period choice among the subject's eligible teachers
   *  (main + assistants). Empty ⇒ derived from profiles/pins as usual. */
  teacherId: text("teacher_id"),
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

/** Days school is closed (public holidays, mid-term breaks). One row per
 *  day so attendance sheets and the calendar join on plain dates. Weekends
 *  need no rows — Saturday and Sunday are never school days. */
export const holidays = pgTable("holidays", {
  id: text("id").primaryKey(), schoolId: sid(),
  date: date("date").notNull(), name: text("name").notNull(),
}, (t) => [uniqueIndex("holiday_unique").on(t.schoolId, t.date)]);

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

/** The fee CATALOG's lookup half: what kinds of money the school charges.
 *  `recurring` types bill every term; one-off types (admission…) bill once
 *  per child, ever. `optional` types apply only to flagged students
 *  (transport riders). */
export const feeTypes = pgTable("fee_types", {
  id: text("id").primaryKey(), schoolId: sid(),
  name: text("name").notNull(), // "Tuition", "Feeding", "Transport", "Admission"…
  kind: text("kind").notNull().default("other"), // tuition|feeding|transport|exam|pta|admission|fine|other
  recurring: boolean("recurring").notNull().default(true),
  optional: boolean("optional").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("fee_types_school").on(t.schoolId)]);

/** The catalog's amounts half: what a type costs per level for a term.
 *  classId narrows one class off its level's price. dueDate overrides the
 *  school-wide "N weeks into term" default. */
export const feeItems = pgTable("fee_items", {
  id: text("id").primaryKey(), schoolId: sid(),
  feeTypeId: text("fee_type_id").notNull().references(() => feeTypes.id, { onDelete: "cascade" }),
  termId: text("term_id").notNull(), levelId: text("level_id").notNull(),
  classId: text("class_id"), // null = whole level
  amountPesewas: integer("amount_pesewas").notNull(),
  dueDate: date("due_date"),
}, (t) => [index("fee_items_school_term").on(t.schoolId, t.termId, t.levelId)]);

/** Named discounts a school grants (sibling, staff child, scholarship…). */
export const scholarships = pgTable("scholarships", {
  id: text("id").primaryKey(), schoolId: sid(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("percent"), // percent|fixed
  value: integer("value").notNull(), // percent (0-100) or pesewas
  feeTypeId: text("fee_type_id"), // null = applies to the whole bill
  active: boolean("active").notNull().default(true),
}, (t) => [index("scholarships_school").on(t.schoolId)]);

export const studentScholarships = pgTable("student_scholarships", {
  schoolId: sid(),
  studentId: text("student_id").notNull(),
  scholarshipId: text("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "cascade" }),
  note: text("note"),
  grantedBy: text("granted_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("stu_schol_pk").on(t.studentId, t.scholarshipId)]);

/** Manual money moves for one child — the override table that keeps edge
 *  cases out of the rules engine. Signed: +50 bills more, −50 waives. */
export const feeAdjustments = pgTable("fee_adjustments", {
  id: text("id").primaryKey(), schoolId: sid(),
  studentId: text("student_id").notNull(), termId: text("term_id").notNull(),
  amountPesewas: integer("amount_pesewas").notNull(), // signed
  reason: text("reason").notNull(),
  createdBy: text("created_by").notNull(),
  invoiced: boolean("invoiced").notNull().default(false), // picked up by a generation run or applied post-issue
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("fee_adj_student_term").on(t.studentId, t.termId)]);

export const invoiceStatus = pgEnum("invoice_status", ["unpaid", "part_paid", "paid"]);
export const feeInvoices = pgTable("fee_invoices", {
  id: text("id").primaryKey(), schoolId: sid(),
  studentId: text("student_id").notNull(), termId: text("term_id").notNull(),
  invoiceNo: text("invoice_no"), // "2026-000418", sequential per school per year
  totalPesewas: integer("total_pesewas").notNull(),
  paidPesewas: integer("paid_pesewas").notNull().default(0),
  status: invoiceStatus("status").notNull().default("unpaid"),
  dueDate: date("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("inv_student_term").on(t.studentId, t.termId),
  index("inv_school_status").on(t.schoolId, t.status),
]);

/** The invoice's line items — FROZEN at generation. Catalog edits after
 *  issue never touch these; corrections arrive as new adjustment lines. */
export const feeInvoiceLines = pgTable("fee_invoice_lines", {
  id: text("id").primaryKey(), schoolId: sid(),
  invoiceId: text("invoice_id").notNull().references(() => feeInvoices.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountPesewas: integer("amount_pesewas").notNull(), // signed (discounts negative)
  source: text("source").notNull().default("item"), // item|adjustment|scholarship|carry_forward|late_fee
  feeTypeId: text("fee_type_id"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("inv_lines_invoice").on(t.invoiceId)]);

export const feePayments = pgTable("fee_payments", {
  id: text("id").primaryKey(), schoolId: sid(),
  // money records must survive everything — no cascade, ever
  invoiceId: text("invoice_id").notNull().references(() => feeInvoices.id, { onDelete: "restrict" }),
  amountPesewas: integer("amount_pesewas").notNull(),
  method: text("method").notNull().default("momo"), // momo|cash|bank|card
  reference: text("reference").notNull().unique(),
  receiptNo: text("receipt_no"), // "2026-000871", sequential per school per year
  note: text("note"),
  recordedBy: text("recorded_by"), // user id of the cashier/admin
  voidedBy: text("voided_by"), voidedAt: timestamp("voided_at"), // void ≠ delete
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("pay_school").on(t.schoolId, t.createdAt)]);

/** Append-only money journal per student: every event is one row, balance
 *  is always the sum. Corrections are offsetting entries — rows are never
 *  updated or deleted. */
export const ledgerEntries = pgTable("ledger_entries", {
  id: text("id").primaryKey(), schoolId: sid(),
  studentId: text("student_id").notNull(),
  kind: text("kind").notNull(), // invoice|payment|adjustment|void|carry_forward|credit
  debitPesewas: integer("debit_pesewas").notNull().default(0),
  creditPesewas: integer("credit_pesewas").notNull().default(0),
  refId: text("ref_id"), // invoice / payment id behind the row
  memo: text("memo").notNull(),
  createdBy: text("created_by"),
  at: timestamp("at").notNull().defaultNow(),
}, (t) => [index("ledger_student").on(t.studentId, t.at), index("ledger_school").on(t.schoolId, t.at)]);

/** Per-school document counters (receipts, invoices), keyed per year so
 *  numbers read "2026-000123" and restart each January. */
export const docCounters = pgTable("doc_counters", {
  schoolId: sid(),
  key: text("key").notNull(), // "receipt-2026", "invoice-2026"
  value: integer("value").notNull().default(0),
}, (t) => [uniqueIndex("doc_counter_pk").on(t.schoolId, t.key)]);

/** Parent online fee payment intents (reference → invoice to credit on success). */
export const feeCheckouts = pgTable("fee_checkouts", {
  reference: text("reference").primaryKey(),
  schoolId: sid(),
  invoiceId: text("invoice_id").notNull(),
  amountPesewas: integer("amount_pesewas").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
