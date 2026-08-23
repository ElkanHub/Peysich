CREATE TABLE "holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "holiday_unique" ON "holidays" USING btree ("school_id","date");