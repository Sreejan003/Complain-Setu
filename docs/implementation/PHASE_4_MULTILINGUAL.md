# Phase 4 — Multilingual complaint text processing

Complaint-language processing is separate from UI localization. No complaint text was sent to an external translation/AI service. Only public model files were downloaded; measurements used synthetic text.

## Implemented

- TypeScript and Python use Unicode NFKC/lower normalization and letter/combining-mark/number tokenization. Hindi, Gujarati, Tamil, Telugu, Bengali, Kannada and mixed-script examples retain meaningful tokens. Original titles/descriptions remain unchanged. Institution fuzzy matching no longer converts Indian-script names to empty strings.
- New intake/case records persist source hashes, preprocessing version, script/language hints and translation status. Shared scripts/Latin text stay `und`; multiple scripts become `mul`. Single distinctive-script hints are heuristic, not calibrated language identification. Officials may record a verified language with attribution through the audit record; no confidence percentage is invented.
- Translations are separate human-supplied drafts, with target language, source hash, supplier/time and independent authorized review. Identical original text cannot be presented as a translation. A stale source cannot inherit a translation review. This does not approve UI locales or official terminology. No external complaint translator is connected.
- Case-language APIs/UI inherit existing case RBAC and explicit confidentiality gates. All new UI keys exist in 23 packs; non-English additions remain unreviewed English fallback behind the existing production gate.
- Optional local providers support pinned multilingual E5-small, multilingual MiniLM and BGE-M3 dense embeddings. Default sidecar mode is lexical; model downloads require explicit opt-in. The backend reports `multilingual_embeddings`, `lexical_fallback` or `unavailable` and validates provider metadata. Unavailable comparison is not displayed as a measured zero.
- Embedding cache keys include model/revision, preprocessing, prefix and token-window settings. Windows are averaged/normalized for long input, with a bounded budget; excessive input degrades to lexical processing rather than silently truncating source data. Cache vectors are bounded and process-local, never operational authority.
- Provider timeouts, concurrency limits, model-unavailable/inference errors and preprocessing mismatch degrade safely. Protected/pending-sensitivity source cases use in-process processing only. Ad-hoc comparison also stays in-process because it has no trustworthy source-case classification. Remote providers retain Phase 3's explicit approval/HTTPS/no-redirect gate.
- Existing misleading TF-IDF/high-accuracy/probability descriptions were removed from active outputs. Token-frequency cosine is labeled lexical; no cross-language semantic capability is claimed for it. Old historical alerts are not rewritten.

## Model assessment

| Candidate | Verified model-card characteristics | Decision / measurement status |
| --- | --- | --- |
| multilingual E5-small | MIT; 384 dimensions; 512-token model window; documented Indic-language tags; `query:` prefix for symmetric similarity | Selected CPU option. Pinned `614241f622f53c4eeff9890bdc4f31cfecc418b3`; actually loaded and measured locally |
| multilingual MiniLM-L12-v2 | Apache-2.0; 384 dimensions; 128-token window; 50 documented languages | Configurable candidate. Its published tags do not establish the same six-language Indic coverage as E5; no runtime quality/latency result claimed here |
| BGE-M3 | MIT; 1024 dimensions; 8192-token window; over 100 languages | Configurable dense candidate. Not loaded in this session: only about 1.47 GiB of RAM was free when checked. No BGE latency/quality result claimed |
| Unicode lexical fallback | Deterministic term-frequency cosine | Available without model weights. Shared tokens only; no semantic cross-language interpretation |

Sources: [E5 model card](https://huggingface.co/intfloat/multilingual-e5-small), [multilingual MiniLM model card](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2), [BGE-M3 model card](https://huggingface.co/BAAI/bge-m3), [Sentence Transformers loading/revision options](https://sbert.net/docs/package_reference/sentence_transformer/model.html). Candidate selection is an engineering inference from these cards and the measured host constraints, not a claim that all 22 scheduled languages have been validated.

Actual smoke results are in `evaluation/phase4-model-smoke.json`: 7 synthetic examples (one per six requested languages plus mixed script), all 7 related examples ranked above their unrelated comparison. Uncached pair calls were roughly 142–629 ms in this run. Model startup/import/loading took 73.37 seconds on this constrained host. Cached timings exclude inference and must not be used as production latency claims. Source examples/labels are unreviewed synthetic drafts. This is not precision/recall/F1 evaluation; Phase 5 provides a separate family-split dataset.

## Persistence and startup

Migration `006_complaint_language.sql` adds an indexed text-analysis projection with source hash, language, version and translation status. Intake JSON documents persist their analysis in the existing intake table. No original IDs, narratives, attachments or prior history are replaced. Historical records derive an explicit not-translated view until an official annotation persists metadata.

From repository root:

```powershell
npm run migrate --prefix backend
npm run test:language --prefix backend
npm run test:language:postgres --prefix backend
python -m venv ai_service/.venv
ai_service/.venv/Scripts/python.exe -m pip install -r ai_service/requirements.txt
# Optional embeddings only:
ai_service/.venv/Scripts/python.exe -m pip install -r ai_service/requirements-embeddings.txt
```

From `ai_service`, set environment variables (the example file is a reference; the Python entry point reads the process environment):

```powershell
$env:EMBEDDING_PROVIDER='lexical' # or sentence_transformers with configured local model files
$env:EMBEDDING_CACHE_DIR=Join-Path (Get-Location) '.model-cache'
$env:EMBEDDING_MODEL='intfloat/multilingual-e5-small'
$env:EMBEDDING_REVISION='614241f622f53c4eeff9890bdc4f31cfecc418b3'
$env:HF_HUB_DISABLE_TELEMETRY='1'
$env:ALLOW_MODEL_DOWNLOAD='false'
.venv/Scripts/python.exe app.py
```

To prepare public weights once, explicitly set `ALLOW_MODEL_DOWNLOAD=true`, start/verify the service, then restore false. No private text is needed for model preparation. Keep the cache/virtual environment outside Git. Readiness is reported only after initialization; the backend's lexical fallback remains available while the optional model starts. The sidecar binds localhost by default and disables access logs. Configure matching `AI_SERVICE_TOKEN` values for service authentication when deployed; Compose/network hardening is Phase 16.

Backend controls: `SIMILARITY_MODE=auto|lexical|unavailable`, `AI_SERVICE_URL`, `AI_TIMEOUT_MS` (bounded 100–15000 ms), `AI_SERVICE_TOKEN`, and Phase 3's `AI_EXTERNAL_DATA_APPROVED`. Sidecar model/cache/window/thread/device options are in `ai_service/.env.example`.

## Executed checks

- 19 language/intake integration scenarios passed in JSON and the same 19 passed on native PostgreSQL 18.4, including an actual restart retaining human-declared Hindi and independently reviewed translation metadata.
- 4 Python sidecar tests passed: Indian scripts, HTTP limits/contract, optional service secret/unavailable mode, model/window cache invalidation.
- Backend TypeScript and frontend production builds passed; existing 23 unit and 15 acceptance checks passed with accurate mode assertions.
- Actual E5 load/inference and 7-example synthetic smoke measurements passed. Existing 33 RBAC scenarios passed with an explicitly disposable DATA_DIR. Locale checks passed for 23 packs; lint remains at the original 184 warnings.
- Browser verified assigned-officer language recording and separate draft translation, then an independent Competent Authority review, with the original narrative still visible unchanged. Evidence: `evidence/phase4-language-review.png`.
- The broad labeled evaluation is Phase 5. No Phase 5 accuracy result is claimed here.
