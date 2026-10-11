CREATE TABLE "platform_access" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tabs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "school_id" text;--> statement-breakpoint
ALTER TABLE "platform_broadcasts" ADD COLUMN "kind" text DEFAULT 'notice' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_broadcasts" ADD COLUMN "roles" jsonb DEFAULT '["admin"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_broadcasts" ADD COLUMN "school_ids" jsonb;--> statement-breakpoint
ALTER TABLE "platform_broadcasts" ADD COLUMN "cta_label" text;--> statement-breakpoint
ALTER TABLE "platform_broadcasts" ADD COLUMN "cta_url" text;--> statement-breakpoint
ALTER TABLE "platform_broadcasts" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "platform_broadcasts" ADD COLUMN "starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "platform_broadcasts" ADD COLUMN "ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "platform_broadcasts" ADD COLUMN "every_hours" integer DEFAULT 24 NOT NULL;