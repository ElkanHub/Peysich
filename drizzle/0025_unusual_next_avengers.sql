CREATE TABLE "staff_teaching" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"kind" text NOT NULL,
	"class_id" text,
	"subject_id" text,
	"level_ids" text,
	"role" text DEFAULT 'main' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "form_master_id" text;--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD COLUMN "teacher_id" text;--> statement-breakpoint
ALTER TABLE "staff_teaching" ADD CONSTRAINT "staff_teaching_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_teaching" ADD CONSTRAINT "staff_teaching_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_teaching" ADD CONSTRAINT "staff_teaching_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_teaching" ADD CONSTRAINT "staff_teaching_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stch_school_staff" ON "staff_teaching" USING btree ("school_id","staff_id");
-- data migration: profile-based teaching
-- 1) every existing per-cell allocation becomes a SUBJECT PROFILE row
--    (teacher × subject, levels = the levels of the classes they covered);
--    the original rows stay behind as per-class pins, so today's derivation
--    is preserved exactly even where two teachers share a subject.
INSERT INTO "staff_teaching" ("id", "school_id", "staff_id", "kind", "subject_id", "level_ids", "role")
SELECT 'st-' || md5(ta.teacher_id || ':' || ta.subject_id),
       ta.school_id, ta.teacher_id, 'subject', ta.subject_id,
       (SELECT json_agg(DISTINCT c.level_id)::text
          FROM "teaching_assignments" ta2
          JOIN "classes" c ON c.id = ta2.class_id
         WHERE ta2.teacher_id = ta.teacher_id AND ta2.subject_id = ta.subject_id),
       'main'
FROM (SELECT DISTINCT teacher_id, subject_id, school_id FROM "teaching_assignments") ta
ON CONFLICT DO NOTHING;
-- 2) the responsible teacher a class already had becomes its form master,
--    so registers and nudges keep pointing at the same person.
UPDATE "classes" SET "form_master_id" = "class_teacher_id"
WHERE "form_master_id" IS NULL AND "class_teacher_id" IS NOT NULL;
