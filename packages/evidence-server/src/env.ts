import { z } from "zod";

export const ServerEnvSchema = z.object({
  // App / Auth
  AUTH_SECRET: z.string().min(16).default("development-auth-secret-32-chars-long-minimum!"),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  OWNER_GITHUB_ID: z.string().default("owner"),
  NEXT_PUBLIC_TRACEVAULT_URL: z.string().url().default("http://localhost:3001"),
  NEXT_PUBLIC_AGENTLEDGER_URL: z.string().url().default("http://localhost:3002"),

  // Database
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/evidencekit"),

  // Storage
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().default("evidencekit-artifacts"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Signing
  EVIDENCE_SIGNING_PRIVATE_KEY: z.string().optional(),
  EVIDENCE_SIGNING_KEY_ID: z.string().optional(),
  EVIDENCE_VERIFY_PUBLIC_KEY: z.string().optional(),

  // Limits
  MAX_UPLOAD_COMPRESSED_BYTES: z.coerce.number().default(20971520), // 20 MB
  MAX_UPLOAD_EXPANDED_BYTES: z.coerce.number().default(104857600), // 100 MB
  MAX_ARCHIVE_ENTRIES: z.coerce.number().default(200),
  MAX_EVENT_PAYLOAD_BYTES: z.coerce.number().default(65536), // 64 KB

  // Demo
  DEMO_MODE: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .default("true"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Environment configuration error:", parsed.error.format());
    throw new Error(`Environment validation failed: ${parsed.error.message}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}
