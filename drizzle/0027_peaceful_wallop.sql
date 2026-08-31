CREATE TABLE "sign_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"slot" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sign_tokens" ADD CONSTRAINT "sign_tokens_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signtok_school" ON "sign_tokens" USING btree ("school_id");