import { pgTable, text, timestamp, integer, boolean, date, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./platform";

const sid = () => text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" });

// ── timetable ──
export const dayEnum = pgEnum("weekday", ["mon", "tue", "wed", "thu", "fri"]);
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
