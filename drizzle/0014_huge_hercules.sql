CREATE TABLE "teaching_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "staff_no" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "staff_type" text DEFAULT 'teaching' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "designation" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "dob" date;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "nationality" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "id_number" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "emergency_name" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "emergency_phone" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "employment_type" text DEFAULT 'full_time' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "joined_on" date;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "probation_end" date;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "qualification" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "institution" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "license_no" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "competencies" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "bank_branch" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "account_no" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "ssnit_no" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "tin_no" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "salary_pesewas" integer;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "onboarding_step" integer;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "exit_date" date;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "exit_note" text;--> statement-breakpoint
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_teacher_id_staff_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ta_class_subject" ON "teaching_assignments" USING btree ("class_id","subject_id");--> statement-breakpoint
CREATE INDEX "ta_school_teacher" ON "teaching_assignments" USING btree ("school_id","teacher_id");--> statement-breakpoint
UPDATE "staff" SET "staff_type" = CASE WHEN "staff_role" = 'teacher' THEN 'teaching' ELSE 'admin' END;
