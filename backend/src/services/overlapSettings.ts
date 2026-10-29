import { randomUUID } from "node:crypto";
import { store } from "../db/store.js";
import { effectiveProfile } from "../security/rbac.js";
import { defaultOverlapSettings } from "../config/overlap.js";
import type { OverlapSettings } from "../models/overlapSettings.js";
import type { Profile } from "../models/types.js";
export class OverlapError extends Error { constructor(public code: string, public status = 400) { super(code); } }
export function overlapFail(code: string, status = 400): never { throw new OverlapError(code, status); }
export function overlapReason(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 5 || value.length > 1000) overlapFail("OVERLAP_REASON_REQUIRED");
  return value.trim();
}
function admin(user: Profile) {
  const current = store.getProfileById(user.id);
  if (!current?.isActive || effectiveProfile(current).role !== "SYSTEM_ADMIN") overlapFail("OVERLAP_CONFIG_FORBIDDEN", 403);
  return current;
}
function validated(input: any): Pick<OverlapSettings, "weights" | "dateWindowDays" | "reviewScoreThreshold" | "duplicateScoreThreshold" | "lexicalRelatedThreshold" | "lexicalDuplicateThreshold" | "embeddingRelatedThreshold" | "embeddingDuplicateThreshold"> {
  const defaults = defaultOverlapSettings(), keys = Object.keys(defaults.weights) as (keyof OverlapSettings["weights"])[];
  if (!input?.weights || Object.keys(input.weights).length !== keys.length || keys.some(key => typeof input.weights[key] !== "number" || !Number.isFinite(input.weights[key]) || input.weights[key] < 0 || input.weights[key] > 100) || keys.reduce((sum, key) => sum + input.weights[key], 0) <= 0) overlapFail("OVERLAP_INVALID_WEIGHTS");
  if (!Number.isInteger(input.dateWindowDays) || input.dateWindowDays < 1 || input.dateWindowDays > 3650) overlapFail("OVERLAP_INVALID_WINDOW");
  const thresholds = ["reviewScoreThreshold", "duplicateScoreThreshold", "lexicalRelatedThreshold", "lexicalDuplicateThreshold", "embeddingRelatedThreshold", "embeddingDuplicateThreshold"] as const;
  if (thresholds.some(key => typeof input[key] !== "number" || !Number.isFinite(input[key]) || input[key] < 0 || input[key] > 100) || input.duplicateScoreThreshold < input.reviewScoreThreshold || input.lexicalDuplicateThreshold < input.lexicalRelatedThreshold || input.embeddingDuplicateThreshold < input.embeddingRelatedThreshold) overlapFail("OVERLAP_INVALID_THRESHOLDS");
  return { weights: Object.fromEntries(keys.map(key => [key, input.weights[key]])) as OverlapSettings["weights"], dateWindowDays: input.dateWindowDays, ...Object.fromEntries(thresholds.map(key => [key, input[key]])) } as ReturnType<typeof validated>;
}
export const overlapSettingsService = {
  view(user: Profile) { admin(user); return { current: store.getOverlapSettings(), history: store.getOverlapSettingsHistory(), defaults: defaultOverlapSettings() }; },
  save(user: Profile, input: any) {
    return store.transaction(() => {
      const actor = admin(user), current = store.getOverlapSettings(), reason = overlapReason(input?.reason);
      if (input?.version !== current.version) overlapFail("OVERLAP_CONFIG_CHANGED", 409);
      const target = input.rollbackTo === undefined ? undefined : store.getOverlapSettingsHistory().find(row => row.version === input.rollbackTo);
      if (input.rollbackTo !== undefined && !target) overlapFail("OVERLAP_ROLLBACK_NOT_FOUND", 404);
      const config: OverlapSettings = { ...validated(target || input), id: randomUUID(), version: current.version + 1, algorithmVersion: "signals-v2", reason, changedBy: actor.id, changedAt: new Date().toISOString(), ...(target ? { rollbackOf: target.version } : {}) };
      store.saveOverlapSettings(config);
      store.addAuditLog({ userId: actor.id, userName: actor.fullName, action: target ? "OVERLAP_CONFIG_ROLLED_BACK" : "OVERLAP_CONFIG_UPDATED", entityType: "Configuration", entityId: config.id, details: { version: config.version, previousVersion: current.version, rollbackOf: config.rollbackOf, reason } });
      return this.view(actor);
    });
  }
};
