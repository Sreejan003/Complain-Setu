export type CoordinationStage = "Pending Origin" | "Pending Target" | "Active" | "Findings Submitted" | "Clarification" | "Escalated" | "Completed" | "Rejected";
export interface CoordinationParticipant { bureauId: string; status: "Awaiting Origin" | "Pending" | "Accepted" | "Rejected" | "Clarification" | "Revoked"; officerIds: string[]; }
export interface CoordinationRecord { id: string; actorId: string; actorName: string; actorRole: string; actorBureau: string; createdAt: string; action: string; remarks: string; details?: Record<string, unknown>; }
export interface CoordinationTask { id: string; title: string; description: string; assignedBureauId: string; assignedOfficerId: string; createdBy: string; createdByName?:string;createdAt?:string;completedAt?:string;dueDate?: string; priority: string; status: "Pending" | "In Progress" | "Submitted" | "Accepted" | "Completed" | "Rework"; completionRemarks: string; version: number; }
export interface CoordinationSession {
  id: string; primaryComplaintId: string; complaintRef: string; institutionId: string; institutionName: string; region?: string;
  leadBureauId: string; leadOfficerId?: string; createdBy: string; reason: string; assistance: string; priority: string; responseDate?: string;
  status: CoordinationStage; participants: CoordinationParticipant[]; version: number; createdAt: string; updatedAt: string; completedAt?: string;
  events: CoordinationRecord[]; messages: (CoordinationRecord & { replyTo?: string })[]; tasks: CoordinationTask[];
  documents: { id: string; documentId: string; sharingBureaus: string[]; sharedBy: string; sharedAt: string; revokedAt?: string; taskId?: string; }[];
  approvals: (CoordinationRecord & { bureauId: string })[]; receipts: { id: string; actorId: string; }[];
  findingsVersion?: number; acknowledgedFindingsVersion?: number;
}
