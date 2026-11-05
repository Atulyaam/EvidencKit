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
      const parsedRaw: any = JSON.parse(line);
      const {
        timestamp,
        level: rawLevel,
        message,
        trace_id,
        span_id,
        context,
        system: rawSystem,
        ...extra
      } = parsedRaw;
      const level = (rawLevel || "info").toLowerCase();
      let severity: EventSeverity = "info";
      if (level === "error" || level === "fatal") severity = "error";
      else if (level === "warn" || level === "warning") severity = "warning";
      else if (level === "debug") severity = "debug";
      else if (level === "critical") severity = "critical";

      const correlations = [];
      if (trace_id) correlations.push(trace_id);
      if (span_id) correlations.push(span_id);
      if (extra.correlation_id) correlations.push(extra.correlation_id);

      const raw: RawEventInput = {
        stream_type: "tracevault.case",
        stream_id: streamId,
        event_name: `app.log.${severity}`,
        occurred_at: timestamp,
        time_confidence: "source_timestamp",
        source: {
          system: rawSystem || "application",
          artifact_id: artifactId,
          adapter: "jsonl-log",
          adapter_version: "1.0.0"
        },
        severity,
        correlation_ids: correlations,
        attributes: {
          message: message || "",
          ...extra,
          ...(context || {})
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
