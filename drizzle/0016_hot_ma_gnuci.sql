CREATE TABLE "school_pulse" (
	"school_id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE OR REPLACE FUNCTION peysich_bump_pulse() RETURNS trigger AS $fn$
DECLARE sid text;
BEGIN
  IF TG_OP = 'DELETE' THEN sid := OLD.school_id; ELSE sid := NEW.school_id; END IF;
  IF sid IS NOT NULL THEN
    INSERT INTO school_pulse (school_id, version, updated_at) VALUES (sid, 1, now())
    ON CONFLICT (school_id) DO UPDATE SET version = school_pulse.version + 1, updated_at = now();
  END IF;
  RETURN NULL;
END $fn$ LANGUAGE plpgsql;
--> statement-breakpoint
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'attendance_records','staff_nudges','announcements','events','assignments','submissions',
    'scores','skill_ratings','report_cards','lessons','students','guardians','student_guardians',
    'enrollments','staff','teaching_assignments','classes','subjects','levels','rooms',
    'academic_years','terms','fee_structures','fee_invoices','fee_payments',
    'student_files','student_items','applicants'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS bump_pulse ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER bump_pulse AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION peysich_bump_pulse()', t);
  END LOOP;
END $do$;
