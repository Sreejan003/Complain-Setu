import { store } from "../db/store.js";
import type { Complaint, Profile } from "../models/types.js";
import type { InstitutionEntityReference } from "../models/overlapSettings.js";
import { authorize, effectiveProfile, mayRead, requestScope } from "../security/rbac.js";
import { normalizedIdentifier } from "./institutionResolution.js";
import { detectOverlapsForComplaint } from "./overlapEngine.js";
import { overlapFail, overlapReason } from "./overlapSettings.js";
function context(user: Profile, id: string) {
  const current = store.getProfileById(user.id), complaint = store.getComplaintById(id);
  if (!current?.isActive || !complaint) overlapFail("OVERLAP_CASE_NOT_FOUND", 404);
  const actor = effectiveProfile(current);
  if (!mayRead(actor, complaint, store.getComplaintRegion(complaint))) overlapFail("OVERLAP_CASE_NOT_FOUND", 404);
  return { actor, complaint };
}
function mutable(actor: Profile, complaint: Complaint) {
  if (!authorize(actor, "case.update", complaint, { region: store.getComplaintRegion(complaint) })) overlapFail("OVERLAP_ACTION_FORBIDDEN", 403);
}
function candidates(actor: Profile, complaint: Complaint) {
  return store.getOverlapCandidates(complaint, actor);
}
export const overlapReviewService = {
  view(user: Profile, id: string) {
    const { actor, complaint } = context(user, id);
    return { entities: complaint.entityReferences || [], version: complaint.entityReferencesVersion || 0, canEdit: authorize(actor, "case.update", complaint, { region: store.getComplaintRegion(complaint) }), configurationVersion: store.getOverlapSettings().version };
  },
  entities(user: Profile, id: string, input: any) {
    return store.transaction(() => {
      const { actor, complaint } = context(user, id); mutable(actor, complaint);
      const reason = overlapReason(input?.reason);
      if (input.version !== (complaint.entityReferencesVersion || 0)) overlapFail("OVERLAP_ENTITIES_CHANGED", 409);
      if (!Array.isArray(input.entities) || input.entities.length > 20) overlapFail("OVERLAP_INVALID_ENTITIES");
      const entities: InstitutionEntityReference[] = input.entities.map((row: any) => {
        if (!row || !["department", "programme", "document_reference"].includes(row.kind) || typeof row.namespace !== "string" || typeof row.value !== "string" || !/^[\p{L}\p{M}\p{N}_. /:-]{1,80}$/u.test(row.namespace) || !/^[\p{L}\p{M}\p{N}_. /:-]{1,80}$/u.test(row.value) || !row.namespace.trim() || !row.value.trim()) overlapFail("OVERLAP_INVALID_ENTITY_CODE");
        return { kind: row.kind, namespace: normalizedIdentifier(row.namespace), value: normalizedIdentifier(row.value) };
      });
      if (new Set(entities.map(row => JSON.stringify(row))).size !== entities.length) overlapFail("OVERLAP_DUPLICATE_ENTITY_CODE");
      store.saveEntityReferences(complaint.id, entities);
      store.addAuditLog({ userId: actor.id, userName: actor.fullName, action: "OVERLAP_ENTITY_CODES_RECORDED", entityType: "Complaint", entityId: complaint.id, details: { reason, version: (complaint.entityReferencesVersion || 0), count: entities.length } });
      return this.view(actor, complaint.id);
    });
  },
  async rescan(user: Profile, id: string, input: any) {
    const initial = context(user, id); mutable(initial.actor, initial.complaint);
    const reason = overlapReason(input?.reason), config = store.getOverlapSettings();
    const institution = store.getInstitutionMasterRecords().find(row => row.id === initial.complaint.institutionId);
    if (!institution) overlapFail("OVERLAP_CASE_NOT_FOUND", 404);
    const source = structuredClone(initial.complaint), compared = structuredClone(candidates(initial.actor, source));
    const fingerprint = JSON.stringify([source, compared, config]);
    const detection = await detectOverlapsForComplaint(source, institution, compared, config);
    return store.transaction(() => {
      const { actor, complaint } = context(user, id); mutable(actor, complaint);
      if (fingerprint !== JSON.stringify([complaint, candidates(actor, complaint), store.getOverlapSettings()])) overlapFail("OVERLAP_INPUT_CHANGED", 409);
      const created = store.recordOverlapCandidates(complaint, institution, detection);
      store.addAuditLog({ userId: actor.id, userName: actor.fullName, action: "OVERLAP_RESCAN", entityType: "Complaint", entityId: complaint.id, details: { reason, configurationVersion: config.version } });
      // Do not disclose candidates/counts outside the current case/alert visibility policy.
      return { created: requestScope.run(actor, () => created.some(alertId => !!store.getOverlapAlertById(alertId))), configurationVersion: config.version };
    });
  }
};
