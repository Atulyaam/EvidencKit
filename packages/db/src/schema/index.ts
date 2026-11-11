import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index
} from "drizzle-orm/pg-core";

export const workspaces = pgTable("workspaces", {
  id: varchar("id", { length: 128 }).primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const users = pgTable("users", {
  id: varchar("id", { length: 128 }).primaryKey(),
  providerSubject: varchar("provider_subject", { length: 256 }),
  email: varchar("email", { length: 256 }),
  role: varchar("role", { length: 64 }).notNull().default("reviewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const cases = pgTable(
  "cases",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 128 })
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description"),
    severity: varchar("severity", { length: 32 }).notNull().default("high"),
    environment: varchar("environment", { length: 64 }).notNull().default("production"),
    status: varchar("status", { length: 64 }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdx: index("cases_workspace_idx").on(table.workspaceId),
    statusIdx: index("cases_status_idx").on(table.status),
    severityIdx: index("cases_severity_idx").on(table.severity)
  })
);

export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 128 })
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    agentName: varchar("agent_name", { length: 128 }).notNull(),
    goal: text("goal").notNull(),
    status: varchar("status", { length: 64 }).notNull().default("running"),
    metadata: jsonb("metadata"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdx: index("agent_sessions_workspace_idx").on(table.workspaceId),
    statusIdx: index("agent_sessions_status_idx").on(table.status)
  })
);

export const evidenceArtifacts = pgTable(
  "evidence_artifacts",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    streamId: varchar("stream_id", { length: 128 }).notNull(),
    filename: varchar("filename", { length: 256 }).notNull(),
    mediaType: varchar("media_type", { length: 128 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    storageKey: varchar("storage_key", { length: 512 }),
    retainedAt: timestamp("retained_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    streamIdx: index("evidence_artifacts_stream_idx").on(table.streamId)
  })
);

export const events = pgTable(
  "events",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    streamId: varchar("stream_id", { length: 128 }).notNull(),
    streamType: varchar("stream_type", { length: 64 }).notNull(),
    eventName: varchar("event_name", { length: 128 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    ingestSequence: integer("ingest_sequence").notNull(),
    severity: varchar("severity", { length: 32 }).notNull().default("info"),
    envelopeJson: jsonb("envelope_json").notNull(),
    previousHash: varchar("previous_hash", { length: 64 }).notNull(),
    eventHash: varchar("event_hash", { length: 64 }).notNull()
  },
  (table) => ({
    streamSeqUnique: uniqueIndex("events_stream_seq_unique").on(
      table.streamId,
      table.ingestSequence
    ),
    streamOccurredIdx: index("events_stream_occurred_idx").on(table.streamId, table.occurredAt),
    streamNameIdx: index("events_stream_name_idx").on(table.streamId, table.eventName),
    streamSeverityIdx: index("events_stream_severity_idx").on(table.streamId, table.severity)
  })
);

export const chainHeads = pgTable("chain_heads", {
  streamId: varchar("stream_id", { length: 128 }).primaryKey(),
  lastSequence: integer("last_sequence").notNull(),
  headHash: varchar("head_hash", { length: 64 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const eventEvidenceRefs = pgTable(
  "event_evidence_refs",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    eventId: varchar("event_id", { length: 128 })
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    artifactId: varchar("artifact_id", { length: 128 })
      .references(() => evidenceArtifacts.id, { onDelete: "cascade" })
      .notNull(),
    locatorType: varchar("locator_type", { length: 64 }).notNull(),
    locator: varchar("locator", { length: 256 }).notNull()
  },
  (table) => ({
    eventIdx: index("event_evidence_refs_event_idx").on(table.eventId),
    artifactIdx: index("event_evidence_refs_artifact_idx").on(table.artifactId)
  })
);

export const agentApprovals = pgTable(
  "agent_approvals",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    sessionId: varchar("session_id", { length: 128 })
      .references(() => agentSessions.id, { onDelete: "cascade" })
      .notNull(),
    toolCallId: varchar("tool_call_id", { length: 128 }).notNull(),
    toolName: varchar("tool_name", { length: 128 }).notNull().default("unknown"),
    operation: text("operation"),
    arguments: jsonb("arguments"),
    decision: varchar("decision", { length: 64 }).notNull().default("pending"),
    actorId: varchar("actor_id", { length: 128 }).notNull().default("pending"),
    reason: text("reason"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true })
  },
  (table) => ({
    sessionIdx: index("agent_approvals_session_idx").on(table.sessionId),
    decisionIdx: index("agent_approvals_decision_idx").on(table.decision)
  })
);

export const exports = pgTable(
  "exports",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    streamId: varchar("stream_id", { length: 128 }).notNull(),
    manifestHash: varchar("manifest_hash", { length: 64 }).notNull(),
    signature: text("signature"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    streamIdx: index("exports_stream_idx").on(table.streamId)
  })
);

export const policies = pgTable(
  "policies",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    version: varchar("version", { length: 64 }).notNull(),
    workspaceId: varchar("workspace_id", { length: 128 })
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    description: text("description"),
    defaultDecision: varchar("default_decision", { length: 64 })
      .notNull()
      .default("REQUIRE_APPROVAL"),
    rules: jsonb("rules").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdx: index("policies_workspace_idx").on(table.workspaceId)
  })
);
