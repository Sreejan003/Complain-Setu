import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import pg from "pg";
import { postgresConfig } from "./postgresConfig.js";
const directory = fileURLToPath(new URL("../../../database/migrations/", import.meta.url));
export function migrationPlan() { return fs.readdirSync(directory).filter(file => /^\d+_.+\.sql$/.test(file) && Number(file.split("_")[0]) >= 3).sort().map(name => ({ name, version: name.split("_")[0], sql: fs.readFileSync(path.join(directory,name), "utf8") })).map(file => ({...file, checksum: createHash("sha256").update(file.sql).digest("hex")})); }
/** Only the additive operational schema is migrated here. Legacy public/Supabase migrations are preserved. */
export async function runMigrations(pool?: pg.Pool) {
  const ownPool = !pool; pool ||= new pg.Pool(postgresConfig()); const client = await pool.connect();
  try {
    await client.query("BEGIN"); await client.query("SELECT pg_advisory_xact_lock(26264, 1)");
    await client.query("CREATE SCHEMA IF NOT EXISTS iicmcs_migrations; REVOKE ALL ON SCHEMA iicmcs_migrations FROM PUBLIC; CREATE TABLE IF NOT EXISTS iicmcs_migrations.applied(version text PRIMARY KEY,name text NOT NULL,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now()); REVOKE ALL ON iicmcs_migrations.applied FROM PUBLIC");
    const applied = await client.query("SELECT version,checksum FROM iicmcs_migrations.applied"); let executedCount = 0;
    for (const migration of migrationPlan()) {
      const existing = applied.rows.find(row => row.version === migration.version);
      if (existing) { if (existing.checksum !== migration.checksum) throw new Error(`Migration checksum mismatch: ${migration.version}`); continue; }
      await client.query(migration.sql);
      await client.query("INSERT INTO iicmcs_migrations.applied(version,name,checksum) VALUES($1,$2,$3)", [migration.version,migration.name,migration.checksum]); executedCount++;
    }
    await client.query("COMMIT"); return { success: true, executedCount, offlineValidation: false };
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); if (ownPool) await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--plan")) console.log(JSON.stringify({ executed: false, sqlValidated: false, migrations: migrationPlan().map(({sql,...file})=>file), legacyPublicMigrations: "001/002 preserved; Supabase-specific, not run by the operational migrator" }, null, 2));
  else await runMigrations().then(result=>console.log(result)).catch(error=>{ console.error("Migration failed; no SQL content or credentials logged:", error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi,"[redacted]") : "unknown error"); process.exitCode=1; });
}
