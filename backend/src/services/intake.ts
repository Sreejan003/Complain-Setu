import { randomUUID } from "node:crypto";
import { store } from "../db/store.js";
import { COMPLAINT_CATEGORIES, PRIORITIES } from "../config/constants.js";
import type { IntakeRecord, IntakeConfiguration, InstitutionIdentifiers } from "../models/intake.js";
import type { Profile } from "../models/types.js";
import { effectiveProfile, mayRead, mayViewInstitution, roleOf } from "../security/rbac.js";
import { normalizedIdentifier, normalizedName, resolveInstitution } from "./institutionResolution.js";
import { analyzeOriginalText, originalTextHash } from "./unicodeText.js";

export class IntakeError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
function fail(code: string, status = 400): never { throw new IntakeError(code, status); }
function text(value: unknown, max: number, optional = false): string {
  if (optional && (value === undefined || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) fail("INVALID_INTAKE_FIELD");
  return value; // Preserve source text; normalize only matching/reference keys.
}
function date(value: unknown) {
  const result = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) fail("INVALID_SOURCE_DATE");
  return result;
}
function actor(user: Profile): Profile {
  const current = store.getProfileById(user.id);
  if (!current?.isActive || !["COMPETENT_AUTHORITY", "BUREAU_HEAD", "CASE_OFFICER"].includes(roleOf(current.role))) fail("INTAKE_FORBIDDEN", 403);
  return effectiveProfile(current);
}
function admin(user: Profile) {
  const current = store.getProfileById(user.id);
  if (!current?.isActive || roleOf(current.role) !== "SYSTEM_ADMIN") fail("CONFIGURATION_FORBIDDEN", 403);
}
function canSee(user: Profile, record: IntakeRecord) {
  if (record.complaintId) { const complaint = store.getCoordinationSource(record.complaintId); if (!complaint || (complaint.security?.level !== undefined && complaint.security.level !== "internal" && !mayRead(user, complaint, store.getComplaintRegion(complaint)))) return false; }
  return (!user.region || record.region === user.region) && (!user.bureauId || record.bureauId === user.bureauId) &&
    (roleOf(user.role) !== "CASE_OFFICER" || record.createdBy === user.id);
}
function scopedRecord(user: Profile, id: string) {
  const record = store.getIntakeRecords().find(item => item.id === id);
  if (!record || !canSee(user, record)) fail("INTAKE_NOT_FOUND", 404);
  return record;
}
function version(record: IntakeRecord, expected: unknown) {
  if (!Number.isInteger(expected) || expected !== record.version) fail("INTAKE_CONFLICT", 409);
  if (record.status === "Registered") fail("INTAKE_ALREADY_REGISTERED", 409);
}
function state(record: IntakeRecord): IntakeRecord["status"] {
  if (!record.institutionId) return "NeedsInstitutionResolution";
  return store.getIntakeConfiguration().caseTypes.find(type => type.id === record.metadata.caseTypeId && type.enabled)?.lifecycle === "complaint_default" ? "Ready" : "NeedsLifecycleReview";
}
function audit(user: Profile, action: string, entityId: string, details: Record<string, unknown> = {}) {
  store.addAuditLog({ userId: user.id, userName: user.fullName, action, entityType: action === "INTAKE_CONFIGURATION_CHANGED" ? "Configuration" : "Intake", entityId, details });
}
function identifier(value: unknown): IntakeRecord["identifier"] {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) fail("INVALID_IDENTIFIER");
  const input = value as Record<string, unknown>;
  return { namespace: normalizedIdentifier(text(input.namespace, 40)), value: normalizedIdentifier(text(input.value, 160)) };
}
function sourceReferenceAvailable(record: IntakeRecord) {
  const reference = record.metadata.normalizedExternalReference;
  if (!reference) return;
  // Do not expose any matching case ID, existence, bureau, or title to the caller.
  const collision = store.exportSnapshot().complaints.some(item => item.metadata?.sourceChannelId === record.metadata.sourceChannelId && item.metadata?.normalizedExternalReference === reference);
  if (collision) fail("SOURCE_REFERENCE_UNAVAILABLE", 409);
}

