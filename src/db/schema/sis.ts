import { pgTable, text, timestamp, boolean, integer, date, jsonb, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
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
  roomId: text("room_id"), // home room
}, (t) => [index("classes_school").on(t.schoolId, t.levelId)]);

export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(), schoolId: sid(),
  name: text("name").notNull(),
}, (t) => [uniqueIndex("subjects_school_name").on(t.schoolId, t.name)]);

export const staff = pgTable("staff", {
  id: text("id").primaryKey(), schoolId: sid(),
  userId: text("user_id"), // links to auth user once invited
  name: text("name").notNull(), email: text("email"), phone: text("phone"),
  staffRole: text("staff_role").notNull().default("teacher"), // portal role: teacher|admin|bursar
  // ── the Staff File (onboarding wizard fills these, stage by stage) ──
  staffNo: text("staff_no"), // employee id, STF0001…
  staffType: text("staff_type").notNull().default("teaching"), // teaching|admin|support
  designation: text("designation"), // "Lead Teacher", "Head Cook", "Driver"
  dob: date("dob"), nationality: text("nationality"),
  idNumber: text("id_number"), address: text("address"),
  emergencyName: text("emergency_name"), emergencyPhone: text("emergency_phone"),
  photoUrl: text("photo_url"), // R2 key
  employmentType: text("employment_type").notNull().default("full_time"), // full_time|part_time|contract
  joinedOn: date("joined_on"), probationEnd: date("probation_end"),
  // teachers only
  qualification: text("qualification"), institution: text("institution"),
  licenseNo: text("license_no"), // GES / NTC registration
  competencies: jsonb("competencies").$type<string[]>().notNull().default([]), // subject names
  // payroll & statutory — rendered for admins only
  bankName: text("bank_name"), bankBranch: text("bank_branch"),
  accountNo: text("account_no"), ssnitNo: text("ssnit_no"), tinNo: text("tin_no"),
  salaryPesewas: integer("salary_pesewas"),
  /** Onboarding wizard progress: 1..6 while a draft, null once completed. */
  onboardingStep: integer("onboarding_step"),
  status: text("status").notNull().default("active"), // draft|active|left
  exitDate: date("exit_date"), exitNote: text("exit_note"),
  deletedAt: timestamp("deleted_at"),
}, (t) => [index("staff_school").on(t.schoolId)]);

/** Subject teaching: teacher → class + subject. The source of truth for who
 *  teaches what — the timetable and score-sheet access derive from it.
 *  (Class-teacher / form-master lives on classes.classTeacherId.) */
export const teachingAssignments = pgTable("teaching_assignments", {
  id: text("id").primaryKey(), schoolId: sid(),
  teacherId: text("teacher_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  subjectId: text("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
}, (t) => [
  uniqueIndex("ta_class_subject").on(t.classId, t.subjectId), // one teacher per class-subject
  index("ta_school_teacher").on(t.schoolId, t.teacherId),
]);

export const sexEnum = pgEnum("sex", ["male", "female"]);
export const students = pgTable("students", {
  id: text("id").primaryKey(), schoolId: sid(),
  admissionNo: text("admission_no").notNull(),
  firstName: text("first_name").notNull(), lastName: text("last_name").notNull(),
  otherNames: text("other_names"), sex: sexEnum("sex").notNull(),
  dob: date("dob"), photoUrl: text("photo_url"), // R2 key of profile photo
  idNumber: text("id_number"), // national ID / birth-certificate number
  placeOfBirth: text("place_of_birth"), nationality: text("nationality"),
  hometown: text("hometown"), religion: text("religion"), address: text("address"),
  previousSchool: text("previous_school"),
  bloodGroup: text("blood_group"), medicalNotes: text("medical_notes"), // allergies, conditions
  emergencyName: text("emergency_name"), emergencyPhone: text("emergency_phone"),
  /** How/where this family pays fees (MoMo number, bank branch, who pays, when) */
  paymentNote: text("payment_note"),
  boarding: boolean("boarding").notNull().default(false), // day student vs boarder
  admittedOn: date("admitted_on"), // official admission date (createdAt = record creation)
  /** Admission wizard progress: 1..7 while a draft, null once admission completes. */
  admissionStep: integer("admission_step"),
  classId: text("class_id"), // current class (denormalized; history in enrollments)
  userId: text("user_id"), // optional JHS login
  status: text("status").notNull().default("active"), // draft|active|alumni|left
  /** Offboarding record — the exit is a status transition, NEVER a delete:
   *  history (attendance, reports, ledger) stays intact under this id. */
  exitDate: date("exit_date"),
  exitReason: text("exit_reason"), // transferred|withdrawn|completed|expelled|other
  exitDestination: text("exit_destination"), // school transferred to (for the TC)
  exitNote: text("exit_note"),
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
  occupation: text("occupation"),
  /** How the school actually reaches this person. "phone" (default — a call
   *  works for everyone) | "sms" | "portal". Not-portal guardians get a
   *  visible "phone them" flag so the desk never waits on an unread email. */
  contactPref: text("contact_pref").notNull().default("phone"),
  note: text("note"), // office memory: "call after 4pm — works night shift"
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

/** Physical spaces: classrooms, science lab, ICT lab, library, hall… */
export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(), schoolId: sid(),
  name: text("name").notNull(), // "Science Lab", "Room 4"
  kind: text("kind").notNull().default("classroom"), // classroom|science_lab|ict_lab|library|hall|office|other
  capacity: integer("capacity"),
  notes: text("notes"),
}, (t) => [index("rooms_school").on(t.schoolId)]);

/** The student file: digital documents (R2) linked to the student. */
export const studentFiles = pgTable("student_files", {
  id: text("id").primaryKey(), schoolId: sid(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("other"), // photo|birth_certificate|immunization|previous_report|id_document|other
  title: text("title").notNull(),
  fileKey: text("file_key").notNull(), // R2 object key
  note: text("note"),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("sfiles_student").on(t.studentId)]);

/** Physical custody register: originals handed to the office (no digital copy
 *  needed) — WHAT was received, from WHOM, and WHERE it is kept. */
export const studentItems = pgTable("student_items", {
  id: text("id").primaryKey(), schoolId: sid(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  itemName: text("item_name").notNull(), // "Birth certificate (original)"
  location: text("location").notNull(), // "Office cabinet A · folder 12"
  receivedFrom: text("received_from"), // "Mother — Akosua Mensah"
  receivedBy: text("received_by").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  returnedAt: timestamp("returned_at"),
  returnedTo: text("returned_to"),
  note: text("note"),
}, (t) => [index("sitems_student").on(t.studentId)]);
