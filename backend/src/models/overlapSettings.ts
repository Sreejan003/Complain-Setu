export interface InstitutionEntityReference {
  kind: "department" | "programme" | "document_reference";
  namespace: string;
  value: string;
}
export interface OverlapSettings {
  id: string; version: number; changedBy: string; changedAt: string; reason: string; rollbackOf?: number;
  algorithmVersion: "signals-v2";
  weights: { institution: number; category: number; programme: number; reference: number; entity: number; text: number; temporal: number; crossBureau: number };
  dateWindowDays: number;
  reviewScoreThreshold: number;
  duplicateScoreThreshold: number;
  lexicalRelatedThreshold: number;
  lexicalDuplicateThreshold: number;
  embeddingRelatedThreshold: number;
  embeddingDuplicateThreshold: number;
}
export interface OverlapSignal {
  key: keyof OverlapSettings["weights"]; available: boolean; value: number; weight: number; contribution: number; reason: string;
}
export interface OverlapAssessment {
  algorithmVersion: "signals-v2"; configurationVersion: number;
  reviewRequired: boolean; mandatoryReview: boolean;
  relationshipCandidate: "possible_duplicate" | "possible_related" | "undetermined";
  signals: OverlapSignal[];
  date: { sourceA: string; sourceB: string; distanceDays?: number; withinWindow?: boolean; missingBehavior: string };
  caveat: string;
}
export interface OverlapFeedback {
  id: string; alertId: string; actorId: string; decision: string; reason: string; createdAt: string;
  configurationVersion?: number; algorithmVersion: string; requestId?: string; linkAsRelated?: boolean;
}
