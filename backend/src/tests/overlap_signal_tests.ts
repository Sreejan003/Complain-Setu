import assert from "node:assert/strict";
import { assessOverlap } from "../services/overlapSignals.js";
import { defaultOverlapSettings } from "../config/overlap.js";
import type { Complaint } from "../models/types.js";
import type { SimilarityResult } from "../models/textAnalysis.js";
const config = defaultOverlapSettings();
const a = { id: "a", institutionId: "one", aictePermanentId: "1", category: "Faculty", status: "Pending", receivingBureauId: "RB", currentBureauId: "RB", receivedDate: "2026-01-01" } as Complaint;
const b = { ...a, id: "b", currentBureauId: "PGRC", receivingBureauId: "PGRC", receivedDate: "2020-01-01" };
const similarity: SimilarityResult = { mode: "lexical_fallback", score: 0, engine: "test", model: "test", revision: "1", preprocessingVersion: "test", limitation: "Synthetic pure signal fixture" };
let passed = 0;
function check(name: string, operation: () => void) { operation(); console.log("PASS " + name); passed++; }
check("Mandatory review survives old dates and absent text without declaring duplication", () => {
  const result = assessOverlap(a,b,similarity,config); assert.equal(result.assessment.mandatoryReview,true); assert.equal(result.assessment.reviewRequired,true); assert.equal(result.assessment.relationshipCandidate,"undetermined"); assert.equal(result.assessment.date.withinWindow,false);
  assert.equal(assessOverlap(a,{...b,status:"Disposed"},similarity,config).assessment.mandatoryReview,false);
  assert.equal(assessOverlap(a,{...b,status:"Transferred"},similarity,config).assessment.mandatoryReview,true);
});
check("Missing dates exclude their weight and do not invent dates", () => {
  const result = assessOverlap({...a,receivedDate:undefined},{...b,receivedDate:"2026-02-30"},similarity,config);
  assert.equal(result.assessment.date.distanceDays,undefined); assert.equal(result.assessment.signals.find(row=>row.key==="temporal")?.available,false); assert.equal(result.assessment.reviewRequired,true);
});
check("Source received dates override entry dates; boundaries use absolute calendar distance", () => {
  const x = {...a,metadata:{sourceReceivedDate:"2026-01-01"} as Complaint["metadata"]}, y = {...b,metadata:{sourceReceivedDate:"2026-06-30"} as Complaint["metadata"]};
  const result = assessOverlap(x,y,similarity,config); assert.equal(result.assessment.date.distanceDays,180); assert.equal(result.assessment.date.withinWindow,true); assert.equal(result.assessment.date.sourceA,"source_received_date");
  assert.equal(assessOverlap(x,{...y,metadata:{sourceReceivedDate:"2026-07-01"} as Complaint["metadata"]},similarity,config).assessment.date.withinWindow,false);
});
check("Different institutions never trigger relationships or mandatory review", () => {
  const result=assessOverlap(a,{...b,institutionId:"two",aictePermanentId:"2"},{...similarity,score:100},config); assert.equal(result.assessment.reviewRequired,false); assert.equal(result.combinedScore,0);
});
check("Temporal window suppresses ordinary candidates while same-source reference can override", () => {
  assert.equal(assessOverlap(a,{...b,currentBureauId:"RB"},{...similarity,score:100},config).assessment.relationshipCandidate,"undetermined");
  const metadata={externalReference:" REF-１２３ ",sourceChannelId:"letter"} as Complaint["metadata"];
  const result=assessOverlap({...a,metadata},{...b,metadata:{...metadata!,externalReference:"ref-123"}},{...similarity,score:100},config);
  assert.notEqual(result.assessment.relationshipCandidate,"undetermined");
  assert.equal(result.assessment.signals.find(row=>row.key==="reference")?.value,1);
  const weak=assessOverlap({...a,metadata},{...b,metadata:{...metadata!,sourceChannelId:"email"}},{...similarity,score:100},config);
  assert.equal(weak.assessment.signals.find(row=>row.key==="reference")?.value,0.4); assert.equal(weak.assessment.relationshipCandidate,"undetermined");
});
check("Explicit programme mismatch blocks duplicate candidate and namespace binds institutional entity", () => {
  const entities=[{kind:"department" as const,namespace:"campus",value:"CSE"}];
  const result=assessOverlap({...a,metadata:{programme:"B.Tech"} as Complaint["metadata"],entityReferences:entities},{...b,receivedDate:a.receivedDate,metadata:{programme:"MBA"} as Complaint["metadata"],entityReferences:entities},{...similarity,score:100},config);
  assert.notEqual(result.assessment.relationshipCandidate,"possible_duplicate"); assert.equal(result.assessment.signals.find(row=>row.key==="entity")?.value,1);
  const different=assessOverlap({...a,entityReferences:entities},{...b,entityReferences:[{...entities[0],namespace:"other-campus"}]},similarity,config); assert.equal(different.assessment.signals.find(row=>row.key==="entity")?.value,0);
});
check("Unavailable text is neutral and extreme settings cannot disable mandatory review", () => {
  const strict={...config,reviewScoreThreshold:100,duplicateScoreThreshold:100,weights:{...config.weights,category:0,crossBureau:0}};
  const result=assessOverlap(a,b,{...similarity,mode:"unavailable",score:undefined},strict); assert.equal(result.assessment.reviewRequired,true); assert.equal(result.assessment.signals.find(row=>row.key==="text")?.available,false); assert.equal(result.assessment.relationshipCandidate,"undetermined");
});
check("Contributions explain the combined score and expose configuration version", () => {
  const result=assessOverlap(a,{...b,receivedDate:a.receivedDate},{...similarity,score:100},{...config,version:7}); assert.equal(result.assessment.configurationVersion,7); assert.equal(result.combinedScore,Math.round(result.assessment.signals.reduce((sum,row)=>sum+row.contribution,0))); assert.equal(result.assessment.relationshipCandidate,"possible_duplicate");
});
console.log(`${passed} pure overlap signal scenarios passed.`);
