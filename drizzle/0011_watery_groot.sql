ALTER TABLE "pending_checkouts" ADD COLUMN "cycle" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "price_per_month_pesewas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "price_per_year_pesewas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cycle" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "guardians" ADD COLUMN "occupation" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "id_number" text;--> statement-breakpoint
UPDATE "plans" SET
  "price_per_month_pesewas" = CASE WHEN "price_per_month_pesewas" > 0 THEN "price_per_month_pesewas"
    WHEN "key" = 'starter' THEN 9900 WHEN "key" = 'standard' THEN 24900 WHEN "key" = 'premium' THEN 49900
    ELSE "price_per_term_pesewas" / 4 END,
  "price_per_year_pesewas" = CASE WHEN "price_per_year_pesewas" > 0 THEN "price_per_year_pesewas"
    WHEN "key" = 'starter' THEN 99000 WHEN "key" = 'standard' THEN 249000 WHEN "key" = 'premium' THEN 499000
    ELSE ("price_per_term_pesewas" / 4) * 10 END;
