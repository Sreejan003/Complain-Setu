# Phase 2 — Case classification and institution resolution

Implemented and verified in isolated JSON and native PostgreSQL 18.4 fixtures. Operational records were not seeded, reset, or migrated.

## Behavior

- `/intake` is available to existing Case Officers, Bureau Heads, and Competent Authorities. Officers prepare and resolve their own drafts; supervisors register drafts within their current Bureau/region. This does not grant officers the existing complaint-registration permission or access to unassigned cases.
- Record kind, case type, existing subject/category, handling Bureau, institution, source channel, external reference, source received date, programme and provenance are separate fields. Original source text is preserved; normalization applies to matching/reference keys only.
- Grievances use the existing default operational complaint workflow. Ragging, norms violation, court, RTI, Parliament and VIP/ministry types default to lifecycle review. They remain intake records without starting a complaint deadline. An administrator may explicitly configure a type's operational workflow; no statutory policy or legal deadline is inferred.
- `/admin/intake` manages versioned types/channels with stable IDs. Existing IDs cannot be removed; disable them instead. History is persisted and audited. System administrators receive configuration only, not intake/case access.
- Portal/manual are internal entry channels. Email/letter/CPGRAMS/CSS/custom channels are explicitly unconnected metadata channels. Configuration cannot activate a connector.
- Institution matching uses Unicode NFKC lexical normalization, names, human-maintained aliases, location hints and exact namespaced identifiers. Exact identifiers take precedence; an unknown identifier never silently falls back to another institution's name. Candidates contain master data only, with scores, confidence category and reasons. Scores are rankings, not calibrated probabilities. Every attachment to an institution requires human selection and a reason; ambiguous records remain unresolved.
- Supervisors maintain institution aliases/identifiers in the review workspace with optimistic versions and audit attribution. AICTE IDs remain canonical. Additional identifiers are globally unique within their namespace without exposing the conflicting institution.
- Registered references are unique within the source channel after NFKC/case/whitespace normalization. Original references remain unchanged. The error does not disclose a conflicting case ID or details. Different source channels may reuse the same reference.
- Intake conversion rechecks version, permissions, current workflow/channel and reference uniqueness inside the existing synchronous post-inference Store transaction. PostgreSQL commits case, intake, provenance, history and projections atomically. JSON provides equivalent single-process atomic behavior.
- Case details show classification/provenance. Historical records without metadata remain unchanged and are explicitly described as not recorded; no source is inferred.

## Migration and commands

`database/migrations/004_intake_classification.sql` is additive. It adds intake/configuration tables, institution identifier/alias projections, classification indexes and a source-scoped reference uniqueness index. No legacy IDs, histories, attachments or case rows are deleted. Migration 003 and its operational backfill remain prerequisites. Configuration versions are immutable through the operational projector. The existing operational snapshot remains the PostgreSQL authority with the scalability limits recorded in Phase 1.

From repository root, with a separately configured supported PostgreSQL database and backup:

```powershell
npm run migrate:plan --prefix backend  # plan only; does not claim SQL execution
npm run migrate --prefix backend
npm run test:intake --prefix backend
npm run test:intake:postgres --prefix backend
```

The test commands create disposable fixtures. `test:intake:postgres` starts a private native PostgreSQL cluster, applies migrations, exercises API behavior, actually restarts PostgreSQL, then removes its own validated temporary directory. Do not point fixture commands at operational data. For browser verification only, `$env:INTAKE_UI_SERVER='true'; npm run test:intake --prefix backend` serves the built frontend on localhost port 52918 (`INTAKE_UI_PORT` can override); synthetic records are kept in a temporary directory. Clear that environment variable before regular automated runs.

## Executed verification

- Backend TypeScript: passed.
- Frontend TypeScript and production Vite build: passed.
- Intake integration: 12 scenarios passed in JSON and the same 12 passed on real PostgreSQL, including exact identifier precedence, six Indian-script aliases, ambiguous locations, region/Bureau restrictions, source reference conflicts, lifecycle review, concurrent registration, configuration versioning, master-data uniqueness, invalid inputs and restart persistence.
- Existing navigation/query checks: passed with new authorized destinations.
- Localization shape/interpolation/Unicode/font/RTL/production-gate checks: passed for 23 locales/10 namespaces. New intake keys are English fallback in non-English packs; no new native review is claimed.
- Browser: officer draft creation with Hindi/Gujarati/Tamil/Telugu/Bengali/Kannada text; ambiguous North/South selection; human resolution reason; supervisor-only gate; supervisor confirmation/registration; original narrative and provenance on case detail. Screenshot: `evidence/phase2-intake-provenance.png`.

## Limits and next phase

This is lexical institution-master matching, not multilingual semantic complaint understanding. Confidentiality/identity encryption is Phase 3 and complaint-language understanding is Phase 4; neither is claimed here. Bulk ingestion/import replay is Phase 8. Audit records use the existing audit mechanism until Phase 9. No external system, AI provider, notification channel or deployment has been activated.
