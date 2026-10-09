CREATE TABLE "term_archives" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"term_id" text NOT NULL,
	"section" text NOT NULL,
	"title" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"built_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "term_archives" ADD CONSTRAINT "term_archives_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "term_archives_term_section" ON "term_archives" USING btree ("term_id","section");