import { pgTable, text, timestamp, integer, date, index } from "drizzle-orm/pg-core";
import { schools } from "./platform";

const sid = () => text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" });

// admissions — the pipeline BEFORE a child is a student. One row per
// applicant; the stage moves New → Screening → Offer → Admitted (or
// Waitlist / Rejected), every move stamped so the funnel is honest.
export const applicants = pgTable("applicants", {
  id: text("id").primaryKey(), schoolId: sid(),
  name: text("name").notNull(), guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone").notNull(),
  levelId: text("level_id").notNull(),
  status: text("status").notNull().default("new"), // new|screening|offer|admitted|waitlist|rejected
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // the child, before the student file exists
  dob: date("dob"), sex: text("sex"), // male|female — asked, never assumed
  prevSchool: text("prev_school"), source: text("source"), // how they heard of us
  yearId: text("year_id"), // the intake year this application belongs to
  docs: text("docs"), // JSON {docKey: true} — received documents (checklist in intake settings)
  interviewAt: date("interview_at"), testScore: integer("test_score"),
  offerAt: timestamp("offer_at"), offerDeadline: date("offer_deadline"),
  decidedAt: timestamp("decided_at"), decisionReason: text("decision_reason"),
  stageAt: timestamp("stage_at").notNull().defaultNow(), // last stage move — powers "days in stage"
  admittedStudentId: text("admitted_student_id"), // forever-link to the created student file
  /** The exact offer text that was sent — viewable forever, editable on resend. */
  offerMessage: text("offer_message"),
}, (t) => [index("app_school").on(t.schoolId, t.status)]);

/** An applicant's guardians — as many as the family has. The offer goes to
 *  every phone (SMS) and every email on this list, and Admit carries each
 *  one onto the student file (reusing an existing guardian by phone). */
export const applicantGuardians = pgTable("applicant_guardians", {
  id: text("id").primaryKey(), schoolId: sid(),
  applicantId: text("applicant_id").notNull().references(() => applicants.id, { onDelete: "cascade" }),
  name: text("name").notNull(), phone: text("phone").notNull(),
  email: text("email"), relation: text("relation").notNull().default("parent"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("apg_applicant").on(t.applicantId)]);

/** Dated, signed notes on an applicant — the paper margin of the file. */
export const applicantNotes = pgTable("applicant_notes", {
  id: text("id").primaryKey(), schoolId: sid(),
  applicantId: text("applicant_id").notNull().references(() => applicants.id, { onDelete: "cascade" }),
  body: text("body").notNull(), byName: text("by_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("apn_applicant").on(t.applicantId)]);

/** Analytics snapshots — one JSON blob per school per day, so dashboards
 *  read a precomputed document instead of scanning live tables. The first
 *  admin visit of the day (or "Refresh now") computes it. */
export const analyticsSnapshots = pgTable("analytics_snapshots", {
  schoolId: sid(), day: date("day").notNull(),
  termId: text("term_id"),
  data: text("data").notNull(), // JSON — see modules/analytics/compute.ts
  computedAt: timestamp("computed_at").notNull().defaultNow(),
}, (t) => [index("ans_school_day").on(t.schoolId, t.day)]);

// library
export const books = pgTable("books", {
  id: text("id").primaryKey(), schoolId: sid(),
  title: text("title").notNull(), author: text("author"),
  copies: integer("copies").notNull().default(1),
}, (t) => [index("books_school").on(t.schoolId)]);

export const loans = pgTable("loans", {
  id: text("id").primaryKey(), schoolId: sid(),
  bookId: text("book_id").notNull(), studentId: text("student_id").notNull(),
  loanedAt: date("loaned_at").notNull(), returnedAt: date("returned_at"),
}, (t) => [index("loans_school").on(t.schoolId, t.returnedAt)]);

// transport
export const routes = pgTable("routes", {
  id: text("id").primaryKey(), schoolId: sid(),
  name: text("name").notNull(), driverName: text("driver_name"), driverPhone: text("driver_phone"),
}, (t) => [index("routes_school").on(t.schoolId)]);

export const routeStudents = pgTable("route_students", {
  routeId: text("route_id").notNull(), studentId: text("student_id").notNull(), schoolId: sid(),
}, (t) => [index("rs_school").on(t.schoolId, t.routeId)]);

// inventory
export const inventoryItems = pgTable("inventory_items", {
  id: text("id").primaryKey(), schoolId: sid(),
  name: text("name").notNull(), quantity: integer("quantity").notNull().default(0),
  location: text("location"),
}, (t) => [index("inv_items_school").on(t.schoolId)]);

// hr
export const leaveRequests = pgTable("leave_requests", {
  id: text("id").primaryKey(), schoolId: sid(),
  staffId: text("staff_id").notNull(),
  fromDate: date("from_date").notNull(), toDate: date("to_date").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending|approved|declined
}, (t) => [index("leave_school").on(t.schoolId, t.status)]);

/* Remote signing — "sign on your phone". A short-lived, single-use token
 * bridges the PC (shows a QR code) and the phone (draws the signature or
 * photographs the stamp). The token IS the credential for the public
 * /sign/<token> page, so it is long, random, expiring and one-shot. */
export const signTokens = pgTable("sign_tokens", {
  id: text("id").primaryKey(), // the token itself — 32 bytes of randomness
  schoolId: sid(),
  slot: text("slot").notNull(), // headSigKey | adminSigKey | stampKey
  createdBy: text("created_by").notNull(), // admin user id
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
}, (t) => [index("signtok_school").on(t.schoolId)]);
