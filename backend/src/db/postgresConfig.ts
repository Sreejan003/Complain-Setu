import fs from "node:fs";
import type pg from "pg";
export function postgresConfig(connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL): pg.PoolConfig {
  if (!connectionString) throw new Error("PostgreSQL requires DATABASE_URL or SUPABASE_DB_URL");
  const ssl = process.env.DATABASE_SSL === "true" || (process.env.NODE_ENV === "production" && process.env.DATABASE_SSL !== "false");
  return { connectionString, ssl: ssl ? { rejectUnauthorized: true, ...(process.env.DATABASE_CA_FILE ? { ca: fs.readFileSync(process.env.DATABASE_CA_FILE, "utf8") } : {}) } : undefined, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 };
}
