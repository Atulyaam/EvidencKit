import { z } from "zod";

export const GraphNodeTypeSchema = z.enum([
  "incident",
  "session",
  "event",
  "tool_call",
  "approval",
  "artifact",
  "receipt"
]);
export type GraphNodeType = z.infer<typeof GraphNodeTypeSchema>;

export const GraphRelationshipTypeSchema = z.enum(["explicit", "inferred_candidate"]);
export type GraphRelationshipType = z.infer<typeof GraphRelationshipTypeSchema>;

export const GraphNodeSchema = z.object({
  id: z.string(),
  type: GraphNodeTypeSchema,
  label: z.string(),
  streamId: z.string().optional(),
  streamType: z.string().optional(),
  application: z.enum(["tracevault", "agentledger", "evidencekit"]),
  timestamp: z.string(),
  metadata: z.record(z.unknown()),
  hash: z.string().optional()
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  relationship: z.string(), // e.g. "contains_event", "previous_hash_link", "governed_by_approval"
  type: GraphRelationshipTypeSchema, // "explicit" | "inferred_candidate"
  confidence: z.number().min(0).max(1).default(1.0),
  description: z.string(),
  isNonCausalCandidate: z.boolean().default(false)
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const GraphQueryParamsSchema = z.object({
  workspaceId: z.string(),
  streamId: z.string().optional(),
  nodeTypes: z.array(GraphNodeTypeSchema).optional(),
  relationshipType: z.enum(["all", "explicit", "inferred"]).default("all"),
  search: z.string().optional(),
  limit: z.number().min(1).max(500).default(100),
  cursor: z.string().optional()
});
export type GraphQueryParams = z.input<typeof GraphQueryParamsSchema>;
export type GraphQueryParamsOutput = z.infer<typeof GraphQueryParamsSchema>;

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
export type EvidenceGraphResult = z.infer<typeof EvidenceGraphResultSchema>;
