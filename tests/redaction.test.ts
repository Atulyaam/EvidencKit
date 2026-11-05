import { describe, it, expect } from "vitest";
import { redactString, sanitizeData } from "@evidencekit/core";

describe("Phase 2 — Secret Redaction & Pre-Persistence Sanitization", () => {
  it("redacts OpenAI API keys", () => {
    const raw = "Connecting to OpenAI with key sk-1234567890abcdef1234567890abcdef";
    const { text, count, types } = redactString(raw);

    expect(text).toContain("[REDACTED_API_KEY]");
    expect(text).not.toContain("sk-1234567890abcdef1234567890abcdef");
    expect(count).toBe(1);
    expect(types).toContain("api_key");
  });

  it("redacts GitHub personal access tokens", () => {
    const raw = "Cloning repo using ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    const { text, count, types } = redactString(raw);

    expect(text).toContain("[REDACTED_GITHUB_TOKEN]");
    expect(text).not.toContain("ghp_ABC");
    expect(count).toBe(1);
    expect(types).toContain("github_token");
  });

  it("redacts Bearer Authorization headers", () => {
    const raw = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature";
    const { text, count } = redactString(raw);

    expect(text).toContain("Bearer [REDACTED_AUTH_TOKEN]");
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("redacts database connection credentials with passwords", () => {
    const raw =
      "Connecting to postgresql://admin:super_secret_pw_123@db.prod.internal:5432/primary";
    const { text, count } = redactString(raw);

    expect(text).toContain("[REDACTED_PASSWORD]");
    expect(text).not.toContain("super_secret_pw_123");
    expect(count).toBe(1);
  });

  it("redacts private key blocks", () => {
    const raw = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1+abcdefghijklmnopqrstuvwxyz1234567890==
-----END RSA PRIVATE KEY-----
    `;
    const { text, count, types } = redactString(raw);

    expect(text).toContain("[REDACTED_PRIVATE_KEY]");
    expect(count).toBe(1);
    expect(types).toContain("private_key");
  });

  it("recursively sanitizes nested objects and arrays", () => {
    const dirtyPayload = {
      user: "engineer@company.com",
      config: {
        apiUrl: "https://api.openai.com",
        apiKey: "sk-99998888777766665555444433332222",
        database: "postgres://root:p@ssword!@localhost:5432/db"
      },
      tokens: ["ghp_11112222333344445555666677778888", "safe_public_id"]
    };

    const result = sanitizeData(dirtyPayload);

    expect(result.redactedCount).toBeGreaterThanOrEqual(3);
    expect(result.sanitized.config.apiKey).toContain("[REDACTED_API_KEY]");
    expect(result.sanitized.config.database).toContain("[REDACTED_PASSWORD]");
    expect(result.sanitized.tokens[0]).toContain("[REDACTED_GITHUB_TOKEN]");
    expect(result.sanitized.tokens[1]).toBe("safe_public_id");
  });
});
