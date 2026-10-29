# RBAC and dashboard upgrade — 29 October 2026

## Existing architecture and gaps confirmed

The working application remains React, TypeScript, React Router, Tailwind, Node/Express, bcrypt and JWT authentication, with routes using the synchronous local JSON store. PostgreSQL interfaces are retained and have not been connected or migrated as part of this task.

Source inspection found duplicated role/action tests, no active-account check in the reusable read policy, no central action evaluator, supervisory delegation flags accepted on officer accounts, client-paginated administrative users, three mostly identical complaint dashboards, history-only recommendations, hardcoded and inconsistent due-soon windows, token-bearing CSV URLs, a disabled-endpoint Reset Demo button, and incorrect transfer-request/rejection history. Browser testing also found that a different role could be redirected back to the previous role's protected page after signing in.

## Effective permission matrix

Every protected request reloads the active profile and session version. Legacy aliases normalize through `effectiveProfile`/`roleOf`; unknown roles are rejected. `authorize(user, action, resource, context)` combines role, delegation, current bureau, exact region, assignment and state. Frontend navigation guards are convenience checks; backend enforcement remains authoritative.

| Capability | System Administrator | Competent Authority | Bureau/Cell Head | Case Handling Officer |
| --- | --- | --- | --- | --- |
| Users, roles, scopes, bureaus, security audit, SLA configuration | Yes; no self-modification | No | No | No |
| Complaint content and evidence reads | No | Authorized bureau/region, otherwise organization-wide | Current bureau and configured region | Assigned cases in current bureau/region |
| Ordinary progress, remarks and next actions | No | Authorized cases | Authorized cases | Assigned active cases; cannot bypass escalated/transferred supervisory states |
| Officer assignment | No | `ASSIGN_OFFICERS` plus case scope | Own bureau/region; active eligible officers only | No |
| Disposal | No | Existing permitted transitions and scope | Existing permitted transitions and scope | Recommendation only |
| Reopening | No | Disposed → Under Process, explicitly authorized | No; existing stricter authority-only rule retained | No |
| Transfer initiation | No | Authorized cases | Own cases | Structured recommendation only |
| Transfer acceptance/rejection | No | `APPROVE_TRANSFERS`, receiving scope, current state | Receiving bureau/region plus `APPROVE_TRANSFERS` | No |
| Escalation approval | No | `APPROVE_ESCALATIONS` plus permitted transition | Same delegation plus scope | Recommendation only |
| Cross-bureau overlap decision | No | Authorized scope | `COORDINATE_CROSS_BUREAU` plus scope | Assigned-case visibility and coordination requests only |
| Evidence upload | No | Permitted active cases | Permitted active cases | Assigned active cases |
| Reports and CSV | Administrative reports only | Authorized case scope | Bureau/region scope | Assigned-case scope |

Only the four existing delegation flags can be saved. Heads cannot receive the authority-only assignment flag; officers and administrators cannot receive supervisory delegations. Existing legacy officer flags do not confer approval authority. Bureau/region filters only intersect server scope. Missing mandatory bureau assignment never grants broader access.

Institutional User remains a separate external account type. Its own-institution intake, profile, evidence and notifications remain available within existing authorization. It is not offered as a fifth internal role.

## Four distinct dashboards

- **System Administrator — `/admin/dashboard`:** Four metrics for active users, inactive users, configured units and the last 30 days of administrative/security events. Server-paginated/searchable/filterable directory; create/edit/deactivate/reactivate/reset-credential workflow; eligible delegation controls; mandatory bureau validation; effective-access summary and confirmation. Roles, bureaus and audit are separate hash-addressed views. Bureau staffing/head counts come from actual profiles. `/admin` contains existing SLA configuration and verified operational health, without duplicate user management or the broken Reset Demo control.
- **Competent Authority — `/authority/dashboard`:** Five scoped metrics, status distribution, recorded disposal trend, bureau/region comparison, received-date/bureau/region filters, authorized complaint overview and supervisory decision queue. Collapsed secondary insights link actual institutions, overlap outcomes and scoped reports. Overlap suggestions remain distinct from recorded official outcomes.
- **Bureau/Cell Head — `/bureau/dashboard`:** Five bureau/region metrics; unassigned/due-soon/overdue/pending-review/active/transfer queues; eligible assignment links; active-officer workload with pending/overdue/due-soon counts and last recorded case action. Incoming and outgoing transfers, coordination and bureau performance remain secondary expandable views.
- **Case Handling Officer — `/officer/dashboard`:** Four metrics for assigned cases, actions due today, upcoming disposal deadlines and completed cases. Prioritization uses overdue next-action dates, today's actions, nearest deadlines, priority and receipt date. Filters and metrics open the matching scoped population. Personal recommendation receipts show review state, official, remarks and time. After a transfer, a personal receipt may remain visible without granting access to the former case or its current narrative.

