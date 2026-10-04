ALTER TABLE "pending_checkouts" ALTER COLUMN "cycle" SET DEFAULT 'term';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "cycle" SET DEFAULT 'term';--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "install_fee_pesewas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "stage_auto" text DEFAULT 'signed_up' NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "installation" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "install_fee_pesewas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Billing by the term and the academic year. The three public plans take the new prices
-- and their installation fees; any other plan (a school's own) was priced per month, and
-- a term is four months of cover.
UPDATE "plans" SET "price_per_term_pesewas" = 50000, "price_per_year_pesewas" = 125000, "install_fee_pesewas" = 50000 WHERE "key" = 'starter';--> statement-breakpoint
UPDATE "plans" SET "price_per_term_pesewas" = 100000, "price_per_year_pesewas" = 250000, "install_fee_pesewas" = 100000 WHERE "key" = 'standard';--> statement-breakpoint
UPDATE "plans" SET "price_per_term_pesewas" = 200000, "price_per_year_pesewas" = 500000, "install_fee_pesewas" = 150000 WHERE "key" = 'premium';--> statement-breakpoint
UPDATE "plans" SET "price_per_term_pesewas" = "price_per_month_pesewas" * 4
  WHERE "key" NOT IN ('trial', 'starter', 'standard', 'premium') AND "price_per_term_pesewas" = 0;--> statement-breakpoint
-- Open plan requests carried a monthly estimate; the console now reads it as per term.
UPDATE "plan_requests" SET "estimate_pesewas" = "estimate_pesewas" * 4 WHERE "kind" = 'custom';--> statement-breakpoint
-- The board starts from where the sweep last put each school.
UPDATE "schools" SET "stage_auto" = "stage";
