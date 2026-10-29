import { randomUUID } from "node:crypto";
import { store } from "../db/store.js";
import { effectiveProfile, mayReadBase, mayRead, roleOf } from "../security/rbac.js";
import { confidentialityAllows } from "../security/confidentiality.js";
import { decryptIdentity, encryptIdentity, identityProtectionAvailable } from "../security/identityCrypto.js";
import { sensitivitySignals } from "../config/confidentiality.js";
import type { CaseSecurity, ComplainantIdentity, SecurityGrant, SensitivityConfiguration } from "../models/confidentiality.js";
import type { Complaint, Profile } from "../models/types.js";

export class CaseSecurityError extends Error { constructor(public code: string, public status = 400) { super(code); } }
function fail(code: string, status = 400): never { throw new CaseSecurityError(code, status); }
function actor(user: Profile) {
  const current = store.getProfileById(user.id);
  if (!current?.isActive) fail("SECURITY_NOT_FOUND", 404);
  return effectiveProfile(current!);
}
function source(user: Profile, id: string) {
  const complaint = store.getCoordinationSource(id);
  if (!complaint || !mayRead(user, complaint, store.getComplaintRegion(complaint))) fail("SECURITY_NOT_FOUND", 404);
  return complaint!;
}
export function canManageCaseSecurity(user: Profile, complaint: Complaint) {
  return roleOf(user.role) === "COMPETENT_AUTHORITY" && mayReadBase(user, complaint, store.getComplaintRegion(complaint)) &&
    (!complaint.security || complaint.security.level === "internal" || confidentialityAllows(user, complaint, "manage")) && confidentialityAllows(user, complaint, "read");
}
function reason(value: unknown) {
  if (typeof value !== "string" || value.trim().length < 5 || value.length > 1000) fail("SECURITY_REASON_REQUIRED");
  return value as string;
}
function audit(user: Profile, complaint: Complaint, action: string, details: Record<string, unknown>) {
  store.addAuditLog({ userId: user.id, userName: user.fullName, entityType: "Complaint", entityId: complaint.id, action, details });
}
function cleanIdentity(input: unknown): ComplainantIdentity {
  if (!input || typeof input !== "object" || Array.isArray(input) || !Object.keys(input).length || Object.keys(input).some(key => !["name", "email", "phone", "address"].includes(key))) fail("INVALID_IDENTITY");
  const identity: ComplainantIdentity = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string" || !value.trim() || value.length > (key === "address" ? 2000 : 300)) fail("INVALID_IDENTITY");
    identity[key as keyof ComplainantIdentity] = value;
  }
  return identity;
}
export const caseSecurityService = {
  view(user: Profile, id: string) {
    user = actor(user); const complaint = source(user, id), security = complaint.security;
    const manage = canManageCaseSecurity(user, complaint), region = store.getComplaintRegion(complaint);
    const signals = sensitivitySignals(complaint, store.getSensitivityConfiguration());
    return { version: security?.version || 0, level: security?.level || "internal", sensitivitySignals: signals, reviewStatus: security?.reviewStatus || (signals.length ? "pending" : "not_flagged"),
      capabilities: { manage, identity: confidentialityAllows(user, complaint, "identity"), evidence: confidentialityAllows(user, complaint, "evidence") }, identityRecorded: confidentialityAllows(user, complaint, "identity") && !!complaint.identityEnvelope,
      encryptionAvailable: identityProtectionAvailable(), grants: manage ? security?.grants || [] : [],
      eligibleProfiles: manage ? store.getProfiles().map(effectiveProfile).filter(profile => profile.isActive && ["COMPETENT_AUTHORITY", "BUREAU_HEAD", "CASE_OFFICER"].includes(profile.role) && (!profile.region || profile.region === region)).map(profile => ({ id: profile.id, name: profile.fullName, bureauId: profile.bureauId, role: profile.role })) : [] };
  },
  update(user: Profile, id: string, input: any) {
    user = actor(user);
    return store.transaction(() => {
      const complaint = source(user, id);
      if (!canManageCaseSecurity(user, complaint)) fail("SECURITY_FORBIDDEN", 403);
      if (input?.version !== (complaint.security?.version || 0)) fail("SECURITY_CONFLICT", 409);
      const justification = reason(input.reason);
      if (!["internal", "restricted", "sealed"].includes(input.level) || !Array.isArray(input.grants) || input.grants.length > 100) fail("INVALID_SECURITY_POLICY");
      const eligible = this.view(user, id).eligibleProfiles;
      const grants: SecurityGrant[] = input.grants.map((grant: any) => {
        if (!grant || typeof grant !== "object" || !eligible.some(profile => profile.id === grant.profileId) || ["read", "evidence", "identity", "manage"].some(key => typeof grant[key] !== "boolean")) fail("INVALID_SECURITY_GRANT");
        if ((grant.identity || grant.evidence || grant.manage) && !grant.read) fail("INVALID_SECURITY_GRANT");
        if (grant.manage && eligible.find(profile => profile.id === grant.profileId)?.role !== "COMPETENT_AUTHORITY") fail("INVALID_SECURITY_GRANT");
        if (grant.expiresAt !== undefined && (typeof grant.expiresAt !== "string" || !Number.isFinite(Date.parse(grant.expiresAt)) || Date.parse(grant.expiresAt) <= Date.now())) fail("INVALID_SECURITY_GRANT");
        return { profileId: grant.profileId, read: grant.read, evidence: grant.evidence, identity: grant.identity, manage: grant.manage, ...(grant.expiresAt ? { expiresAt: new Date(grant.expiresAt).toISOString() } : {}) };
      });
      if (new Set(grants.map(grant => grant.profileId)).size !== grants.length) fail("INVALID_SECURITY_GRANT");
      if (input.level !== "internal") {
        const self = grants.find(grant => grant.profileId === user.id);
        if (self) { self.read = true; self.manage = true; delete self.expiresAt; }
        else grants.push({ profileId: user.id, read: true, evidence: false, identity: false, manage: true });
      }
      const security: CaseSecurity = { version: (complaint.security?.version || 0) + 1, level: input.level, grants,
        sensitivitySignals: sensitivitySignals(complaint, store.getSensitivityConfiguration()), reviewStatus: "reviewed", reviewedBy: user.id, reviewedAt: new Date().toISOString() };
      const previousLevel = complaint.security?.level || "internal";
      store.saveCaseSecurity(id, security); audit(user, complaint, "CASE_CONFIDENTIALITY_REVIEWED", { previousLevel, level: security.level, version: security.version, reason: justification, grantedProfileIds: grants.map(grant => grant.profileId) });
      return this.view(user, id);
    });
  },
  storeIdentity(user: Profile, id: string, input: any) {
    user = actor(user);
    return store.transaction(() => {
      const complaint = source(user, id);
      if (!confidentialityAllows(user, complaint, "identity")) fail("IDENTITY_FORBIDDEN", 403);
      const justification = reason(input?.reason), identity = cleanIdentity(input?.identity);
      store.saveIdentityEnvelope(id, encryptIdentity(id, identity)); audit(user, complaint, "COMPLAINANT_IDENTITY_PROTECTED", { reason: justification, fieldNames: Object.keys(identity) }); return { stored: true };
    });
  },
  revealIdentity(user: Profile, id: string, input: any) {
    user = actor(user);
    return store.transaction(() => {
      const complaint = source(user, id);
      if (!confidentialityAllows(user, complaint, "identity")) fail("IDENTITY_FORBIDDEN", 403);
      const justification = reason(input?.reason);
      if (!complaint.identityEnvelope) fail("IDENTITY_UNAVAILABLE", 404);
      const identity = decryptIdentity(id, complaint.identityEnvelope);
      audit(user, complaint, "COMPLAINANT_IDENTITY_REVEALED", { reason: justification, keyVersion: complaint.identityEnvelope.keyId }); return { identity };
    });
  },
  configuration(user: Profile) {
    user = actor(user); if (user.role !== "SYSTEM_ADMIN") fail("SECURITY_FORBIDDEN", 403); return store.getSensitivityConfiguration();
  },
  configure(user: Profile, input: any) {
    user = actor(user); if (user.role !== "SYSTEM_ADMIN") fail("SECURITY_FORBIDDEN", 403);
    const current = store.getSensitivityConfiguration();
    if (input?.version !== current.version) fail("SECURITY_CONFLICT", 409);
    const justification = reason(input?.reason);
    if (!Array.isArray(input.signals) || input.signals.length > 50) fail("INVALID_SENSITIVITY_CONFIGURATION");
    const signals: SensitivityConfiguration["signals"] = input.signals.map((signal: any) => {
      if (!signal || typeof signal.id !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(signal.id) || typeof signal.enabled !== "boolean") fail("INVALID_SENSITIVITY_CONFIGURATION");
      for (const key of ["caseTypeIds", "categories", "terms"]) if (!Array.isArray(signal[key]) || signal[key].length > 50 || signal[key].some((item: unknown) => typeof item !== "string" || !item.trim() || item.length > 160)) fail("INVALID_SENSITIVITY_CONFIGURATION");
      return { id: signal.id, enabled: signal.enabled, caseTypeIds: signal.caseTypeIds, categories: signal.categories, terms: signal.terms };
    });
    if (new Set(signals.map(signal => signal.id)).size !== signals.length) fail("INVALID_SENSITIVITY_CONFIGURATION");
    const configuration: SensitivityConfiguration = { id: randomUUID(), version: current.version + 1, signals, changedBy: user.id, changedAt: new Date().toISOString(), reason: justification };
    return store.transaction(() => { store.saveSensitivityConfiguration(configuration); store.addAuditLog({ userId: user.id, userName: user.fullName, action: "SENSITIVITY_CONFIGURATION_UPDATED", entityType: "Configuration", entityId: configuration.id, details: { version: configuration.version } }); return configuration; });
  }
};
