import type { SensitivityConfiguration, CaseSecurity } from "../models/confidentiality.js";
export function defaultSensitivityConfiguration(): SensitivityConfiguration {
  return { id: "sensitivity-config-1", version: 1, changedBy: "system-default", changedAt: "2026-01-01T00:00:00.000Z", reason: "Review signals only; these do not determine a legal category or universal handling rule.", signals: [
    { id: "ragging_review", caseTypeIds: ["ragging"], categories: [], terms: ["ragging", "रैगिंग"], enabled: true },
    { id: "posh_review", caseTypeIds: [], categories: ["Harassment & Grievance Redressal Failure"], terms: ["posh", "sexual harassment"], enabled: true },
    { id: "sc_st_review", caseTypeIds: [], categories: [], terms: ["caste discrimination", "scheduled caste", "scheduled tribe", "जातिगत भेदभाव"], enabled: true }
  ] };
}
export function sensitivitySignals(input: { category?: string; title?: string; description?: string; metadata?: { caseTypeId?: string } }, configuration: SensitivityConfiguration): string[] {
  const narrative = `${input.title || ""} ${input.description || ""}`.normalize("NFKC").toLocaleLowerCase("und");
  return configuration.signals.filter(signal => signal.enabled && (signal.caseTypeIds.includes(input.metadata?.caseTypeId || "") || signal.categories.includes(input.category || "") || signal.terms.some(term => narrative.includes(term.normalize("NFKC").toLocaleLowerCase("und"))))).map(signal => signal.id);
}
export function initialCaseSecurity(input: Parameters<typeof sensitivitySignals>[0], config: SensitivityConfiguration): CaseSecurity {
  const signals = sensitivitySignals(input, config);
  return { version: 1, level: "internal", grants: [], sensitivitySignals: signals, reviewStatus: signals.length ? "pending" : "not_flagged" };
}
