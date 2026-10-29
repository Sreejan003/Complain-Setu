# Complain Setu frontend design upgrade

Implemented on 29 October 2026. This delivery changes the existing React frontend; it does not replace the application or its complaint workflows.

## Audit and before/after

The audit covered the route map, four official dashboards, institutional views, complaint intake/list/details, overlap comparison and decisions, coordination, transfers, notifications, reports, settings, shared controls, and localization resources. Existing backend responses and capabilities remain authoritative.

| Before | After |
| --- | --- |
| Small text, angular cards, inconsistent controls and borders | Shared navy/teal palette, 14px base text, clear heading hierarchy, restrained white surfaces, 8–12px corners and consistent controls |
| Flat navigation with weak context and a content-consuming sidebar on mobile | Grouped role-specific navigation, accurate active states, collapsed tooltips, compact page context, and a mobile navigation drawer |
| Dense role dashboards with secondary information mixed into operational queues | Consistent live summary cards, clear queue tabs, and the authority case/review queue before performance analytics |
| Long complaint detail page | Overview, Case Timeline, Documents, Coordination and Related Cases, with the case header and permitted actions available across tabs |
| Coordination presented as an administrative form | Clear session metadata, participant names/Bureaus, stage badges, formal decision confirmation, readable discussion, task cards and a read-only timeline |
| Repeated institution role banners and vertically dense profile details | One page title, searchable directory, live totals, a compact two-column profile/Bureau section and expandable coordination details |
| Technical overlap diagnostics immediately competing with the assessment | Assessment and review actions remain visible; detailed matching information is available through progressive disclosure |
| All main routes bundled into the initial entry | Lazy page modules and separated chart code; the main JavaScript entry decreased from about 1,150 kB to about 294 kB before gzip (not a claim about total downloaded assets) |

## Design system and layout

`index.css` defines the canvas, surfaces, ink, borders, navy, teal, radii, fields, buttons, page headers, status badges, tables, tab navigation and focus styles. Existing success, warning and error meaning is preserved. Government identification, the tricolor strip, AICTE identity and the demonstration marker remain visible.

Reusable frontend primitives include PageHeader, SectionCard, StatCard, StatusBadge, EmptyState, ErrorState, LoadingSkeleton, ModalFrame and ConfirmDialog. Existing DashboardUI exports now use the shared tokens, so dependent screens retain their existing behavior while receiving the same presentation.

The navigation model preserves existing destinations by role. Unknown roles receive no links. Hash sections, assignment filters and nested case/institution/coordination routes highlight the appropriate item. System Settings no longer highlights alongside every other admin section. Global complaint search uses the existing search endpoint and is hidden when the current role cannot visit the complaint route.

## Roles and preserved workflows

| Role | Presentation priority |
| --- | --- |
| System Administrator | User/access management, role metadata, Bureaus, audit metadata, settings and health; no new confidential case navigation |
| Competent Authority | Authorized complaint/review queue, scope filters, coordination access, then performance and institutional insights |
| Bureau/Cell Head | Bureau totals, unassigned/overdue/review/transfer queues and officer workload |
| Case Handling Officer | Assigned cases, due-date views, next actions and supervisory requests |

Existing intake, assignment, complaint transitions, disposal/reopening, transfers, overlap decisions, institutional scope, coordination approvals/messages/tasks/evidence, notifications, exports and audit integrations remain connected. No database schema, backend service, authentication behavior or role permission was changed.

All original route paths remain present: login; the four role dashboards; institution dashboard and institution redirect/profile routes; complaint registration; cases and case details; overlaps; transfers; notifications; coordination directory/session; analytics; and administration. The index redirect and protected-route checks remain intact. Legacy frontend views remain available in source and receive compatible presentation tokens rather than being deleted.

## Targeted frontend interaction fixes

- Complaint requests previously serialized absent filters as the literal string `undefined`. The frontend now omits undefined/null parameters while retaining meaningful false, zero, empty and Unicode values. This fixes empty complaint registers without changing server filtering or access rules.
- Supervisor “My Cases” and “All in scope” controls now update the URL scope used by the existing request. Pagination displays page 1 of 1 for an empty result rather than page 1 of 0.
- Register Complaint controls respect the existing route guard; officers are not offered an unauthorized registration action.
- Formal coordination decisions, assignment/revocation and completion use a review dialog showing the selected action and recorded remarks. Existing server versions, independent approvals and record authorization still decide whether an action succeeds.
- Existing dialogs have names, Escape handling, focus containment and focus return. Nested dialogs keep only the top dialog interactive. Tall centered dialogs can scroll on small screens.
- Registration warns before browser reload/close when title, description or evidence is unsaved. This is not an application-wide internal-navigation blocker.
- Complaint load failures offer retry, and shared loading/empty/error states replace otherwise blank panels in the main updated views.

## Responsive, accessibility and language work

- Desktop navigation can collapse; mobile/tablet use a drawer instead of reducing the content to a narrow strip. Navigation remains available through a labeled toggle.
- Summary cards adapt to the available width. Existing mobile case cards are preserved; wide ledgers scroll inside their table container.
- Fields use readable sizes and touch-friendly control heights. Forms retain required fields, validation, existing submission states and audit remarks.
- Added a skip-to-content link, visible keyboard focus, navigation/current-page state, explicit control names, text-bearing status badges and improved case section heading order.
- Reduced-motion preferences disable optional movement. Print CSS removes the navigation shell and releases scroll containers so report content can paginate rather than being clipped by the application viewport.
- New labels use i18next keys in all 23 registered locale resources. Script fonts, original officer-entered text, RTL direction, approved overrides and production approval gating remain intact. New unreviewed labels currently use English fallback. No complaint content was sent to a translation provider.

