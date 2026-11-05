import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

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
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }
  return pool;
}

export function getDb(connectionString?: string) {
  const p = getDbPool(connectionString);
  return drizzle(p, { schema });
}

export type DbClient = ReturnType<typeof getDb>;
