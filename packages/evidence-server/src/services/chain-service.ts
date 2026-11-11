import {
  EvidenceEvent,
  ChainedEvent,
  VerificationResult,
  computeEventHash,
  verifyEventChain,
  INITIAL_PREVIOUS_HASH,
  TimelineQueryOptions,
  TimelineQueryResult,
  queryTimeline,
  createExportBundle,
  EvidenceExportBundle
} from "@evidencekit/core";
import {
  getDb,
  events,
  chainHeads,
  eventEvidenceRefs,
  DbClient,
  isDbConnectionError,
  assertInMemoryFallbackAllowed
} from "@evidencekit/db";
import { eq } from "drizzle-orm";

export class ChainService {
  private inMemoryStreams: Map<string, ChainedEvent[]> = new Map();
  private inMemoryHeads: Map<string, { lastSequence: number; headHash: string }> = new Map();

  /**
   * Appends an event to an in-memory stream (used for fast standalone tests and demo sandbox mode).
   */
  public appendInMemory(event: EvidenceEvent): ChainedEvent {
    const streamId = event.stream_id;
    const existing = this.inMemoryStreams.get(streamId) || [];
    const head = this.inMemoryHeads.get(streamId);

    const nextSequence = head ? head.lastSequence + 1 : 0;
    const previousHash = head ? head.headHash : INITIAL_PREVIOUS_HASH;
    const eventHash = computeEventHash(event, previousHash);

    const chained: ChainedEvent = {
      event,
      stream_sequence: nextSequence,
      previous_hash: previousHash,
      event_hash: eventHash
    };

    existing.push(chained);
    this.inMemoryStreams.set(streamId, existing);
    this.inMemoryHeads.set(streamId, { lastSequence: nextSequence, headHash: eventHash });

    return chained;
  }

  public getEventsInMemory(streamId: string): ChainedEvent[] {
    return this.inMemoryStreams.get(streamId) || [];
  }

  public verifyInMemory(streamId: string): VerificationResult {
    const streamEvents = this.getEventsInMemory(streamId);
    const head = this.inMemoryHeads.get(streamId);
    return verifyEventChain(streamEvents, head?.headHash);
  }

  public queryTimelineInMemory(
    streamId: string,
    options?: TimelineQueryOptions
  ): TimelineQueryResult {
    const streamEvents = this.getEventsInMemory(streamId);
    return queryTimeline(streamEvents, options);
  }

  public exportInMemory(streamId: string): EvidenceExportBundle {
    const streamEvents = this.getEventsInMemory(streamId);
    const streamType =
      streamEvents.length > 0 ? streamEvents[0]!.event.stream_type : "tracevault.case";
    return createExportBundle(streamId, streamType, streamEvents);
  }

  /**
   * Transactional atomic append against PostgreSQL using Drizzle ORM.
   * Acquires row lock on chain_heads for streamId inside a single transaction.
   */
  public async appendTransactional(event: EvidenceEvent, db?: DbClient): Promise<ChainedEvent> {
    const database = db || getDb();
    const streamId = event.stream_id;

    try {
      return await database.transaction(async (tx) => {
        // 1. Lock the stream head row for update
        const headRows = await tx
          .select()
          .from(chainHeads)
          .where(eq(chainHeads.streamId, streamId))
          .for("update");

        let nextSequence = 0;
        let previousHash = INITIAL_PREVIOUS_HASH;

        if (headRows.length > 0 && headRows[0]) {
          nextSequence = headRows[0].lastSequence + 1;
          previousHash = headRows[0].headHash;
        }

        // 2. Compute deterministic SHA-256 event hash
        const eventHash = computeEventHash(event, previousHash);

        // 3. Insert into events table
        await tx.insert(events).values({
          id: event.event_id,
          streamId: event.stream_id,
          streamType: event.stream_type,
          eventName: event.event_name,
          occurredAt: event.occurred_at ? new Date(event.occurred_at) : null,
          observedAt: new Date(event.observed_at),
          ingestSequence: nextSequence,
          severity: event.severity,
          envelopeJson: event,
          previousHash: previousHash,
          eventHash: eventHash
        });

        // 4. Update or insert chain head
        if (headRows.length > 0) {
          await tx
            .update(chainHeads)
            .set({
              lastSequence: nextSequence,
              headHash: eventHash,
              updatedAt: new Date()
            })
            .where(eq(chainHeads.streamId, streamId));
        } else {
          await tx.insert(chainHeads).values({
            streamId: streamId,
            lastSequence: nextSequence,
            headHash: eventHash,
            updatedAt: new Date()
          });
        }

        // 5. Insert evidence refs if present
        if (event.evidence_refs && event.evidence_refs.length > 0) {
          for (const ref of event.evidence_refs) {
            await tx.insert(eventEvidenceRefs).values({
              id: `${event.event_id}-${ref.artifact_id}-${ref.locator}`,
              eventId: event.event_id,
              artifactId: ref.artifact_id,
              locatorType: ref.locator_type,
              locator: ref.locator
            });
          }
        }

        return {
          event,
          stream_sequence: nextSequence,
          previous_hash: previousHash,
          event_hash: eventHash
        };
      });
    } catch (err: any) {
      if (isDbConnectionError(err)) {
        assertInMemoryFallbackAllowed("appendTransactional", err);
        return this.appendInMemory(event);
      }
      throw err;
    }
  }

  public async getEventsFromDb(streamId: string, db?: DbClient): Promise<ChainedEvent[]> {
    const database = db || getDb();
    const rows = await database
      .select()
      .from(events)
      .where(eq(events.streamId, streamId))
      .orderBy(events.ingestSequence);

    return rows.map((r) => ({
      event: r.envelopeJson as EvidenceEvent,
      stream_sequence: r.ingestSequence,
      previous_hash: r.previousHash,
      event_hash: r.eventHash
    }));
  }

  /**
   * Retrieves all chained events for a stream (checking in-memory first, then DB).
   */
  public async getAllEvents(streamId: string, db?: DbClient): Promise<ChainedEvent[]> {
    const inMem = this.getEventsInMemory(streamId);
    if (inMem.length > 0) return inMem;
    try {
      if (process.env.DATABASE_URL) {
        return await this.getEventsFromDb(streamId, db);
      }
    } catch {
      // Fallback to in-memory if DB is unreachable
    }
    return inMem;
  }

  /**
   * Reads all chained events from PostgreSQL and verifies chain integrity.
   */
  public async verifyStreamFromDb(streamId: string, db?: DbClient): Promise<VerificationResult> {
    try {
      const database = db || getDb();

      const headRows = await database
        .select()
        .from(chainHeads)
        .where(eq(chainHeads.streamId, streamId));

      const expectedHead = headRows.length > 0 ? headRows[0]?.headHash : undefined;

      const rows = await database
        .select()
        .from(events)
        .where(eq(events.streamId, streamId))
        .orderBy(events.ingestSequence);

      const chainedEvents: ChainedEvent[] = rows.map((r) => ({
        event: r.envelopeJson as EvidenceEvent,
        stream_sequence: r.ingestSequence,
        previous_hash: r.previousHash,
        event_hash: r.eventHash
      }));

      return verifyEventChain(chainedEvents, expectedHead);
    } catch (err: any) {
      if (isDbConnectionError(err)) {
        assertInMemoryFallbackAllowed("verifyStreamFromDb", err);
        return this.verifyInMemory(streamId);
      }
      throw err;
    }
  }
}

export const defaultChainService = new ChainService();
