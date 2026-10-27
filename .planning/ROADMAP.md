# Roadmap: ComplaintTracker Full Project Repair

## Overview
A comprehensive 10-phase repair, hardening, and verification plan for ComplaintTracker. Every phase includes clear goals, requirements, success criteria, and verification steps.

## Phases

- [x] **Phase 1: Baseline Establishment & System Audit** - Audit existing issues, verify baseline build/test failures, create audit report.
- [x] **Phase 2: Build & Development Environment Repair** - Fix compiler errors, correct package scripts, resolve .gitignore.
- [x] **Phase 3: Authentication & Security Hardening** - Eliminate bypasses, secure JWT, restrict CORS, enforce role-based access control.
- [x] **Phase 4: Real Database Integration (PostgreSQL / Supabase)** - Reconcile schemas, implement repository pattern, migrations, and test database support.
- [x] **Phase 5: Complaint Workflows & Audit Trail** - Complete case history logging, lifecycle transitions, transfers, and overlap engine.
- [ ] **Phase 6: SLA Scheduling & Notifications** - Fix boundary calculations, pagination, notification deduplication, and concurrency safety.
- [ ] **Phase 7: Frontend Authentication & UX** - Create LoginPage, ProtectedRoute, role gates, remove auto demo login, improve UX states.
- [ ] **Phase 8: Analytics Security, CSV Sanitization & Evidence Protection** - Secure analytics endpoints, prevent CSV formula injection, gate document downloads.
- [ ] **Phase 9: Comprehensive Automated Test Suite** - Build end-to-end tests covering auth, roles, SLA, CSV, transfers, and uploads.
- [ ] **Phase 10: Production Readiness & Documentation** - Complete READMEs, environment examples, deployment guide, and final verification.

## Phase Details

### Phase 1: Baseline Establishment & System Audit
**Goal**: Run baseline builds and tests, investigate the 17 identified defects, and produce a formal audit document with reproduction evidence.
**Depends on**: Nothing
**Requirements**: AUD-01, AUD-02, AUD-03
**Success Criteria**:
  1. Frontend and backend builds executed and baseline results recorded.
  2. Baseline test execution recorded.
  3. All 17 identified audit items verified against current source.
  4. Detailed audit artifact created in `.planning/phases/01-audit-and-baseline/AUDIT.md`.
**Plans**: 1 plan

Plans:
- [ ] 01-01: Run baseline checks and create comprehensive audit artifact

### Phase 2: Build & Development Environment Repair
**Goal**: Fix TypeScript compilation errors, correct package scripts, and establish reproducible builds.
**Depends on**: Phase 1
**Requirements**: BLD-01, BLD-02, BLD-03, BLD-04
**Success Criteria**:
  1. `npm run build` passes with zero errors in `backend`.
  2. `npm run build` passes with zero errors in `frontend`.
  3. `backend/package.json` separates `seed` from `test`.
  4. `.gitignore` properly excludes local DB files, builds, secrets, and uploads.
**Plans**: 1 plan

Plans:
- [ ] 02-01: Fix backend TS compiler errors, update package.json scripts and .gitignore

### Phase 3: Authentication & Security Hardening
**Goal**: Remove hardcoded bypasses, enforce role-based authorization on all routes, secure JWT, and restrict CORS.
**Depends on**: Phase 2
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06
**Success Criteria**:
  1. Login strictly requires valid bcrypt hash check; `Aicte@2026` bypass removed.
  2. `/demo-accounts` omits passwords and is only available in development.
  3. JWT secret requires secure configuration in production.
  4. All sensitive backend routes enforce `requireAuth` and appropriate `requireRole`.
  5. CORS is restricted to configurable origins.
**Plans**: 1 plan

Plans:
- [ ] 03-01: Hardened auth routes, JWT config, role-based middleware, and secure CORS

### Phase 4: Real Database Integration (PostgreSQL / Supabase)
**Goal**: Architect modular repository layer supporting PostgreSQL / Supabase, schema reconciliation, and migrations.
**Depends on**: Phase 3
**Requirements**: DAT-01, DAT-02, DAT-03, DAT-04, DAT-05, DAT-06
**Success Criteria**:
  1. Repository interface abstracts storage with PostgreSQL and local development adapters.
  2. SQL migrations reconcile schema including missing `documents` table and constraints.
  3. Health check validates actual database connectivity (`SELECT 1`).
  4. Repeatable migration runner script is available and tested.
**Plans**: 1 plan

Plans:
- [ ] 04-01: Implement database repository layer, SQL migrations, and migration runner

### Phase 5: Complaint Workflows & Audit Trail
**Goal**: Implement complete case history audit trail, validated lifecycle transitions, and maintain overlap detection.
**Depends on**: Phase 4
**Requirements**: WRK-01, WRK-02, WRK-03, WRK-04, WRK-05
**Success Criteria**:
  1. Every case mutation creates an immutable case history log entry.
  2. Status transitions follow allowed state progression.
  3. Transfer workflow preserves full history and destination bureau assignment.
  4. Overlap detection engine correctly scores cross-bureau grievances and logs review rationale.
