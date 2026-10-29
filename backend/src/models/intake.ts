export type RecordKind = "complaint" | "other_case";
export interface CaseTypeDefinition {
  id: string;
  label: string;
  enabled: boolean;
  lifecycle: "complaint_default" | "review_required";
}
export interface SourceChannelDefinition {
  id: string;
  label: string;
  enabled: boolean;
  connection: "internal_entry" | "not_connected";
}
export interface IntakeConfiguration {
  id: string;
  version: number;
  caseTypes: CaseTypeDefinition[];
  channels: SourceChannelDefinition[];
  changedBy: string;
  changedAt: string;
  reason: string;
}
export interface CaseMetadata {
  recordKind: RecordKind;
  caseTypeId: string;
  sourceChannelId: string;
  externalReference?: string;
  normalizedExternalReference?: string;
  sourceReceivedDate: string;
  programme?: string;
  provenance: {
    method: "manual_intake" | "portal_entry" | "file_import" | "email_simulation";
    importRunId?:string;
    importRowNumber?:number;
    enteredBy: string;
    enteredAt: string;
    configurationVersion: number;
    sourceNote?: string;
    originalInstitutionText?: string;
    resolvedBy?: string;
    resolvedAt?: string;
    resolutionReason?: string;
    intakeId?: string;
  };
}
export interface InstitutionIdentifiers {
  aliases: string[];
  identifiers: { namespace: string; value: string }[];
  version: number;
}
export interface IntakeRecord {
  textAnalysis?: import("./textAnalysis.js").TextAnalysis;
  id: string;
  version: number;
  status: "NeedsInstitutionResolution" | "NeedsLifecycleReview" | "Ready" | "Registered";
  institutionText: string;
  institutionId?: string;
  locationHint?: string;
  identifier?: { namespace: string; value: string };
  metadata: CaseMetadata;
  category: string;
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  bureauId: string;
  region?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  complaintId?: string;
}
export interface InstitutionCandidate {
  id: string;
  name: string;
  aictePermanentId: string;
  city: string;
  state: string;
  region: string;
  score: number;
  confidence: "exact_identifier" | "exact_name" | "approximate";
  reasons: string[];
}
