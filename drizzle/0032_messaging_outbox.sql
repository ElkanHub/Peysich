CREATE TABLE "contact_channels" (
	"owner_kind" text NOT NULL,
	"owner_id" text NOT NULL,
	"school_id" text NOT NULL,
	"whatsapp" text,
	"whatsapp_consent" boolean DEFAULT false NOT NULL,
	"telegram_chat_id" text,
	"linked_at" timestamp,
	CONSTRAINT "contact_channels_owner_kind_owner_id_pk" PRIMARY KEY("owner_kind","owner_id")
);
--> statement-breakpoint
CREATE TABLE "message_links" (
	"token" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"recipient_kind" text NOT NULL,
	"recipient_id" text NOT NULL,
	"opened_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"name" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"category" text,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"class_id" text,
	"student_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messaging_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text,
	"plane" text DEFAULT 'school' NOT NULL,
	"message_id" text,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"to" text NOT NULL,
	"body" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_id" text,
	"parts" integer DEFAULT 1 NOT NULL,
	"price_pesewas" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_try_at" timestamp DEFAULT now() NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_schedule" (
	"school_id" text NOT NULL,
	"event_key" text NOT NULL,
	"due_on" date NOT NULL,
	"sent_at" timestamp,
	"skipped" text,
	CONSTRAINT "platform_schedule_school_id_event_key_pk" PRIMARY KEY("school_id","event_key")
);
--> statement-breakpoint
CREATE TABLE "platform_timeline" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"event" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "stage" text DEFAULT 'signed_up' NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "stage_since" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "owner_phone" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "auto_messages_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_channels" ADD CONSTRAINT "contact_channels_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_links" ADD CONSTRAINT "message_links_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_schedule" ADD CONSTRAINT "platform_schedule_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_timeline" ADD CONSTRAINT "platform_timeline_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_channels_school_idx" ON "contact_channels" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_links_recipient_idx" ON "message_links" USING btree ("message_id","recipient_kind","recipient_id");--> statement-breakpoint
CREATE INDEX "messages_school_idx" ON "messages" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "outbox_school_idx" ON "outbox" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "outbox_queue_idx" ON "outbox" USING btree ("status","next_try_at");--> statement-breakpoint
CREATE INDEX "outbox_provider_idx" ON "outbox" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "platform_timeline_school_idx" ON "platform_timeline" USING btree ("school_id","created_at");--> statement-breakpoint
-- sms_log is read once into the outbox and then retired (docs/MESSAGING_BUILD_PLAN.md §2).
-- Old "queued" rows never left (no SMS key at the time): they come over as failed,
-- never as queued, so the worker cannot send a stale message.
INSERT INTO "outbox" ("id", "school_id", "plane", "kind", "channel", "to", "body", "status", "parts", "price_pesewas", "attempts", "error", "created_at", "sent_at")
SELECT "id", "school_id", 'school', "kind",
  CASE WHEN "kind" LIKE '%email' THEN 'email' ELSE 'sms' END,
  "to", "body",
  CASE WHEN "status" IN ('sent', 'held') THEN "status" ELSE 'failed' END,
  CASE WHEN "kind" LIKE '%email' OR length("body") <= 160 THEN 1 ELSE ceil(length("body") / 153.0)::int END,
  CASE WHEN "status" = 'sent' AND "kind" NOT LIKE '%email' THEN "cost_pesewas" ELSE 0 END,
  1,
  CASE WHEN "status" IN ('sent', 'held') THEN NULL ELSE 'Not sent: SMS was not switched on yet' END,
  "created_at",
  CASE WHEN "status" = 'sent' THEN "created_at" END
FROM "sms_log"
ON CONFLICT ("id") DO NOTHING;
