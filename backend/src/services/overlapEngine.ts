import { Complaint, Institution, OverlapAlert, DetectionResult, OverlapExplanation } from "../models/types.js";
import { defaultOverlapSettings } from "../config/overlap.js";
import { assessOverlap } from "./overlapSignals.js";
import type { OverlapSettings, OverlapAssessment } from "../models/overlapSettings.js";
import { unicodeTokens, lexicalCosine, PREPROCESSING_VERSION } from "./unicodeText.js";
import { compareTexts, querySimilarityService } from "./similarityProvider.js";
import type { SimilarityResult } from "../models/textAnalysis.js";

interface KeywordDictionary {
  [key: string]: string[];
}

const DOMAIN_KEYWORDS: KeywordDictionary = {
  faculty: ["faculty", "teacher", "professor", "salary", "unpaid", "shortage", "qualification", "phd", "recruitment", "biometric"],
  fees: ["fee", "fees", "capitation", "overcharging", "refund", "receipt", "tuition", "hostel", "extortion", "penalty"],
  infrastructure: ["lab", "laboratory", "library", "equipment", "deficiency", "classroom", "building", "fire safety", "computer", "wi-fi"],
  documents: ["certificate", "marksheet", "degree", "retention", "withholding", "original", "refusal", "tc", "transfer certificate"],
  admission: ["admission", "quota", "management", "eligibility", "counseling", "merit", "donation", "unauthorized", "intake"]
};

/**
 * Tokenize and normalize text into clean unique keyword tokens
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  return Array.from(new Set(unicodeTokens(text)));
}

/**
 * Unicode token-frequency cosine. This is lexical overlap, not TF-IDF or cross-language semantics.
 */
export function computeInProcessCosineSimilarity(textA: string, textB: string): number {
  return lexicalCosine(textA, textB);
}

/**
 * Normalizes institution name for fuzzy discrimination
 */
