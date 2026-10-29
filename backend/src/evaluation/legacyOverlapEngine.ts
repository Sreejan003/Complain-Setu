import { Complaint, Institution, OverlapAlert, DetectionResult, OverlapExplanation } from "../models/types.js";
import { DEFAULT_DETECTION_CONFIG } from "../config/constants.js";
import { unicodeTokens, lexicalCosine, PREPROCESSING_VERSION } from "../services/unicodeText.js";
import { compareTexts, querySimilarityService } from "../services/similarityProvider.js";
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
  similarity: SimilarityResult;
  isOverlap: boolean;
  ruleScore: number;
  semanticScore?: number;
  combinedScore: number;
  semanticEngine: string;
  reasons: string[];
  explanation: OverlapExplanation;
  recommendation: string;
  isCrossBureau: boolean;
}

/**
 * Core 3-Stage Overlap Detection Algorithm:
 * Stage A: Exact Institution Matching
 * Stage B: Rule-based explainable heuristics
 * Stage C: Explicit multilingual embedding, Unicode lexical fallback, or unavailable mode
 */
export async function evaluateComplaintPair(
  newComplaint: Partial<Complaint>,
  existingCase: Complaint,
  institution: Institution,
  config = DEFAULT_DETECTION_CONFIG
): Promise<OverlapEvaluation> {
  const reasons: string[] = [];
  let ruleScore = 0;

  // --- STAGE A: Exact Institution Matching ---
  const isSameInstitution =
    (newComplaint.institutionId && newComplaint.institutionId === existingCase.institutionId) ||
    (newComplaint.aictePermanentId && newComplaint.aictePermanentId === existingCase.aictePermanentId);

  if (!isSameInstitution) {
    // If not the same institution, they cannot be an institution overlap case
    return {
      isOverlap: false,
      similarity: { mode: "unavailable", engine: "Unavailable", model: "none", revision: "none", preprocessingVersion: PREPROCESSING_VERSION, limitation: "Different institutions: text comparison was not performed." },
      ruleScore: 0,
      combinedScore: 0,
      semanticEngine: "None",
      reasons: ["Different institutions: Overlap detection restricted to same institution"],
      explanation: {
        institutionMatch: { matched: false, score: 0, details: "Different institutions: Cross-institution isolation enforced." },
        crossBureauMatch: { isCrossBureau: false, bureauA: "", bureauB: "", details: "N/A" },
        categoryMatch: { exactMatch: false, categoryA: "", categoryB: "", details: "N/A" },
        keywordMatch: { matchedTerms: [], score: 0, details: "N/A" },
        semanticMatch: { score: 0, engine: "None", details: "N/A" },
        summary: "Zero overlap: Complaints belong to distinct technical institutions.",
        recommendation: "No action required."
      },
      recommendation: "No action required.",
      isCrossBureau: false
    };
  }

  ruleScore += config.exactInstitutionWeight;
  reasons.push(`Exact Institution Match: Verified AICTE Permanent ID (${institution.aictePermanentId} - ${institution.name})`);

  // --- STAGE B: Rule-Based Evaluation ---
  // 1. Cross-Bureau Check
  const newBureau = newComplaint.receivingBureauId || newComplaint.currentBureauId;
  const existingBureau = existingCase.currentBureauId || existingCase.receivingBureauId;
  const isCrossBureau = Boolean(newBureau && existingBureau && newBureau !== existingBureau);

  if (isCrossBureau) {
    ruleScore += config.crossBureauWeight;
    reasons.push(`Cross-Bureau Overlap: Active simultaneously in ${newBureau} and ${existingBureau}. Cross-department coordination required.`);
  } else {
    reasons.push(`Intra-Bureau Case: Both handled under ${newBureau || existingBureau}.`);
  }

  // 2. Category Match
  const sameCategory = newComplaint.category && existingCase.category && newComplaint.category === existingCase.category;
  if (sameCategory) {
    ruleScore += config.categoryMatchWeight;
    reasons.push(`Identical Category: Both complaints filed under "${newComplaint.category}".`);
  } else {
    // Check related category keywords
    const catWordsNew = (newComplaint.category || "").toLowerCase();
    const catWordsExist = (existingCase.category || "").toLowerCase();
    if (
      (catWordsNew.includes("faculty") && catWordsExist.includes("salary")) ||
      (catWordsNew.includes("salary") && catWordsExist.includes("faculty")) ||
      (catWordsNew.includes("fee") && catWordsExist.includes("admission"))
    ) {
      ruleScore += Math.round(config.categoryMatchWeight * 0.7);
      reasons.push(`Related Category Scope: Interdependent regulatory areas ("${newComplaint.category}" & "${existingCase.category}").`);
    }
  }

  // 3. Status & Recency Check
  const isActiveExisting = ["Pending", "Under Process", "Escalated"].includes(existingCase.status);
  if (isActiveExisting) {
    ruleScore += 10;
    reasons.push(`Target Case is currently active (${existingCase.status}), heightening duplication risk.`);
  }

  // 4. Keyword Intersection Analysis
  const fullTextNew = `${newComplaint.title || ""} ${newComplaint.description || ""}`;
  const fullTextExisting = `${existingCase.title || ""} ${existingCase.description || ""}`;

  const kwNew = extractKeywords(fullTextNew);
  const kwExist = extractKeywords(fullTextExisting);

  const sharedTokens = kwNew.filter(token => kwExist.includes(token));
  if (sharedTokens.length >= 3) {
    const keywordScore = Math.min(config.keywordOverlapWeight, sharedTokens.length * 4);
    ruleScore += keywordScore;
    reasons.push(`High Keyword Concordance: Matched terms: [${sharedTokens.slice(0, 6).join(", ")}].`);
  }

  // --- STAGE C: Semantic Similarity ---
  const privateInput = [newComplaint, existingCase].some(caseRecord => caseRecord.security && (caseRecord.security.level !== "internal" || caseRecord.security.reviewStatus === "pending"));
  const similarity = await compareTexts(fullTextNew, fullTextExisting, !privateInput);
  const semanticScore = similarity.score, semanticEngine = similarity.engine;
  reasons.push(`${similarity.mode}: ${semanticScore === undefined ? "score unavailable" : semanticScore + "/100 similarity"}. ${similarity.limitation}`);

  // Combined weighted score: 60% rule-based + 40% semantic similarity
  const combinedScore = Math.min(100, Math.round(ruleScore * 0.6 + (semanticScore || 0) * 0.4));

  // Determine if it qualifies as an overlap
  const isOverlap = Boolean(
    isSameInstitution &&
    (ruleScore >= config.ruleThreshold || (semanticScore !== undefined && semanticScore >= config.semanticSimilarityThreshold))
  );

  let recommendation = "Monitor individually.";
  if (isOverlap) {
    if (combinedScore >= config.highConfidenceThreshold || (sameCategory && isCrossBureau && (semanticScore || 0) > 70)) {
      recommendation = isCrossBureau
        ? "High combined similarity signals across Bureaus. Human review is required before determining any relationship."
        : "Probable duplicate or companion grievance. Review case files side-by-side.";
    } else if (isCrossBureau) {
      recommendation = "Cross-Bureau activity on same institution. Inform assigned officers and link case histories.";
    } else {
      recommendation = "Review complaints side-by-side to determine if complaints should be merged or linked.";
    }
  }

  const explanation: OverlapExplanation = {
    institutionMatch: {
      matched: Boolean(isSameInstitution),
      score: config.exactInstitutionWeight,
      details: `Verified AICTE Permanent ID: ${institution.aictePermanentId} (${institution.name})`
    },
    crossBureauMatch: {
      isCrossBureau,
      bureauA: newBureau || "RB",
      bureauB: existingBureau || "PGRC",
      details: isCrossBureau
        ? `Complaints active in separate bureaus (${newBureau} and ${existingBureau}). Joint coordination required.`
        : `Complaints processed within same bureau (${newBureau || existingBureau}).`
    },
    categoryMatch: {
      exactMatch: Boolean(sameCategory),
      categoryA: newComplaint.category || "",
      categoryB: existingCase.category || "",
      details: sameCategory
        ? `Identical grievance classification: "${newComplaint.category}"`
        : `Categorized under "${newComplaint.category}" and "${existingCase.category}"`
    },
    keywordMatch: {
      matchedTerms: sharedTokens.slice(0, 8),
      score: Math.min(config.keywordOverlapWeight, sharedTokens.length * 4),
      details: sharedTokens.length >= 3
        ? `Identified common grievance terminology: [${sharedTokens.slice(0, 6).join(", ")}]`
        : "Standard lexical vocabulary distribution."
    },
    semanticMatch: {
      mode: similarity.mode, model: similarity.model, revision: similarity.revision, preprocessingVersion: PREPROCESSING_VERSION,
      score: semanticScore,
      engine: semanticEngine,
      details: `${semanticScore === undefined ? "Unavailable" : semanticScore + "/100 similarity"} via ${semanticEngine}. ${similarity.limitation}`
    },
    summary: `${combinedScore}/100 combined rule and text-similarity score. This is not a calibrated probability of duplication. Active mode: ${similarity.mode}.`,
    recommendation
  };

  return {
    similarity,
    isOverlap,
    ruleScore,
    semanticScore,
    combinedScore,
    semanticEngine,
    reasons,
    explanation,
    recommendation,
    isCrossBureau
  };
}

