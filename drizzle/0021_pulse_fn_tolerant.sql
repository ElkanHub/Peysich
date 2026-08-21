-- The live-update pulse trigger read NEW.school_id directly, which blows up on
-- tables without that column (student_guardians) — linking a guardian crashed.
-- Read the row as jsonb instead, and fall back to the student's school so
-- guardian-link changes still refresh parents' screens.
CREATE OR REPLACE FUNCTION peysich_bump_pulse() RETURNS trigger AS $fn$
DECLARE rec jsonb; sid text;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := to_jsonb(OLD); ELSE rec := to_jsonb(NEW); END IF;
  sid := rec->>'school_id';
  IF sid IS NULL AND rec ? 'student_id' THEN
    SELECT school_id INTO sid FROM students WHERE id = rec->>'student_id';
  END IF;
  IF sid IS NOT NULL THEN
    INSERT INTO school_pulse (school_id, version, updated_at) VALUES (sid, 1, now())
    ON CONFLICT (school_id) DO UPDATE SET version = school_pulse.version + 1, updated_at = now();
  END IF;
  RETURN NULL;
END $fn$ LANGUAGE plpgsql;
