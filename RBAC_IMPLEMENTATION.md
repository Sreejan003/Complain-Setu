# Four-role RBAC implementation

## Architecture and implementation boundary

The application retains React 19, TypeScript, Vite, Tailwind, Express, bcrypt, JWTs, and the existing synchronous persistent JSON store. Existing routes import that store directly. The repository also contains a PostgreSQL adapter and SQL schema, but those are not the storage path used by the application routes. This implementation secures the active JSON path; it does not claim PostgreSQL deployment verification.

There are four internal roles: `SYSTEM_ADMIN`, `COMPETENT_AUTHORITY`, `BUREAU_HEAD`, and `CASE_OFFICER`. Bureau identity is a separate attribute. Existing institutional accounts remain an external self-service account type, not a fifth internal role. Legacy role names are mapped at authentication and authorization boundaries without deleting or bulk rewriting existing users. Legacy bureau officers map to assigned-case officers; administrators must explicitly assign Bureau Heads through User Management.

## Routes and effective permissions

| Role | Dashboard | Read scope | Actions |
| --- | --- | --- | --- |
| System Administrator | `/admin/dashboard` | Administrative accounts, units, security/configuration records | Create/edit/deactivate users, reset credentials, assign one of four roles and scope, configure bureaus, inspect administrative audit and existing settings |
| Competent Authority | `/authority/dashboard` | Organization-wide, narrowed by any assigned bureau and/or exact region | Supervisory complaint updates, disposal/reopening under existing transitions, reports, case histories, institution monitoring, overlap review and coordination |
| Bureau/Cell Head | `/bureau/dashboard` | Current bureau, narrowed by any exact region | Case updates and assignment to active same-bureau officers; intake, reports, transfer initiation, coordination requests |
| Case Handling Officer | `/officer/dashboard` | Assigned cases in the officer's current bureau, narrowed by any exact region | Permitted ordinary status updates, next actions/dates, remarks, evidence, case history, personal reports, supervisory requests and coordination requests |

Transfer approval requires `APPROVE_TRANSFERS` in addition to a supervisory role and receiving-bureau scope. Escalation decisions require `APPROVE_ESCALATIONS`. Bureau Head cross-bureau overlap decisions require `COORDINATE_CROSS_BUREAU`. Competent Authority officer assignment requires `ASSIGN_OFFICERS`. Administrators assign these delegations through account editing; delegations never enlarge case scope or let officers approve decisions. New accounts have no delegated workflow permissions by default.

Missing bureau assignments deny Bureau Head/officer case access. Administrator is never a blanket complaint-access bypass. Frontend role values do not authorize backend operations. `/` continues to redirect to the correct dashboard, and existing module routes remain available to authorized roles.

## Backend enforcement

- JWT verification loads the active account from storage on every request. Account changes revoke existing tokens through a stored session version. Logout invalidates server-side token acceptance. Existing tokens issued before session-version support require a fresh login.
- Authorization scope is carried through Node AsyncLocalStorage. Store reads filter case and overlap collections before filtering, pagination, analytics and CSV export. Detail/history/document reads use the same scoped case lookup.
- Route checks restrict actions, assignment targets, supervisory decisions, intake bureau/region and institutional ownership. API IDs and supplied search filters cannot widen scope.
- Related-case narratives outside the user's case scope are redacted in overlap lists/details and institution views. Related case references remain available for coordination.
- Transfers begin as pending requests. Ownership remains with the source bureau until an authorized, delegated receiving supervisor accepts. Duplicate pending requests and repeat adjudication are rejected.
- Officers submit transfer/escalation/disposal/coordination recommendations through recorded case requests; those requests do not change status or ownership. Supervisors act through the existing decision modules.
- Coordination remarks, state and optional responsible-official designation are recorded as timestamped, attributed audit events. Coordination history is exposed only through an authorized overlap. Assigned responsibility does not give access to another bureau's case.
- SSE delivery rechecks account status, session version and case scope. Generic unscoped events are not broadcast with case metadata. Legacy file downloads now require a scoped document record.
- Existing bcrypt verification, login throttling, JWT expiry, parameterized PostgreSQL code, upload restrictions and CSV formula neutralization remain. Password hashes/tokens are excluded from account responses and audit details.

## Data preservation and migrations

No live SQL migrations, database resets, user deletion, case deletion or seed commands were executed. Existing JSON records are retained. Optional fields extend users (`permissions`, `lastLogin`), complaints (`nextAction`, `nextActionDate`) and database metadata (`bureaus`). Bureau additions/edits persist through the existing store. Read-time role mapping preserves historical role strings. The reset-demo API remains present but rejects destructive resets; unreadable existing database files now fail rather than being replaced with seed data.

