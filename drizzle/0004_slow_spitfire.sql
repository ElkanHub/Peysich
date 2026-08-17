CREATE TYPE "public"."weekday" AS ENUM('mon', 'tue', 'wed', 'thu', 'fri');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('unpaid', 'part_paid', 'paid');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"class_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"title" text NOT NULL,
	"instructions" text,
	"due_date" date NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"class_id" text,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "fee_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"term_id" text NOT NULL,
	"total_pesewas" integer NOT NULL,
	"paid_pesewas" integer DEFAULT 0 NOT NULL,
	"status" "invoice_status" DEFAULT 'unpaid' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"amount_pesewas" integer NOT NULL,
	"method" text DEFAULT 'momo' NOT NULL,
	"reference" text NOT NULL,
	"recorded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fee_payments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "fee_structures" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"term_id" text NOT NULL,
	"level_id" text NOT NULL,
	"name" text NOT NULL,
	"amount_pesewas" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"teacher_id" text,
	"day" "weekday" NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_log" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"to" text NOT NULL,
	"body" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"cost_pesewas" integer DEFAULT 9 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"assignment_id" text NOT NULL,
	"student_id" text NOT NULL,
	"school_id" text NOT NULL,
	"file_url" text,
	"note" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"mark" integer,
	"feedback" text
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_invoice_id_fee_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."fee_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_log" ADD CONSTRAINT "sms_log_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ann_school" ON "announcements" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "asg_school_class" ON "assignments" USING btree ("school_id","class_id","due_date");--> statement-breakpoint
CREATE INDEX "events_school" ON "events" USING btree ("school_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inv_student_term" ON "fee_invoices" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX "inv_school_status" ON "fee_invoices" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "pay_school" ON "fee_payments" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "fees_school_term" ON "fee_structures" USING btree ("school_id","term_id","level_id");--> statement-breakpoint
CREATE INDEX "lessons_school_class" ON "lessons" USING btree ("school_id","class_id","day");--> statement-breakpoint
CREATE INDEX "lessons_school_teacher" ON "lessons" USING btree ("school_id","teacher_id","day");--> statement-breakpoint
CREATE INDEX "sms_school" ON "sms_log" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subm_pk" ON "submissions" USING btree ("assignment_id","student_id");