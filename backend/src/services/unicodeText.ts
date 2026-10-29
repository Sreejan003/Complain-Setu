import { createHash } from "node:crypto";
import type { TextAnalysis } from "../models/textAnalysis.js";
export const PREPROCESSING_VERSION = "unicode-nfkc-lower-v1";
export const ENGLISH_STOPWORDS = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "up", "about", "into", "over", "after", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "this", "that", "these", "those", "it", "its", "we", "they", "our", "their", "student", "college", "institution", "complaint", "aicte"]);
export function unicodeTokens(text: string) {
  return (text.normalize("NFKC").toLocaleLowerCase("und").match(/[\p{L}\p{M}\p{N}]+/gu) || []).filter(token => /[\p{L}\p{N}]/u.test(token) && !ENGLISH_STOPWORDS.has(token));
}
export function lexicalCosine(textA: string, textB: string) {
  const frequency = (text: string) => { const counts = new Map<string, number>(); for (const token of unicodeTokens(text)) counts.set(token, (counts.get(token) || 0) + 1); return counts; };
  const a = frequency(textA), b = frequency(textB);
  const norm = (values: Map<string, number>) => Math.sqrt([...values.values()].reduce((sum, value) => sum + value * value, 0));
  const denominator = norm(a) * norm(b); if (!denominator) return 0;
  return Math.round([...a].reduce((sum, [token, value]) => sum + value * (b.get(token) || 0), 0) / denominator * 10000) / 100;
}
export const originalTextHash = (title: string, description: string) => createHash("sha256").update(JSON.stringify([title, description])).digest("hex");
const scriptPatterns: [string, RegExp][] = [
  ["Deva", /\p{Script=Devanagari}/u], ["Gujr", /\p{Script=Gujarati}/u], ["Taml", /\p{Script=Tamil}/u], ["Telu", /\p{Script=Telugu}/u],
  ["Beng", /\p{Script=Bengali}/u], ["Knda", /\p{Script=Kannada}/u], ["Mlym", /\p{Script=Malayalam}/u], ["Guru", /\p{Script=Gurmukhi}/u],
  ["Orya", /\p{Script=Oriya}/u], ["Arab", /\p{Script=Arabic}/u], ["Olck", /\p{Script=Ol_Chiki}/u], ["Mtei", /\p{Script=Meetei_Mayek}/u], ["Latn", /\p{Script=Latin}/u]
];
export function analyzeOriginalText(title: string, description: string): TextAnalysis {
  const text = title + " " + description, scripts = scriptPatterns.filter(([, pattern]) => pattern.test(text)).map(([script]) => script);
  const singleScriptLanguage: Record<string, string> = { Gujr: "gu", Taml: "ta", Telu: "te", Knda: "kn", Mlym: "ml", Guru: "pa", Orya: "or", Olck: "sat-Olck", Mtei: "mni-Mtei" };
  const code = scripts.length > 1 ? "mul" : singleScriptLanguage[scripts[0]] || "und";
  return { sourceHash: originalTextHash(title, description), preprocessingVersion: PREPROCESSING_VERSION, analyzedAt: new Date().toISOString(),
    language: { code, method: "script_heuristic", scripts, limitations: "Script hints are not calibrated language identification. Shared scripts and Latin text remain undetermined; mixed scripts are marked multilingual." },
    translation: { status: "not_requested" } };
}
