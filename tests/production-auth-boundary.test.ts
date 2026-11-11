import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  evaluateSessionContext,
  getSessionStore,
  resetSessionStore,
  resetServerEnv
} from "../packages/evidence-server/src/index";

describe("Part 1.3 — Production Authentication Boundary & Separation", () => {
  const originalEnv = { ...process.env };
  const TEST_SECRET = "production-test-auth-secret-32-chars-long-minimum!";

  beforeEach(() => {
    resetSessionStore();
    resetServerEnv();
    process.env = { ...originalEnv };
    process.env.AUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    resetSessionStore();
    resetServerEnv();
    process.env = { ...originalEnv };
  });

  it("Production + valid AUTH_SECRET: Rejected as general user authentication", () => {
    process.env.NODE_ENV = "production";
    delete process.env.E2E_TEST_MODE;
    delete process.env.CI;
    resetServerEnv();

    const headers = { authorization: `Bearer ${TEST_SECRET}` };
    const context = evaluateSessionContext(headers);

    expect(context.isOwner).toBe(false);
    expect(context.role).not.toBe("owner");
    expect(context.userId).toBeUndefined();
    expect(context.authorizedWorkspaces).not.toContain("*");
  });

  it("Production + E2E_TEST_MODE=true: Rejected", () => {
    process.env.NODE_ENV = "production";
    process.env.E2E_TEST_MODE = "true";
    delete process.env.CI;
    resetServerEnv();

    const headers = { authorization: `Bearer ${TEST_SECRET}` };
    const context = evaluateSessionContext(headers);

    expect(context.isOwner).toBe(false);
    expect(context.role).not.toBe("owner");
    expect(context.userId).toBeUndefined();
    expect(context.authorizedWorkspaces).not.toContain("*");
  });

  it("Production + CI=true: Rejected", () => {
    process.env.NODE_ENV = "production";
    delete process.env.E2E_TEST_MODE;
    process.env.CI = "true";
    resetServerEnv();

    const headers = { authorization: `Bearer ${TEST_SECRET}` };
    const context = evaluateSessionContext(headers);

    expect(context.isOwner).toBe(false);
    expect(context.role).not.toBe("owner");
    expect(context.userId).toBeUndefined();
    expect(context.authorizedWorkspaces).not.toContain("*");
  });

  it("Production + both E2E_TEST_MODE=true and CI=true: Rejected", () => {
    process.env.NODE_ENV = "production";
    process.env.E2E_TEST_MODE = "true";
    process.env.CI = "true";
    resetServerEnv();

    const headers = { authorization: `Bearer ${TEST_SECRET}` };
    const context = evaluateSessionContext(headers);

    expect(context.isOwner).toBe(false);
    expect(context.role).not.toBe("owner");
    expect(context.userId).toBeUndefined();
    expect(context.authorizedWorkspaces).not.toContain("*");
  });

  it("Test/E2E environment + valid configured test token: Accepted", () => {
    process.env.NODE_ENV = "test";
    resetServerEnv();

    const headers = { authorization: `Bearer ${TEST_SECRET}` };
    const context = evaluateSessionContext(headers);

    expect(context.isOwner).toBe(true);
    expect(context.role).toBe("owner");
    expect(context.userId).toBeDefined();
    expect(context.authorizedWorkspaces).toContain("*");
  });

  it("Test/E2E environment + invalid token: Rejected", () => {
    process.env.NODE_ENV = "test";
    resetServerEnv();

    const headers = { authorization: "Bearer invalid-wrong-token-value" };
    const context = evaluateSessionContext(headers);

    expect(context.isOwner).toBe(false);
    expect(context.role).not.toBe("owner");
    expect(context.userId).toBeUndefined();
    expect(context.authorizedWorkspaces).not.toContain("*");
  });

  it("Production + valid server-side session: Accepted", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.E2E_TEST_MODE;
    delete process.env.CI;
    resetServerEnv();

    // Create a legitimate server session in SessionStore
    const store = getSessionStore();
    const { token: sessionToken } = await store.createSession({
      userId: "prod-user-42",
      role: "owner",
      authorizedWorkspaces: ["ws-prod-alpha"],
      ttlSeconds: 86400
    });

    const headers = { authorization: `Bearer ${sessionToken}` };
    const context = evaluateSessionContext(headers);

    expect(context.userId).toBe("prod-user-42");
    expect(context.role).toBe("owner");
    expect(context.isOwner).toBe(true);
    expect(context.authorizedWorkspaces).toEqual(["ws-prod-alpha"]);
  });
});
