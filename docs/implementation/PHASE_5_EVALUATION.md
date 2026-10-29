# Phase 5 — Labeled overlap baseline

The fixed dataset contains 84 synthetic pairs, 112 synthetic case records and 28 family groups: 60 tuning pairs (20 groups) and 24 held-out pairs (8 groups). Each group supplies a duplicate, related and unrelated example. All labels, rationales and translations are **drafts without independent subject-matter/native review**. These results measure candidate classifications against those drafts; they are not production accuracy claims or official findings.

Dataset: `backend/src/evaluation/fixtures/overlap-pairs.json`. SHA-256: `c5c21d687497e053cc2017ef729d0c453f9f3c5b9a2350f8e5c24da7e6f7bc12`. Labels/splits were fixed before evaluation. Family IDs and exact original texts are disjoint across tuning/held-out; the Phase 4 salary smoke family/texts are excluded. The generator refuses to replace differing measured labels/splits silently.

Pairs include cross-language duplicates, distinct verification/coordination proceedings, different-institution near-identical narratives, same-institution independent subjects and closed older-cohort proceedings. Shared source/reference, programme, period, handling Bureau and status metadata are explicit synthetic facts. There is no operational Store import/seed dependency. Repeated templates and unreviewed labels limit generalizability.

## Measured baseline

The existing registration candidate mapping is evaluated: not flagged → unrelated; flagged score ≥80 → duplicate candidate; other flagged → related candidate. These are **review candidates**, never automatic case decisions. No thresholds were tuned on either split. Defaults and their hash are recorded in each report.

| Mode | Tuning macro P / R / F1 (n=60) | Held-out macro P / R / F1 (n=24) |
| --- | --- | --- |
| Unicode lexical fallback | 0.733 / 0.633 / 0.618 | 0.786 / 0.667 / 0.661 |
| Local E5 embeddings with legacy rules/cutoff | 0.578 / 0.467 / 0.392 | 0.593 / 0.500 / 0.448 |

Held-out per-class F1 (8 examples per class):

| Class | Lexical | E5 + legacy mapping |
| --- | --- | --- |
| Duplicate candidate | 0.800 | 0.615 |
| Related candidate | 0.636 | 0.182 |
| Unrelated / no flag | 0.545 | 0.545 |

Held-out confusion matrices (rows actual; columns duplicate / related / unrelated):

| Actual | Lexical predictions | E5 predictions |
| --- | --- | --- |
| Duplicate | 6 / 2 / 0 | 8 / 0 / 0 |
| Related | 1 / 7 / 0 | 7 / 1 / 0 |
| Unrelated | 0 / 5 / 3 | 3 / 2 / 3 |

Binary review-candidate detection was the same for both modes: tuning P/R/F1 = 0.755/1.000/0.860 (13 false positives), held-out = 0.762/1.000/0.865 (5 false positives). The institution/category-heavy rules dominate detection; embedding scores plus the legacy fixed cutoff overproduce duplicate candidates. This is a measured weakness to address in Phase 6 using tuning data, not evidence of improved production accuracy.

Each held-out language group has **only 3 samples**: English→English, Hindi, Gujarati, Tamil, Telugu, Bengali, Kannada and mixed script. Per-language/class precision/recall/F1 and sample counts are in the reports; no statistically reliable language-level claim is made. In each held-out run, 21 pairs actually used its text algorithm and 3 were gated as different institutions without comparison. The embedding report contains no lexical degradation disguised as embeddings.

Reports:

- `evaluation/phase5-lexical.json`
- `evaluation/phase5-embeddings.json`

Both include split sizes/validation, source/configuration hashes, confusion matrices, class and macro/micro metrics, binary detection, language/mode breakdowns, per-row model/revision/preprocessing and duration. Null means the metric denominator is absent; it does not mean measured zero. Macro metrics average labels with support or predictions, treating an undefined precision/recall as zero for such a label. Metric arithmetic was checked against an independently hand-counted 9-row matrix and empty/missed-class cases.

## Reproduce

From repository root:

```powershell
npm run test:evaluation --prefix backend
npm run evaluate:generate --prefix backend # verifies/recreates identical deterministic data only
npm run evaluate:overlaps --prefix backend -- --mode lexical
```

For embeddings, start the local cached provider as documented in Phase 4, then configure the backend CLI to the same localhost URL/token. Example (use the matching configured service token, never a real notification/government connector):

```powershell
$env:AI_SERVICE_URL='http://127.0.0.1:52931'
$env:AI_TIMEOUT_MS='15000'
# Set AI_SERVICE_TOKEN to the locally configured sidecar token if enabled.
npm run evaluate:overlaps --prefix backend -- --mode embeddings
```

The embedding command checks live health and fails without creating a fresh embedding result if the provider is unavailable or any compared row degrades to lexical fallback. Check command exit status and report timestamps; a prior successful report is historical evidence, not a fresh failed-run result. `--split tuning|heldout|both` and `--output <path>` are supported. Output defaults assume the npm backend working directory.

Actual commands executed successfully: lexical evaluation, live localhost E5 evaluation, metric checks and backend TypeScript. E5 revision: `614241f622f53c4eeff9890bdc4f31cfecc418b3`. Thresholds, model weights, labels and splits were unchanged between modes. Phase 5 baseline files must remain frozen before Phase 6; future configuration choices must use tuning data only. A new independently reviewed dataset requires an explicit new version and a fresh held-out protocol.
