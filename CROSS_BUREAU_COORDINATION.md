# Cross-Bureau Coordination upgrade

## Existing implementation and design

The original `CoordinationPanel` stores overlap-linked remarks/status audit entries. `WorkflowRequests` supplies supervisory recommendations, and existing complaint/transfer APIs retain case-specific RBAC, evidence, history, notifications and authenticated SSE. There was no durable shared participant lifecycle, two-sided approval, task/conversation model or document-specific cross-Bureau grant.

The upgrade keeps those features and adds one reusable `CrossBureauCoordinationWorkspace` at `/coordination` and `/coordination/:id`. Complaint Details, the existing overlap coordination panel, role dashboards, the sidebar and notifications lead to the same workspace. Coordination can start without an overlap alert. AI overlap explanations, related-case linking and existing overlap decisions remain in the authorized Overlap Center; AI never authorizes workspace participation or merges complaints.

## Workflow and policy

1. An eligible officer requests assistance on a case they can read. The server derives complaint, institution, primary Bureau, lead officer and region from the stored case. Officers cannot raise its request priority; supervisors can use the API to set an authorized priority. Target Bureaus come from the configured directory. Required reason/assistance and optional response dates are validated.
2. The originating Bureau Head (or a delegated, scoped authority) approves, rejects or returns the request for clarification. The requester cannot approve their own request. The receiving Bureau cannot discover an unapproved request.
3. The receiving Bureau Head sees only the approved request summary, then accepts, rejects with remarks, or requests clarification. Acceptance alone does not grant an officer access. The receiving Head assigns one or more active, region-eligible officers from their own Bureau; authority assignments require the existing assignment delegation.
4. Assigned participants collaborate through Overview, Discussion, Tasks, Documents and Activity Timeline. Conversation search runs server-side across the thread; messages, tasks and timeline endpoints are paginated. Text is stored as entered, including Indian scripts, and is not sent to translation services. Messages and formal decisions have separate record types; no message is interpreted as approval.
5. Tasks follow Pending → In Progress → Submitted → Accepted → Completed, with a Rework path. Officers update only their assigned tasks. Supervisory review or the lead officer's independent review is needed for acceptance/completion. Self-review is rejected. Version checks guard both session and task updates; mutation request IDs make retries idempotent.
6. Contributors submit findings. The lead Bureau acknowledges the contribution, requests clarification, or escalates disagreement. Only a scoped Competent Authority resolves an escalated disagreement. Completion requires acknowledged findings, completed tasks, and no unanswered participation decisions. Complaint disposal remains a separate existing authorized operation.

Additional Bureaus have independent participation decisions. Heads can revoke participation and reassign officers with retained events. Disabled accounts, Bureau/region changes and revocations are rechecked on every request. Primary Bureau or lead-assignment changes, and case disposal, freeze further coordination mutations. The old workspace remains an authorized read-only record; the current case owner must use the established case workflow and initiate a fresh approved session where appropriate. Coordination never rewrites case ownership, assignees, status or SLA dates.

| Role | Coordination access |
| --- | --- |
| System Administrator | Administrative audit metadata and existing technical configuration; no coordination content APIs |
| Competent Authority | Scoped oversight, disagreement resolution; delegated cross-Bureau decisions/assignment where required |
| Bureau/Cell Head | Origin approval or own-Bureau acceptance/assignment, supervision and permitted revocation |
| Case Handling Officer | Assigned primary case requests, explicitly assigned workspace participation, own tasks and permitted shared evidence |
| Institutional User | No internal coordination access |

## Documents, audit and updates

No original evidence is shared automatically. After activation, authorized participants can upload PDF, PNG, JPEG or DOCX files up to 10 MB, or a case-authorized user can explicitly share an existing case document. Uploads validate file extension, MIME and signature; generated filenames prevent user-controlled filesystem paths. Sharing is a document-specific list of accepted Bureaus, subject to active workspace membership. The lead Bureau retains access as stated in the UI. A scoped authority still needs the correct sharing scope or existing primary-case access. Documents can link to a task. Downloads recheck grants, account state and revocation; direct complaint evidence APIs do not gain new permissions.

Uploads reuse the existing evidence metadata/store and storage directory. Session changes, case-history entries, administrative audit metadata and generic in-app notifications commit through the existing Store transaction, including rollback on persistence failure. Audit/history records are append-only through these APIs. Task revisions and assignment/revocation details remain in events. No coordination edit/delete-message endpoint exists.

SSE reuses `/api/complaints/stream/live`. Coordination events contain only a session ID/invalidation signal and are independently filtered using current workspace permissions. Messages and document contents are never broadcast. Notifications use generic previews and are filtered again against current membership. The client refreshes on these events and periodically as a fallback. Legacy overlap notes retain their original function but are Bureau-scoped, and their notifications no longer broadcast remark contents.

Reminder configuration uses environment settings, not invented statutory SLA rules:

- `COORDINATION_REMINDER_HOURS`: repeat interval, default 24 hours.
- `COORDINATION_DUE_SOON_DAYS`: requested-date warning window, default 3 days.
- Reminders run on the existing SLA scheduler cadence; duplicate notifications within an interval are suppressed.
- `COORDINATION_MIN_RETENTION_DAYS`: reported minimum retention policy; default 0 means retain indefinitely. There is no automatic deletion/purge. A minimum setting never silently deletes records when it expires.

## Persistence and APIs

The operational routes use the existing JSON `Store`. An optional `coordinationSessions` collection contains sessions, independent Bureau participants, approvals, messages, tasks, document grants, events and retry/reminder receipts. It is populated on first use; existing files without the field remain valid. Original complaints, users, audit, notifications and evidence are reused. No live seed/reset, PostgreSQL migration, parallel account system or runtime dependency was added.

Authenticated endpoints:

- `GET/POST /api/coordination` — scoped paginated directory/KPIs and request creation.
- `GET /api/coordination/bureaus` — configured Bureau options.
- `GET /api/coordination/:id` — permission-filtered workspace summary and bounded previews.
- `GET /api/coordination/:id/officers?bureau=…` — supervisor-only eligible assignees.
- `POST /api/coordination/:id/actions/:action` — formal decisions, invitation/assignment/revocation, messages, tasks, document grants, findings/acknowledgement, clarification, escalation/resolution and completion. Requires current `version` and `requestId`.
- `GET /api/coordination/:id/messages`, `/tasks`, `/timeline` — scoped pagination; message search is available through `search`.
- `POST /api/coordination/:id/documents` — explicit multipart upload/sharing.
- `GET /api/coordination/:id/documents/:shareId/download` — authorized attachment download.

## Files added

- `backend/src/models/coordination.ts`
- `backend/src/security/coordination.ts`
- `backend/src/services/coordination.ts`
- `backend/src/routes/coordination.ts`
- `backend/src/tests/coordination_scenarios.ts`
- `frontend/src/components/common/CrossBureauCoordinationWorkspace.tsx`
- `frontend/src/services/coordination.ts`
- `frontend/src/services/coordinationControls.ts`
- `frontend/src/services/coordinationNotice.ts`
- `frontend/src/i18n/coordinationLabels.json`
- `frontend/scripts/test-coordination.mjs`
- `CROSS_BUREAU_COORDINATION.md`

## Files updated

- Backend: `src/db/store.ts`, `src/models/types.ts`, `src/server.ts`, `src/routes/complaints.ts`, `src/routes/overlaps.ts`, `src/services/slaScheduler.ts`, `src/tests/rbac_tests.ts`.
- Frontend: `package.json`, `src/App.tsx`, `src/services/access.ts`, `src/services/api.ts`, `src/services/types.ts`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Navbar.tsx`, `src/components/common/CoordinationPanel.tsx`, `src/pages/ComplaintDetails.tsx`, `src/pages/RoleDashboard.tsx`, `src/pages/NotificationsPage.tsx`.
- Localization: `frontend/src/i18n/locales/<locale>/workflow.json` for `as`, `bn`, `brx`, `doi`, `en`, `gu`, `hi`, `kn`, `kok`, `ks-Arab`, `mai`, `ml`, `mni-Mtei`, `mr`, `ne`, `or`, `pa`, `sa`, `sat-Olck`, `sd-Arab`, `ta`, `te`, `ur`; plus generated `frontend/src/i18n/coverage-report.json`.

## Verification and limits

Validation passed: the full build; 23 unit checks; 15 acceptance checks; 33 RBAC integration scenarios; frontend coordination permission/transition checks; and localization validation across all 23 registered locales. The build retains the existing Vite large-chunk warning.

The expanded disposable-database suite exercises successful collaboration, rejection, clarification, three participating Bureaus, direct-URL denial, own-task updates, rework, stale task versions, retry idempotency, Unicode messages and conversation search, explicit upload/download/revocation, scoped-authority document denial, inactive/moved/revoked participants, durable reopening through a new Store instance, transaction rollback, reminder idempotency, SSE recipient isolation, unchanged case ownership during coordination, freezing after a separately approved Bureau transfer, and disposal freeze. The existing unit and acceptance suites were run with an explicitly disposable `DATA_DIR`; operational complaint records were not used for testing.

Browser verification against the disposable fixture covered the scoped request queue, keyboard navigation into the shared workspace, participant names, the completed read-only discussion and retained Hindi/Tamil/Urdu text. At 390 × 844, the workspace fits without horizontal document overflow with the existing sidebar collapsed. The shared sidebar itself retains its existing expanded/collapsed behavior. Screenshots were saved outside the application source tree.

The active JSON store remains a single-process prototype; PostgreSQL coordination persistence was not introduced or represented as operational. Read receipts and optional performance analytics are not implemented. New labels use English fallback in unreviewed development locales; existing approved terminology and production-language gates remain intact. The request initially discloses no supporting files; evidence sharing becomes available after activation. The existing overlap module remains the place to review/link related complaint records, while each session retains one primary complaint.