Complaint registration, institutional profiles, complaint lists and details, documents, existing status transitions, transfer history, overlap detection and linking, chronological histories, SLA monitoring, notifications, reports and exports remain integrated. The previously removed alert banners, Status Summary, dashboard Register Complaint button and My Work section have not been restored. New dashboards use role-specific tables rather than those removed panels.

## Verification

- Frontend production build and backend TypeScript build pass.
- 14 isolated HTTP RBAC scenarios cover authentication, disabled accounts, all four roles, missing scope, direct-ID access, report/CSV scoping, overlap redaction, assignment validation, officer decisions, pending transfer approval, administrative restrictions, case requests, account creation/deactivation, delegation denial and logout revocation.
- Existing backend regression suite: 23/23 checks pass after updating obsolete administrator/regional authorization expectations to the new policy.
- Existing acceptance suite: 15/15 checks pass.
- Tests ran against disposable temporary databases, not the user's complaint dataset. New tests use real Express HTTP handlers and store operations, not mocked authorization results.
- Browser interaction, responsive visual inspection, and live PostgreSQL migration tests have not been performed. Vite reports a bundle-size warning; no unrelated dependency or bundling changes were made.

## Local operation

Use the already installed dependencies, or install the existing locked dependencies in `backend` and `frontend` if setting up a fresh checkout.

1. In one terminal: `npm run dev:backend` (API on port 5000).
2. In another: `npm run dev:frontend` (Vite on port 3000, proxying `/api` to port 5000).
3. Sign in with an existing administrator account. Open User Management, assign Bureau Heads and officers, and explicitly select any required delegated permissions. Existing credentials are retained.
4. `npm --prefix backend run test:rbac` runs the isolated HTTP scenarios. Local loopback access must be permitted by the execution environment.
5. `npm run build` builds both applications.

The legacy `npm test` scripts write test fixtures through the store. Run them only with `DATA_DIR` set to a disposable directory; this is how regression verification was performed here.

## Remaining limitations

This is a verified local-store implementation, not a claim that every enterprise requirement in the request is complete. PostgreSQL route integration, database-level RLS migration, indexed queries, multi-process transactions, tamper-resistant external audit storage, secure production session/token storage, forced credential rotation/delivery, durable SLA configuration, and deployment/load testing remain production work. The JSON store still scans collections in memory and is unsuitable for concurrent multi-instance operation. Existing SLA configuration remains process-local.

User tables and audit previews are client-filtered/limited rather than server-paginated. Transfer/escalation approvals use the documented delegation flags, but a multi-stage approval hierarchy is not implemented. Officers cannot directly link another bureau's cases; supervisors use the dedicated overlap review module. Coordination requests and decisions are preserved, but there is no separate workflow inbox with a formal request-to-decision foreign key. Formal UI accessibility and responsive-browser audits remain outstanding.

## Files created or updated

Created:

- `backend/src/security/rbac.ts`
- `backend/src/tests/rbac_tests.ts`
- `frontend/src/pages/RoleDashboard.tsx`
- `frontend/src/pages/AdminWorkspace.tsx`
- `frontend/src/components/common/CoordinationPanel.tsx`
- `RBAC_IMPLEMENTATION.md`

Updated:

- `backend/package.json`
- `backend/src/config/constants.ts`
- `backend/src/models/types.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/db/store.ts`
- `backend/src/routes/auth.ts`
- `backend/src/routes/admin.ts`
- `backend/src/routes/analytics.ts`
- `backend/src/routes/complaints.ts`
- `backend/src/routes/institutions.ts`
- `backend/src/routes/overlaps.ts`
- `backend/src/routes/transfers.ts`
- `backend/src/server.ts`
- `backend/src/tests/run_tests.ts`
- `frontend/src/App.tsx`
- `frontend/src/services/types.ts`
- `frontend/src/services/api.ts`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/components/common/ProtectedRoute.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/pages/AdministrationPage.tsx`
- `frontend/src/pages/CaseList.tsx`
- `frontend/src/pages/ComplaintDetails.tsx`
- `frontend/src/pages/InstitutionDashboard.tsx`
- `frontend/src/pages/InstitutionDirectory.tsx`
- `frontend/src/pages/OverlapCenter.tsx`
- `frontend/src/pages/OverviewDashboard.tsx` (legacy role compatibility only; removed panels stay removed)
- `frontend/src/pages/WorkflowTransfers.tsx`

Build commands also regenerate ignored `backend/dist` and `frontend/dist` outputs and TypeScript build caches.
