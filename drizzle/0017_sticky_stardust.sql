CREATE TABLE "class_subject_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"action" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"section" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'teaching' NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_config" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"section" text NOT NULL,
	"mode" text DEFAULT 'subject_teaching' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"section" text NOT NULL,
	"subject_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"day" "weekday" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_subject_overrides" ADD CONSTRAINT "class_subject_overrides_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_slots" ADD CONSTRAINT "period_slots_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_config" ADD CONSTRAINT "section_config_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_subjects" ADD CONSTRAINT "section_subjects_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_slot_id_period_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."period_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "csov_unique" ON "class_subject_overrides" USING btree ("class_id","subject_id");--> statement-breakpoint
CREATE INDEX "pslots_school_section" ON "period_slots" USING btree ("school_id","section","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "secconf_school_section" ON "section_config" USING btree ("school_id","section");--> statement-breakpoint
CREATE UNIQUE INDEX "secsub_unique" ON "section_subjects" USING btree ("school_id","section","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tte_class_day_slot" ON "timetable_entries" USING btree ("class_id","day","slot_id");--> statement-breakpoint
CREATE INDEX "tte_school_class" ON "timetable_entries" USING btree ("school_id","class_id");--> statement-breakpoint
CREATE INDEX "tte_school_subject" ON "timetable_entries" USING btree ("school_id","subject_id");
--> statement-breakpoint
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'section_config','period_slots','section_subjects','class_subject_overrides','timetable_entries'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS bump_pulse ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER bump_pulse AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION peysich_bump_pulse()', t);
  END LOOP;
END $do$;
