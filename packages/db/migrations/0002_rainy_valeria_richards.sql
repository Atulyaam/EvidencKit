ALTER TABLE "agent_approvals" ALTER COLUMN "decision" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "agent_approvals" ALTER COLUMN "actor_id" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "agent_approvals" ALTER COLUMN "decided_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "agent_approvals" ALTER COLUMN "decided_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD COLUMN "tool_name" varchar(128) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD COLUMN "operation" text;--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD COLUMN "arguments" jsonb;--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "agent_approvals" ADD COLUMN "requested_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "agent_approvals_decision_idx" ON "agent_approvals" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "agent_sessions_status_idx" ON "agent_sessions" USING btree ("status");