import { UserRole, ComplaintStatus, Priority, OverlapStatus } from "../config/constants.js";

export interface Profile {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  bureauId?: string;
  permissions?: string[];
  region?: string;
  institutionId?: string;
  institutionName?: string;
  lastLogin?: string;
  designation?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sessionVersion?: string;
}

export interface WorkflowRequest {
  id: string;
  complaintId: string;
  complaintRef: string;
  institutionName: string;
  bureauId: string;
  type: "Transfer" | "Escalation" | "Disposal" | "Coordination";
  status: "Pending" | "Approved" | "Rejected";
  remarks: string;
  destinationBureauId?: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  caseVersion: string;
  assignedOfficerId?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  decisionRemarks?: string;
  decidedAt?: string;
  transferId?: string;
}

export interface Institution {
  id: string;
  aictePermanentId: string;
  permanentId?: string;
  name: string;
  institutionType: "Engineering" | "Management" | "Pharmacy" | "Polytechnic" | "Architecture";
  address: string;
  city: string;
  district?: string;
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
  sourceType?: string;
  sourceFile?: string;
  sourcePage?: number;
  sourceDocumentDate?: string;
  verificationStatus?: string;
  hasSourceConflict?: boolean;
  conflictDetails?: any;
  sourcePages?: number[];
  pendingComplaintsCount?: number;
  handlingBureaus?: string[];
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
  nextAction?: string;
  nextActionDate?: string;
  status: ComplaintStatus;
  priority: Priority;
  hasOverlapAlert: boolean;
  disposalDate?: string;
  disposalRemarks?: string;
  slaTargetDays?: number;
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
  sourceCaseVersion?: string;
  sourceStatus?: ComplaintStatus;
  decisionRemarks?: string;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
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

export interface OverlapExplanation {
  institutionMatch: {
    matched: boolean;
    score: number;
    details: string;
  };
  crossBureauMatch: {
    isCrossBureau: boolean;
    bureauA: string;
    bureauB: string;
    details: string;
  };
  categoryMatch: {
    exactMatch: boolean;
    categoryA: string;
    categoryB: string;
    details: string;
  };
  keywordMatch: {
    matchedTerms: string[];
    score: number;
    details: string;
  };
  semanticMatch: {
    score: number;
    engine: string;
    details: string;
  };
  summary: string;
  recommendation: string;
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
  explanation?: OverlapExplanation;
  alertStatus: OverlapStatus;
  recommendedAction: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  confidenceCategory?: "High-Confidence Duplicate" | "Related Grievance" | "Low-Confidence Match";
  detectionMethod?: string;
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
  referenceType?: "complaint" | "overlap" | "transfer" | "coordination";
  isRead: boolean;
  readByUserIds?: string[];
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

export interface ComplaintDocument {
  id: string;
  complaintId: string;
  institutionId?: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  documentType: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
}

export interface DetectionResult {
  hasOverlap: boolean;
  candidateAlerts: {
    existingComplaint: Complaint;
    ruleScore: number;
    semanticScore?: number;
    combinedScore: number;
    reasons: string[];
    explanation?: OverlapExplanation;
    isCrossBureau: boolean;
    recommendation: string;
  }[];
}
