# ComplaintTracker Comprehensive System & Security Audit

**Date:** 2026-10-26  
**Auditor:** Senior Full-Stack & Security QA Auditor  
**Artifact:** Phase 1 Deliverable (`01-audit-and-baseline/AUDIT.md`)

---

## 1. Baseline Build & Test Execution Results

### 1.1 Backend Build (`npm run build` in `backend/`)
- **Status:** **FAILED** (Exit code 1)
- **Command:** `tsc` (TypeScript 5.8.2)
- **Errors Identified:**
  1. `src/routes/complaints.ts(289,13): error TS2339: Property 'addCaseHistory' does not exist on type 'Store'.`
  2. `src/routes/complaints.ts(333,13): error TS2339: Property 'addCaseHistory' does not exist on type 'Store'.`
  3. `src/services/slaScheduler.ts(89,13): error TS2345: Argument of type '{ id: string; fullName: string; role: "Administrator"; email: string; isActive: true; createdAt: string; updatedAt: string; }' is not assignable to parameter of type 'Profile'. Property 'passwordHash' is missing in type...`
  4. `src/tests/run_tests.ts(396,7): error TS2561: Object literal may only specify known properties, but 'receivingDate' does not exist in type 'Complaint'. Did you mean to write 'receivedDate'?`

### 1.2 Frontend Build (`npm run build` in `frontend/`)
- **Status:** **PASSED** (Exit code 0)
- **Command:** `tsc -b && vite build`
- **Output:**
  - `dist/index.html`: 1.11 kB
  - `dist/assets/index-Dt9Dac4c.css`: 49.27 kB
  - `dist/assets/index-DgXXZxgw.js`: 865.93 kB
- **Warnings:** Bundle exceeds 500 kB chunk size warning limit.

### 1.3 Backend Test Suite Execution (`npm test` in `backend/`)
- **Status:** 17/17 passed via `tsx` runner (which executes TypeScript without type-checking).
- **Critical Flaw:** `package.json` `"seed"` script points to `run_tests.ts`, meaning database seeding executes test assertions, and running tests mutates the underlying `backend/data/db.json` dataset.

---

## 2. Audited Findings & Severity-Ranked Matrix

| ID | Issue Description | Location | Category | Severity |
|---|---|---|---|---|
| **VULN-01** | Hardcoded universal authentication bypass password `Aicte@2026` | `backend/src/routes/auth.ts:37` | Authentication | **CRITICAL** |
| **VULN-02** | Public demo-accounts endpoint exposing all official accounts & passwords | `backend/src/routes/auth.ts:9-21` | Information Disclosure | **CRITICAL** |
| **VULN-03** | Predictable static JWT signing secret fallback | `backend/src/middleware/auth.ts:7` | Cryptographic Failure | **CRITICAL** |
| **VULN-04** | All sensitive complaint, transfer, overlap & analytics endpoints are unauthenticated | `backend/src/routes/*.ts` | Authorization | **CRITICAL** |
| **VULN-05** | Public unauthenticated static file access to sensitive evidence uploads | `backend/src/server.ts:36` | Access Control | **CRITICAL** |
| **VULN-06** | Missing `Store.addCaseHistory()` causes build breakage and lost timeline audits | `backend/src/db/store.ts` | Data Integrity | **HIGH** |
| **VULN-07** | Synthetic profile in SLA scheduler breaks TypeScript compilation | `backend/src/services/slaScheduler.ts:89` | Type Safety | **HIGH** |
| **VULN-08** | Automatic demo login as Administrator on mount in React AuthContext | `frontend/src/context/AuthContext.tsx:31` | Authentication | **HIGH** |
| **VULN-09** | Missing frontend route-level protection guards (`ProtectedRoute`) | `frontend/src/App.tsx:24-37` | UI Security | **HIGH** |
| **VULN-10** | Absence of real production database integration (pure JSON file store used) | `backend/src/db/store.ts` | Persistence | **HIGH** |
| **VULN-11** | SQL Schema mismatch: `01_schema.sql` lacks `documents` table | `database/01_schema.sql` | Schema Drift | **HIGH** |
| **VULN-12** | SLA scheduler premature overdue calculation, batch cap, and duplicate alerts | `backend/src/services/slaScheduler.ts` | Business Logic | **HIGH** |
| **VULN-13** | CSV Formula Injection via unescaped user-controlled values (`=`, `+`, `-`, `@`) | `backend/src/routes/analytics.ts:52` | Injection | **HIGH** |
| **VULN-14** | Wildcard `*` CORS policy enabled across all methods and origins | `backend/src/server.ts:29-33` | Network Security | **MEDIUM** |
| **VULN-15** | Backend `seed` script aliased directly to automated test runner | `backend/package.json:12` | Dev Ops | **MEDIUM** |
| **VULN-16** | Misleading health check equates env var presence with live DB connection | `backend/src/routes/admin.ts:43-52` | Operational Monitoring | **MEDIUM** |
| **VULN-17** | Type discrepancy `receivingDate` vs `receivedDate` in test suite | `backend/src/tests/run_tests.ts:396` | Type Safety | **MEDIUM** |
| **VULN-18** | Missing `.gitignore` rules for local runtime db files, evidence uploads, and envs | `.gitignore` | Hygiene | **MEDIUM** |

---

## 3. Detailed Verification of Investigated Targets

