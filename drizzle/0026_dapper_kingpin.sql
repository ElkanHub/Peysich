CREATE TABLE "applicant_guardians" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"applicant_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"relation" text DEFAULT 'parent' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "offer_message" text;--> statement-breakpoint
ALTER TABLE "applicant_guardians" ADD CONSTRAINT "applicant_guardians_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_guardians" ADD CONSTRAINT "applicant_guardians_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apg_applicant" ON "applicant_guardians" USING btree ("applicant_id");
-- backfill: the single guardian every applicant already carries becomes
-- the first row of their guardian list
INSERT INTO "applicant_guardians" ("id", "school_id", "applicant_id", "name", "phone", "relation", "sort_order")
SELECT 'apg-' || md5(a.id), a.school_id, a.id,
       COALESCE(a.guardian_name, 'Guardian'), a.guardian_phone, 'parent', 0
FROM "applicants" a
WHERE a.guardian_phone IS NOT NULL AND a.guardian_phone <> ''
ON CONFLICT DO NOTHING;
