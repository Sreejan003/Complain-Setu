import assert from "node:assert/strict";
import { classificationMetrics } from "./metrics.js";
const rows: Parameters<typeof classificationMetrics>[0] = [
  { expected: "duplicate", predicted: "duplicate" }, { expected: "duplicate", predicted: "duplicate" }, { expected: "duplicate", predicted: "related" },
  { expected: "related", predicted: "duplicate" }, { expected: "related", predicted: "related" }, { expected: "related", predicted: "related" },
  { expected: "unrelated", predicted: "duplicate" }, { expected: "unrelated", predicted: "related" }, { expected: "unrelated", predicted: "unrelated" }
];
const result = classificationMetrics(rows), close = (value: number | null, expected: number) => assert.ok(value !== null && Math.abs(value - expected) < 1e-12);
assert.deepEqual(result.confusionMatrix.values, { duplicate: { duplicate: 2, related: 1, unrelated: 0 }, related: { duplicate: 1, related: 2, unrelated: 0 }, unrelated: { duplicate: 1, related: 1, unrelated: 1 } });
close(result.candidateClassification.macroPrecision, 2 / 3); close(result.candidateClassification.macroRecall, 5 / 9); close(result.macroF1, 23 / 42); close(result.candidateClassification.microF1, 5 / 9);
close(result.reviewCandidateDetection.precision, 0.75); close(result.reviewCandidateDetection.recall, 1); close(result.reviewCandidateDetection.f1, 6 / 7);
const empty = classificationMetrics([]); assert.equal(empty.macroF1, null); assert.equal(empty.reviewCandidateDetection.f1, null); assert.equal(empty.perClass.duplicate.precision, null);
const missed = classificationMetrics([{ expected: "duplicate", predicted: "unrelated" }]); assert.equal(missed.perClass.duplicate.f1, 0); assert.equal(missed.perClass.unrelated.f1, 0); assert.equal(missed.macroF1, 0);
const mandatory = classificationMetrics([{ expected: "unrelated", predicted: "unrelated", flagged: true }, { expected: "related", predicted: "unrelated", flagged: true }]);
assert.equal(mandatory.reviewCandidateDetection.fp, 1); assert.equal(mandatory.reviewCandidateDetection.tp, 1); assert.equal(mandatory.reviewCandidateDetection.fn, 0);
console.log("PASS Evaluation metrics: independently hand-counted confusion matrix, macro/micro precision/recall/F1, binary review detection, absent denominators and missed classes.");
