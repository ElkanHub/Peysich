CREATE TABLE "plan_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"school_name" text,
	"module_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"size_band" text,
	"estimate_pesewas" integer DEFAULT 0 NOT NULL,
	"cycle" text DEFAULT 'monthly' NOT NULL,
	"reason" text,
	"message" text,
	"source" text DEFAULT 'app' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "school_id" text;--> statement-breakpoint
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_requests_status_idx" ON "plan_requests" USING btree ("status","created_at");