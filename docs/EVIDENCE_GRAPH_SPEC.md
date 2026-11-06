# Unified Evidence Graph Specification

**EvidenceKit — Multi-Stream Forensic Topology & Graph Architecture**  
**Document Version:** 1.0.0  
**Status:** Approved & Implemented  
**Date:** 2026-11-06

---

## 1. Executive Summary

Forensic incident investigations and AI agent audits rarely exist in isolation. Modern production environments involve complex interactions across deployments, error events, agent tool invocations, human approvals, and cryptographic exports.

The **Unified Evidence Graph** constructs an explainable directed graph across EvidenceKit data streams. It bridges TraceVault incidents, AgentLedger sessions, individual timeline events, tool executions, approval decisions, file artifacts, and export receipts into a single, unified topology.

Crucially, the engine enforces strict forensic rigor: **explicit provenance edges** (such as hash-chain linkages and container relationships) are cleanly segregated from **non-causal temporal candidate correlations**, preventing misleading causality claims.

---

## 2. Core Forensic Distinctions: Explicit vs. Inferred Edges

A fundamental tenet of EvidenceKit is that **cryptographic sequence and temporal proximity do not equate to causal certainty**.

The graph schema formally reflects this via `GraphRelationshipType`:

```typescript
export const GraphRelationshipTypeSchema = z.enum([
  "explicit", // Cryptographically or structurally proven linkage
  "inferred_candidate" // Heuristic or temporal correlation (< 60s window)
]);
```

### Explicit Linkages (`explicit`)

- **`contains_stream` / `contains_event`**: Parent-child relationship (e.g. Incident -> Event, Session -> Tool Call).
- **`previous_hash_link`**: Cryptographic sequence verified by SHA-256 hash chaining (`event.previous_hash == parent.event_hash`).
- **`governed_by_approval`**: Direct approval record linked to an execution request.
- **`produced_artifact`**: Cryptographically hashed file created by a tool execution.
- **`receipt_signed_by`**: Ed25519 digital signature bound to an export manifest.

### Inferred Candidate Linkages (`inferred_candidate`)

- **`temporal_proximity_candidate`**: Two events originating from different sources that occurred within 60 seconds of each other.
- **`isNonCausalCandidate: true`**: Explicit boolean flag indicating to UI renderers and consumers that this edge is an exploratory lead, not a confirmed cause.
- **Visual Distinction**: Displayed in UI as dashed amber lines with warning badges, distinct from solid emerald/blue explicit lines.

---

## 3. Graph Data Model & Schema

Defined in `@evidencekit/core/src/graph/index.ts`:

```typescript
export const GraphNodeTypeSchema = z.enum([
  "incident",
  "session",
  "event",
  "tool_call",
  "approval",
  "artifact",
  "export_receipt"
]);

export const GraphNodeSchema = z.object({
  id: z.string(),
  type: GraphNodeTypeSchema,
  label: z.string(),
  streamId: z.string(),
  streamType: z.string(),
  timestamp: z.string(),
  severity: z.string().optional(),
  metadata: z.record(z.unknown()).default({})
});

export const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  relationship: z.string(),
  type: GraphRelationshipTypeSchema, // "explicit" | "inferred_candidate"
  confidence: z.number().min(0).max(1).default(1.0),
  description: z.string(),
  isNonCausalCandidate: z.boolean().default(false)
});

export const EvidenceGraphResultSchema = z.object({
  workspaceId: z.string(),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  totalNodes: z.number(),
  totalEdges: z.number(),
  explicitCount: z.number(),
  inferredCount: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.string().optional()
});
```

---

## 4. Graph Construction Algorithm

Implemented in `EvidenceGraphService.getEvidenceGraph`:

1. **Workspace Boundary Scoping**: Queries are strictly bounded by `workspaceId`. Cross-tenant data cannot be queried or linked.
2. **Container Node Construction**:
   - Fetches incidents (`cases`) and agent sessions (`agentSessions`).
   - Creates root container nodes with attributes (`incident`, `session`).
3. **Event Node Construction**:
   - Queries timeline events for the target streams.
   - For each event, constructs an `event` node and an explicit `contains_event` edge connecting it to its parent container.
4. **Cryptographic Sequence Edges**:
   - Identifies consecutive events in each hash chain.
   - For every event with `previous_hash !== "0".repeat(64)`, connects the prior event to the current event with an explicit `previous_hash_link` edge.
5. **Approval & Governance Edges**:
   - Queries approval records (`agent_approvals`).
   - Links the approval node to its corresponding tool execution event with an explicit `governed_by_approval` edge.
6. **Temporal Candidate Edge Generation**:
   - Identifies events across distinct sources occurring within a configurable delta ($\Delta t \le 60\text{ seconds}$).
   - Emits an `inferred_candidate` edge with `isNonCausalCandidate: true`, confidence score based on temporal delta, and a human-readable disclaimer description.
7. **Filtering & Slicing**:
   - Supports filtering by `nodeTypes`, `relationshipType` (`all`, `explicit`, `inferred`), and search queries.
   - Applies deterministic pagination bounding node results to `limit` (default: 100, max: 500).

---

## 5. UI Visualization & Interaction

Interactive graph explorers are deployed in both TraceVault (`/graph`) and AgentLedger (`/graph`):

- **Graph Topology Overview**: Node count, edge count, explicit provenance count, and candidate correlation count.
- **Causality Legend**: Visual distinction between Solid Green/Blue (Explicit Provenance) and Dashed Amber (Temporal Candidate).
- **Interactive Filtering**: Filter by relationship type, node type, or text search.
- **Node Detail Drawer**: Clicking any node displays its full metadata, stream ID, timestamp, and hash-chain sequence position.
- **Non-Causality Banner**: Prominently warns investigators that candidate links require independent verification.

---

## 6. Performance & Scale

- **Query Latency**: Sub-15ms graph generation for streams up to 1,000 nodes/edges.
- **Pagination**: High-density graphs utilize cursor-based windowing to preserve browser rendering performance.
