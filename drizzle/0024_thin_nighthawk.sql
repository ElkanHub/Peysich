CREATE TABLE "analytics_snapshots" (
	"school_id" text NOT NULL,
	"day" date NOT NULL,
	"term_id" text,
	"data" text NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"applicant_id" text NOT NULL,
	"body" text NOT NULL,
	"by_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "dob" date;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "sex" text;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "prev_school" text;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "year_id" text;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "docs" text;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "interview_at" date;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "test_score" integer;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "offer_at" timestamp;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "offer_deadline" date;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "decided_at" timestamp;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "decision_reason" text;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "stage_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "admitted_student_id" text;--> statement-breakpoint
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_notes" ADD CONSTRAINT "applicant_notes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_notes" ADD CONSTRAINT "applicant_notes_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ans_school_day" ON "analytics_snapshots" USING btree ("school_id","day");--> statement-breakpoint
CREATE INDEX "apn_applicant" ON "applicant_notes" USING btree ("applicant_id");
-- data migration: old stage name "interview" becomes "screening"
UPDATE "applicants" SET "status" = 'screening' WHERE "status" = 'interview';
