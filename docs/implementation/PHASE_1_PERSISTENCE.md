# Phase 1: PostgreSQL operational authority

## Implemented and verified

The existing synchronous domain Store now runs against a request-owned PostgreSQL snapshot when `PERSISTENCE_DRIVER=postgres`. PostgreSQL is the sole durable authority in that mode: there is no JSON fallback or dual-write. Existing routes, RBAC, coordination memberships, approvals, history and document grants use the same Store implementation within the database transaction. The independently selected legacy SQL adapter is no longer used for operational health while routes use a different database.

Migration `003_operational_coordination.sql` adds the private `iicmcs` schema. It stores the complete operational state and relational integrity projections for profiles, institutions, Bureaus, complaints, evidence, coordination sessions, independent participants/officers, messages, approvals, events, tasks, document scopes and retry/reminder receipts. Original string IDs are preserved. Foreign keys, unique request receipts, paging/responsibility indexes and immutable-message/approval/event checks are enforced. A private transactional live-event outbox publishes random event IDs through PostgreSQL NOTIFY; recipients fetch current state and reapply existing access checks.

Each operational request serializes through a PostgreSQL advisory lock and revision check. Multi-record state and projections commit together before the HTTP success body is sent. Files created during a failed transaction are compensated; deletion of existing files is deferred until commit. SSE connection setup uses a short read transaction, not a long-lived database lock. Background coordination/SLA cycles use the same transaction boundary. Demo resets are disabled in PostgreSQL mode.

This is an explicit compatibility bridge for the existing prototype, not a claim of unrestricted enterprise throughput: requests load the operational document and serialize writes/reads through one domain lock. Large datasets need subsequent normalized query optimization and capacity testing. Responses are buffered up to 32 MiB to avoid sending success or attachment bytes before commit. Existing upload limits remain. JSON remains a **single-process development/test mode**. Production startup requires PostgreSQL and fails closed on unavailable/uninitialized storage.

## Migration and initial data commands

PowerShell examples; supply real values through environment configuration, never committed source:

```powershell
$env:DATABASE_URL='postgresql://app_user:YOUR_PASSWORD@localhost:5432/complain_setu'
$env:PERSISTENCE_DRIVER='postgres'
# Only for an explicitly local development database:
$env:DATABASE_SSL='false'
npm --prefix backend run migrate:plan
npm --prefix backend run migrate
npm --prefix backend run backfill:operational -- --from-json C:\secure-backups\db.json
npm --prefix backend run build
npm --prefix backend start
```

The plan command lists files/checksums; it does not claim SQL validation or execution. Normal migration without a database URL fails instead of reporting offline success. The new migrator uses a checksum ledger and transaction/advisory lock. Already applied migration files must not be edited.

Legacy public-schema migrations 001/002 are retained unchanged. They are not rerun by this operational migrator: 002 is Supabase-specific and uses older role policies. Existing public tables are neither dropped nor silently imported. Select the intended data authority explicitly. If historical data exists in both public PostgreSQL tables and JSON, reconcile/choose the source before importing; this tool does not guess which records win.

Alternatively initialize a **new empty authority** with one administrator and no synthetic institutions/complaints:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL='your-official-address@example.org'
$env:BOOTSTRAP_ADMIN_NAME='Initial administrator'
$env:BOOTSTRAP_ADMIN_PASSWORD='A_UNIQUE_RANDOM_PASSWORD_AT_LEAST_16_CHARACTERS'
npm --prefix backend run backfill:operational -- --bootstrap-empty
```

Import/bootstrap refuses to overwrite an initialized authority. It reports counts and a source digest, not narratives, identities or passwords. An invalid foreign key rolls back the whole import. Original evidence bytes must also be copied into the configured `DATA_DIR/uploads` directory using a verified backup process; the import intentionally does not move or delete files.

## Configuration and recovery

- `PERSISTENCE_DRIVER`: `postgres` for production; `json` for development/test.
- `DATABASE_URL` / `SUPABASE_DB_URL`: server-only connection string.
- `DATABASE_SSL`: TLS enabled by default in production; verification stays enabled. Disable only for a deliberately local development connection.
- `DATABASE_CA_FILE`: optional trusted CA PEM file for certificate verification.
- `DATA_DIR`: JSON development data or protected evidence storage in PostgreSQL mode.
- Bootstrap variables above are used only by the explicit empty-bootstrap CLI.

Use a restricted service database role; the operational schema and tables revoke PUBLIC access. Application RBAC remains server enforced. Do not expose the operational document or projection tables directly through a public REST database gateway.

Back up PostgreSQL and evidence together. Example `pg_dump -Fc -f backup.dump DATABASE_NAME`; restore into a **new empty recovery database** with `createdb recovery_name` then `pg_restore -d recovery_name backup.dump`. Verify IDs, evidence hashes and coordination counts before pointing a stopped application at the recovered authority. Keep the original JSON backup read-only; do not run competing JSON and PostgreSQL writers. No automatic downgrade/export to JSON is provided.

## Actual checks

`npm --prefix backend run test:postgres` passed **12 scenarios on native PostgreSQL 18.4**, using pinned development binaries and test-only temporary clusters. Checks covered migrations/reapplication, one-time backfill, actual APIs and RBAC, independent decisions, concurrent version conflicts, retry idempotency, tasks/findings/acknowledgement projections, multipart evidence and scoped download/revocation, rollback compensation, foreign-key and immutable-record failures, cross-connection live events, unchanged complaint ownership and a real PostgreSQL process restart. The operational JSON file remained untouched.

After integration, the existing JSON suites passed again: **23 unit checks, 15 acceptance checks and 33 RBAC scenarios**. Backend TypeScript passed. PostgreSQL TLS against a hosted service, production capacity and multi-host deployment are not claimed as tested. No live government system, email or SMS delivery was connected.
