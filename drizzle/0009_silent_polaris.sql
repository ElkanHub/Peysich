CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'classroom' NOT NULL,
	"capacity" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "student_files" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"file_key" text NOT NULL,
	"note" text,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_items" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"item_name" text NOT NULL,
	"location" text NOT NULL,
	"received_from" text,
	"received_by" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"returned_at" timestamp,
	"returned_to" text,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "room_id" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "place_of_birth" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "nationality" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "hometown" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "religion" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "previous_school" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "blood_group" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "medical_notes" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "emergency_name" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "emergency_phone" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "payment_note" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_files" ADD CONSTRAINT "student_files_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_files" ADD CONSTRAINT "student_files_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_items" ADD CONSTRAINT "student_items_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_items" ADD CONSTRAINT "student_items_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rooms_school" ON "rooms" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "sfiles_student" ON "student_files" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "sitems_student" ON "student_items" USING btree ("student_id");