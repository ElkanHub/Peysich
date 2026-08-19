ALTER TABLE "students" ADD COLUMN "boarding" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "admitted_on" date;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "admission_step" integer;