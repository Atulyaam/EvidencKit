import { describe, it, expect } from "vitest";
import { canonicalizeJson, canonicalizeBytes } from "@evidencekit/core";

describe("Phase 2 — RFC 8785 JSON Canonicalization Scheme (JCS)", () => {
  it("sorts object keys lexicographically", () => {
    const input1 = { b: 2, a: 1, c: 3 };
    const input2 = { c: 3, a: 1, b: 2 };

    const jcs1 = canonicalizeJson(input1);
    const jcs2 = canonicalizeJson(input2);

    expect(jcs1).toBe('{"a":1,"b":2,"c":3}');
    expect(jcs1).toBe(jcs2);
  });

  it("removes all superfluous structural whitespace", () => {
    const obj = { message: "hello world", count: 42, nested: { active: true } };
    const jcs = canonicalizeJson(obj);

    expect(jcs).toBe('{"count":42,"message":"hello world","nested":{"active":true}}');
    expect(jcs).not.toContain(": ");
    expect(jcs).not.toContain(", ");
    expect(jcs).not.toContain("\n");
  });

  it("handles numbers and floats deterministically according to IEEE 754", () => {
    const numbers = { zero: 0, integer: 100, float: 3.14159, negative: -42 };
    const jcs = canonicalizeJson(numbers);
    expect(jcs).toBe('{"float":3.14159,"integer":100,"negative":-42,"zero":0}');
  });

  it("handles Unicode characters and strings accurately", () => {
    const input = { symbol: "€", greeting: "こんにちは", emoji: "⚡" };
    const jcs = canonicalizeJson(input);
    const bytes = canonicalizeBytes(input);

    expect(jcs).toBe('{"emoji":"⚡","greeting":"こんにちは","symbol":"€"}');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("throws when canonicalizing undefined value", () => {
    expect(() => canonicalizeJson(undefined)).toThrow(/Cannot canonicalize undefined/);
  });
});