“Actions Due Today” means an active assigned complaint with a recorded `nextActionDate` equal to today's UTC calendar date, consistent with the existing server date-only convention. It does not substitute the disposal date. Due-soon dates use the existing configurable monitor threshold; legal/prescribed case deadlines and existing priority SLA values were not changed.

Shared header, metric, table, decision-queue and pagination components use the existing navy/white/neutral identity. Complaint rows become stacked records at narrow widths. Dashboard headers include user, role, bureau, region when present and last-refresh time. No removed alert banner, Status Summary, Disposal Turnaround Rate widget, dashboard Register Complaint button or My Work section was restored.

## API and workflow changes

- `GET /api/analytics/role-dashboard` now returns role metrics, their definitions, scoped paginated queues, request states, incoming/outgoing transfers, workload, distributions and available filter options. Counts are computed before pagination.
- `GET /api/admin/users?paginated=true` adds server pagination, search, role and account-state filters. Existing callers without this flag retain their array response. Administrative summary adds inactive-user counts; bureau responses add recorded head and staffing information.
- `GET /api/complaints/:id/eligible-officers` supplies only active officers eligible for that case's bureau/region, with workload. Authority access requires its assignment delegation.
- `GET/POST /api/complaints/:id/requests` reads/submits structured recommendations. The existing POST route remains compatible; transfer recommendations additionally require a configured destination.
- `PATCH /api/complaints/:id/requests/:requestId/decision` records approval/rejection, reviewer, remarks and timestamp. The current case version and submission snapshot prevent stale approvals, repeated decisions and ownership races. Superseded recommendations can be explicitly rejected with the current case version. Self-review is denied.
- Approval of a disposal/escalation recommendation uses existing backend status transitions. Approval of a transfer recommendation creates a pending destination transfer; it does not itself move ownership. Coordination recommendations record an attributed supervisory decision. Existing overlap linking/review remains in the Overlap Center.
- Case details return backend `allowedActions` and permitted statuses. Controls, eligible lookup, SLA override, evidence and requests use these capabilities. The recorded next action/date are displayed instead of a fabricated suggested action.
- Transfer requests preserve source ownership, assignment and status. History says “Transfer Requested.” Rejection retains the current state. Acceptance requires receiving scope/delegation, a current version and a still-eligible destination officer. Decision attribution and remarks are persisted.
- CSV downloads now use Authorization headers, and exports iterate all authorized pages rather than silently truncating at 100 rows. The legacy URL helper no longer adds tokens. Existing SSE transport compatibility is retained; ordinary query-token authentication remains denied.
- Account access/credential changes create a fresh session version. Role changes, deactivation and logout revoke existing acceptance. Login restores only a route allowed for the authenticated role.
- The configured SLA settings now persist in the JSON store. The manual monitor button invokes the existing configured system job in its system scope and records the administrative trigger. It does not give the administrator complaint content or a direct status-decision permission. System monitor actions retain their existing system attribution and configured rules.

## Persistence and audit

The JSON schema has additive optional `workflowRequests`, `slaConfig`, session-version and transfer-decision metadata. There is no live SQL migration, reset, reseed, bulk role rewrite or table deletion. Existing historical recommendations remain in their original timelines; no invented approval outcomes were backfilled.

Synchronous local-store transactions defer persistence, then replace the JSON file atomically, or restore the in-memory snapshot on failure. Case progress, recommendation decisions, transfer decisions and overlap reviews use this path. Registration runs its asynchronous detection first and commits records/history/alerts together; new IDs use UUIDs and complaint references are checked at commit. Existing files are not silently replaced by seed data, and existing datasets no longer receive implicit seed-profile insertions. New complaints without an actual assignee no longer display a fabricated officer name.

Administrative audit records include before/after access configuration, credential-change indicators and session revocation without password material. Workflow histories preserve request submission, assignment, official decisions, transfer outcomes, escalation, disposal and reopening with actors and timestamps. Evidence metadata, downloads, notifications, reports, exports, overlap narratives and live events keep the relevant case scope.

## Executed verification

