import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "dotenv";
import path from "node:path";
import * as schema from "./schema/index";

// Load .env from workspace root or current directory
[
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env")
].forEach((p) => config({ path: p }));
config();

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getDbPool(connectionString?: string): pg.Pool {
  if (!pool) {
    const connStr =
      connectionString ||
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/evidencekit";
    pool = new Pool({
      connectionString: connStr,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 1500
    });
  }
  return pool;
}

export class DatabaseUnavailableError extends Error {
  public readonly code = "DATABASE_UNAVAILABLE";
  constructor(
    message = "PostgreSQL database is unavailable. Production mode cannot fall back to volatile in-memory storage.",
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

/**
 * Asserts that the system is permitted to use in-memory fallback.
 * Strictly throws DatabaseUnavailableError in production or strict persistence mode.
 */
export function assertInMemoryFallbackAllowed(operation: string, cause?: unknown): void {
  if (process.env.NODE_ENV === "production" || process.env.STRICT_PERSISTENCE === "true") {
    const detail = cause instanceof Error ? cause.message : String(cause || "Connection failure");
    throw new DatabaseUnavailableError(
      `PostgreSQL database connection failed during ${operation}: ${detail}. In-memory fallback is strictly disabled in production to prevent data loss.`,
      cause
    );
  }
}

export function resetDbPool(): void {
  if (pool) {
    pool.end().catch(() => {});
    pool = null;
  }
}

/**
 * Rapidly checks whether the configured PostgreSQL database is reachable.
 * Times out within timeoutMs (default 1200ms) to prevent test and API hangs.
 */
export async function checkDbHealth(timeoutMs: number = 1200): Promise<boolean> {
  const p = getDbPool();
  try {
    const clientPromise = p.connect();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Database connection health check timed out")), timeoutMs)
    );
    const client = await Promise.race([clientPromise, timeoutPromise]);
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

/**
 * Determines whether an error was caused by a database connection/network failure.
 */
export function isDbConnectionError(err: any): boolean {
  if (!err) return false;
  const code = err.code;
  const msg = String(err.message || "").toLowerCase();
  return (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    code === "57P01" || // admin_shutdown
    code === "57P02" || // crash_shutdown
    code === "57P03" || // cannot_connect_now
    msg.includes("timeout") ||
    msg.includes("connection terminated") ||
    msg.includes("connect econnrefused") ||
    msg.includes("connection refused")
  );
}

export function getDb(connectionString?: string) {
  const p = getDbPool(connectionString);
  return drizzle(p, { schema });
}

export type DbClient = ReturnType<typeof getDb>;
