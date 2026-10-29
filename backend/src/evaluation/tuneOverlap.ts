/** Synthetic tuning only. Held-out rows are explicitly rejected; no model retraining occurs. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { assessOverlap } from "../services/overlapSignals.js";
import { defaultOverlapSettings } from "../config/overlap.js";
import { classificationMetrics } from "./metrics.js";
import type { Complaint } from "../models/types.js";
import type { SimilarityResult } from "../models/textAnalysis.js";
const fixture = fs.readFileSync(new URL("./fixtures/overlap-pairs.json", import.meta.url), "utf8"), data = JSON.parse(fixture), digest = createHash("sha256").update(fixture).digest("hex");
const cases = new Map<string, Complaint>(data.cases.map((row: Complaint) => [row.id, row]));
const reports = ["lexical", "embeddings"].map(mode => {
  const report = JSON.parse(fs.readFileSync(new URL(`../../../docs/implementation/evaluation/phase6-${mode}-tuning.json`, import.meta.url), "utf8"));
  if (report.datasetSha256 !== digest || report.rows.length !== 60 || report.rows.some((row: any) => row.split !== "tuning")) throw new Error("Tuning requires exactly the 60 frozen tuning rows; held-out inputs are forbidden");
  return { mode, rows: report.rows.map((row: any) => { const pair = data.pairs.find((item: any) => item.id === row.id); if (pair?.split !== "tuning") throw new Error("Non-tuning pair rejected"); return { row, a: cases.get(pair.caseA)!, b: cases.get(pair.caseB)! }; }) };
});
const defaults = defaultOverlapSettings();
const grid = { review: [40,45,50,55,60,65,70], duplicate: [65,70,75,80,85,90,95], lexicalRelated: [30,40,50,60,70], lexicalDuplicate: [60,70,80,85,90], embeddingRelated: [70,75,80,85,90], embeddingDuplicate: [85,90,92,95,98] };
let selected: any; let evaluated = 0;
for (const reviewScoreThreshold of grid.review) for (const duplicateScoreThreshold of grid.duplicate) {
  const modeResults = reports.map(report => {
    let best: any;
    for (const related of report.mode === "lexical" ? grid.lexicalRelated : grid.embeddingRelated) for (const duplicate of report.mode === "lexical" ? grid.lexicalDuplicate : grid.embeddingDuplicate) {
      if (duplicate < related) continue;
      const config = { ...defaults, reviewScoreThreshold, duplicateScoreThreshold, ...(report.mode === "lexical" ? { lexicalRelatedThreshold: related, lexicalDuplicateThreshold: duplicate } : { embeddingRelatedThreshold: related, embeddingDuplicateThreshold: duplicate }) };
      const rows = report.rows.map(({row,a,b}: any) => {
        const similarity: SimilarityResult = {mode:row.mode === "not_compared_different_institution" ? "unavailable" : row.mode,score:row.textScore,model:row.model,revision:row.revision,engine:report.mode,preprocessingVersion:row.preprocessingVersion,limitation:"Cached synthetic tuning inference"};
        const result = assessOverlap(a,b,similarity,config).assessment;
        return { expected: row.expected, predicted: result.relationshipCandidate === "possible_duplicate" ? "duplicate" as const : result.relationshipCandidate === "possible_related" ? "related" as const : "unrelated" as const, flagged: result.reviewRequired };
      });
      const metrics = classificationMetrics(rows); evaluated++;
      // Deterministic tie-break: fewer false relation candidates, then higher text thresholds.
      const fp = rows.filter((row:any)=>row.expected==="unrelated"&&row.predicted!=="unrelated").length;
      if (!best || metrics.macroF1! > best.metrics.macroF1 + 1e-12 || Math.abs(metrics.macroF1! - best.metrics.macroF1) < 1e-12 && (fp < best.falseRelationships || fp === best.falseRelationships && related + duplicate > best.related + best.duplicate)) best = { related,duplicate,metrics,falseRelationships:fp };
    }
    return { mode:report.mode,...best };
  });
  const objective=modeResults.reduce((sum,row)=>sum+row.metrics.macroF1,0)/2, fp=modeResults.reduce((sum,row)=>sum+row.falseRelationships,0);
  if (!selected || objective > selected.objective + 1e-12 || Math.abs(objective-selected.objective) < 1e-12 && (fp < selected.falseRelationships || fp === selected.falseRelationships && reviewScoreThreshold + duplicateScoreThreshold > selected.reviewScoreThreshold + selected.duplicateScoreThreshold)) selected={objective,falseRelationships:fp,reviewScoreThreshold,duplicateScoreThreshold,modes:modeResults};
}
const chosen = { ...defaults, reviewScoreThreshold:selected.reviewScoreThreshold,duplicateScoreThreshold:selected.duplicateScoreThreshold,lexicalRelatedThreshold:selected.modes[0].related,lexicalDuplicateThreshold:selected.modes[0].duplicate,embeddingRelatedThreshold:selected.modes[1].related,embeddingDuplicateThreshold:selected.modes[1].duplicate };
const report={datasetSha256:digest,split:"tuning_only",sampleSizePerMode:60,grid,evaluated,objective:"Mean lexical/embedding macro-F1 for draft synthetic relationship candidates. Tie-break fewer false relationships, then higher thresholds. Review flags separately include mandatory review.",selected:chosen,metrics:selected.modes,limitations:"Draft synthetic labels and translations, small template corpus. Not production validation, calibrated confidence, legal rules or model retraining. Held-out rows were not used. Weights/date window unchanged."};
fs.writeFileSync(new URL("../../../docs/implementation/evaluation/phase6-tuning-selection.json",import.meta.url),JSON.stringify(report,null,2)+"\n"); console.log(JSON.stringify({evaluated,selected:chosen,objective:selected.objective},null,2));
