# Requirements: ComplaintTracker Full Project Repair

## Active Requirements

### Baseline & Audit
- [ ] **AUD-01**: Document initial build/test baseline across frontend and backend.
- [ ] **AUD-02**: Verify and classify all 17 target security, logic, and environment defects.
- [ ] **AUD-03**: Formulate prioritized severity matrix and implementation roadmap.

### Build & Dev Environment
- [ ] **BLD-01**: Fix TypeScript compiler errors (`Store.addCaseHistory`, `passwordHash` in slaScheduler, `receivingDate` in test).
- [ ] **BLD-02**: Separate database seeding from automated testing in `backend/package.json`.
- [ ] **BLD-03**: Verify clean builds (`tsc`, `vite build`) across frontend and backend.
- [ ] **BLD-04**: Update `.gitignore` to prevent tracking runtime DB files, builds, uploads, and secrets.

### Authentication & Authorization (Security First)
- [ ] **SEC-01**: Eliminate `Aicte@2026` bypass password; enforce bcrypt verification for all logins.
- [ ] **SEC-02**: Remove credentials from `/demo-accounts` endpoint; gate behind development mode.
- [ ] **SEC-03**: Remove default/predictable fallback JWT secret; require strong JWT secret in production.
- [ ] **SEC-04**: Protect all backend endpoints (`/complaints`, `/institutions`, `/overlaps`, `/transfers`, `/analytics`, `/admin`) with JWT auth.
- [ ] **SEC-05**: Implement explicit role and scope matrix (Administrator, RB Officer, PGRC Officer, Regional Officer, Senior Management).
- [ ] **SEC-06**: Restrict CORS to configured origins; prevent wildcard `*` in authenticated environments.

### Database Architecture & Migrations
- [ ] **DAT-01**: Reconcile SQL schema (`01_schema.sql`, `02_rls_policies.sql`), TypeScript models, and storage layer.
- [ ] **DAT-02**: Add missing `documents` table, foreign keys, indexes, and constraints to SQL migrations.
- [ ] **DAT-03**: Implement modular database repository layer supporting PostgreSQL / Supabase with transactions.
- [ ] **DAT-04**: Implement explicit development/test JSON fallback adapter with clear runtime flags.
- [ ] **DAT-05**: Replace false health-check logic with active database connectivity verification.
- [ ] **DAT-06**: Provide repeatable database migration scripts (`npm run migrate`).

### Complaint Workflows & Audit History
- [ ] **WRK-01**: Implement `addCaseHistory` with complete actor, role, action, and timestamp metadata.
- [ ] **WRK-02**: Enforce strict status lifecycle transitions with audit log recording.
- [ ] **WRK-03**: Verify case transfers record source bureau, destination bureau, transfer reason, and audit events.
- [ ] **WRK-04**: Maintain overlap detection engine (cross-bureau, lexical/TF-IDF, and external semantic service).
- [ ] **WRK-05**: Ensure merge/duplicate and review decisions are human-audited and recorded immutably.

### SLA Monitoring & Escalation
- [ ] **SLA-01**: Fix date boundary calculations (end-of-day statutory deadline comparison).
- [ ] **SLA-02**: Implement paginated/batched scanning to support datasets of any size.
- [ ] **SLA-03**: Enforce idempotency and deduplication for reminder and overdue notifications.
- [ ] **SLA-04**: Provide concurrency protection and operational execution logs.

### Frontend Authentication & UX
- [ ] **FE-01**: Implement dedicated `LoginPage` with explicit user authentication and error states.
- [ ] **FE-02**: Eliminate automatic demo admin login on mount in `AuthContext`.
- [ ] **FE-03**: Implement route-level authentication guards (`ProtectedRoute`) and role-based access gates.
- [ ] **FE-04**: Support session expiration, unauthorized redirects, and dynamic navigation.
- [ ] **FE-05**: Ensure UI forms validate input, prevent double-submissions, and refresh data post-mutation.

### Analytics, CSV Exports & Document Security
- [ ] **DOC-01**: Enforce authentication and role filtering on analytics dashboards and reports.
- [ ] **DOC-02**: Sanitize CSV exports against formula injection (`=`, `+`, `-`, `@`).
- [ ] **DOC-03**: Protect uploaded evidence files against public unauthenticated access.
- [ ] **DOC-04**: Validate file upload size, MIME type, and sanitize server-side filenames.

### Test Suite & Verification
- [ ] **TST-01**: Separate test suite from seeding (`npm test` vs `npm run seed`).
- [ ] **TST-02**: Add negative authentication and authorization tests for every role.
- [ ] **TST-03**: Add unit and integration tests for SLA boundaries and idempotency.
- [ ] **TST-04**: Add tests for CSV sanitization and evidence download authentication.
- [ ] **TST-05**: Verify end-to-end passing status with zero compiler or runtime errors.

### Production Readiness
- [ ] **PRD-01**: Update `.env.example` with all configuration keys, secret guidelines, and persistence flags.
- [ ] **PRD-02**: Document setup, migration, test, and production deployment procedures.
- [ ] **PRD-03**: Document operational boundaries, external prerequisites, and remaining considerations.
