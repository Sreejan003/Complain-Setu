import { Complaint, Institution, OverlapAlert, DetectionResult } from "../models/types.js";
import { DEFAULT_DETECTION_CONFIG } from "../config/constants.js";

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

// Common English stopwords to ignore in text overlap
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
  "from", "up", "about", "into", "over", "after", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "this", "that", "these", "those", "it",
  "its", "we", "they", "our", "their", "student", "college", "institution", "complaint", "aicte"
]);

/**
 * Tokenize and normalize text into clean unique keyword tokens
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word));
  return Array.from(new Set(words));
}

/**
 * In-process Fallback Cosine Similarity calculation (word-vector based TF-IDF approximation)
 */
export function computeInProcessCosineSimilarity(textA: string, textB: string): number {
  const tokensA = extractKeywords(textA);
  const tokensB = extractKeywords(textB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const freqA: Record<string, number> = {};
  tokensA.forEach(t => { freqA[t] = (freqA[t] || 0) + 1; });

  const freqB: Record<string, number> = {};
  tokensB.forEach(t => { freqB[t] = (freqB[t] || 0) + 1; });

  let dotProduct = 0;
  for (const token of Object.keys(freqA)) {
    if (freqB[token]) {
      dotProduct += freqA[token] * freqB[token];
    }
  }

  const normA = Math.sqrt(Object.values(freqA).reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(Object.values(freqB).reduce((sum, val) => sum + val * val, 0));

  if (normA === 0 || normB === 0) return 0;
  const similarity = dotProduct / (normA * normB);
  return Math.min(100, Math.round(similarity * 100 * 10) / 10);
}

/**
 * Query external Python AI Service (Sentence Transformers) if running
 */
export async function querySemanticService(textA: string, textB: string): Promise<{ score: number; engine: string } | null> {
  const aiUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200); // 1.2s fast timeout

    const res = await fetch(`${aiUrl}/similarity/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text_a: textA, text_b: textB }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return {
        score: Number(data.similarity_score) || 0,
        engine: data.engine || "SentenceTransformer"
      };
    }
  } catch (err) {
    // Expected when optional AI service is not running locally; smoothly fallback
  }
  return null;
}

export interface OverlapEvaluation {
  isOverlap: boolean;
  ruleScore: number;
  semanticScore?: number;
  combinedScore: number;
  semanticEngine: string;
  reasons: string[];
  recommendation: string;
  isCrossBureau: boolean;
}

/**
 * Core 3-Stage Overlap Detection Algorithm:
 * Stage A: Exact Institution Matching
 * Stage B: Rule-based explainable heuristics
 * Stage C: Semantic Similarity (Sentence Transformers or TF-IDF fallback)
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
      ruleScore: 0,
      combinedScore: 0,
      semanticEngine: "None",
      reasons: ["Different institutions: Overlap detection restricted to same institution"],
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
  let semanticScore: number | undefined;
  let semanticEngine = "TF-IDF Fallback";

  const aiResult = await querySemanticService(fullTextNew, fullTextExisting);
  if (aiResult) {
    semanticScore = aiResult.score;
    semanticEngine = aiResult.engine;
    reasons.push(`AI Semantic Embeddings: ${semanticScore}% similarity computed via ${aiResult.engine} (all-MiniLM-L6-v2).`);
  } else {
    const inProcessSim = computeInProcessCosineSimilarity(fullTextNew, fullTextExisting);
    semanticScore = inProcessSim;
    semanticEngine = "TF-IDF Fallback (in-process)";
    reasons.push(`Rule & Lexical Similarity: ${inProcessSim}% text similarity computed via in-process cosine analyzer.`);
  }

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
        ? "CRITICAL: High-probability cross-Bureau overlap detected. Immediate joint review by RB and PGRC Officers recommended."
        : "Probable duplicate or companion grievance. Review case files side-by-side.";
    } else if (isCrossBureau) {
      recommendation = "Cross-Bureau activity on same institution. Inform assigned officers and link case histories.";
    } else {
      recommendation = "Review complaints side-by-side to determine if complaints should be merged or linked.";
    }
  }

  return {
    isOverlap,
    ruleScore,
    semanticScore,
    combinedScore,
    semanticEngine,
    reasons,
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
