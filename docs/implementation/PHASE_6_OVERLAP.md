# Phase 6 — Explainable, versioned overlap review

Completed in the implementation workspace. Nothing was deployed or backfilled into operational data.

## Behavior and boundaries

- Exact resolved institution identity gates comparison. Original IDs and text remain unchanged.
- `signals-v2` explains institution, subject/category, recorded programme, source-scoped normalized reference, explicit institutional entity codes, text mode, date distance and current handling Bureau. Available weights normalize to 100; absent programme/reference/entity/text/date inputs are excluded, not fabricated.
- Dates prefer valid `metadata.sourceReceivedDate`, then `receivedDate`. Absolute calendar-day distance between the two cases is compared with the configured window. Missing/invalid dates are neutral. Distant dates suppress ordinary relationship candidates unless a verified same-source reference matches. The default window is 180 days, an engineering setting rather than an asserted legal rule.
- Same institution + same category + both open + different current handling Bureaus always requests review. Open includes Pending, Under Process, Escalated and Transferred. A prospective registration without status is treated as Pending. Review never automatically establishes duplication, wrongdoing or a merge. Mandatory review can have an undetermined relationship.
- Exact reference text across distinct source channels is weak evidence, not a shared external identifier. Different programmes prevent an automatic duplicate candidate. Explicit entity annotations are institutional department/programme/document codes; no narrative person extraction or identity fields enter scoring.
- Protected/pending-sensitivity text stays on the local lexical path. Original confidentiality/RBAC/assignment/region checks remain authoritative. Explanations, entity/date/reference signals and reviewer feedback are withheld when both case files are not readable. Sealed counterpart existence remains hidden.

## Persistent configuration and feedback

`GET/PUT /api/admin/overlap-settings` is system-administrator-only. It returns defaults/current/history; saves require the current version and a reason. Values, finite ranges, date-window bounds, weight keys and ordered thresholds are validated. `rollbackTo` restores parameters as a new version with attribution; it never edits prior versions or rescales prior alerts. Administrators gain no case access.

The administrator page is `/admin/overlap-settings`, linked from Case Intake Configuration. A redundant older route whitelist blocked these new authorized configuration pages; `ProtectedRoute` now uses the shared deny-by-default `canVisit` check and explicit role gates.

Case-scoped officials can view/edit verified institutional codes and explicitly rescan through `/api/case-overlap/:id`, `/entities` and `/rescan`. Inference finishes before the synchronous mutation transaction. The transaction rechecks input/configuration/scope and deduplicates unordered pairs against every existing alert, including reviewed alerts. It does not reset decisions, replace historic explanations or issue repeat alert notifications. Registration uses validated intake provenance before inference and checks source uniqueness before inserting the new case.

Review supports request IDs, stale-version checks and immutable feedback with the original algorithm/configuration version. Retrying a review creates no duplicate feedback, relationship or history. `/api/overlaps/:id/feedback` returns feedback only when both files are readable. Feedback does not retrain any model. Related-case linking remains a separate explicit reviewer action; merging is Phase 7.

Migration `007_overlap_review.sql` adds configuration versions, entity-code projections, alert projections, canonical pair receipts and feedback with indexes/FKs. Existing duplicate pairs/IDs remain in the snapshot; receipts do not delete legacy history. Legacy orphan/self-pairs remain in the snapshot for explicit review rather than being silently repaired. Database triggers reject edits/deletions of configuration and feedback history; identical projection upserts are permitted. App authority remains the Phase 1 PostgreSQL transactional snapshot, with these integrity projections. JSON provides equivalent application behavior for development/test.

Run versioned migrations with `npm run migrate --prefix backend` against an explicitly configured PostgreSQL authority. `npm run migrate:plan --prefix backend` lists checksums only. Migration 007 was executed successfully in fresh disposable native PostgreSQL clusters, not against a production/operational database. Back up the snapshot, database and external identity keys before operational migration; do not reset or re-seed. Older code should not be used to overwrite a snapshot containing these newer fields.

## Tuning and measured limitations

Phase 5 reports and the 84-pair fixture remain frozen (SHA-256 `c5c21d687497e053cc2017ef729d0c453f9f3c5b9a2350f8e5c24da7e6f7bc12`). `evaluation/legacyOverlapEngine.ts` retains the original algorithm exclusively for repeatable baseline evaluation. `--algorithm legacy|signals-v2` selects the evaluator; production uses signals-v2.

