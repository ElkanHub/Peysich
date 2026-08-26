import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { schools } from "./platform";

// Better Auth core tables (field names per better-auth drizzle adapter),
// extended with our multi-tenant fields (role, schoolId, username).

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Peysich fields
  role: text("role").notNull().default("parent"), // platform_admin | admin | teacher | student | parent
  schoolId: text("school_id").references(() => schools.id, { onDelete: "cascade" }), // null = platform staff
  username: text("username").unique(), // school-issued logins (students/parents without email)
  displayUsername: text("display_username"), // required by better-auth username plugin
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("user_school_idx").on(t.schoolId)]);

/** Scoped access for admin-role logins (Team & access). NO row = full admin.
 *  A row lists the tabs this member may open and, for the money module,
 *  which fee actions they may perform — how a "cashier" exists without
 *  being a fifth role. */
export const adminAccess = pgTable("admin_access", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  schoolId: text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  tabs: text("tabs").notNull(), // JSON array of tab keys, e.g. ["fees"]
  feeActions: text("fee_actions").notNull().default("{}"), // {record,voidPay,catalog,generate}
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("admin_access_school").on(t.schoolId)]);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("session_user_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(), // "credential" | "google"
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("account_user_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
