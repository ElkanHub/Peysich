ALTER TABLE "academic_years" ADD COLUMN "closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "terms" ADD COLUMN "opened_at" timestamp;--> statement-breakpoint
ALTER TABLE "terms" ADD COLUMN "closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "terms" ADD COLUMN "closed_by" text;--> statement-breakpoint
ALTER TABLE "terms" ADD COLUMN "close_summary" jsonb;--> statement-breakpoint
-- Every term that has already begun counts as opened; none is closed by the
-- migration — the admin closes each one from Home (docs/11 §4).
UPDATE "terms" SET "opened_at" = ("starts_at"::timestamp) WHERE "starts_at" <= CURRENT_DATE AND "opened_at" IS NULL;--> statement-breakpoint
-- Of the terms that already ran, the latest stays live for the admin to close; every
-- earlier one is closed as it ended, so Archives is full from day one.
UPDATE "terms" t SET "closed_at" = ("ends_at"::timestamp), "closed_by" = 'migration', "scores_locked" = true
  WHERE t."ends_at" < CURRENT_DATE AND t."closed_at" IS NULL
    AND t."starts_at" < (SELECT max(u."starts_at") FROM "terms" u WHERE u."school_id" = t."school_id" AND u."starts_at" <= CURRENT_DATE);
