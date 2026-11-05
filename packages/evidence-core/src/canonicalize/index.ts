import canonicalize from "canonicalize";

/**
 * Deterministically serializes a JavaScript object according to RFC 8785 (JSON Canonicalization Scheme).
 * Ensures lexicographically sorted keys, no whitespace, and standard IEEE 754 number formatting.
 */
export function canonicalizeJson(value: unknown): string {
  const result = canonicalize(value);
  if (result === undefined) {
    throw new Error("Cannot canonicalize undefined value under RFC 8785");
  }
  return result;
}

/**
 * Returns canonical UTF-8 bytes for a given value according to RFC 8785.
 */
export function canonicalizeBytes(value: unknown): Uint8Array {
  const json = canonicalizeJson(value);
  return new TextEncoder().encode(json);
}
