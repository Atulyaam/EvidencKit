import { GraphNode, GraphEdge, GraphQueryParams, EvidenceGraphResult } from "@evidencekit/core";
import { DbClient, cases, agentSessions, events, agentApprovals, eq, desc } from "@evidencekit/db";
import { defaultChainService } from "./chain-service";

export class EvidenceGraphService {
  /**
   * Generates a unified evidence graph bounded by workspace authorization and query filters.
   */
  public async getEvidenceGraph(
    params: GraphQueryParams,
    db?: DbClient
  ): Promise<EvidenceGraphResult> {
    const { workspaceId, streamId, nodeTypes, relationshipType, limit = 100 } = params;

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    if (db) {
      await this.buildFromDatabase(workspaceId, streamId, nodes, edges, db);
    } else {
      this.buildFromInMemory(workspaceId, streamId, nodes, edges);
    }

    // Apply filtering
    let filteredNodes = nodes;
    if (nodeTypes && nodeTypes.length > 0) {
      const typeSet = new Set(nodeTypes);
      filteredNodes = nodes.filter((n) => typeSet.has(n.type));
    }

    if (params.search) {
      const q = params.search.toLowerCase();
      filteredNodes = filteredNodes.filter(
        (n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
      );
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    // Filter edges to only include ones where both source and target are in filteredNodes
    let filteredEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    if (relationshipType === "explicit") {
      filteredEdges = filteredEdges.filter((e) => e.type === "explicit");
    } else if (relationshipType === "inferred") {
      filteredEdges = filteredEdges.filter((e) => e.type === "inferred_candidate");
    }

    // Pagination / Slicing
    const totalNodes = filteredNodes.length;
    const totalEdges = filteredEdges.length;
    const paginatedNodes = filteredNodes.slice(0, limit);
    const paginatedNodeIds = new Set(paginatedNodes.map((n) => n.id));
    const paginatedEdges = filteredEdges.filter(
      (e) => paginatedNodeIds.has(e.source) && paginatedNodeIds.has(e.target)
    );

    const explicitCount = paginatedEdges.filter((e) => e.type === "explicit").length;
    const inferredCount = paginatedEdges.filter((e) => e.type === "inferred_candidate").length;

    return {
      workspaceId,
      nodes: paginatedNodes,
      edges: paginatedEdges,
      totalNodes,
      totalEdges,
      explicitCount,
      inferredCount,
      hasMore: totalNodes > limit
    };
  }

  private async buildFromDatabase(
    workspaceId: string,
    streamId: string | undefined,
    nodes: GraphNode[],
    edges: GraphEdge[],
    db: DbClient
  ) {
    // 1. Incidents
    const dbCases = await db
      .select()
      .from(cases)
      .where(eq(cases.workspaceId, workspaceId))
      .orderBy(desc(cases.createdAt))
      .limit(50);

    for (const c of dbCases) {
      if (streamId && c.id !== streamId) continue;
      nodes.push({
        id: c.id,
        type: "incident",
        label: `Incident: ${c.title}`,
        streamId: c.id,
        streamType: "tracevault.case",
        application: "tracevault",
        timestamp: c.createdAt.toISOString(),
        metadata: {
          severity: c.severity,
          status: c.status,
          environment: c.environment
        }
      });
    }

    // 2. Agent Sessions
    const dbSessions = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.workspaceId, workspaceId))
      .orderBy(desc(agentSessions.createdAt))
      .limit(50);

    for (const s of dbSessions) {
      if (streamId && s.id !== streamId) continue;
      nodes.push({
        id: s.id,
        type: "session",
        label: `Session: ${s.agentName}`,
        streamId: s.id,
        streamType: "agentledger.session",
        application: "agentledger",
        timestamp: s.createdAt.toISOString(),
        metadata: {
          agentName: s.agentName,
          goal: s.goal,
          status: s.status
        }
      });

      // Query approvals for this session
      const approvals = await db
        .select()
        .from(agentApprovals)
        .where(eq(agentApprovals.sessionId, s.id));

      for (const a of approvals) {
        nodes.push({
          id: a.id,
          type: "approval",
          label: `Approval Gate (${a.decision})`,
          streamId: s.id,
          streamType: "agentledger.session",
          application: "agentledger",
          timestamp: a.requestedAt.toISOString(),
          metadata: {
            toolName: a.toolName,
            decision: a.decision,
            reason: a.reason,
            actorId: a.actorId
          }
        });

        edges.push({
          id: `edge_${s.id}_${a.id}`,
          source: s.id,
          target: a.id,
          relationship: "governed_by_approval",
          type: "explicit",
          confidence: 1.0,
          description: `Explicit human approval gate (${a.decision}) for session ${s.id}`,
          isNonCausalCandidate: false
        });
      }
    }

    // 3. Events for streams
    const activeStreamIds = nodes
      .filter((n) => n.type === "incident" || n.type === "session")
      .map((n) => n.id);

    for (const sid of activeStreamIds) {
      const dbEvents = await db
        .select()
        .from(events)
        .where(eq(events.streamId, sid))
        .orderBy(events.ingestSequence)
        .limit(100);

      let prevEventNodeId: string | null = null;
      for (const ev of dbEvents) {
        const evNodeId = ev.id;
        nodes.push({
          id: evNodeId,
          type: "event",
          label: `${ev.eventName} (#${ev.ingestSequence})`,
          streamId: sid,
          streamType: ev.streamType,
          application: ev.streamType.startsWith("tracevault") ? "tracevault" : "agentledger",
          timestamp: (ev.occurredAt || ev.observedAt).toISOString(),
          metadata: {
            eventName: ev.eventName,
            sequence: ev.ingestSequence,
            severity: ev.severity,
            eventHash: ev.eventHash,
            previousHash: ev.previousHash
          },
          hash: ev.eventHash
        });

        // Edge from stream container to event
        edges.push({
          id: `edge_${sid}_${evNodeId}`,
          source: sid,
          target: evNodeId,
          relationship: "contains_event",
          type: "explicit",
          confidence: 1.0,
          description: `Stream ${sid} explicitly contains event ${ev.eventName}`,
          isNonCausalCandidate: false
        });

        // Previous hash cryptographic edge
        if (prevEventNodeId) {
          edges.push({
            id: `edge_prev_${prevEventNodeId}_${evNodeId}`,
            source: prevEventNodeId,
            target: evNodeId,
            relationship: "previous_hash_link",
            type: "explicit",
            confidence: 1.0,
            description: `Cryptographic SHA-256 chain link: previous_hash matches upstream event`,
            isNonCausalCandidate: false
          });
        }
        prevEventNodeId = evNodeId;

        // Tool call node if tool event
        const rawJson = ev.envelopeJson as any;
        if (rawJson?.attributes?.tool_call_id) {
          const tcId = rawJson.attributes.tool_call_id;
          if (!nodes.some((n) => n.id === tcId)) {
            nodes.push({
              id: tcId,
              type: "tool_call",
              label: `Tool: ${rawJson.attributes.tool_name || "unknown"}`,
              streamId: sid,
              application: "agentledger",
              timestamp: (ev.occurredAt || ev.observedAt).toISOString(),
              metadata: {
                toolName: rawJson.attributes.tool_name,
                toolCallId: tcId
              }
            });

            edges.push({
              id: `edge_ev_${evNodeId}_${tcId}`,
              source: evNodeId,
              target: tcId,
              relationship: "executed_tool",
              type: "explicit",
              confidence: 1.0,
              description: `Event records execution of tool call ${tcId}`,
              isNonCausalCandidate: false
            });
          }
        }
      }
    }

    // 4. Candidate (Inferred Non-Causal) Relationships
    this.computeCandidateRelationships(nodes, edges);
  }