### Target 1: Missing `Store.addCaseHistory()`
- **Verified:** Yes. In `backend/src/routes/complaints.ts`, lines 289 and 333 invoke `store.addCaseHistory(...)`. The class `Store` in `backend/src/db/store.ts` contains `getCaseHistory(complaintId)`, but has no `addCaseHistory(history: CaseHistory)` method. This triggers compile-time `TS2339`.

### Target 2: Invalid `passwordHash` in SLA Scheduler Synthetic Profile
- **Verified:** Yes. In `backend/src/services/slaScheduler.ts` line 89, `store.updateComplaintStatus()` is invoked with a synthetic user object that omits `passwordHash`. Since the parameter type is `Profile`, TypeScript rejects this under strict checking (`TS2345`).

### Target 3: Incorrect `receivingDate` in `run_tests.ts`
- **Verified:** Yes. In `backend/src/tests/run_tests.ts` line 396, `receivingDate: "2026-10-01"` is specified on type `Complaint`, which defines `receivedDate: string`.

### Target 4: Frontend Vite Executable Permission / Build Failure
- **Verified:** Build succeeded in this Windows environment (`tsc -b && vite build`), but chunk size exceeds 860 kB. In Linux/Unix CI environments, Vite binary requires executable bit permissions.

### Target 5: Backend Seed Script Pointing to Test Runner
- **Verified:** Yes. In `backend/package.json`, `"seed": "tsx src/tests/run_tests.ts"`. Seeding the database runs tests and tests mutate database state. Seeding and testing must be decoupled.

### Target 6: Hardcoded Authentication Bypass Password `Aicte@2026`
- **Verified:** Yes. In `backend/src/routes/auth.ts`, line 37:
  ```typescript
  const isValid = bcrypt.compareSync(password, profile.passwordHash);
  if (!isValid && password !== "Aicte@2026") { ... }
  ```
  Any account can be logged into using `Aicte@2026`.

### Target 7: Public Endpoints (Complaints, Overlaps, Transfers, Analytics)
- **Verified:** Yes.
  - `GET /api/complaints` has no `requireAuth`.
  - `GET /api/complaints/:id` has no `requireAuth`.
  - `GET /api/complaints/:id/history` has no `requireAuth`.
  - `GET /api/complaints/:id/related` has no `requireAuth`.
  - `GET /api/institutions/:id` has no `requireAuth`.
  - `GET /api/overlaps` has no `requireAuth`.
  - `GET /api/transfers` has no `requireAuth`.
  - `GET /api/analytics/dashboard` has no `requireAuth`.
  - `GET /api/analytics/export-csv` has no `requireAuth`.

### Target 8: Demo-Account Endpoint Exposing Shared Credentials
- **Verified:** Yes. `GET /api/auth/demo-accounts` returns full profiles with `demoPassword: "Aicte@2026"`.

### Target 9: Predictable Fallback JWT Secret
- **Verified:** Yes. Line 7 of `backend/src/middleware/auth.ts` uses `"aicte_sih_secure_jwt_secret_key_2026"`.

### Target 10: Wildcard CORS
- **Verified:** Yes. `backend/src/server.ts` line 30 sets `origin: "*"`.

### Target 11: Automatic Demo Login in `AuthContext.tsx`
- **Verified:** Yes. Lines 31-37 automatically log in as the default Administrator if no token is found in `localStorage`.

### Target 12: Missing Frontend Route-Level Guards
- **Verified:** Yes. `frontend/src/App.tsx` renders all paths directly without checking authentication or role permissions.

### Target 13: JSON Persistence vs Supabase / PostgreSQL Architecture
- **Verified:** Yes. The application only queries in-memory arrays serialized to `backend/data/db.json`. No PostgreSQL client (`pg` or `@supabase/supabase-js`) is installed in backend dependencies.

### Target 14: SLA Boundary, Batching, and Deduplication Concerns
- **Verified:** Yes. `slaScheduler.ts` compares time in milliseconds against midnight of expected disposal date, capping at 1000 items and lacking notification mutex guards.

### Target 15: Public Static Access to Uploaded Evidence
- **Verified:** Yes. `backend/src/server.ts` line 36 serves `UPLOADS_DIR` via `express.static("/uploads")`. Anyone knowing or guessing the filename can access private evidence.

### Target 16: Discrepancies Between SQL Schema and Data Models
- **Verified:** Yes. `01_schema.sql` does not include `documents`, whereas `types.ts` defines `ComplaintDocument`.

### Target 17: Inconsistent Audit Logging & Permissions
- **Verified:** Yes. Multiple write operations fail to write to `audit_logs` or `case_history`.

---

## 4. Remediation Plan

The remediation follows the 10-phase GSD roadmap:
1. **Phase 1:** Baseline & Audit (Completed).
2. **Phase 2:** Repair Build & Dev Environment (Compiler errors, seed script, .gitignore).
3. **Phase 3:** Authentication & Security Hardening (Remove bypass, secure JWT, protect routes, role matrix, CORS).
4. **Phase 4:** Real Database Integration (PostgreSQL / Supabase repository, migrations, connection checks).
5. **Phase 5:** Complaint Workflows & Audit Trail (`addCaseHistory`, status transitions, overlap review).
6. **Phase 6:** SLA Scheduling & Notifications (Boundary math, pagination, deduplication).
7. **Phase 7:** Frontend Auth & UX (LoginPage, ProtectedRoute, role gates).
8. **Phase 8:** Analytics & Documents (CSV sanitization, authenticated evidence streaming).
9. **Phase 9:** Automated Test Suite (Negative auth tests, SLA tests, role guards).
10. **Phase 10:** Production Readiness & Documentation (READMEs, env configs, deployment verification).
