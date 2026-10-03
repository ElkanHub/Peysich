CREATE TABLE "price_settings" (
	"channel" text PRIMARY KEY NOT NULL,
	"price_pesewas" integer NOT NULL,
	"cost_pesewas" integer NOT NULL,
	"effective_from" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"kind" text NOT NULL,
	"pesewas" integer NOT NULL,
	"reference" text,
	"note" text,
	"price_pesewas" integer,
	"channel" text,
	"outbox_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_ledger_school_idx" ON "wallet_ledger" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_reference_idx" ON "wallet_ledger" USING btree ("reference");