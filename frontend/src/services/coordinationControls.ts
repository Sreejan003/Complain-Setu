import type { CoordinationView, CoordinationData } from "./coordination.js";
export function permittedTaskTransitions(view: CoordinationView, task: CoordinationData["tasks"][number], actorId: string, bureauId?: string): string[] {
  const a = view.capabilities; if (!a.full || !a.writable || !["Active", "Clarification", "Findings Submitted", "Escalated"].includes(view.status)) return [];
  const transitions: Record<string, string[]> = { Pending: ["In Progress"], "In Progress": ["Submitted"], Rework: ["In Progress", "Submitted"], Submitted: ["Accepted", "Rework"], Accepted: ["Completed"] };
  const supervise = a.authority || a.leadHead || a.leadOfficer || a.receivingHead && task.assignedBureauId === bureauId;
  return (transitions[task.status] || []).filter(next => ["Accepted", "Completed", "Rework"].includes(next) ? supervise && task.assignedOfficerId !== actorId : task.assignedOfficerId === actorId);
}