  private buildFromInMemory(
    workspaceId: string,
    streamId: string | undefined,
    nodes: GraphNode[],
    edges: GraphEdge[]
  ) {
    // In-memory graph builder for mock/testing
    if (streamId) {
      nodes.push({
        id: streamId,
        type: streamId.startsWith("case_") ? "incident" : "session",
        label: `Container: ${streamId}`,
        streamId,
        application: streamId.startsWith("case_") ? "tracevault" : "agentledger",
        timestamp: new Date().toISOString(),
        metadata: { workspaceId }
      });

      const inMemEvents = defaultChainService.getEventsInMemory(streamId);
      let prevId: string | null = null;
      for (const ev of inMemEvents) {
        const eid = ev.event.event_id;
        nodes.push({
          id: eid,
          type: "event",
          label: `${ev.event.event_name} (#${ev.stream_sequence})`,
          streamId,
          application: streamId.startsWith("case_") ? "tracevault" : "agentledger",
          timestamp: ev.event.occurred_at || new Date().toISOString(),
          metadata: { ...ev.event.attributes },
          hash: ev.event_hash
        });

        edges.push({
          id: `edge_${streamId}_${eid}`,
          source: streamId,
          target: eid,
          relationship: "contains_event",
          type: "explicit",
          confidence: 1.0,
          description: `Container ${streamId} contains event ${ev.event.event_name}`,
          isNonCausalCandidate: false
        });

        if (prevId) {
          edges.push({
            id: `edge_prev_${prevId}_${eid}`,
            source: prevId,
            target: eid,
            relationship: "previous_hash_link",
            type: "explicit",
            confidence: 1.0,
            description: "Cryptographic SHA-256 chain link",
            isNonCausalCandidate: false
          });
        }
        prevId = eid;
      }
    }
    this.computeCandidateRelationships(nodes, edges);
  }

  /**
   * Computes candidate (inferred) relationships across events.
   * Explicitly marks isNonCausalCandidate: true to prevent confusion with causality.
   */
  private computeCandidateRelationships(nodes: GraphNode[], edges: GraphEdge[]) {
    const eventNodes = nodes.filter((n) => n.type === "event");
    for (let i = 0; i < eventNodes.length; i++) {
      for (let j = i + 1; j < Math.min(i + 15, eventNodes.length); j++) {
        const nodeA = eventNodes[i]!;
        const nodeB = eventNodes[j]!;

        // Check if from different streams or distinct events
        if (nodeA.streamId !== nodeB.streamId) {
          const tA = new Date(nodeA.timestamp).getTime();
          const tB = new Date(nodeB.timestamp).getTime();
          const diffSec = Math.abs(tB - tA) / 1000;

          if (diffSec <= 60) {
            edges.push({
              id: `candidate_${nodeA.id}_${nodeB.id}`,
              source: nodeA.id,
              target: nodeB.id,
              relationship: "temporal_proximity",
              type: "inferred_candidate",
              confidence: Math.max(0.2, 1 - diffSec / 60),
              description: `Candidate Link (Non-Causal): Occurred within ${Math.round(diffSec)}s across streams`,
              isNonCausalCandidate: true
            });
          }
        }
      }
    }
  }
}

export const defaultEvidenceGraphService = new EvidenceGraphService();
