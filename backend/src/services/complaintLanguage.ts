import { store } from "../db/store.js";
import { authorize, effectiveProfile } from "../security/rbac.js";
import { analyzeOriginalText, originalTextHash, PREPROCESSING_VERSION } from "./unicodeText.js";
import type { Profile } from "../models/types.js";
export const COMPLAINT_LANGUAGE_CODES = ["en", "hi", "mr", "gu", "ta", "te", "bn", "kn", "ml", "pa", "or", "as", "ur", "ne", "sa", "mai", "doi", "kok", "brx", "mni-Mtei", "sat-Olck", "ks-Arab", "sd-Arab"];
export class ComplaintLanguageError extends Error { constructor(public code: string, public status = 400) { super(code); } }
function fail(code: string, status = 400): never { throw new ComplaintLanguageError(code, status); }
function current(user: Profile, id: string) {
  const actor = store.getProfileById(user.id), complaint = store.getComplaintById(id);
  if (!actor?.isActive || !complaint) fail("LANGUAGE_NOT_FOUND", 404);
  const profile = effectiveProfile(actor);
  return { profile, complaint, analysis: complaint.textAnalysis?.sourceHash === originalTextHash(complaint.title, complaint.description) && complaint.textAnalysis.preprocessingVersion === PREPROCESSING_VERSION ? structuredClone(complaint.textAnalysis) : analyzeOriginalText(complaint.title, complaint.description) };
}
export const complaintLanguageService = {
  view(user: Profile, id: string) {
    const { profile, complaint, analysis } = current(user, id);
    return { analysis, languages: COMPLAINT_LANGUAGE_CODES, capabilities: { annotate: authorize(profile, "case.update", complaint, { region: store.getComplaintRegion(complaint) }), review: profile.role === "COMPETENT_AUTHORITY" } };
  },
  annotate(user: Profile, id: string, input: any) {
    return store.transaction(() => {
      const { profile, complaint, analysis } = current(user, id);
      if (!authorize(profile, "case.update", complaint, { region: store.getComplaintRegion(complaint) })) fail("LANGUAGE_FORBIDDEN", 403);
      if (input?.sourceHash !== analysis.sourceHash) fail("LANGUAGE_SOURCE_CHANGED", 409);
      if (typeof input.reason !== "string" || input.reason.trim().length < 5 || input.reason.length > 1000) fail("LANGUAGE_REASON_REQUIRED");
      const now = new Date().toISOString(); let action: string;
      if (input.action === "declare_language") {
        if (![...COMPLAINT_LANGUAGE_CODES, "und", "mul"].includes(input.language)) fail("INVALID_LANGUAGE");
        analysis.language = { ...analysis.language, code: input.language, method: "human_declared", limitations: "Language recorded by an authorized official; not an automated confidence estimate." }; action = "COMPLAINT_LANGUAGE_RECORDED";
      } else if (input.action === "supply_translation") {
        if (!COMPLAINT_LANGUAGE_CODES.includes(input.targetLanguage) || typeof input.text !== "string" || !input.text.trim() || input.text.length > 20000) fail("INVALID_TRANSLATION");
        if ([complaint.description, complaint.title + " " + complaint.description].some(text => text.normalize("NFKC").trim() === input.text.normalize("NFKC").trim())) fail("TRANSLATION_DID_NOT_OCCUR");
        analysis.translation = { status: "draft", text: input.text, targetLanguage: input.targetLanguage, method: "human_supplied", suppliedBy: profile.id, suppliedAt: now, sourceHash: analysis.sourceHash }; action = "COMPLAINT_TRANSLATION_SUPPLIED";
      } else if (input.action === "review_translation") {
        if (profile.role !== "COMPETENT_AUTHORITY" || analysis.translation.status !== "draft" || analysis.translation.suppliedBy === profile.id || analysis.translation.sourceHash !== analysis.sourceHash) fail("TRANSLATION_REVIEW_FORBIDDEN", 403);
        analysis.translation.status = "reviewed"; analysis.translation.reviewedBy = profile.id; analysis.translation.reviewedAt = now; action = "COMPLAINT_TRANSLATION_REVIEWED";
      } else fail("INVALID_LANGUAGE_ACTION");
      store.saveTextAnalysis(id, analysis);
      store.addAuditLog({ userId: profile.id, userName: profile.fullName, action, entityType: "Complaint", entityId: complaint.id, details: { sourceHash: analysis.sourceHash, preprocessingVersion: analysis.preprocessingVersion, reason: input.reason, translationStatus: analysis.translation.status } });
      return this.view(profile, id);
    });
  }
};
