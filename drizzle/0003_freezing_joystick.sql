CREATE TABLE "pending_checkouts" (
	"reference" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"plan_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
