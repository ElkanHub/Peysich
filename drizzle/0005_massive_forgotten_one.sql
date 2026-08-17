CREATE TABLE "applicants" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"guardian_name" text,
	"guardian_phone" text NOT NULL,
	"level_id" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"copies" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"location" text
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"book_id" text NOT NULL,
	"student_id" text NOT NULL,
	"loaned_at" date NOT NULL,
	"returned_at" date
);
--> statement-breakpoint
CREATE TABLE "route_students" (
	"route_id" text NOT NULL,
	"student_id" text NOT NULL,
	"school_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"driver_name" text,
	"driver_phone" text
);
--> statement-breakpoint
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_students" ADD CONSTRAINT "route_students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_school" ON "applicants" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "books_school" ON "books" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "inv_items_school" ON "inventory_items" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "leave_school" ON "leave_requests" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "loans_school" ON "loans" USING btree ("school_id","returned_at");--> statement-breakpoint
CREATE INDEX "rs_school" ON "route_students" USING btree ("school_id","route_id");--> statement-breakpoint
CREATE INDEX "routes_school" ON "routes" USING btree ("school_id");