/**
 * Run overlap detection for a new complaint against all relevant existing cases for that institution
 */
export async function detectOverlapsForComplaint(
  newComplaint: Partial<Complaint>,
  institution: Institution,
  existingComplaints: Complaint[]
): Promise<DetectionResult> {
  const candidateAlerts: DetectionResult["candidateAlerts"] = [];

  // Filter candidate cases: must be for the same institution and not the same record itself
  const candidateCases = existingComplaints.filter(c => {
    if (newComplaint.id && c.id === newComplaint.id) return false;
    if (newComplaint.complaintId && c.complaintId === newComplaint.complaintId) return false;
    return c.institutionId === institution.id || c.aictePermanentId === institution.aictePermanentId;
  });

  for (const existingCase of candidateCases) {
    const evalResult = await evaluateComplaintPair(newComplaint, existingCase, institution);
    if (evalResult.isOverlap) {
      candidateAlerts.push({
        existingComplaint: existingCase,
        ruleScore: evalResult.ruleScore,
        semanticScore: evalResult.semanticScore,
        combinedScore: evalResult.combinedScore,
        reasons: evalResult.reasons,
        explanation: evalResult.explanation,
        isCrossBureau: evalResult.isCrossBureau,
        recommendation: evalResult.recommendation
      });
    }
  }

  // Sort candidates by combined score descending
  candidateAlerts.sort((a, b) => b.combinedScore - a.combinedScore);

  return {
    hasOverlap: candidateAlerts.length > 0,
    candidateAlerts
  };
}

