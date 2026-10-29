import type { Institution, Profile } from "../models/types.js";
import type { InstitutionCandidate } from "../models/intake.js";
import { mayViewInstitution } from "../security/rbac.js";

export const normalizedName = (value: string) => value.normalize("NFKC").toLocaleLowerCase("und").replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
export const normalizedIdentifier = (value: string) => value.normalize("NFKC").trim().toLocaleUpperCase("und").replace(/\s+/g, " ");
function bigrams(value: string) { const points = Array.from(value); return new Set(points.slice(1).map((point, index) => points[index] + point)); }
function similarity(left: string, right: string) {
  if (left === right) return 1;
  const a = bigrams(left), b = bigrams(right);
  return a.size && b.size ? 2 * [...a].filter(token => b.has(token)).length / (a.size + b.size) : 0;
}
/** Matches master data only: never includes complaint counts, narratives or hidden institutions. Scores are lexical rankings, not calibrated probabilities. */
export function resolveInstitution(institutions: Institution[], user: Profile, input: { text: string; locationHint?: string; identifier?: { namespace: string; value: string } }) {
  const text = normalizedName(input.text), location = normalizedName(input.locationHint || "");
  const identifier = input.identifier && { namespace: normalizedIdentifier(input.identifier.namespace), value: normalizedIdentifier(input.identifier.value) };
  const candidates: InstitutionCandidate[] = [];
  for (const institution of institutions.filter(item => mayViewInstitution(user, item))) {
    const ids = [{ namespace: "AICTE", value: institution.aictePermanentId }, ...(institution.matching?.identifiers || [])];
    const exactId = !!identifier && ids.some(item => normalizedIdentifier(item.namespace) === identifier.namespace && normalizedIdentifier(item.value) === identifier.value);
    // An explicit identifier must not fall through to a different institution's fuzzy name.
    if (identifier && !exactId) continue;
    const names = [institution.name, ...(institution.matching?.aliases || [])].map(normalizedName);
    const exactName = !!text && names.includes(text);
    const nameScore = text ? Math.max(...names.map(name => similarity(text, name))) : 0;
    const locationMatch = !!location && [institution.city, institution.state, institution.region].some(value => normalizedName(value).includes(location));
    if (!exactId && nameScore < 0.25) continue;
    const reasons = exactId ? ["exact_identifier"] : [exactName ? "exact_name_or_alias" : "lexical_name_similarity"];
    if (locationMatch) reasons.push("location_hint");
    candidates.push({ id: institution.id, name: institution.name, aictePermanentId: institution.aictePermanentId, city: institution.city, state: institution.state, region: institution.region,
      score: exactId ? 1 : Math.min(0.99, nameScore * 0.85 + (locationMatch ? 0.14 : 0)), confidence: exactId ? "exact_identifier" : exactName ? "exact_name" : "approximate", reasons });
  }
  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { candidates: candidates.slice(0, 10), ambiguous: candidates.length > 1 && candidates[0].score - candidates[1].score < 0.12,
    requiresHumanSelection: true, mode: "unicode_lexical_master_data", scoreMeaning: "ranking_only" };
}
