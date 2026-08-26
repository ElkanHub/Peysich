CREATE TABLE "admin_access" (
	"user_id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"tabs" text NOT NULL,
	"fee_actions" text DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_counters" (
	"school_id" text NOT NULL,
	"key" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"term_id" text NOT NULL,
	"amount_pesewas" integer NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"invoiced" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"label" text NOT NULL,
	"amount_pesewas" integer NOT NULL,
	"source" text DEFAULT 'item' NOT NULL,
	"fee_type_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_items" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"fee_type_id" text NOT NULL,
	"term_id" text NOT NULL,
	"level_id" text NOT NULL,
	"class_id" text,
	"amount_pesewas" integer NOT NULL,
	"due_date" date
);
--> statement-breakpoint
CREATE TABLE "fee_types" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"recurring" boolean DEFAULT true NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"kind" text NOT NULL,
	"debit_pesewas" integer DEFAULT 0 NOT NULL,
	"credit_pesewas" integer DEFAULT 0 NOT NULL,
	"ref_id" text,
	"memo" text NOT NULL,
	"created_by" text,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarships" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'percent' NOT NULL,
	"value" integer NOT NULL,
	"fee_type_id" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_scholarships" (
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"scholarship_id" text NOT NULL,
	"note" text,
	"granted_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fee_payments" DROP CONSTRAINT "fee_payments_invoice_id_fee_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "transport_rider" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN "invoice_no" text;--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "receipt_no" text;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "voided_by" text;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "voided_at" timestamp;--> statement-breakpoint
ALTER TABLE "admin_access" ADD CONSTRAINT "admin_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_access" ADD CONSTRAINT "admin_access_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_counters" ADD CONSTRAINT "doc_counters_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_invoice_lines" ADD CONSTRAINT "fee_invoice_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_invoice_lines" ADD CONSTRAINT "fee_invoice_lines_invoice_id_fee_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."fee_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_fee_type_id_fee_types_id_fk" FOREIGN KEY ("fee_type_id") REFERENCES "public"."fee_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_types" ADD CONSTRAINT "fee_types_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_scholarships" ADD CONSTRAINT "student_scholarships_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_scholarships" ADD CONSTRAINT "student_scholarships_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_access_school" ON "admin_access" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_counter_pk" ON "doc_counters" USING btree ("school_id","key");--> statement-breakpoint
CREATE INDEX "fee_adj_student_term" ON "fee_adjustments" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX "inv_lines_invoice" ON "fee_invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "fee_items_school_term" ON "fee_items" USING btree ("school_id","term_id","level_id");--> statement-breakpoint
CREATE INDEX "fee_types_school" ON "fee_types" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "ledger_student" ON "ledger_entries" USING btree ("student_id","at");--> statement-breakpoint
CREATE INDEX "ledger_school" ON "ledger_entries" USING btree ("school_id","at");--> statement-breakpoint
CREATE INDEX "scholarships_school" ON "scholarships" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stu_schol_pk" ON "student_scholarships" USING btree ("student_id","scholarship_id");--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_invoice_id_fee_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."fee_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- ── data migration: legacy fee_structures → typed catalog ──
-- one fee_type per distinct (school, name), kind guessed from the name
INSERT INTO fee_types (id, school_id, name, kind, recurring, optional, sort_order)
SELECT 'ft-' || md5(school_id || '·' || name), school_id, name,
  CASE
    WHEN name ILIKE '%tuition%' THEN 'tuition'
    WHEN name ILIKE '%feed%' OR name ILIKE '%canteen%' THEN 'feeding'
    WHEN name ILIKE '%transport%' OR name ILIKE '%bus%' THEN 'transport'
    WHEN name ILIKE '%exam%' THEN 'exam'
    WHEN name ILIKE '%pta%' THEN 'pta'
    WHEN name ILIKE '%admis%' THEN 'admission'
    ELSE 'other'
  END,
  true,
  (name ILIKE '%transport%' OR name ILIKE '%bus%'),
  0
FROM (SELECT DISTINCT school_id, name FROM fee_structures) s
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO fee_items (id, school_id, fee_type_id, term_id, level_id, amount_pesewas)
SELECT 'fi-' || fs.id, fs.school_id, 'ft-' || md5(fs.school_id || '·' || fs.name),
       fs.term_id, fs.level_id, fs.amount_pesewas
FROM fee_structures fs
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- ── data migration: existing invoices & payments → the append-only ledger ──
INSERT INTO ledger_entries (id, school_id, student_id, kind, debit_pesewas, credit_pesewas, ref_id, memo, at)
SELECT 'led-inv-' || i.id, i.school_id, i.student_id, 'invoice', i.total_pesewas, 0, i.id,
       'Invoice for term (migrated)', i.created_at
FROM fee_invoices i
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO ledger_entries (id, school_id, student_id, kind, debit_pesewas, credit_pesewas, ref_id, memo, at)
SELECT 'led-pay-' || p.id, p.school_id, i.student_id, 'payment', 0, p.amount_pesewas, p.id,
       'Payment received (migrated) · ' || p.method, p.created_at
FROM fee_payments p JOIN fee_invoices i ON i.id = p.invoice_id
ON CONFLICT DO NOTHING;
