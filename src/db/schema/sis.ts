import { pgTable, text, timestamp, boolean, integer, date, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { schools } from "./platform";

// ── Core SIS: every table carries school_id (tenant dimension) ──
const sid = () => text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" });

export const academicYears = pgTable("academic_years", {
  id: text("id").primaryKey(), schoolId: sid(),
  name: text("name").notNull(), // "2025/2026"
  startsAt: date("starts_at").notNull(), endsAt: date("ends_at").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
}, (t) => [index("ay_school").on(t.schoolId)]);

export const terms = pgTable("terms", {
  id: text("id").primaryKey(), schoolId: sid(),
  yearId: text("year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Term 1"
  startsAt: date("starts_at").notNull(), endsAt: date("ends_at").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  scoresLocked: boolean("scores_locked").notNull().default(false),
}, (t) => [index("terms_school").on(t.schoolId, t.yearId)]);

export const levels = pgTable("levels", {
  id: text("id").primaryKey(), schoolId: sid(),
  code: text("code").notNull(), // creche|nursery1|nursery2|kg1|kg2|b1..b9
  name: text("name").notNull(), sortOrder: integer("sort_order").notNull(),
  preschool: boolean("preschool").notNull().default(false), // skills-based reports
}, (t) => [uniqueIndex("levels_school_code").on(t.schoolId, t.code)]);

export const classes = pgTable("classes", {
  id: text("id").primaryKey(), schoolId: sid(),
  levelId: text("level_id").notNull().references(() => levels.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Basic 4 A"
  classTeacherId: text("class_teacher_id"),
}, (t) => [index("classes_school").on(t.schoolId, t.levelId)]);

export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(), schoolId: sid(),
  name: text("name").notNull(),
}, (t) => [uniqueIndex("subjects_school_name").on(t.schoolId, t.name)]);

export const staff = pgTable("staff", {
  id: text("id").primaryKey(), schoolId: sid(),
  userId: text("user_id"), // links to auth user once invited
  name: text("name").notNull(), email: text("email"), phone: text("phone"),
  staffRole: text("staff_role").notNull().default("teacher"), // teacher|admin|bursar
  deletedAt: timestamp("deleted_at"),
}, (t) => [index("staff_school").on(t.schoolId)]);

export const sexEnum = pgEnum("sex", ["male", "female"]);
export const students = pgTable("students", {
  id: text("id").primaryKey(), schoolId: sid(),
  admissionNo: text("admission_no").notNull(),
  firstName: text("first_name").notNull(), lastName: text("last_name").notNull(),
  otherNames: text("other_names"), sex: sexEnum("sex").notNull(),
  dob: date("dob"), photoUrl: text("photo_url"),
  classId: text("class_id"), // current class (denormalized; history in enrollments)
  userId: text("user_id"), // optional JHS login
  status: text("status").notNull().default("active"), // active|alumni|left
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("students_school_adm").on(t.schoolId, t.admissionNo),
  index("students_school_class").on(t.schoolId, t.classId),
  index("students_school_name").on(t.schoolId, t.lastName, t.firstName),
]);

export const guardians = pgTable("guardians", {
  id: text("id").primaryKey(), schoolId: sid(),
  userId: text("user_id"),
  name: text("name").notNull(), phone: text("phone").notNull(), email: text("email"),
  relation: text("relation").notNull().default("parent"),
}, (t) => [index("guardians_school_phone").on(t.schoolId, t.phone)]);

export const studentGuardians = pgTable("student_guardians", {
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  guardianId: text("guardian_id").notNull().references(() => guardians.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(true),
}, (t) => [uniqueIndex("sg_pk").on(t.studentId, t.guardianId)]);

export const enrollments = pgTable("enrollments", {
  id: text("id").primaryKey(), schoolId: sid(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  yearId: text("year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("enrolled"), // enrolled|promoted|repeated|graduated|left
}, (t) => [
  uniqueIndex("enroll_student_year").on(t.studentId, t.yearId),
  index("enroll_school_class").on(t.schoolId, t.yearId, t.classId),
]);