export function normalizeInstitutionName(name: string): string {
  if (!name) return "";
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\buniv\b/g, "university")
    .replace(/\btech\b/g, "technology")
    .replace(/\btechnological\b/g, "technology")
    .replace(/\bengg\b/g, "engineering")
    .replace(/\binst\b/g, "institute")
    .replace(/\bmgmt\b/g, "management")
    .replace(/\b(college|institute|technology|engineering|university|polytechnic|of|and|for|the|national|indian)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fuzzy matching between searched institution name and database institution candidate
 */
export function fuzzyMatchInstitution(query: string, candidate: string): { match: boolean; score: number } {
  if (!query || !candidate) return { match: false, score: 0 };
  const qClean = query.toLowerCase().trim();
  const cClean = candidate.toLowerCase().trim();

  if (qClean === cClean) return { match: true, score: 100 };

  if (cClean.includes(qClean) || qClean.includes(cClean)) {
    const ratio = Math.min(qClean.length, cClean.length) / Math.max(qClean.length, cClean.length);
    return { match: true, score: Math.round(75 + ratio * 25) };
  }

  // Canonical expansion for common educational abbreviations
  const expand = (s: string) =>
    s
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
      .replace(/\buniv\b/g, "university")
      .replace(/\btech\b/g, "technology")
      .replace(/\btechnological\b/g, "technology")
      .replace(/\bengg\b/g, "engineering")
      .replace(/\binst\b/g, "institute")
      .replace(/\bmgmt\b/g, "management")
      .replace(/\s+/g, " ")
      .trim();

  const expQ = expand(query);
  const expC = expand(candidate);
  if (!expQ || !expC) return { match: false, score: 0 };

  if (expQ === expC) return { match: true, score: 95 };
  if (expC.includes(expQ) || expQ.includes(expC)) {
    return { match: true, score: 85 };
  }

  const normQ = normalizeInstitutionName(query);
  const normC = normalizeInstitutionName(candidate);
  if (normQ && normC && (normC.includes(normQ) || normQ.includes(normC))) {
    return { match: true, score: 80 };
  }

  const tokensQ = (normQ || expQ).split(" ").filter(Boolean);
  const tokensC = (normC || expC).split(" ").filter(Boolean);
  if (tokensQ.length === 0 || tokensC.length === 0) return { match: false, score: 0 };

  let matchCount = 0;
  for (const tQ of tokensQ) {
    for (const tC of tokensC) {
      if (tQ === tC || (tQ.length >= 3 && tC.startsWith(tQ)) || (tC.length >= 3 && tQ.startsWith(tC))) {
        matchCount++;
        break;
      }
    }
  }

  const jaccard = (matchCount / Math.max(tokensQ.length, tokensC.length)) * 100;

  return {
    match: jaccard >= 40,
    score: Math.round(jaccard)
  };
}

/**
 * Query external Python AI Service (Sentence Transformers) if running
 */
export async function querySemanticService(textA: string, textB: string) {
  const result = await querySimilarityService(textA, textB);
  return result && result.score !== undefined ? { ...result, score: result.score } : null;
}

export interface OverlapEvaluation {
  similarity: SimilarityResult; assessment: OverlapAssessment; isOverlap: boolean; ruleScore: number;
  semanticScore?: number; combinedScore: number; semanticEngine: string; reasons: string[];
  explanation: OverlapExplanation; recommendation: string; isCrossBureau: boolean;
}

/** Review-only signals. Mandatory review and inferred relationship are deliberately separate. */
export async function evaluateComplaintPair(a: Partial<Complaint>, b: Complaint, institution: Institution, config: OverlapSettings = defaultOverlapSettings()): Promise<OverlapEvaluation> {
  const sameInstitution = !!(a.institutionId && a.institutionId === b.institutionId || a.aictePermanentId && a.aictePermanentId === b.aictePermanentId);
  const privateInput = [a, b].some(record => record.security && (record.security.level !== "internal" || record.security.reviewStatus === "pending"));
  const similarity: SimilarityResult = sameInstitution ? await compareTexts(`${a.title || ""} ${a.description || ""}`, `${b.title || ""} ${b.description || ""}`, !privateInput) : { mode: "unavailable", engine: "Unavailable", model: "none", revision: "none", preprocessingVersion: PREPROCESSING_VERSION, limitation: "Different institutions; no text comparison performed." };
  const scored = assessOverlap(a, b, similarity, config), assessment = scored.assessment;
  const sharedTokens = extractKeywords(`${a.title || ""} ${a.description || ""}`).filter(token => extractKeywords(`${b.title} ${b.description}`).includes(token));
  const reasons = assessment.signals.filter(signal => signal.available).map(signal => `${signal.key}: ${signal.reason}; contribution ${signal.contribution}/100.`);
  if (assessment.mandatoryReview) reasons.unshift("Mandatory review: same institution, same category, both cases open, different handling Bureaus. This does not declare duplication.");
  const recommendation = !assessment.reviewRequired ? "Handle individually under the existing workflow." : assessment.relationshipCandidate === "possible_duplicate" ? "Possible duplicate: an authorized reviewer must compare evidence and source obligations before deciding." : assessment.relationshipCandidate === "possible_related" ? "Possible related case: an authorized reviewer must decide whether coordination is needed." : "Mandatory overlap review; the relationship is undetermined. No merge or duplication decision has been made.";
  const signal = (key: string) => assessment.signals.find(row => row.key === key)!;
  const explanation: OverlapExplanation = {
    assessment,
    institutionMatch: { matched: sameInstitution, score: signal("institution").contribution, details: sameInstitution ? `Exact resolved institution: ${institution.aictePermanentId} (${institution.name})` : "Different institutions" },
    categoryMatch: { exactMatch: !!a.category && a.category === b.category, categoryA: a.category || "", categoryB: b.category, details: signal("category").reason },
    crossBureauMatch: { isCrossBureau: scored.isCrossBureau, bureauA: a.currentBureauId || a.receivingBureauId || "", bureauB: b.currentBureauId || b.receivingBureauId, details: signal("crossBureau").reason },
    keywordMatch: { matchedTerms: sharedTokens.slice(0, 8), score: 0, details: "Shared lexical terms are illustrative; their effect is included only in the text signal." },
    semanticMatch: { score: similarity.score, engine: similarity.engine, mode: similarity.mode, model: similarity.model, revision: similarity.revision, preprocessingVersion: similarity.preprocessingVersion, details: similarity.limitation },
    summary: `${scored.combinedScore}/100 weighted signal score; signals-v2 configuration ${config.version}; ${similarity.mode}. ${assessment.caveat}`, recommendation
  };
  return { ...scored, similarity, assessment, isOverlap: assessment.reviewRequired, semanticScore: similarity.score, semanticEngine: similarity.engine, reasons, explanation, recommendation };
}

export async function detectOverlapsForComplaint(a: Partial<Complaint>, institution: Institution, cases: Complaint[], config: OverlapSettings = defaultOverlapSettings()): Promise<DetectionResult> {
  const candidateAlerts: DetectionResult["candidateAlerts"] = [];
  for (const b of cases.filter(row => row.id !== a.id && row.complaintId !== a.complaintId && (row.institutionId === institution.id || row.aictePermanentId === institution.aictePermanentId))) {
    const result = await evaluateComplaintPair(a, b, institution, config);
    if (result.isOverlap) candidateAlerts.push({ existingComplaint: b, ruleScore: result.ruleScore, semanticScore: result.semanticScore, combinedScore: result.combinedScore, reasons: result.reasons, explanation: result.explanation, assessment: result.assessment, isCrossBureau: result.isCrossBureau, recommendation: result.recommendation });
  }
  candidateAlerts.sort((x, y) => y.combinedScore - x.combinedScore);
  return { hasOverlap: candidateAlerts.length > 0, candidateAlerts };
}
