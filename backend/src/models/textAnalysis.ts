export interface TextAnalysis {
  sourceHash: string;
  preprocessingVersion: string;
  analyzedAt: string;
  language: { code: string; method: "script_heuristic" | "human_declared"; scripts: string[]; limitations: string };
  translation: {
    status: "not_requested" | "draft" | "reviewed" | "unavailable";
    text?: string; targetLanguage?: string; method?: "human_supplied"; suppliedBy?: string; suppliedAt?: string;
    sourceHash?: string; reviewedBy?: string; reviewedAt?: string;
  };
}
export type SimilarityMode = "multilingual_embeddings" | "lexical_fallback" | "unavailable";
export interface SimilarityResult {
  score?: number; mode: SimilarityMode; engine: string; model: string; revision: string;
  preprocessingVersion: string; limitation: string;
}
