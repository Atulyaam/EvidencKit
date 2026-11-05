import { ChainedEvent } from "../chain/index";
import { EventSeverity } from "../schema/index";

export interface TimelineQueryOptions {
  severity?: EventSeverity;
  system?: string;
  eventName?: string;
  search?: string;
  offset?: number;
  limit?: number;
}

export interface TimelineQueryResult {
  events: ChainedEvent[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Deterministically sorts chained events by occurred_at ASC,
 * tie-breaking by stream_sequence ASC, and finally by event_id ASC.
 * Events with null occurred_at are placed at the end, sorted by stream_sequence.
 */
export function sortEventsForTimeline(events: ChainedEvent[]): ChainedEvent[] {
  return [...events].sort((a, b) => {
    const timeA = a.event.occurred_at ? new Date(a.event.occurred_at).getTime() : null;
    const timeB = b.event.occurred_at ? new Date(b.event.occurred_at).getTime() : null;

    if (timeA !== null && timeB !== null) {
      if (timeA !== timeB) {
        return timeA - timeB;
      }
    } else if (timeA !== null && timeB === null) {
      return -1;
    } else if (timeA === null && timeB !== null) {
      return 1;
    }

    // Tie-break by stream_sequence
    if (a.stream_sequence !== b.stream_sequence) {
      return a.stream_sequence - b.stream_sequence;
    }

    // Final tie-break by event_id
    return a.event.event_id.localeCompare(b.event.event_id);
  });
}

/**
 * Filters, sorts, and paginates chained events for the timeline view.
 */
export function queryTimeline(
  events: ChainedEvent[],
  options: TimelineQueryOptions = {}
): TimelineQueryResult {
  const { severity, system, eventName, search, offset = 0, limit = 50 } = options;

  let filtered = events;

  if (severity) {
    filtered = filtered.filter((e) => e.event.severity === severity);
  }

  if (system) {
    filtered = filtered.filter((e) => e.event.source.system === system);
  }

  if (eventName) {
    filtered = filtered.filter((e) => e.event.event_name === eventName);
  }

  if (search && search.trim().length > 0) {
    const q = search.toLowerCase();
    filtered = filtered.filter((e) => {
      if (e.event.event_name.toLowerCase().includes(q)) return true;
      if (e.event.source.system.toLowerCase().includes(q)) return true;
      const attrStr = JSON.stringify(e.event.attributes).toLowerCase();
      return attrStr.includes(q);
    });
  }

  const sorted = sortEventsForTimeline(filtered);
  const total = sorted.length;
  const paginated = sorted.slice(offset, offset + limit);

  return {
    events: paginated,
    total,
    offset,
    limit,
    hasMore: offset + limit < total
  };
}