## Verification

Executed successfully:

- Frontend TypeScript project check and Vite production build (`npm --prefix frontend run build`).
- Interface tests for all official roles plus institutional users; deny-by-default behavior; authorized destinations; exactly one active navigation item; query/hash/nested route behavior; and Unicode/optional complaint filter serialization (`test:interface`).
- Existing coordination frontend permission, transition and canonical localized-value checks (`test:coordination`).
- Localization validation across 23 locales and 10 namespaces (`check:i18n`).
- 33 RBAC integration scenarios against a disposable fixture, including complaint/assignment/transfer/coordination isolation and existing workflow regressions.
- 23 existing backend unit checks and 15 acceptance checks with an explicitly isolated temporary `DATA_DIR`.
- Hash comparison against the task-start snapshot: backend source unchanged; authentication context, frontend access guard implementation and language registry unchanged. The route path inventory is unchanged.

Browser verification used disposable test records, never production complaint records:

- All four official role views and their allowed navigation; administrator search omission.
- Case Overview/Documents tabs and the existing action modal; Tab containment, Escape dismissal and return to the invoking control.
- Complaint register populated from the authorized API; search narrowed the result and clear restored it.
- Institution directory/profile data, coordination directory and participant information, retained Hindi/Tamil/Urdu discussion text, transfer history and report tables/actions.
- Mobile width of 390px: no permanent sidebar or horizontal document overflow; the navigation drawer contains focus and closes after selection; case cards and controlled ledger scrolling remain available.
- Urdu development preview: `lang=ur`, `dir=rtl`, Noto Naskh Arabic, right-side navigation and no horizontal page overflow. Production language approval settings were not relaxed.

## Remaining limits

- This is WCAG 2.2 AA-oriented implementation and targeted browser verification, not a complete accessibility certification or testing of every assistive technology/browser combination.
- New terminology and English fallbacks still require native-language review. Existing approval status was not upgraded.
- The coordination list endpoint does not provide per-row pending-task totals; the redesign does not invent those counts or add backend analytics. Existing bounded/paginated data behavior remains.
- Existing optional coordination features such as read receipts and performance analytics remain outside this frontend-only delivery. The operational store remains the existing JSON implementation.
- Print styling is included; printer/browser-specific pagination has not been certified. Existing CSV/PDF-print actions remain connected.
- Unsaved-change warning currently covers browser unload for complaint registration; it is not a universal navigation blocker.

## Files modified in this delivery

The list below is relative to the project root. Earlier task changes already present in the working tree are not attributed to this delivery.

- `FRONTEND_DESIGN_UPGRADE.md`
- `frontend/package.json`
- `frontend/scripts/test-interface.mjs`
- `frontend/src/App.tsx`
- `frontend/src/components/common/CrossBureauCoordinationWorkspace.tsx`
- `frontend/src/components/common/InstitutionOverview.tsx`
- `frontend/src/components/common/LanguageSelector.tsx`
- `frontend/src/components/common/ProtectedRoute.tsx`
- `frontend/src/components/dashboard/DashboardUI.tsx`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/components/layout/Navbar.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/navigation.ts`
- `frontend/src/components/ui/Interface.tsx`
- `frontend/src/i18n/coverage-report.json`
- `frontend/src/i18n/locales/as/navigation.json`
- `frontend/src/i18n/locales/bn/navigation.json`
- `frontend/src/i18n/locales/brx/navigation.json`
- `frontend/src/i18n/locales/doi/navigation.json`
- `frontend/src/i18n/locales/en/navigation.json`
- `frontend/src/i18n/locales/gu/navigation.json`
- `frontend/src/i18n/locales/hi/navigation.json`
- `frontend/src/i18n/locales/kn/navigation.json`
- `frontend/src/i18n/locales/kok/navigation.json`
- `frontend/src/i18n/locales/ks-Arab/navigation.json`
- `frontend/src/i18n/locales/mai/navigation.json`
- `frontend/src/i18n/locales/ml/navigation.json`
- `frontend/src/i18n/locales/mni-Mtei/navigation.json`
- `frontend/src/i18n/locales/mr/navigation.json`
- `frontend/src/i18n/locales/ne/navigation.json`
- `frontend/src/i18n/locales/or/navigation.json`
- `frontend/src/i18n/locales/pa/navigation.json`
- `frontend/src/i18n/locales/sa/navigation.json`
- `frontend/src/i18n/locales/sat-Olck/navigation.json`
- `frontend/src/i18n/locales/sd-Arab/navigation.json`
- `frontend/src/i18n/locales/ta/navigation.json`
- `frontend/src/i18n/locales/te/navigation.json`
- `frontend/src/i18n/locales/ur/navigation.json`
- `frontend/src/index.css`
- `frontend/src/pages/AdminWorkspace.tsx`
- `frontend/src/pages/AdministrationPage.tsx`
- `frontend/src/pages/CaseList.tsx`
- `frontend/src/pages/ComplaintDetails.tsx`
- `frontend/src/pages/ComplaintRegister.tsx`
- `frontend/src/pages/InstitutionDashboard.tsx`
- `frontend/src/pages/InstitutionDirectory.tsx`
- `frontend/src/pages/InstitutionProfile.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/NotificationsPage.tsx`
- `frontend/src/pages/OverlapCenter.tsx`
- `frontend/src/pages/OverviewDashboard.tsx`
- `frontend/src/pages/ReportsAnalytics.tsx`
- `frontend/src/pages/RoleDashboard.tsx`
- `frontend/src/pages/WorkflowTransfers.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/services/query.ts`
