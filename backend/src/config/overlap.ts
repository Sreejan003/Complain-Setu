import type { OverlapSettings } from "../models/overlapSettings.js";
/** Provisional engineering defaults, not validated legal/administrative rules or calibrated probabilities. */
export function defaultOverlapSettings(): OverlapSettings {
  return { id: "overlap-settings-1", version: 1, changedBy: "system-default", changedAt: "2026-01-01T00:00:00.000Z", reason: "Review-only defaults selected on 60 draft synthetic tuning pairs per mode; not independently reviewed or calibrated. Validate with reviewed local data before operational tuning.", algorithmVersion: "signals-v2",
    weights: { institution: 20, category: 15, programme: 10, reference: 15, entity: 10, text: 20, temporal: 5, crossBureau: 5 },
    dateWindowDays: 180, reviewScoreThreshold: 50, duplicateScoreThreshold: 85,
    lexicalRelatedThreshold: 40, lexicalDuplicateThreshold: 70, embeddingRelatedThreshold: 85, embeddingDuplicateThreshold: 90 };
}
