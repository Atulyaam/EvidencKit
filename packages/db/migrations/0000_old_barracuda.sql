CREATE TABLE "agent_approvals" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"tool_call_id" varchar(128) NOT NULL,
	"decision" varchar(64) NOT NULL,
	"actor_id" varchar(128) NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(128) NOT NULL,
	"agent_name" varchar(128) NOT NULL,
	"goal" text NOT NULL,
	"status" varchar(64) DEFAULT 'running' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(128) NOT NULL,
	"title" varchar(256) NOT NULL,
	"environment" varchar(64) DEFAULT 'production' NOT NULL,
	"status" varchar(64) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chain_heads" (
	"stream_id" varchar(128) PRIMARY KEY NOT NULL,
	"last_sequence" integer NOT NULL,
	"head_hash" varchar(64) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_evidence_refs" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"event_id" varchar(128) NOT NULL,
	"artifact_id" varchar(128) NOT NULL,
	"locator_type" varchar(64) NOT NULL,
	"locator" varchar(256) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"stream_id" varchar(128) NOT NULL,
	"stream_type" varchar(64) NOT NULL,
	"event_name" varchar(128) NOT NULL,
	"occurred_at" timestamp with time zone,
	"observed_at" timestamp with time zone NOT NULL,
	"ingest_sequence" integer NOT NULL,
	"severity" varchar(32) DEFAULT 'info' NOT NULL,
	"envelope_json" jsonb NOT NULL,
	"previous_hash" varchar(64) NOT NULL,
	"event_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_artifacts" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"stream_id" varchar(128) NOT NULL,
	"filename" varchar(256) NOT NULL,
	"media_type" varchar(128) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"storage_key" varchar(512),
	"retained_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"stream_id" varchar(128) NOT NULL,
	"manifest_hash" varchar(64) NOT NULL,
	"signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"provider_subject" varchar(256),
	"email" varchar(256),
	"role" varchar(64) DEFAULT 'reviewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_evidence_refs" ADD CONSTRAINT "event_evidence_refs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_evidence_refs" ADD CONSTRAINT "event_evidence_refs_artifact_id_evidence_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."evidence_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_approvals_session_idx" ON "agent_approvals" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_workspace_idx" ON "agent_sessions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "cases_workspace_idx" ON "cases" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "event_evidence_refs_event_idx" ON "event_evidence_refs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_evidence_refs_artifact_idx" ON "event_evidence_refs" USING btree ("artifact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_stream_seq_unique" ON "events" USING btree ("stream_id","ingest_sequence");--> statement-breakpoint
CREATE INDEX "events_stream_occurred_idx" ON "events" USING btree ("stream_id","occurred_at");--> statement-breakpoint
CREATE INDEX "events_stream_name_idx" ON "events" USING btree ("stream_id","event_name");--> statement-breakpoint
CREATE INDEX "events_stream_severity_idx" ON "events" USING btree ("stream_id","severity");--> statement-breakpoint
CREATE INDEX "evidence_artifacts_stream_idx" ON "evidence_artifacts" USING btree ("stream_id");--> statement-breakpoint
CREATE INDEX "exports_stream_idx" ON "exports" USING btree ("stream_id");