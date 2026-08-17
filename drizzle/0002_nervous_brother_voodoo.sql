CREATE TABLE "assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"term_id" text NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"kind" text DEFAULT 'ca' NOT NULL,
	"title" text NOT NULL,
	"max_score" integer DEFAULT 100 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"class_id" text NOT NULL,
	"term_id" text NOT NULL,
	"date" date NOT NULL,
	"status" text DEFAULT 'present' NOT NULL,
	"marked_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grading_schemes" (
	"school_id" text PRIMARY KEY NOT NULL,
	"ca_weight" integer DEFAULT 50 NOT NULL,
	"exam_weight" integer DEFAULT 50 NOT NULL,
	"bands" jsonb DEFAULT '[{"min":80,"grade":"1","remark":"Excellent"},{"min":70,"grade":"2","remark":"Very Good"},{"min":60,"grade":"3","remark":"Good"},{"min":55,"grade":"4","remark":"Credit"},{"min":50,"grade":"5","remark":"Average"},{"min":40,"grade":"6","remark":"Below Average"},{"min":35,"grade":"7","remark":"Pass"},{"min":30,"grade":"8","remark":"Weak Pass"},{"min":0,"grade":"9","remark":"Fail"}]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"term_id" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"data" jsonb NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"assessment_id" text NOT NULL,
	"student_id" text NOT NULL,
	"school_id" text NOT NULL,
	"score" integer NOT NULL,
	"entered_by" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_schemes" ADD CONSTRAINT "grading_schemes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assess_school_term" ON "assessments" USING btree ("school_id","term_id","class_id","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "att_unique" ON "attendance_records" USING btree ("student_id","date");--> statement-breakpoint
CREATE INDEX "att_school_class_date" ON "attendance_records" USING btree ("school_id","class_id","date");--> statement-breakpoint
CREATE INDEX "att_school_student_term" ON "attendance_records" USING btree ("school_id","student_id","term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_student_term" ON "report_cards" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_pk" ON "scores" USING btree ("assessment_id","student_id");--> statement-breakpoint
CREATE INDEX "scores_school_student" ON "scores" USING btree ("school_id","student_id");