import {
  pgTable, text, timestamp, boolean, integer, jsonb, pgEnum, uniqueIndex, index,
} from "drizzle-orm/pg-core";

// ── Platform plane: no school_id here; these tables sit ABOVE tenants ──

export const schoolStatus = pgEnum("school_status", [
  "trial", "active", "past_due", "suspended", "expired", "archived",
]);

export const schools = pgTable("schools", {
  id: text("id").primaryKey(), // uuidv7, generated in app code
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // subdomain: {slug}.peysich.com
  status: schoolStatus("status").notNull().default("trial"),
  planKey: text("plan_key").notNull().default("trial"),
  // Branding for all deliverables (report cards, invoices, emails, SMS)
  branding: jsonb("branding").$type<{
    logoUrl?: string; motto?: string; address?: string; phone?: string;
    email?: string; primaryColor?: string; smsSenderId?: string;
    signatureLines?: string[];
  }>().notNull().default({}),
  // General settings: levels offered, attendance mode, student logins, etc.
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  studentCap: integer("student_cap").notNull().default(50), // trial default
  storageCapMb: integer("storage_cap_mb").notNull().default(2048),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const plans = pgTable("plans", {
  key: text("key").primaryKey(), // starter | standard | premium | custom:<school>
  name: text("name").notNull(),
  moduleKeys: jsonb("module_keys").$type<string[]>().notNull().default([]),
  studentCap: integer("student_cap"), // null = unlimited
  storageCapMb: integer("storage_cap_mb").notNull().default(2048),
  pricePerTermPesewas: integer("price_per_term_pesewas").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

// Switchboard: per-school override of the plan's module set
export const switchMode = pgEnum("switch_mode", ["on", "off"]);
export const schoolModules = pgTable("school_modules", {
  schoolId: text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  moduleKey: text("module_key").notNull(),
  mode: switchMode("mode").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("school_modules_pk").on(t.schoolId, t.moduleKey)]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "active", "past_due", "canceled",
]);
export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  planKey: text("plan_key").notNull(),
  status: subscriptionStatus("status").notNull().default("active"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  paystackCustomerCode: text("paystack_customer_code"),
  paystackSubscriptionCode: text("paystack_subscription_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("subscriptions_school_idx").on(t.schoolId)]);

// Platform-plane audit: every switchboard flip, suspension, impersonation
export const platformAuditLogs = pgTable("platform_audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(), // e.g. "switchboard.set", "school.suspend"
  schoolId: text("school_id"),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("platform_audit_school_idx").on(t.schoolId, t.createdAt)]);
