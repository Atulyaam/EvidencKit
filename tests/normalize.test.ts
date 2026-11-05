import { describe, it, expect } from "vitest";
import { normalizeEvent, RawEventInput } from "@evidencekit/core";

describe("Phase 2 — Event Normalization Engine", () => {
  it("normalizes a valid raw event with source timestamp", () => {
    const raw: RawEventInput = {
      stream_type: "tracevault.case",
      stream_id: "case_norm_01",
      event_name: "deployment.completed",
      occurred_at: "2026-11-16T10:00:00.000Z",
      observed_at: "2026-11-16T10:00:05.000Z",
      source: {
        system: "deployer",
        artifact_id: "art_01",
        adapter: "deployment-json",
        adapter_version: "1.0.0"
      },
      actor: {
        type: "service",
        id: "deploy-bot"
      },
      severity: "info",
      correlation_ids: ["dep-101"],
      attributes: {
        environment: "production",
        service: "api",
        token: "sk-11223344556677889900aabbccddeeff"
      },
      evidence_refs: [
        {
          artifact_id: "art_01",
          locator_type: "json_pointer",
          locator: "/deployments/0"
        }
      ]
    };

    const event = normalizeEvent(raw);

    expect(event.schema_version).toBe("1.0");
    expect(event.event_id).toBeDefined();
    expect(event.time_confidence).toBe("source_timestamp");
    expect(event.occurred_at).toBe("2026-11-16T10:00:00.000Z");
    expect(event.evidence_refs?.length).toBe(1);

    // Sanitization check
    expect((event.attributes as any).token).toContain("[REDACTED_API_KEY]");
  });

  it("assigns ingestion_fallback when occurred_at is missing or unparseable", () => {
    const raw: RawEventInput = {
      stream_type: "tracevault.case",
      stream_id: "case_norm_02",
      event_name: "app.log.raw",
      occurred_at: "invalid-date-string",
      source: {
        system: "syslog",
        adapter: "raw-log",
        adapter_version: "1.0.0"
      },
      severity: "warning"
    };

    const event = normalizeEvent(raw);

    expect(event.occurred_at).toBeNull();
    expect(event.time_confidence).toBe("ingestion_fallback");
    expect(event.observed_at).toBeDefined();
  });

  it("throws validation error when required stream_id is missing or empty", () => {
    const raw: any = {
      stream_type: "tracevault.case",
      stream_id: "",
      event_name: "test.event",
      source: {
        system: "test",
        adapter: "test",
        adapter_version: "1.0.0"
      }
    };

    expect(() => normalizeEvent(raw)).toThrow();
  });
});