export const intakeService = {
  configuration(user: Profile) {
    if (roleOf(user.role) === "SYSTEM_ADMIN") admin(user); else actor(user);
    return store.getIntakeConfiguration();
  },
  configurationHistory(user: Profile) { admin(user); return store.getIntakeConfigurationHistory(); },
  updateConfiguration(user: Profile, input: any) {
    admin(user);
    const current = store.getIntakeConfiguration();
    if (input?.version !== current.version) fail("CONFIGURATION_CONFLICT", 409);
    const reason = text(input.reason, 1000);
    if (!Array.isArray(input.caseTypes) || !Array.isArray(input.channels) || !input.caseTypes.length || !input.channels.length || input.caseTypes.length > 40 || input.channels.length > 30) fail("INVALID_CONFIGURATION");
    const ids = (rows: any[]) => {
      if (rows.some(row => !row || typeof row !== "object" || typeof row.id !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(row.id) || typeof row.enabled !== "boolean")) fail("INVALID_CONFIGURATION");
      if (new Set(rows.map(row => row.id)).size !== rows.length) fail("INVALID_CONFIGURATION");
    };
    ids(input.caseTypes); ids(input.channels);
    // Stable identifiers are never removed or repurposed; disable entries instead.
    if (current.caseTypes.some(row => !input.caseTypes.some((next: any) => next.id === row.id)) || current.channels.some(row => !input.channels.some((next: any) => next.id === row.id))) fail("CONFIGURATION_IDS_MUST_REMAIN");
    const caseTypes = input.caseTypes.map((row: any) => {
      if (!["complaint_default", "review_required"].includes(row.lifecycle)) fail("INVALID_CONFIGURATION");
      return { id: row.id, label: text(row.label, 100), enabled: row.enabled, lifecycle: row.lifecycle };
    });
    const channels = input.channels.map((row: any) => {
      // This API configures metadata only. It cannot activate external connectors.
      const connection = ["portal", "manual"].includes(row.id) ? "internal_entry" : "not_connected";
      if (row.connection !== connection) fail("EXTERNAL_CONNECTOR_UNAVAILABLE");
      return { id: row.id, label: text(row.label, 100), enabled: row.enabled, connection };
    });
    const next: IntakeConfiguration = { id: randomUUID(), version: current.version + 1, caseTypes, channels, changedBy: user.id, changedAt: new Date().toISOString(), reason };
    return store.transaction(() => { store.saveIntakeConfiguration(next); audit(user, "INTAKE_CONFIGURATION_CHANGED", next.id, { version: next.version, previousVersion: current.version }); return next; });
  },
  candidates(user: Profile, input: any) {
    user = actor(user);
    const search = { text: text(input?.text, 300, true), locationHint: text(input?.locationHint, 160, true), identifier: identifier(input?.identifier) };
    if (!search.text.trim() && !search.identifier) fail("INSTITUTION_QUERY_REQUIRED");
    return resolveInstitution(store.getInstitutionMasterRecords(), user, search);
  },
  list(user: Profile) {
    user = actor(user);
    return store.getIntakeRecords().filter(record => canSee(user, record)).map(record => {
      if (record.status !== "Registered") record.status = state(record);
      if (record.complaintId) {
        const complaint = store.getCoordinationSource(record.complaintId);
        if (!complaint || !mayRead(user, complaint, store.getComplaintRegion(complaint))) delete record.complaintId;
      }
      return record;
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  prepare(user: Profile, input: any) {
    user = actor(user);
    if (!input || typeof input !== "object" || !["complaint", "other_case"].includes(input.recordKind)) fail("INVALID_INTAKE_FIELD");
    const configuration = store.getIntakeConfiguration();
    if (!configuration.caseTypes.some(item => item.id === input.caseTypeId && item.enabled) || !configuration.channels.some(item => item.id === input.sourceChannelId && item.enabled)) fail("INVALID_CLASSIFICATION");
    if (!COMPLAINT_CATEGORIES.includes(input.category) || !PRIORITIES.includes(input.priority)) fail("INVALID_CLASSIFICATION");
    const bureauId = text(input.bureauId, 40);
    if (!store.getBureaus().some(bureau => bureau.id === bureauId) || (user.bureauId && bureauId !== user.bureauId) || (roleOf(user.role) !== "COMPETENT_AUTHORITY" && !user.bureauId)) fail("INTAKE_FORBIDDEN", 403);
    const now = new Date().toISOString(), externalReference = text(input.externalReference, 160, true);
    const record: IntakeRecord = {
      id: randomUUID(), version: 1, status: "NeedsInstitutionResolution", institutionText: text(input.institutionText, 300),
      locationHint: text(input.locationHint, 160, true) || undefined, identifier: identifier(input.identifier),
      category: input.category, title: text(input.title, 300), description: text(input.description, 20000), priority: input.priority,
      bureauId, region: user.region, createdBy: user.id, createdAt: now, updatedAt: now,
      metadata: { recordKind: input.recordKind, caseTypeId: input.caseTypeId, sourceChannelId: input.sourceChannelId,
        externalReference: externalReference || undefined, normalizedExternalReference: externalReference ? normalizedIdentifier(externalReference) : undefined,
        sourceReceivedDate: date(input.sourceReceivedDate), programme: text(input.programme, 200, true) || undefined,
        provenance: { method: "manual_intake", enteredBy: user.id, enteredAt: now, configurationVersion: configuration.version,
          sourceNote: text(input.sourceNote, 2000, true) || undefined, originalInstitutionText: input.institutionText } }
    };
    record.textAnalysis = analyzeOriginalText(record.title, record.description);
    return record;
  },
  create(user: Profile, input: any) {
    const record = this.prepare(user,input);
    return store.transaction(() => { store.saveIntakeRecord(record); audit(user, "INTAKE_CREATED", record.id, { source: record.metadata.sourceChannelId, caseType: record.metadata.caseTypeId }); return record; });
  },
  resolve(user: Profile, id: string, input: any) {
    user = actor(user);
    return store.transaction(() => {
      const record = scopedRecord(user, id); version(record, input?.version);
      const institution = store.getInstitutionMasterRecords().find(item => item.id === input?.institutionId);
      if (!institution || !mayViewInstitution(user, institution)) fail("INSTITUTION_NOT_FOUND", 404);
      const reason = text(input.reason, 1000);
      record.institutionId = institution.id; record.region = institution.region;
      record.metadata.provenance.resolvedBy = user.id; record.metadata.provenance.resolvedAt = new Date().toISOString(); record.metadata.provenance.resolutionReason = reason;
      record.status = state(record); record.version++; record.updatedAt = new Date().toISOString();
      store.saveIntakeRecord(record); audit(user, "INTAKE_INSTITUTION_RESOLVED", id, { institutionId: institution.id, version: record.version }); return record;
    });
  },
  async register(user: Profile, id: string, input: any) {
    user = actor(user);
    if (!["COMPETENT_AUTHORITY", "BUREAU_HEAD"].includes(roleOf(user.role))) fail("INTAKE_REGISTRATION_FORBIDDEN", 403);
    const record = scopedRecord(user, id); version(record, input?.version);
    if (state(record) !== "Ready") fail("INTAKE_REVIEW_REQUIRED", 409);
    const institution = store.getInstitutionMasterRecords().find(item => item.id === record.institutionId);
    if (!institution || !mayViewInstitution(user, institution)) fail("INSTITUTION_NOT_FOUND", 404);
    if (!store.getIntakeConfiguration().channels.some(channel => channel.id === record.metadata.sourceChannelId && channel.enabled)) fail("INVALID_CLASSIFICATION");
    sourceReferenceAvailable(record);
    // Overlap inference awaits before Store's synchronous transaction. Recheck the draft inside that transaction.
    return store.createComplaint({ institutionId: institution.id, category: record.category, title: record.title, description: record.description,
        receivingBureauId: record.bureauId, priority: record.priority, metadata: { ...structuredClone(record.metadata), provenance: { ...structuredClone(record.metadata.provenance), intakeId: record.id } } }, user, complaint => {
      user = actor(user);
      const latest = scopedRecord(user, id); version(latest, input.version);
      if (!["COMPETENT_AUTHORITY", "BUREAU_HEAD"].includes(roleOf(user.role))) fail("INTAKE_REGISTRATION_FORBIDDEN", 403);
      if (state(latest) !== "Ready" || latest.institutionId !== institution.id || !mayViewInstitution(user, institution) || !store.getIntakeConfiguration().channels.some(channel => channel.id === latest.metadata.sourceChannelId && channel.enabled)) fail("INTAKE_CONFLICT", 409);
      sourceReferenceAvailable(latest);
      complaint.metadata = structuredClone(latest.metadata); complaint.metadata.provenance.intakeId = latest.id;
      if (latest.textAnalysis?.sourceHash === originalTextHash(complaint.title, complaint.description)) complaint.textAnalysis = structuredClone(latest.textAnalysis);
      latest.status = "Registered"; latest.complaintId = complaint.id; latest.version++; latest.updatedAt = new Date().toISOString();
      store.saveIntakeRecord(latest); audit(user, "INTAKE_REGISTERED", latest.id, { complaintId: complaint.id, configurationVersion: store.getIntakeConfiguration().version });
    });
  },
  saveMatching(user: Profile, institutionId: string, input: any) {
    user = actor(user);
    if (!["BUREAU_HEAD", "COMPETENT_AUTHORITY"].includes(roleOf(user.role))) fail("MATCHING_CONFIGURATION_FORBIDDEN", 403);
    return store.transaction(() => {
      const institution = store.getInstitutionMasterRecords().find(item => item.id === institutionId);
      if (!institution || !mayViewInstitution(user, institution)) fail("INSTITUTION_NOT_FOUND", 404);
      if (input?.version !== (institution.matching?.version || 0)) fail("MATCHING_CONFIGURATION_CONFLICT", 409);
      text(input.reason, 1000);
      if (!Array.isArray(input.aliases) || input.aliases.length > 50 || !Array.isArray(input.identifiers) || input.identifiers.length > 20) fail("INVALID_IDENTIFIER");
      const aliases = input.aliases.map((item: unknown) => text(item, 300));
      if (aliases.some((alias: string) => !normalizedName(alias))) fail("INVALID_IDENTIFIER");
      const identifiers = input.identifiers.map((item: unknown) => identifier(item)!);
      if (identifiers.some((item: NonNullable<IntakeRecord["identifier"]>) => item.namespace === "AICTE")) fail("AICTE_IDENTIFIER_IS_CANONICAL");
      const keys = identifiers.map((item: NonNullable<IntakeRecord["identifier"]>) => item.namespace + "\u0000" + item.value);
      if (new Set(keys).size !== keys.length || new Set(aliases.map(normalizedName)).size !== aliases.length) fail("DUPLICATE_IDENTIFIER");
      // Global uniqueness is checked without disclosing the conflicting institution.
      if (store.getInstitutionMasterRecords().some(other => other.id !== institution.id && other.matching?.identifiers.some(item => keys.includes(normalizedIdentifier(item.namespace) + "\u0000" + normalizedIdentifier(item.value))))) fail("IDENTIFIER_UNAVAILABLE", 409);
      const matching: InstitutionIdentifiers = { aliases, identifiers, version: (institution.matching?.version || 0) + 1 };
      store.saveInstitutionMatching(institution.id, matching); audit(user, "INSTITUTION_MATCHING_UPDATED", institution.id, { version: matching.version, reason: input.reason }); return matching;
    });
  }
};
