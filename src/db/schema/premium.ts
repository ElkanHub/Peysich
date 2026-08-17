import { pgTable, text, timestamp, integer, date, index } from "drizzle-orm/pg-core";
import { schools } from "./platform";

const sid = () => text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" });

// admissions
export const applicants = pgTable("applicants", {
  id: text("id").primaryKey(), schoolId: sid(),
  name: text("name").notNull(), guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone").notNull(),
  levelId: text("level_id").notNull(),
  status: text("status").notNull().default("new"), // new|interview|admitted|rejected
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("app_school").on(t.schoolId, t.status)]);

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
