import { describe, it, expect } from "vitest";
import {
  getServerEnv,
  evaluateSessionContext,
  requireOwnerAuthorization,
  getHealthStatus
} from "@evidencekit/evidence-server";

describe("Phase 1 — Infrastructure & Configuration", () => {
  it("validates server environment configuration with defaults", () => {
    const env = getServerEnv();
    expect(env).toBeDefined();
    expect(env.DEMO_MODE).toBe(true);
    expect(env.MAX_EVENT_PAYLOAD_BYTES).toBe(65536);
    expect(env.MAX_UPLOAD_COMPRESSED_BYTES).toBe(20971520);
  });

  it("evaluates public request as read-only judge role in demo mode", () => {
    const headers = new Headers();
    const context = evaluateSessionContext(headers);

    expect(context.isOwner).toBe(false);
    expect(context.role).toBe("judge");
    expect(context.isJudgeMode).toBe(true);
  });

  it("blocks mutation operations in public judge mode", () => {
    const headers = new Headers();
    const context = evaluateSessionContext(headers);

    expect(() => requireOwnerAuthorization(context)).toThrow(
      /Public Judge Mode is strictly READ-ONLY/
    );
  });

  it("grants owner authorization when matching OWNER_GITHUB_ID header is provided", () => {
    const env = getServerEnv();
    const headers = new Headers();
    headers.set("x-evidencekit-user", env.OWNER_GITHUB_ID);

    const context = evaluateSessionContext(headers);
    expect(context.isOwner).toBe(true);
    expect(context.role).toBe("owner");
    expect(() => requireOwnerAuthorization(context)).not.toThrow();
  });

  it("returns operational health status report", () => {
    const health = getHealthStatus();
    expect(health.status).toBe("ok");
    expect(health.demo_mode).toBe(true);
    expect(typeof health.uptime_seconds).toBe("number");
    expect(health.version).toBe("1.0.0");
  });
});
