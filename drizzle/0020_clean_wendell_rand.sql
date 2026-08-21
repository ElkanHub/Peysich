CREATE TABLE "announcement_acks" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"announcement_id" text NOT NULL,
	"user_id" text NOT NULL,
	"acked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcement_acks" ADD CONSTRAINT "announcement_acks_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ack_unique" ON "announcement_acks" USING btree ("announcement_id","user_id");
--> statement-breakpoint
DROP TRIGGER IF EXISTS bump_pulse ON announcement_acks;
--> statement-breakpoint
CREATE TRIGGER bump_pulse AFTER INSERT OR UPDATE OR DELETE ON announcement_acks FOR EACH ROW EXECUTE FUNCTION peysich_bump_pulse();
