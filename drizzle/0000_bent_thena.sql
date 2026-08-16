CREATE TYPE "public"."school_status" AS ENUM('trial', 'active', 'past_due', 'suspended', 'expired', 'archived');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."switch_mode" AS ENUM('on', 'off');--> statement-breakpoint
CREATE TABLE "plans" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"module_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"student_cap" integer,
	"storage_cap_mb" integer DEFAULT 2048 NOT NULL,
	"price_per_term_pesewas" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"school_id" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_modules" (
	"school_id" text NOT NULL,
	"module_key" text NOT NULL,
	"mode" "switch_mode" NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "school_status" DEFAULT 'trial' NOT NULL,
	"plan_key" text DEFAULT 'trial' NOT NULL,
	"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"student_cap" integer DEFAULT 50 NOT NULL,
	"storage_cap_mb" integer DEFAULT 2048 NOT NULL,
	"trial_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "schools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"plan_key" text NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"paystack_customer_code" text,
	"paystack_subscription_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'parent' NOT NULL,
	"school_id" text,
	"username" text,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "school_modules" ADD CONSTRAINT "school_modules_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_audit_school_idx" ON "platform_audit_logs" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "school_modules_pk" ON "school_modules" USING btree ("school_id","module_key");--> statement-breakpoint
CREATE INDEX "subscriptions_school_idx" ON "subscriptions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_school_idx" ON "user" USING btree ("school_id");