import { lexicalCosine, PREPROCESSING_VERSION } from "./unicodeText.js";
import type { SimilarityResult } from "../models/textAnalysis.js";
export async function querySimilarityService(textA: string, textB: string): Promise<SimilarityResult | null> {
  if (!textA.trim() || !textB.trim() || textA.length > 20000 || textB.length > 20000) return null;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const endpoint = new URL(process.env.AI_SERVICE_URL || "http://localhost:8000");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
    if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password || (!local && (process.env.AI_EXTERNAL_DATA_APPROVED !== "true" || endpoint.protocol !== "https:"))) return null;
    const controller = new AbortController(), duration = Math.min(15000, Math.max(100, Number(process.env.AI_TIMEOUT_MS) || 1200));
    timeout = setTimeout(() => controller.abort(), duration);
    const response = await fetch(`${endpoint.href.replace(/\/$/, "")}/similarity/pair`, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.AI_SERVICE_TOKEN ? { Authorization: "Bearer " + process.env.AI_SERVICE_TOKEN } : {}) }, body: JSON.stringify({ text_a: textA, text_b: textB }), signal: controller.signal, redirect: "error" });
    if (!response.ok || Number(response.headers.get("content-length") || 0) > 65536) return null;
    const data = await response.json() as any;
    if (!["multilingual_embeddings", "lexical_fallback", "unavailable"].includes(data.mode) || data.preprocessing_version !== PREPROCESSING_VERSION) return null;
    if (data.mode === "unavailable") return null;
    if (typeof data.similarity_score !== "number" || !Number.isFinite(data.similarity_score) || data.similarity_score < 0 || data.similarity_score > 100 || typeof data.model !== "string" || typeof data.revision !== "string" || !data.revision) return null;
    if (data.mode === "multilingual_embeddings" && (!["intfloat/multilingual-e5-small", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2", "BAAI/bge-m3"].includes(data.model) || !/^[0-9a-f]{40}$/.test(data.revision))) return null;
    return { score: data.similarity_score, mode: data.mode, engine: data.mode === "multilingual_embeddings" ? "Multilingual embeddings" : "Unicode Lexical Fallback (sidecar)", model: data.model, revision: data.revision, preprocessingVersion: PREPROCESSING_VERSION,
      limitation: data.mode === "multilingual_embeddings" ? "Embedding similarity is not a probability of duplication or a legal finding." : "Lexical overlap does not provide semantic cross-language understanding." };
  } catch { return null; } finally { if (timeout) clearTimeout(timeout); }
}
export async function compareTexts(textA: string, textB: string, allowProvider = true): Promise<SimilarityResult> {
  const mode = process.env.SIMILARITY_MODE || "auto";
  if (mode === "unavailable") return { mode: "unavailable", engine: "Unavailable", model: "none", revision: "none", preprocessingVersion: PREPROCESSING_VERSION, limitation: "Text similarity is disabled; configured institution/category rules remain available." };
  if (!["auto", "lexical"].includes(mode)) throw new Error("SIMILARITY_MODE must be auto, lexical or unavailable");
  if (allowProvider && mode === "auto") { const result = await querySimilarityService(textA, textB); if (result) return result; }
  return { score: lexicalCosine(textA, textB), mode: "lexical_fallback", engine: "Unicode Lexical Fallback (in-process)", model: "token-frequency-cosine", revision: "1", preprocessingVersion: PREPROCESSING_VERSION, limitation: "Lexical overlap does not provide semantic cross-language understanding." };
}
