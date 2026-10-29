import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { evaluateComplaintPair as legacyEvaluate } from "./legacyOverlapEngine.js";
import { evaluateComplaintPair as signalsEvaluate } from "../services/overlapEngine.js";
import { defaultOverlapSettings } from "../config/overlap.js";
import type { OverlapAssessment } from "../models/overlapSettings.js";
import { DEFAULT_DETECTION_CONFIG } from "../config/constants.js";
import type { Complaint, Institution } from "../models/types.js";
import { classificationMetrics as metrics } from "./metrics.js";

type Label = "duplicate" | "related" | "unrelated";
const labels: Label[] = ["duplicate", "related", "unrelated"];
type EvaluationCase = Complaint & { familyId: string; language: string };
type Pair = { id: string; groupId: string; caseFamilyIds: string[]; split: "tuning" | "heldout"; caseA: string; caseB: string; label: Label; rationale: string; labelReviewStatus: string };
type Row = { id: string; split: string; expected: Label; predicted: Label; mode: string; language: string; combinedScore: number; textScore?: number; ruleScore: number; flagged: boolean; model: string; revision: string; preprocessingVersion: string; durationMs: number };
function argument(name: string, fallback: string) { const index = process.argv.indexOf(name); return index < 0 ? fallback : process.argv[index + 1] || fallback; }
const mode = argument("--mode", "lexical"), split = argument("--split", "both");
const algorithm = argument("--algorithm", "legacy");
if (!["legacy", "signals-v2"].includes(algorithm)) throw new Error("Use --algorithm legacy|signals-v2");
const configuration = algorithm === "legacy" ? DEFAULT_DETECTION_CONFIG : defaultOverlapSettings();
if (!["lexical", "embeddings"].includes(mode) || !["tuning", "heldout", "both"].includes(split)) throw new Error("Use --mode lexical|embeddings --split tuning|heldout|both");
const source = fileURLToPath(new URL("./fixtures/overlap-pairs.json", import.meta.url));
const raw = fs.readFileSync(source, "utf8"), dataset = JSON.parse(raw) as { version: string; cases: EvaluationCase[]; pairs: Pair[]; smokeFamiliesExcluded: string[] };
const caseMap = new Map(dataset.cases.map(item => [item.id, item]));
assert.equal(caseMap.size, dataset.cases.length); assert.ok(dataset.pairs.length >= 60 && dataset.pairs.length <= 100);
const familySplits = new Map<string, string>(), originalSplits = new Map<string, string>();
for (const pair of dataset.pairs) {
  assert.ok(labels.includes(pair.label) && pair.rationale && pair.labelReviewStatus);
  assert.equal(pair.labelReviewStatus, "draft_not_independently_reviewed");
  assert.deepEqual([...new Set([caseMap.get(pair.caseA)?.familyId, caseMap.get(pair.caseB)?.familyId])].sort(), [...pair.caseFamilyIds].sort(), "Declared case families must match the actual case fixtures");
  for (const family of pair.caseFamilyIds) { const previous = familySplits.get(family); assert.ok(!previous || previous === pair.split, "A case family occurs in both splits"); familySplits.set(family, pair.split); }
  for (const id of [pair.caseA, pair.caseB]) {
    const item = caseMap.get(id); assert.ok(item, "Unknown case fixture");
    const fingerprint = createHash("sha256").update(item.title + "\0" + item.description).digest("hex"), previous = originalSplits.get(fingerprint);
    assert.ok(!previous || previous === pair.split, "Exact original text occurs in both splits"); originalSplits.set(fingerprint, pair.split);
  }
}
assert.ok(dataset.smokeFamiliesExcluded.includes("smoke-only-salary-not-in-tuning-or-heldout"));
assert.ok([...familySplits.keys()].every(family => !dataset.smokeFamiliesExcluded.includes(family) && !family.startsWith("smoke-only-")));
const smokeSource = fileURLToPath(new URL("../../../docs/implementation/evaluation/phase4-model-smoke.json", import.meta.url));
const smokeTextChecked = fs.existsSync(smokeSource);
if (smokeTextChecked) {
  const smoke = JSON.parse(fs.readFileSync(smokeSource, "utf8"));
  assert.ok(dataset.cases.every(item => !smoke.rows.some((row: any) => item.description.includes(row.synthetic_text))), "Smoke examples must not enter either labeled split");
}
const chosen = dataset.pairs.filter(pair => split === "both" || pair.split === split), results: Row[] = [];
process.env.SIMILARITY_MODE = mode === "lexical" ? "lexical" : "auto";
if (mode === "embeddings") {
  const url = new URL(process.env.AI_SERVICE_URL || "http://127.0.0.1:8000");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Synthetic evaluation requires a local provider");
  const response = await fetch(url.href.replace(/\/$/, "") + "/health", { signal: AbortSignal.timeout(15000) });
  if (!response.ok || (await response.json() as any).mode !== "multilingual_embeddings") throw new Error("Embedding provider unavailable: no embedding accuracy result is produced");
}
for (const pair of chosen) {
  const a = caseMap.get(pair.caseA)!, b = caseMap.get(pair.caseB)!;
  const institution: Institution = { id: a.institutionId, aictePermanentId: a.aictePermanentId, name: a.institutionName, institutionType: "Engineering", address: "Synthetic only", city: "Synthetic city", state: "Synthetic state", region: "Synthetic region", pincode: "000000", contactEmail: "fixture@example.test", contactPhone: "", accreditationStatus: "Synthetic only", yearEstablished: 2000, totalComplaintsCount: 0, activeComplaintsCount: 0, overlapCount: 0, createdAt: a.createdAt, updatedAt: a.updatedAt };
  const started = performance.now(), score = algorithm === "legacy" ? await legacyEvaluate(a, b, institution) : await signalsEvaluate(a, b, institution);
  const durationMs = performance.now() - started;
  if (mode === "embeddings" && score.similarity.mode === "lexical_fallback") throw new Error("Embedding run degraded to lexical fallback; no mixed result is reported as embedding accuracy");
  // Exact mapping used by current Store registration confidence categories. These are review candidates, never official decisions.
  const candidate = (score as { assessment?: OverlapAssessment }).assessment?.relationshipCandidate;
  const predicted: Label = algorithm === "legacy" ? !score.isOverlap ? "unrelated" : score.combinedScore >= 80 ? "duplicate" : "related" : candidate === "possible_duplicate" ? "duplicate" : candidate === "possible_related" ? "related" : "unrelated";
  results.push({ id: pair.id, split: pair.split, expected: pair.label, predicted, mode: score.similarity.mode === "unavailable" && a.institutionId !== b.institutionId ? "not_compared_different_institution" : score.similarity.mode,
    language: a.language + "→" + b.language, combinedScore: score.combinedScore, textScore: score.semanticScore, ruleScore: score.ruleScore, flagged: score.isOverlap, model: score.similarity.model, revision: score.similarity.revision, preprocessingVersion: score.similarity.preprocessingVersion, durationMs: Math.round(durationMs * 100) / 100 });
}
function breakdown(rows: Row[], key: "mode" | "language") { return Object.fromEntries([...new Set(rows.map(row => row[key]))].sort().map(value => [value, metrics(rows.filter(row => row[key] === value))])); }
const report = {
  datasetVersion: dataset.version, datasetSha256: createHash("sha256").update(raw).digest("hex"), generatedAt: new Date().toISOString(), requestedMode: mode,
  metricsVersion: "candidate-class-union-v1",
  datasetSize: { pairs: dataset.pairs.length, cases: dataset.cases.length, tuning: dataset.pairs.filter(pair => pair.split === "tuning").length, heldout: dataset.pairs.filter(pair => pair.split === "heldout").length, familyGroups: new Set(dataset.pairs.map(pair => pair.groupId)).size },
  splitValidation: { familyDisjoint: true, exactTextDisjoint: true, smokeFamilyExcluded: true, smokeTextExclusionVerified: smokeTextChecked }, labelReviewStatus: "draft_not_independently_reviewed", algorithm, configuration, configurationSha256: createHash("sha256").update(JSON.stringify(configuration)).digest("hex"),
  predictor: algorithm === "legacy" ? "Legacy Store mapping: not flagged→unrelated, flagged score>=80→duplicate candidate, other flagged→related candidate." : "signals-v2 relationshipCandidate maps to duplicate/related/unrelated-undetermined. Mandatory review is reported separately through flagged; undetermined is not a confirmed unrelated decision.",
  thresholdProtocol: algorithm === "legacy" ? "Legacy defaults fixed before baseline evaluation; no fitting." : "Initial defaults measured on tuning rows; deterministic threshold grid selected using only 60 tuning pairs per mode. Settings frozen before Phase 6 held-out evaluation; no fitting on held-out labels. See phase6-tuning-selection.json. Different-institution gating is part of the pipeline, not an embedding result.",
  splits: Object.fromEntries(["tuning", "heldout"].filter(value => split === "both" || value === split).map(value => { const rows = results.filter(row => row.split === value); return [value, { ...metrics(rows), perMode: breakdown(rows, "mode"), perLanguage: breakdown(rows, "language") }]; })),
  limitations: "Synthetic template-based draft labels/translation; no independent native or subject-matter review. Small held-out language groups; no production accuracy claim, statistical confidence claim or training on held-out data.", rows: results
};
const output = path.resolve(argument("--output", `../docs/implementation/evaluation/${algorithm === "legacy" ? "phase5" : "phase6"}-${mode}-${split}.json`));
if (algorithm !== "legacy" && path.basename(output).startsWith("phase5-")) throw new Error("Do not overwrite the frozen Phase 5 baseline with a different algorithm");
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output, mode, datasetSha256: report.datasetSha256, splits: Object.fromEntries(Object.entries(report.splits).map(([key, value]) => [key, { n: value.sampleSize, macroF1: value.macroF1, reviewCandidateDetection: value.reviewCandidateDetection }])) }, null, 2));
