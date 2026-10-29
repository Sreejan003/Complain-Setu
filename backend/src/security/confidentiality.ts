import type { CaseSecurity } from "../models/confidentiality.js";
import type { Profile } from "../models/types.js";
/** Additional gate only. It never substitutes for Bureau, region, assignment, membership or role authorization. */
export function confidentialityAllows(user: Profile, resource: { security?: CaseSecurity }, action: "read" | "evidence" | "identity" | "manage", now = Date.now()): boolean {
  if (!user.isActive) return false;
  const security = resource.security;
  if ((action === "read" || action === "evidence") && (!security || security.level === "internal")) return true;
  return !!security?.grants.some(grant => grant.profileId === user.id && grant[action] && (!grant.expiresAt || Date.parse(grant.expiresAt) > now));
}
/** Ciphertexts and legacy cleartext never belong in general API responses, even for an identity-authorized reader. */
export function confidentialityJsonReplacer(key: string, value: unknown) {
  if (["identityEnvelope", "complainantIdentity", "complainantName", "complainantEmail", "complainantPhone", "complainantAddress"].includes(key)) return undefined;
  if (key === "security" && value && typeof value === "object") {
    const policy = value as CaseSecurity;
    return { version: policy.version, level: policy.level, sensitivitySignals: policy.sensitivitySignals, reviewStatus: policy.reviewStatus };
  }
  return value;
}