**Plans**: 1 plan

Plans:
- [ ] 05-01: Case history logging, status validation, transfer audit trail, and overlap verification

### Phase 6: SLA Scheduling & Notifications
**Goal**: Correct SLA deadline boundary calculations, implement pagination, deduplicate notifications, and make runs idempotent.
**Depends on**: Phase 5
**Requirements**: SLA-01, SLA-02, SLA-03, SLA-04
**Success Criteria**:
  1. Deadline comparison uses statutory end-of-day boundary.
  2. SLA evaluation processes complaints in paginated batches.
  3. Re-running SLA cycles does not produce duplicate notifications within the reminder window.
  4. Auto-escalation to Senior Management records audit trails and handles concurrency safely.
**Plans**: 1 plan

Plans:
- [ ] 06-01: Harden SLA scheduler with pagination, boundary logic, and deduplication

### Phase 7: Frontend Authentication & UX
**Goal**: Implement LoginPage, ProtectedRoute, role-aware navigation, remove automatic demo login, and polish UI states.
**Depends on**: Phase 6
**Requirements**: FE-01, FE-02, FE-03, FE-04, FE-05
**Success Criteria**:
  1. Dedicated LoginPage allows official login with proper credentials.
  2. Automatic demo login in AuthContext is disabled; demo switcher is gated to development.
  3. ProtectedRoute blocks unauthenticated visits and redirects to login.
  4. Unauthorized pages show 403 Forbidden feedback.
  5. API requests include JWT token and handle 401 expiration gracefully.
**Plans**: 1 plan

Plans:
- [ ] 07-01: Build LoginPage, ProtectedRoute, role guards, and enhance UX feedback

### Phase 8: Analytics Security, CSV Sanitization & Evidence Protection
**Goal**: Secure analytics endpoints, prevent CSV formula injection, and protect uploaded evidence files.
**Depends on**: Phase 7
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04
**Success Criteria**:
  1. Analytics and export endpoints require authentication and scope checks.
  2. CSV export prefixes formula characters (`=`, `+`, `-`, `@`) with a tab/quote to prevent injection.
  3. Document downloads require authentication and check case access.
  4. Uploaded files validate MIME type, file size, and store safe filenames.
**Plans**: 1 plan

Plans:
- [ ] 08-01: CSV formula sanitization, secure file downloads, and analytics authorization

### Phase 9: Comprehensive Automated Test Suite
**Goal**: Expand test suite with negative auth tests, SLA tests, role guards, and isolation tests.
**Depends on**: Phase 8
**Requirements**: TST-01, TST-02, TST-03, TST-04, TST-05
**Success Criteria**:
  1. Test suite runs independently from seeding via `npm test`.
  2. Negative tests verify 401/403 on invalid passwords, missing tokens, and unauthorized roles.
  3. SLA boundary and idempotency tests pass.
  4. CSV sanitization and document download tests pass.
  5. All tests in suite pass with 100% success rate.
**Plans**: 1 plan

Plans:
- [ ] 09-01: Build and run comprehensive security, workflow, SLA, and unit test suite

### Phase 10: Production Readiness & Documentation
**Goal**: Finalize environment documentation, deployment guides, READMEs, and verify definition of done.
**Depends on**: Phase 9
**Requirements**: PRD-01, PRD-02, PRD-03
**Success Criteria**:
  1. Root, backend, and frontend READMEs provide accurate setup, migration, and run commands.
  2. `.env.example` documents all required and optional environment variables.
  3. Production builds pass cleanly without warnings.
  4. All Definition of Done items verified and documented.
**Plans**: 1 plan

Plans:
- [x] 10-01: Update documentation, verify final production builds, and summarize deliverables

---

## Milestone 2: Core ComplaintTracker Features
- [x] **Phase 11: Single-Window Institution Dashboard** - Institution selector, scoped metrics, unified single-window management, inline drawer/modal case review.
- [x] **Phase 12: Automated Overlap Detection Engine** - Confidence classification, non-automatic merging, audit trail for reviewer decisions, duplicate prevention.
- [x] **Phase 13: Real-Time Case Tracking & Workflow** - Permitted transition enforcement, optimistic concurrency conflict prevention, case timeline, jurisdiction-aware real-time stream.
- [x] **Phase 14: Priority-Based SLA Monitoring & Overrides** - SLA target storage, boundary calculations, idempotent notifications, authorized deadline override route.
- [x] **Phase 15: Advanced Search, Filters & Status Monitoring** - Debounced search, quick filters, URL search param synchronization, database-backed multi-criteria filtering.
- [x] **Phase 16: Acceptance Verification & Delivery** - 15 automated acceptance tests verifying all core criteria.
