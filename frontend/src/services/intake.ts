import { api } from "./api.js";
export interface IntakeConfig {
  id: string; version: number; reason: string;
  caseTypes: { id: string; label: string; enabled: boolean; lifecycle: "complaint_default" | "review_required" }[];
  channels: { id: string; label: string; enabled: boolean; connection: "internal_entry" | "not_connected" }[];
  categories: string[]; priorities: string[]; bureaus: { id: string; name: string }[];
}
export interface CaseMetadata {
  recordKind: "complaint" | "other_case"; caseTypeId: string; sourceChannelId: string;
  externalReference?: string; sourceReceivedDate: string; programme?: string;
  provenance: { method: string; enteredBy: string; enteredAt: string; configurationVersion: number; sourceNote?: string; originalInstitutionText?: string; resolvedBy?: string; resolvedAt?: string; resolutionReason?: string; intakeId?: string };
}
export interface IntakeRecord {
  id: string; version: number; status: "NeedsInstitutionResolution" | "NeedsLifecycleReview" | "Ready" | "Registered";
  institutionText: string; institutionId?: string; locationHint?: string; identifier?: { namespace: string; value: string };
  metadata: CaseMetadata; title: string; description: string; category: string; priority: string; bureauId: string; complaintId?: string;
}
export interface InstitutionCandidate {
  id: string; name: string; aictePermanentId: string; city: string; state: string; region: string;
  score: number; confidence: string; reasons: string[];
}
export const intakeApi = {
  configuration: () => api.request<IntakeConfig>("intake/configuration"),
  list: () => api.request<IntakeRecord[]>("intake"),
  create: (body: unknown) => api.request<IntakeRecord>("intake", "POST", body),
  candidates: (body: unknown) => api.request<{ candidates: InstitutionCandidate[]; ambiguous: boolean }>("intake/institutions/resolve", "POST", body),
  resolve: (id: string, body: unknown) => api.request<IntakeRecord>(`intake/${encodeURIComponent(id)}/resolve`, "POST", body),
  register: (id: string, version: number) => api.request<{ complaint: { id: string; complaintId: string } }>(`intake/${encodeURIComponent(id)}/register`, "POST", { version }),
  configure: (body: unknown) => api.request<IntakeConfig>("intake/configuration", "PUT", body),
  saveMatching: (id: string, body: unknown) => api.request(`intake/institutions/${encodeURIComponent(id)}/matching`, "PUT", body)
};
