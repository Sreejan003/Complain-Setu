# Phase 0 baseline — 29 October 2026

Executed against commit `09aa42f`, before feature changes. Operational `backend/data/db.json` was left intact; backend tests used explicitly disposable temporary storage.

| Check | Actual result |
| --- | --- |
| `npm run build` | Passed backend TypeScript and frontend TypeScript/Vite production build; existing bundler timing advisory under concurrent checks |
| Backend unit checks | 23/23 passed |
| Backend acceptance checks | 15/15 passed |
| RBAC integration suite | 33 scenarios passed, including coordination |
| Frontend `test:interface` | Passed navigation and query serialization checks |
| Frontend `test:coordination` | Passed permission/transition checks |
| Frontend `check:i18n` | Passed 23 locales / 10 namespaces; production approval gate intact |
| Frontend lint | Runs with 184 existing warnings (unused declarations, hook dependencies/state-in-effect and render-purity warnings); tracked as pre-existing, not attributed to this upgrade |

Environment inspection found Node.js and Python, but no Docker or `psql` executable on PATH and no configured database URL. Python FastAPI is installed; sentence-transformers, torch and the optional Unicode `regex` package are absent. A pinned development-only embedded PostgreSQL runtime is being provisioned for real, disposable database integration checks; no live government database is used.

Verified gaps: API routes bypass the optional PostgreSQL adapter; coordination exists only in the JSON domain Store; the legacy SQL RLS migration requires Supabase `auth.uid()` and older roles; no sealed/identity policy, general case intake metadata, merge workflow, ingestion runs, chained audit, policy-driven SLA, scheduled binary report packs, OTP tracker or saved command system is currently implemented. No external connector or model availability is inferred from configuration files.

Raw check logs are `.phase0-*.log` (ignored runtime artifacts). Later phase results are recorded separately.
