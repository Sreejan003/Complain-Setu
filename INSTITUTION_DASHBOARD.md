# Shared Institution Dashboard

The existing `/institution-dashboard` route serves all four official roles and continues to serve Institutional Users. The sidebar calls this Institution Dashboard. No complaint workflow permissions were broadened.

## Visibility policy

| Role | Institution master data and totals | Confidential case records and actions |
| --- | --- | --- |
| System Administrator | Directory, profiles and non-sensitive institution-wide status/Bureau totals within configured region | No case narratives, evidence, investigation remarks or decisions |
| Competent Authority | Institution overview within configured region | Existing Bureau/region scope and supervisory capabilities |
| Bureau/Cell Head | Institution overview, including cross-Bureau counts and status indicators, within configured region | Existing own-Bureau and region case scope and delegated actions |
| Case Handling Officer | Institution overview, including cross-Bureau counts and status indicators, within configured region | Existing assigned cases in own Bureau/region only |
| Institutional User | Own institution only | Existing own-institution permissions |

`mayViewInstitution` in the existing RBAC module governs institution reads, including direct institution/Permanent-ID lookups. Aggregates disclose only counts, status labels and Bureau codes. They contain no complaint identifiers, narratives, assignee names, documents or timeline remarks. Counts are calculated from actual records in the active JSON Store, with no 100-row truncation. Exact institution-level aggregate counts are permitted by this policy; case details remain separately scoped.

The existing complaint, evidence, transfer, overlap decision, audit and export APIs keep their case-specific authorization. Institution metrics expose scoped urgent records and charts separately from institution totals. The UI states that distinction. Existing complaint detail/timeline links remain available for authorized records. Administrators do not request the complaint register or see case-changing controls.

The shared directory adds server-side search, state, region, institution type, complaint status and Bureau filters, pagination and clear filters. The profile adds missing-value states, official contact details, Bureau involvement and coordination status indicators. Existing charts, complaint filtering, registration for permitted roles and case detail features remain available. The six compact cards show total, pending, in-progress, disposed, escalated and potential overlaps; overdue/high-priority and transferred counts remain in the involvement section.

Existing scoped live-event subscriptions remain active. A 30-second refresh also updates safe aggregates/directory rows for changes whose confidential events the viewer is not allowed to receive. The application does not widen event access, merge cases or change ownership.

New labels use existing i18next namespaces with English fallback in all draft locales. Approved resources and production-language gates are unchanged. This is not native-language approval.

## Files for this change

- `backend/src/security/rbac.ts`
- `backend/src/db/store.ts`
- `backend/src/routes/institutions.ts`
- `backend/src/tests/rbac_tests.ts`
- `frontend/src/services/access.ts`
- `frontend/src/services/types.ts`
- `frontend/src/components/common/ProtectedRoute.tsx`
- `frontend/src/components/common/InstitutionOverview.tsx` (new shared directory/profile sections)
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/pages/InstitutionDashboard.tsx`
- `frontend/scripts/check-i18n.mjs` (recognizes complete literal keys instead of dynamic key prefixes)
- `frontend/src/i18n/catalog.ts`
- `frontend/src/i18n/locales/<locale>/complaints.json` for all 23 registered locales (new `institutionOverview` keys only)
- `frontend/src/i18n/coverage-report.json` (generated check results)
- `INSTITUTION_DASHBOARD.md`

## Verification

Production frontend/backend build and `npm --prefix frontend run check:i18n` passed. All 32 disposable-database RBAC integration scenarios passed, including four-role overview reads, filtered totals, authorized-only case responses, administrator redaction, region-bound lookups, and existing assignment/transfer/disposal/escalation/overlap/evidence protections. No database migrations, seed/reset operations, authentication changes or new runtime dependencies are needed.

Run the existing application from VS Code with `npm run dev:backend` and `npm run dev:frontend` in separate project-root terminals. Run `npm --prefix backend run test:rbac` for isolated integration tests.
