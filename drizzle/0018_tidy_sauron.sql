CREATE TABLE "assessment_components" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"section" text NOT NULL,
	"name" text NOT NULL,
	"weight" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_exam" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"term_id" text NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"component_id" text NOT NULL,
	"student_id" text NOT NULL,
	"raw" real NOT NULL,
	"entered_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_publications" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"term_id" text NOT NULL,
	"component_id" text NOT NULL,
	"published_by" text NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_sheets" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"term_id" text NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"component_id" text NOT NULL,
	"out_of" integer DEFAULT 100 NOT NULL,
	"submitted" boolean DEFAULT false NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "section_config" ADD COLUMN "skill_scale" jsonb DEFAULT '["Emerging","Developing","Secure"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_components" ADD CONSTRAINT "assessment_components_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_scores" ADD CONSTRAINT "component_scores_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_scores" ADD CONSTRAINT "component_scores_component_id_assessment_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."assessment_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_publications" ADD CONSTRAINT "score_publications_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_publications" ADD CONSTRAINT "score_publications_component_id_assessment_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."assessment_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_sheets" ADD CONSTRAINT "score_sheets_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_sheets" ADD CONSTRAINT "score_sheets_component_id_assessment_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."assessment_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acomp_unique" ON "assessment_components" USING btree ("school_id","section","name");--> statement-breakpoint
CREATE UNIQUE INDEX "cscore_unique" ON "component_scores" USING btree ("student_id","term_id","subject_id","component_id");--> statement-breakpoint
CREATE INDEX "cscore_school_term" ON "component_scores" USING btree ("school_id","term_id","class_id","subject_id");--> statement-breakpoint
CREATE INDEX "cscore_student" ON "component_scores" USING btree ("school_id","student_id","term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spub_unique" ON "score_publications" USING btree ("term_id","component_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sheet_unique" ON "score_sheets" USING btree ("term_id","class_id","subject_id","component_id");
--> statement-breakpoint
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assessment_components','score_sheets','component_scores','score_publications'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS bump_pulse ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER bump_pulse AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION peysich_bump_pulse()', t);
  END LOOP;
END $do$;
