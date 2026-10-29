type Label = "duplicate" | "related" | "unrelated";
const labels: Label[] = ["duplicate", "related", "unrelated"];
export function classificationMetrics(rows: { expected: Label; predicted: Label; flagged?: boolean }[]) {
  const confusion = Object.fromEntries(labels.map(expected => [expected, Object.fromEntries(labels.map(predicted => [predicted, rows.filter(row => row.expected === expected && row.predicted === predicted).length]))]));
  const classes = Object.fromEntries(labels.map(label => {
    const tp = rows.filter(row => row.expected === label && row.predicted === label).length, fp = rows.filter(row => row.expected !== label && row.predicted === label).length, fn = rows.filter(row => row.expected === label && row.predicted !== label).length;
    return [label, { support: tp + fn, predicted: tp + fp, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null }];
  }));
  const active = Object.values(classes).filter(value => value.support || value.predicted), mean = (key: "precision" | "recall" | "f1") => active.length ? active.reduce((sum, value) => sum + (value[key] || 0), 0) / active.length : null;
  const positive = (label: Label) => label !== "unrelated", review = (row: typeof rows[number]) => row.flagged ?? positive(row.predicted), tp = rows.filter(row => positive(row.expected) && review(row)).length, fp = rows.filter(row => !positive(row.expected) && review(row)).length, fn = rows.filter(row => positive(row.expected) && !review(row)).length;
  const micro = rows.length ? rows.filter(row => row.expected === row.predicted).length / rows.length : null;
  return { sampleSize: rows.length, confusionMatrix: { rows: "expected", columns: "candidate_prediction", values: confusion }, perClass: classes, macroF1: mean("f1"),
    macroPolicy: "Mean over labels with actual support or predictions; undefined precision/recall contributes zero for such a label. No samples -> null. Per-class absent denominators remain null.",
    candidateClassification: { macroPrecision: mean("precision"), macroRecall: mean("recall"), macroF1: mean("f1"), microPrecision: micro, microRecall: micro, microF1: micro },
    reviewCandidateDetection: { precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null, tp, fp, fn } };
}
