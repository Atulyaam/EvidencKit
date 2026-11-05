# EvidenceKit — Security Steering Rules

1. Secrets must be redacted before persistence and before canonicalization.
2. Detected secrets use typed placeholders (`[REDACTED_API_KEY]`, `[REDACTED_AUTH_TOKEN]`, `[REDACTED_PASSWORD]`, `[REDACTED_CONNECTION_STRING]`).
3. Never log raw evidence payloads or secrets.
4. Server-side authorization blocks all mutations in public judge mode.
5. All file uploads and bundle imports must validate paths against directory traversal (zip-slip) and enforce byte limits.
