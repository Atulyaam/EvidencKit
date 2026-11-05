import { normalizeEvent, RawEventInput, EventSeverity } from "@evidencekit/core";

export interface AppLogEntry {
  timestamp: string;
  level: string;
  message: string;
  trace_id?: string;
  span_id?: string;
  context?: Record<string, unknown>;
}

export function parseAppLogsToEvents(lines: string[], streamId: string, artifactId: string) {
  const events = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    try {
      const parsed: AppLogEntry = JSON.parse(line);
      const level = parsed.level.toLowerCase();
      let severity: EventSeverity = "info";
      if (level === "error" || level === "fatal") severity = "error";
      else if (level === "warn" || level === "warning") severity = "warning";
      else if (level === "debug") severity = "debug";

      const correlations = [];
      if (parsed.trace_id) correlations.push(parsed.trace_id);
      if (parsed.span_id) correlations.push(parsed.span_id);

      const raw: RawEventInput = {
        stream_type: "tracevault.case",
        stream_id: streamId,
        event_name: `app.log.${severity}`,
        occurred_at: parsed.timestamp,
        time_confidence: "source_timestamp",
        source: {
          system: "application",
          artifact_id: artifactId,
          adapter: "jsonl-log",
          adapter_version: "1.0.0"
        },
        severity,
        correlation_ids: correlations,
        attributes: {
          message: parsed.message,
          ...(parsed.context || {})
        },
        evidence_refs: [
          {
            artifact_id: artifactId,
            locator_type: "line_number",
            locator: String(i + 1)
          }
        ]
      };

      events.push(normalizeEvent(raw));
    } catch {
      // Non-JSON line fallback
      events.push(
        normalizeEvent({
          stream_type: "tracevault.case",
          stream_id: streamId,
          event_name: "app.log.raw",
          time_confidence: "ingestion_fallback",
          source: {
            system: "application",
            artifact_id: artifactId,
            adapter: "raw-log",
            adapter_version: "1.0.0"
          },
          severity: "info",
          attributes: { message: line },
          evidence_refs: [
            {
              artifact_id: artifactId,
              locator_type: "line_number",
              locator: String(i + 1)
            }
          ]
        })
      );
    }
  }

  return events;
}
