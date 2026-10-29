# Phase 11 — Scoped reporting and private schedules

Implemented 30 October 2026. Existing analytics, CSV and browser print remain available; the filtered report workspace is linked from Reports & Analytics at `/reports`.

## Shared authorization and filters

The new `reporting.ts` pipeline derives preview totals, regional grid/table and report ledgers from exactly the same currently readable records. It reloads the active profile and applies existing role, current Bureau, region, assignment and confidentiality rules before filtering. System administrators and institutional users cannot access case reporting. Filters support institution ID/permanent ID, exact region (or an explicit unknown flag), current handling Bureau, status, case type, source, and inclusive received dates. Type/source are not inferred for historical records.

Regional labels come from authorized institution master records; no coordinates, boundaries or maps are invented. The grid and table include genuine zero counts and an unknown/unassigned region bucket. Missing region/type/source/received-date coverage is reported separately. Region buttons apply click-through filters. Missing data is not interpreted as zero or as an allegation/finding.

Period selection supports custom dates, month, quarter and year, with explicit calendar (January–December) and financial (April–March) reporting conventions. A financial year's month 1 is April and its year is the starting year. Boundaries use UTC received dates. `current-quarter` replaces the old hardcoded Q1 2026 option. The existing analytics CSV button now applies its selected period and current Bureau, matching its KPI total; the new workspace provides the complete filter set. Existing historical charts are retained, rather than represented as newly filtered report charts.

## Files and print

- CSV preserves Unicode and neutralizes formula prefixes, including leading whitespace/control characters.
- Excel is a real XLSX workbook with typed string cells (never formulas for supplied strings), header/frozen row/filter, full authorized ledger and a scope/coverage sheet.
- PDF is a real PDF report containing the same total, missing-metadata counts and stable internal case identifiers/status/dates. The complete original Unicode ledger and exact scope/region information are embedded as `report.csv` and `scope.json`. The PDF states this presentation boundary; it does not claim to typeset every Indian script. Standalone CSV/Excel remain available for the full visible ledger fields.
- No narrative, complainant identity, secret grants, credentials or evidence bodies are exported. Report files are generated on request and not placed in a public directory.
- Browser print is retained. The web ledger explicitly displays the first 100 rows; exports include all matching rows up to a **5,000-case** limit. Larger exports fail explicitly with 413 and require narrower filters. No silent truncation occurs.
- Exports recompute current authorized data under the displayed applied filters. New or changed cases between preview and export may change totals; timestamps identify the generation time. Scheduled packs preserve the generated snapshot.

Implementation uses existing ExcelJS and pinned `pdfkit@0.20.2` / `@types/pdfkit@0.17.7`. PDFKit's official stream and embedded-file APIs were checked against its documentation. Dependency installation reported zero vulnerabilities. No new external service or live recipient integration is used.

## Private schedules and historical packs

Persistent monthly/quarterly schedules store private owner, version, enabled state, basis and filters. Dates are generated dynamically for the previous complete period; fixed dates are rejected for schedules. Explicit generation and the existing background operational timer use the same generator. Multi-instance PostgreSQL serialization and a unique schedule/period key make repeated generation idempotent, including concurrent requests. Changing a schedule never rewrites a prior pack. Disabling retains history.

Generation reloads the current active owner and filters under current case access. Download and history listing recheck every original case in the pack; if any case is no longer readable, the entire pack is unavailable (404), including after a case is sealed or assignment changes. Pack contents and download history are immutable SQL projections. File rendering is followed by an additional authorization check before delivery. Significant previews, exports, schedule writes, generation and downloads are audited without original narratives or raw filter values in preview audit metadata. No external report delivery exists.

## Migration and commands

`database/migrations/012_reporting.sql` adds private schedule, unique period pack and append-only download-history tables with owner/record references and indexes. It is additive. Existing schema/data are retained. No operational database migration or backfill was performed.

Executed in disposable fixtures:

```powershell
cd backend
npm run test:reports
npm run test:reports:postgres
npm run build
npm test
npm run test:rbac
npm run test:sla
```

For a separately backed-up, configured PostgreSQL deployment, use the existing migration procedure (`npm run migrate:plan`, then `npm run migrate` with the intended DATABASE_URL/PERSISTENCE_DRIVER configured). The test harness executes actual migrations and an actual native PostgreSQL stop/start; a plan alone is not treated as validation. Recovery retains tables/packs and disables schedules or restores a compatible backed-up application/database; never rewrite audit/download histories.

No new environment variables are needed. Non-test servers run schedule checks through the existing operational timer. Development startup remains `npm run dev` in backend and frontend, with PostgreSQL migration/backfill according to Phase 1. Production JSON persistence remains rejected. No credentials, operational fixtures or real notifications were introduced.

## Verification

- **20 JSON** reporting/intake scenarios passed, including malformed periods, leap-year and financial-year boundaries, exact totals, zero/unknown/missing semantics, scoped filtering, current-quarter KPI equality, real CSV/XLSX/PDF contents, formula safety, private schedule versions, concurrent/repeated generation, download history, disabled owners, and sealed access revocation.
- **20 native PostgreSQL** scenarios passed, including migration012, schedule/pack/download projections, immutable pack/download protection, unique period behavior and restart persistence.
- **23 SLA**, **23 unit**, **15 acceptance** and **33 RBAC** regression checks passed using disposable data. Backend and frontend builds, localization (23 locales / 10 namespaces) and interface checks passed. Final lint retains original warnings, with no warnings in new SLA/report components.
- Browser: a Bureau Head viewed the region grid/table, clicked South to obtain zero matching cases, clicked North to restore one authorized case, created a private monthly schedule, generated the prior complete September period and downloaded its CSV. Recorded downloads increased from zero to one. Evidence: `evidence/phase11-reports-schedule.png`.
- A generated synthetic PDF was rendered through Poppler and inspected visually with no clipping or overlap. pypdf confirmed its embedded CSV rows equal its declared scope total (5). The Poppler wrapper path was unavailable; the bundled executable worked, with a harmless unused Symbol display-font warning. Sample proof: `evidence/phase11-report-sample.pdf` and rendered `phase11-report-1.png`.
- The first missing-metadata test fixture originally contained only new classified cases; adding a historical unclassified fixture corrected the test setup. Final checks passed. Sandbox-isolated API execution required approved loopback/native PostgreSQL access. Operational `backend/data/db.json` digest stayed unchanged during reporting integration runs. The browser fixture exited cleanly after `stop` and removed its temporary data.

## Important files

Backend models/services: `models/reporting.ts`, `services/reporting.ts`, `services/reportFiles.ts`; route `routes/reporting.ts`; Store, PostgreSQL projection, existing operational scheduler/server integration; reporting checks and isolated integration harness. Frontend: `pages/ReportWorkspace.tsx`, existing ReportsAnalytics export/period selection, App/access/navigation, authenticated report download helper and English fallback keys in all 23 complaint locale packs. Migration012 and package manifest/lock contain the persistence/dependency additions.
