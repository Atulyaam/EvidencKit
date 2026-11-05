ALTER TABLE "cases" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "severity" varchar(32) DEFAULT 'high' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "cases_status_idx" ON "cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cases_severity_idx" ON "cases" USING btree ("severity");