import { UserRole, ComplaintStatus, Priority, OverlapStatus } from "../config/constants.js";

export interface Profile {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  bureauId?: string;
  region?: string;
  designation?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Institution {
  id: string;
  aictePermanentId: string;
  name: string;
  institutionType: "Engineering" | "Management" | "Pharmacy" | "Polytechnic" | "Architecture";
  address: string;
  city: string;
  state: string;
  region: string;
  pincode: string;
  contactEmail: string;
  contactPhone: string;
  accreditationStatus: string;
  yearEstablished: number;
  totalComplaintsCount: number;
  activeComplaintsCount: number;
  overlapCount: number;
  latestComplaintDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Complaint {
  id: string;
  complaintId: string; // e.g. AICTE/RB/2026/00142
  institutionId: string;
  aictePermanentId: string;
  institutionName: string;
  category: string;
  title: string;
  description: string;
  receivedDate: string;
  expectedDisposalDate: string;
  receivingBureauId: string;
  currentBureauId: string;
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  status: ComplaintStatus;
  priority: Priority;
  hasOverlapAlert: boolean;
  disposalDate?: string;
  disposalRemarks?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseAssignment {
  id: string;
  complaintId: string;
  bureauId: string;
  officerId: string;
  officerName: string;
  assignedBy: string;
  assignedAt: string;
  isActive: boolean;
  notes?: string;
}

export interface CaseHistory {
  id: string;
  complaintId: string;
  actionType: string;
  fromStatus?: string;
  toStatus?: string;
  remarks: string;
  performedBy: string;
  performedByName: string;
  createdAt: string;
}

export interface CaseTransfer {
  id: string;
  complaintId: string;
  complaintRefId: string;
  institutionName: string;
  fromBureauId: string;
  toBureauId: string;
  fromOfficerId?: string;
  fromOfficerName?: string;
  toOfficerId?: string;
  toOfficerName?: string;
  transferReason: string;
  transferredBy: string;
  transferredByName: string;
  transferredAt: string;
  acceptanceStatus: "Pending" | "Accepted" | "Rejected";
}

export interface RelatedCase {
  id: string;
  complaintIdA: string;
  complaintIdB: string;
  complaintRefA: string;
  complaintRefB: string;
  relationshipType: "Duplicate" | "Related" | "Coordinated";
  linkedBy: string;
  linkedByName: string;
  notes?: string;
  createdAt: string;
}

export interface OverlapAlert {
  id: string;
  alertId: string;
  institutionId: string;
  aictePermanentId: string;
  institutionName: string;
  complaintIdA: string;
  complaintRefA: string;
  complaintTitleA: string;
  complaintDescA: string;
  complaintIdB: string;
  complaintRefB: string;
  complaintTitleB: string;
  complaintDescB: string;
  bureauA: string;
  bureauB: string;
  categoryA: string;
  categoryB: string;
  statusA: string;
  statusB: string;
  ruleMatchScore: number;
  semanticSimilarityScore?: number;
  matchReasons: string[];
  alertStatus: OverlapStatus;
  recommendedAction: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  recipientId?: string;
  recipientRole?: string;
  title: string;
  message: string;
  notificationType: "Overlap Alert" | "Deadline" | "Overdue" | "Transfer" | "Status Update";
  referenceId?: string;
  referenceType?: "complaint" | "overlap" | "transfer";
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface DetectionResult {
  hasOverlap: boolean;
  candidateAlerts: {
    existingComplaint: Complaint;
    ruleScore: number;
    semanticScore?: number;
    combinedScore: number;
    reasons: string[];
    isCrossBureau: boolean;
    recommendation: string;
  }[];
}