The initial Phase 6 tuning reports contain only the 60 tuning pairs per mode. `tuneOverlap.ts` rejects held-out rows and wrong fixture hashes, evaluates a fixed 2,352-setting grid, and maximizes mean relationship macro-F1 over lexical/embedding modes. Ties prefer fewer false relationship candidates, then higher thresholds. Weights and date window were unchanged. Chosen values: combined related 50, combined duplicate 85, lexical related/duplicate 40/70, embedding related/duplicate 85/90. See `evaluation/phase6-tuning-selection.json`. These are draft synthetic tuning values, not calibrated probabilities or operational validation.

After freezing those parameters, actual lexical and pinned local E5 evaluations ran on all 60 tuning and 24 held-out pairs. No threshold adjustments were made after seeing Phase 6 held-out results. Mandatory review flags are evaluated separately from relationship class predictions; an undetermined candidate is not a confirmed unrelated finding.

| Mode | Tuning macro-F1 | Held-out macro precision / recall / F1 | Held-out review precision / recall / F1 |
| --- | --- | --- | --- |
| Unicode lexical fallback | 0.626422 | 0.823529 / 0.625000 / 0.603077 | 0.842105 / 1.000000 / 0.914286 |
| Local E5 multilingual embeddings | 0.915344 | 0.909091 / 0.875000 / 0.870445 | 0.842105 / 1.000000 / 0.914286 |

Held-out confusion matrices (rows expected duplicate/related/unrelated, columns candidate duplicate/related/undetermined): lexical `[2,6,0];[0,8,0];[0,3,5]`; E5 `[8,0,0];[0,8,0];[0,3,5]`. Both modes request review on 3 unrelated pairs. The lexical fallback still misses most cross-language duplicate classifications. Labels and translations remain unreviewed synthetic drafts; each held-out language direction has only three pairs. Full per-class/mode/language results are in `phase6-lexical.json` and `phase6-embeddings.json`. These metrics must not be presented as production accuracy.

Reproduce from the backend directory:

```powershell
npm run evaluate:overlaps -- --algorithm signals-v2 --mode lexical --split tuning
# Local cached provider must report multilingual_embeddings; set matching URL/token.
npm run evaluate:overlaps -- --algorithm signals-v2 --mode embeddings --split tuning
npx tsx src/evaluation/tuneOverlap.ts
npm run evaluate:overlaps -- --algorithm signals-v2 --mode lexical --split both --output ../docs/implementation/evaluation/phase6-lexical.json
npm run evaluate:overlaps -- --algorithm signals-v2 --mode embeddings --split both --output ../docs/implementation/evaluation/phase6-embeddings.json
```

## Executed checks

- 8 pure scoring scenarios: mandatory review, open/closed/transferred status, date preference/boundary/missing values, far-date/reference behavior, institution isolation, programme/entity namespace, unavailable text/extreme settings and explained contributions.
- 19 JSON API scenarios and 19 real PostgreSQL API scenarios, including original intake regression, configuration/rollback validation, code scope/versioning, concurrent rescan deduplication, request replay, retained decisions and sealed isolation. PostgreSQL additionally verified configuration/feedback edit/delete rejection, unique pair receipts, projections and actual stop/start recovery. Operational JSON SHA checks remained unchanged.
- Existing 23 unit + 15 acceptance, 33 RBAC and 25 JSON confidentiality scenarios passed. Backend/frontend builds passed. Locale checks passed for 23 packs/10 namespaces, with English fallback and unreviewed-language gates preserved. Lint reports the same 184 pre-existing warnings.
- Browser: actual administrator configuration save to version 2; authority case rescan; resulting review item with signal table/date/configuration/mode/mandatory rule. Screenshots: `evidence/phase6-overlap-configuration.png`, `evidence/phase6-overlap-explanation.png`. Both use disposable fixtures and a local preview.

Important files: backend overlap engine/signals/settings/review services and routes, Store/projection adapter, migration 007, evaluation/tuning scripts, frontend OverlapConfiguration/CaseOverlapPanel/OverlapSignals, route guard and 23 complaint locale packs. New interface keys use explicit English fallback; none received official language approval.
