CREATE TABLE "staff_nudges" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"kind" text DEFAULT 'attendance' NOT NULL,
	"ref_id" text,
	"message" text NOT NULL,
	"sent_by" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_nudges" ADD CONSTRAINT "staff_nudges_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_nudges" ADD CONSTRAINT "staff_nudges_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nudges_staff" ON "staff_nudges" USING btree ("staff_id","sent_at");