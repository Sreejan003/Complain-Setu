import type { IntakeConfiguration } from "../models/intake.js";

/** Product configuration, not a statement of statutory handling rules. */
export function defaultIntakeConfiguration(): IntakeConfiguration {
  return {
    id: "intake-config-1", version: 1, changedBy: "system-default", changedAt: "2026-01-01T00:00:00.000Z",
    reason: "Operational grievance workflow only; other case types require lifecycle review.",
    caseTypes: [
      ["grievance", "Grievance"], ["ragging", "Ragging"], ["norms_violation", "Norms violation"],
      ["court", "Court matter"], ["rti", "RTI matter"], ["parliament", "Parliament question"], ["vip_ministry", "VIP / ministry reference"]
    ].map(([id, label]) => ({ id, label, enabled: true, lifecycle: id === "grievance" ? "complaint_default" : "review_required" })),
    channels: [
      ["portal", "Portal"], ["email", "Email"], ["letter", "Letter"], ["cpgrams", "CPGRAMS"], ["css", "CSS"], ["manual", "Manual entry"]
    ].map(([id, label]) => ({ id, label, enabled: true, connection: ["portal", "manual"].includes(id) ? "internal_entry" : "not_connected" }))
  };
}