- Backend TypeScript build: passed.
- Frontend production build: passed. The existing bundle-size warning remains; no dependency or bundling upgrades were introduced.
- HTTP RBAC/workflow suite: **31/31 scenarios passed**, using real Express handlers and disposable JSON/evidence directories. Scenarios include all roles, unknown/legacy roles, bureau and region boundaries, direct-ID denial, disabled and revoked sessions, delegated approvals, eligible lookup, structured escalation/disposal/transfer decisions, stale approval rejection, personal receipts, evidence downloads, live-event/notification isolation, export pagination, rollback, KPI-to-queue counts and persisted SLA configuration/system monitoring.
- Existing regression suite: **23/23 passed**; existing acceptance suite: **15/15 passed**. Obsolete transfer-history expectations were updated to assert pending ownership followed by explicit receiving approval.
- Browser checks on isolated fixture data: all four role destinations; administrator form labels/effective-access summary; authority decision KPI; Bureau Head KPI and assignment/workload form; officer queue and recommendation receipts. The observed post-logout role-redirection bug was fixed and subsequent role login went to the correct dashboard.
- Layouts inspected at **1366×768** and **390×844**. Narrow officer page: measured page width 386 versus viewport 390, zero unlabelled visible input controls, and keyboard Tab from search reached Open Case. This is targeted accessibility verification, not formal WCAG certification.

### Live data verification limit

Mutating tests and browser fixtures used disposable `DATA_DIR` paths; test uploads were redirected there too. No test was deliberately run against `backend/data/db.json`.

The starting live-file checksum was `ecb144353e2a4ef5d305153242895df6da2bdf561e25c1f4cb5818414b886361`. A later checksum was `966e16e00d5722f7d1e4f006b43730fe9aa84d77868f2ee78001f0ab121a3eb3`. The live audit contains authenticated sign-ins during this work, including 20:33 and 20:38 UTC on 28 October. Therefore byte-for-byte preservation cannot be claimed. The live file was not restored/overwritten to force a checksum match. Its recorded reset timestamp remains 27 October; the inspected file contains 131 complaints, 36 institutions, 18 transfers, 71 overlaps and their history/audit collections. A full before/after record inventory was not captured, so absence of every possible concurrent record change is unverified.

## Remaining limits

The JSON store remains a single-process local-development design; atomic file replacement is not a multi-process database transaction or tamper-proof audit system. PostgreSQL/RLS integration, load/concurrency testing across multiple instances, formal accessibility certification and a full browser matrix remain separate work. No production database connection, email credential-delivery channel or production deployment was verified. Core role policies are fixed rather than arbitrary custom permissions. Credential resets remain authenticated administrative operations with audit and session revocation; no external delivery mechanism was invented.

## Run locally in VS Code

Use two terminals from the repository root:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

Open the Vite URL (normally `http://localhost:3000`). The backend normally listens on port 5000. Existing credentials are retained. Administrators configure heads, mandatory bureaus/regions and eligible delegations through User Management.

`npm --prefix backend run test:rbac` automatically uses disposable data. The older `npm test` suite must be given a disposable directory:

```powershell
$env:DATA_DIR = Join-Path $env:TEMP ('iicmcs-tests-' + [guid]::NewGuid())
npm --prefix backend test
Remove-Item Env:DATA_DIR
```

Do not set the application server's `DATA_DIR` to a test directory when starting it for normal work.

## Exact source files created

- `backend/src/services/roleDashboard.ts`
- `frontend/src/components/common/WorkflowRequests.tsx`
- `frontend/src/components/dashboard/DashboardUI.tsx`
- `frontend/src/services/access.ts`

## Exact existing source files changed

- `backend/src/db/store.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/models/types.ts`
- `backend/src/routes/admin.ts`
- `backend/src/routes/analytics.ts`
- `backend/src/routes/auth.ts`
- `backend/src/routes/complaints.ts`
- `backend/src/routes/transfers.ts`
- `backend/src/routes/overlaps.ts`
- `backend/src/security/rbac.ts`
- `backend/src/server.ts`
- `backend/src/services/slaScheduler.ts`
- `backend/src/tests/acceptance_tests.ts`
- `backend/src/tests/rbac_tests.ts`
- `backend/src/tests/run_tests.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/common/CoordinationPanel.tsx`
- `frontend/src/components/common/ProtectedRoute.tsx`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/pages/AdministrationPage.tsx`
- `frontend/src/pages/AdminWorkspace.tsx`
- `frontend/src/pages/ComplaintDetails.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/OverlapCenter.tsx`
- `frontend/src/pages/ReportsAnalytics.tsx`
- `frontend/src/pages/RoleDashboard.tsx`
- `frontend/src/pages/WorkflowTransfers.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/services/types.ts`

Documentation: this report was created and `RBAC_IMPLEMENTATION.md` received a superseding-report notice. Builds regenerate ignored `backend/dist`, `frontend/dist` and TypeScript caches. No package/dependency version changes were made.
