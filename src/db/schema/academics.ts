import { pgTable, text, timestamp, integer, boolean, date, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./platform";

const sid = () => text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" });

// ── attendance module ──
export const attendanceRecords = pgTable("attendance_records", {
  id: text("id").primaryKey(), schoolId: sid(),
  studentId: text("student_id").notNull(),
  classId: text("class_id").notNull(),
  termId: text("term_id").notNull(),
  date: date("date").notNull(),
  status: text("status").notNull().default("present"), // present|absent|late
  markedBy: text("marked_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("att_unique").on(t.studentId, t.date),
  index("att_school_class_date").on(t.schoolId, t.classId, t.date),
  index("att_school_student_term").on(t.schoolId, t.studentId, t.termId),
]);

// ── assessment module ──
export const gradingSchemes = pgTable("grading_schemes", {
  schoolId: text("school_id").primaryKey().references(() => schools.id, { onDelete: "cascade" }),
  caWeight: integer("ca_weight").notNull().default(50),   // %
  examWeight: integer("exam_weight").notNull().default(50),
  bands: jsonb("bands").$type<{ min: number; grade: string; remark: string }[]>().notNull()
    .default([
      { min: 80, grade: "1", remark: "Excellent" }, { min: 70, grade: "2", remark: "Very Good" },
      { min: 60, grade: "3", remark: "Good" }, { min: 55, grade: "4", remark: "Credit" },
      { min: 50, grade: "5", remark: "Average" }, { min: 40, grade: "6", remark: "Below Average" },
      { min: 35, grade: "7", remark: "Pass" }, { min: 30, grade: "8", remark: "Weak Pass" },
      { min: 0, grade: "9", remark: "Fail" },
    ]),
});

export const assessments = pgTable("assessments", {
  id: text("id").primaryKey(), schoolId: sid(),
  termId: text("term_id").notNull(),
  classId: text("class_id").notNull(),
  subjectId: text("subject_id").notNull(),
  kind: text("kind").notNull().default("ca"), // ca|exam
  title: text("title").notNull(), // "CA 1", "End of Term Exam"
  maxScore: integer("max_score").notNull().default(100),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("assess_school_term").on(t.schoolId, t.termId, t.classId, t.subjectId)]);

export const scores = pgTable("scores", {
  assessmentId: text("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull(),
  schoolId: sid(),
  score: integer("score").notNull(),
  enteredBy: text("entered_by").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("scores_pk").on(t.assessmentId, t.studentId),
  index("scores_school_student").on(t.schoolId, t.studentId),
]);

export const reportCards = pgTable("report_cards", {
  id: text("id").primaryKey(), schoolId: sid(),
  studentId: text("student_id").notNull(),
  termId: text("term_id").notNull(),
  published: boolean("published").notNull().default(false),
  /** Snapshot: subject rows computed at publish time (immutable record). */
  data: jsonb("data").$type<{
    subjects: { name: string; ca: number; exam: number; total: number; grade: string; remark: string }[];
    attendance: { present: number; total: number };
    skills?: { domain: string; rating: string }[];
    teacherRemark?: string;
  }>().notNull(),
  publishedAt: timestamp("published_at"),
}, (t) => [uniqueIndex("report_student_term").on(t.studentId, t.termId)]);

// ── preschool skills-based assessment (doc 05: a mode, not a module) ──
export const skillDomains = pgTable("skill_domains", {
  id: text("id").primaryKey(), schoolId: sid(),
  name: text("name").notNull(), sortOrder: integer("sort_order").notNull().default(0),
});

export const skillRatings = pgTable("skill_ratings", {
  schoolId: sid(),
  studentId: text("student_id").notNull(),
  termId: text("term_id").notNull(),
  domainId: text("domain_id").notNull().references(() => skillDomains.id, { onDelete: "cascade" }),
  rating: text("rating").notNull(), // emerging | developing | secure
  ratedBy: text("rated_by").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("skill_pk").on(t.studentId, t.termId, t.domainId)]);
