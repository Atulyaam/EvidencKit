import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"]
    }
  },
  resolve: {
    alias: {
      "@evidencekit/core": path.resolve(__dirname, "./packages/evidence-core/src/index.ts"),
      "@evidencekit/evidence-server": path.resolve(
        __dirname,
        "./packages/evidence-server/src/index.ts"
      ),
      "@evidencekit/adapters": path.resolve(__dirname, "./packages/adapters/src/index.ts"),
      "@evidencekit/agent-sdk": path.resolve(__dirname, "./packages/agent-sdk/src/index.ts"),
      "@evidencekit/db": path.resolve(__dirname, "./packages/db/src/index.ts"),
      "@evidencekit/ui": path.resolve(__dirname, "./packages/ui/src/index.ts")
    }
  }
});
