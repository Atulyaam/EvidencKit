# EvidenceKit — Coding Standards

1. Strict TypeScript mode enabled across all packages and apps.
2. No `any` types; use precise discriminated unions, generics, or `unknown` with runtime type narrowing.
3. Clean imports: Use workspace package names `@evidencekit/*`.
4. Consistent formatting with Prettier and linting with ESLint.
5. Error handling: Use typed result types `Result<T, E>` or well-defined error classes rather than throwing generic strings.
