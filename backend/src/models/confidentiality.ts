export interface IdentityEnvelope {
  version: 1; algorithm: "aes-256-gcm"; keyId: string; iv: string; tag: string; ciphertext: string;
}
export interface ComplainantIdentity { name?: string; email?: string; phone?: string; address?: string }
export interface SecurityGrant {
  profileId: string; read: boolean; evidence: boolean; identity: boolean; manage: boolean; expiresAt?: string;
}
export interface CaseSecurity {
  version: number; level: "internal" | "restricted" | "sealed"; grants: SecurityGrant[];
  sensitivitySignals: string[]; reviewStatus: "not_flagged" | "pending" | "reviewed";
  reviewedBy?: string; reviewedAt?: string;
}
export interface SensitivityConfiguration {
  id: string; version: number; changedBy: string; changedAt: string; reason: string;
  signals: { id: string; caseTypeIds: string[]; categories: string[]; terms: string[]; enabled: boolean }[];
}
