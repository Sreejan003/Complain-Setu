import type { Complaint } from "../models/types.js";
import type { OverlapSettings, OverlapAssessment, OverlapSignal } from "../models/overlapSettings.js";
import type { SimilarityResult } from "../models/textAnalysis.js";
import { normalizedIdentifier, normalizedName } from "./institutionResolution.js";

function calendar(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) return undefined;
  return Date.parse(value);
}
function receivedDate(caseRecord: Partial<Complaint>) {
  const source = calendar(caseRecord.metadata?.sourceReceivedDate);
  if (source !== undefined) return { value: source, source: "source_received_date" };
  const received = calendar(caseRecord.receivedDate);
  return received === undefined ? { value: undefined, source: "unknown" } : { value: received, source: "received_date" };
}
/** Pure scoring of already authorized case inputs. No identity/profile/narrative entity extraction occurs here. */
export function assessOverlap(a: Partial<Complaint>, b: Complaint, similarity: SimilarityResult, config: OverlapSettings): { assessment: OverlapAssessment; combinedScore: number; ruleScore: number; isSameInstitution: boolean; isCrossBureau: boolean } {
  const sameInstitution = !!(a.institutionId && a.institutionId === b.institutionId || a.aictePermanentId && a.aictePermanentId === b.aictePermanentId);
  const sameCategory = !!a.category && a.category === b.category;
  const bureauA = a.currentBureauId || a.receivingBureauId, bureauB = b.currentBureauId || b.receivingBureauId;
  const crossBureau = !!bureauA && !!bureauB && bureauA !== bureauB;
  // A missing prospective-case status means Pending for registration/preview only.
  const open = (status?: string) => status === undefined || ["Pending", "Under Process", "Escalated", "Transferred"].includes(status);
  const mandatory = sameInstitution && sameCategory && open(a.status) && open(b.status) && crossBureau;
  const dateA = receivedDate(a), dateB = receivedDate(b), distanceDays = dateA.value !== undefined && dateB.value !== undefined ? Math.abs(dateA.value - dateB.value) / 86400000 : undefined;
  const withinWindow = distanceDays !== undefined ? distanceDays <= config.dateWindowDays : undefined;
  const programmeA = a.metadata?.programme ? normalizedName(a.metadata.programme) : "", programmeB = b.metadata?.programme ? normalizedName(b.metadata.programme) : "";
  const programmeAvailable = !!programmeA && !!programmeB, programmeMatch = programmeAvailable && programmeA === programmeB;
  const refA = a.metadata?.normalizedExternalReference || a.metadata?.externalReference || "", refB = b.metadata?.normalizedExternalReference || b.metadata?.externalReference || "";
  const referenceAvailable = !!refA && !!refB, sameReferenceText = referenceAvailable && normalizedIdentifier(refA) === normalizedIdentifier(refB);
  const strongReference = !!sameReferenceText && !!a.metadata?.sourceChannelId && a.metadata.sourceChannelId === b.metadata?.sourceChannelId;
  const entityKey = (entity: NonNullable<Complaint["entityReferences"]>[number]) => `${entity.kind}\0${normalizedIdentifier(entity.namespace)}\0${normalizedIdentifier(entity.value)}`;
  const entitiesA = new Set((a.entityReferences || []).map(entityKey)), entitiesB = new Set((b.entityReferences || []).map(entityKey));
  const entityAvailable = entitiesA.size > 0 && entitiesB.size > 0, entityMatches = [...entitiesA].filter(key => entitiesB.has(key)).length;
  const signals: OverlapSignal[] = [];
  const add = (key: OverlapSignal["key"], available: boolean, value: number, reason: string) => signals.push({ key, available, value: Math.max(0, Math.min(1, value)), weight: config.weights[key], contribution: 0, reason });
  add("institution", true, sameInstitution ? 1 : 0, sameInstitution ? "Exact resolved institution identity" : "Different institutions; no overlap relationship is inferred");
  add("category", !!a.category && !!b.category, sameCategory ? 1 : 0, sameCategory ? "Exact subject/category" : "Different or missing subject/category");
  add("programme", programmeAvailable, programmeMatch ? 1 : 0, programmeAvailable ? programmeMatch ? "Same recorded programme/course" : "Different recorded programmes/cohorts" : "Programme missing; weight excluded");
  add("reference", referenceAvailable, strongReference ? 1 : sameReferenceText ? 0.4 : 0, strongReference ? "Same normalized reference within the same source channel" : sameReferenceText ? "Reference text matches across different sources; weak evidence requiring verification" : referenceAvailable ? "Different source references" : "Reference missing; weight excluded");
  add("entity", entityAvailable, entityAvailable ? entityMatches / new Set([...entitiesA, ...entitiesB]).size : 0, entityAvailable ? `${entityMatches} matching explicitly recorded institutional entity code(s); no complainant identity used` : "Explicit entity codes missing; weight excluded");
  add("text", similarity.score !== undefined, (similarity.score || 0) / 100, `${similarity.mode}. ${similarity.limitation}`);
  add("temporal", distanceDays !== undefined, withinWindow ? 1 - distanceDays! / config.dateWindowDays * 0.5 : 0, distanceDays === undefined ? "Date missing/invalid; neutral, excluded from weight normalization" : `${distanceDays} calendar days between recorded source/received dates; window ${config.dateWindowDays} days`);
  add("crossBureau", !!bureauA && !!bureauB, crossBureau ? 1 : 0, crossBureau ? `Different handling Bureaus: ${bureauA} / ${bureauB}` : "Same or missing handling Bureau");
  const availableWeight = signals.filter(signal => signal.available).reduce((sum, signal) => sum + signal.weight, 0);
  for (const signal of signals) signal.contribution = signal.available && availableWeight ? Math.round(signal.weight * signal.value / availableWeight * 10000) / 100 : 0;
  const combinedScore = sameInstitution && availableWeight ? Math.round(signals.reduce((sum, signal) => sum + signal.contribution, 0)) : 0;
  const rules = signals.filter(signal => signal.available && signal.key !== "text"), ruleWeight = rules.reduce((sum, signal) => sum + signal.weight, 0);
  const ruleScore = sameInstitution && ruleWeight ? Math.round(rules.reduce((sum, signal) => sum + signal.weight * signal.value, 0) / ruleWeight * 100) : 0;
  const relatedThreshold = similarity.mode === "multilingual_embeddings" ? config.embeddingRelatedThreshold : config.lexicalRelatedThreshold;
  const duplicateThreshold = similarity.mode === "multilingual_embeddings" ? config.embeddingDuplicateThreshold : config.lexicalDuplicateThreshold;
  const textRelated = similarity.score !== undefined && similarity.score >= relatedThreshold, textDuplicate = similarity.score !== undefined && similarity.score >= duplicateThreshold;
  const temporalEligible = withinWindow !== false || strongReference;
  const contextCompatible = !programmeAvailable || programmeMatch;
  let candidate: OverlapAssessment["relationshipCandidate"] = "undetermined";
  if (sameInstitution && temporalEligible && sameCategory && contextCompatible && combinedScore >= config.duplicateScoreThreshold && (textDuplicate || strongReference)) candidate = "possible_duplicate";
  else if (sameInstitution && temporalEligible && combinedScore >= config.reviewScoreThreshold && (textRelated || sameReferenceText || entityMatches > 0)) candidate = "possible_related";
  const reviewRequired = sameInstitution && (mandatory || candidate !== "undetermined");
  return { isSameInstitution: sameInstitution, isCrossBureau: crossBureau, combinedScore, ruleScore,
    assessment: { algorithmVersion: "signals-v2", configurationVersion: config.version, reviewRequired, mandatoryReview: mandatory, relationshipCandidate: candidate, signals,
      date: { sourceA: dateA.source, sourceB: dateB.source, distanceDays, withinWindow, missingBehavior: "Prefer valid source received date, then received date. Missing/invalid dates are neutral; mandatory review is never disabled by missing or distant dates." },
      caveat: "Review signals and relationship candidates are not duplication decisions, merges, findings of wrongdoing, calibrated probabilities or statutory conclusions." } };
}
