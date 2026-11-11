CREATE TABLE IF NOT EXISTS "policies" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"version" varchar(64) NOT NULL,
	"workspace_id" varchar(128) NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"default_decision" varchar(64) DEFAULT 'REQUIRE_APPROVAL' NOT NULL,
	"rules" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policies" ADD CONSTRAINT "policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policies_workspace_idx" ON "policies" USING btree ("workspace_id");

