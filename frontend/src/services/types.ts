export type UserRole =
  | "Administrator"
  | "Regulation Bureau Officer"
  | "PGRC Officer"
  | "Regional Officer"
  | "Senior Management"
  | "Institutional User";

export type ComplaintStatus =
  | "Pending"
  | "Under Process"
  | "Disposed"
  | "Transferred"
  | "Escalated";

export type Priority = "Low" | "Medium" | "High" | "Critical";

export type OverlapStatus =
  | "Pending Review"
  | "Confirmed Related"
  | "Confirmed Duplicate"
  | "Marked Unrelated"
  | "Dismissed"
  | "Resolved";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  bureauId?: string;
  region?: string;
  institutionId?: string;
  institutionName?: string;
  designation?: string;
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
  complaintId: string;
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
  slaTargetDays?: number;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
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

export interface DashboardAnalytics {
  kpi: {
    totalComplaints: number;
    pendingComplaints: number;
    underProcessComplaints: number;
    disposedComplaints: number;
    transferredComplaints: number;
    escalatedComplaints: number;
    overdueComplaints: number;
    unresolvedOverlapAlerts: number;
    disposalRatePercentage: number;
  };
  statusDistribution: { name: string; count: number; color: string }[];
  bureauWorkload: { bureau: string; total: number; pending: number; active: number; disposed: number }[];
  monthlyTrends: { month: string; filed: number; disposed: number }[];
  regionDistribution: { region: string; count: number }[];
  caseAgeing: { range: string; count: number; color: string }[];
  recentActivity: CaseHistory[];
  criticalAlerts: OverlapAlert[];
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
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

export interface InstitutionDashboardMetrics {
  institution: Institution;
  kpis: {
    totalComplaints: number;
    pendingCount: number;
    underProcessCount: number;
    resolvedCount: number;
    overdueCount: number;
    highPriorityCount: number;
    activeOverlapCount: number;
  };
  distribution: {
    byStatus: { name: string; count: number }[];
    byPriority: { name: string; count: number }[];
    byCategory: { name: string; count: number }[];
    byDate: { date: string; count: number }[];
  };
  urgent: {
    upcomingDeadlines: Complaint[];
    overdueComplaints: Complaint[];
    recentlyUpdated: Complaint[];
  };
}

