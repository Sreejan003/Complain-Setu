import {
  Profile,
  Institution,
  Complaint,
  OverlapAlert,
  CaseHistory,
  CaseTransfer,
  RelatedCase,
  Notification,
  AuditLog,
  ComplaintDocument
} from "../models/types.js";
import { OverlapStatus } from "../config/constants.js";

export interface DatabaseHealthResult {
  connected: boolean;
  mode: "PostgreSQL" | "Local Persistent JSON Store (ACID)";
  error?: string;
  details?: Record<string, any>;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IRepository {
  readonly mode: string;

  // Health and Readiness
  healthCheck(): Promise<DatabaseHealthResult>;

  // Profiles
  getProfiles(): Promise<Profile[]> | Profile[];
  getProfileById(id: string): Promise<Profile | undefined> | Profile | undefined;
  getProfileByEmail(email: string): Promise<Profile | undefined> | Profile | undefined;

  // Institutions
  getInstitutions(params: {
    search?: string;
    region?: string;
    state?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<PaginationResult<Institution>> | PaginationResult<Institution>;
  getInstitutionById(id: string): Promise<Institution | undefined> | Institution | undefined;
  createInstitution(institution: Omit<Institution, "id" | "createdAt" | "updatedAt" | "totalComplaintsCount" | "activeComplaintsCount" | "overlapCount">): Promise<Institution> | Institution;

  // Complaints
  getComplaints(params: {
    institutionId?: string;
    aictePermanentId?: string;
    search?: string;
    bureau?: string;
    region?: string;
    category?: string;
    status?: string;
    priority?: string;
    assignedOfficerId?: string;
    isOverdue?: boolean;
    isDueSoon?: boolean;
    hasOverlap?: boolean;
    receivedFrom?: string;
    receivedTo?: string;
    lastActionFrom?: string;
    lastActionTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<PaginationResult<Complaint>> | PaginationResult<Complaint>;
  getComplaintById(id: string): Promise<Complaint | undefined> | Complaint | undefined;
  createComplaint(
    data: {
      institutionId: string;
      category: string;
      title: string;
      description: string;
      receivingBureauId: string;
      assignedOfficerId?: string;
      priority: Complaint["priority"];
      expectedDisposalDate?: string;
    },
    user: Profile
  ): Promise<{ complaint: Complaint; detectedOverlaps: any[] }> | { complaint: Complaint; detectedOverlaps: any[] };
  updateComplaintStatus(
    complaintId: string,
    updates: { status: Complaint["status"]; remarks: string; disposalRemarks?: string },
    user: Profile
  ): Promise<Complaint> | Complaint;
  overrideSlaDeadline?(
    complaintId: string,
    newDeadline: string,
    overrideReason: string,
    user: Profile
  ): Promise<Complaint> | Complaint;

  // Case History & Timeline
  getCaseHistory(complaintId: string): Promise<CaseHistory[]> | CaseHistory[];
  addCaseHistory(history: CaseHistory): Promise<CaseHistory> | CaseHistory;

  // Transfers
  getTransfers(): Promise<CaseTransfer[]> | CaseTransfer[];
  transferCase(
    complaintId: string,
    transferData: { toBureauId: string; toOfficerId?: string; transferReason: string },
    user: Profile
  ): Promise<CaseTransfer> | CaseTransfer;

  // Related Cases
  getRelatedCases(complaintId: string): Promise<RelatedCase[]> | RelatedCase[];

  // Overlap Alerts
  getOverlapAlerts(params: {
    bureau?: string;
    alertStatus?: string;
    institutionId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginationResult<OverlapAlert>> | PaginationResult<OverlapAlert>;
  getOverlapAlertById(id: string): Promise<OverlapAlert | undefined> | OverlapAlert | undefined;
  reviewOverlapAlert(
    alertId: string,
    reviewData: {
      decision: OverlapAlert["alertStatus"];
      remarks: string;
      linkAsRelated?: boolean;
    },
    user: Profile
  ): Promise<OverlapAlert> | OverlapAlert;

  // Notifications
  getNotifications(role?: string): Promise<Notification[]> | Notification[];
  addNotification(notification: Notification): Promise<Notification> | Notification;
  markNotificationRead(id: string): Promise<void | boolean> | void | boolean;
  markAllNotificationsRead(role?: string): Promise<void | number> | void | number;

  // Documents
  getDocuments(params: { complaintId?: string; institutionId?: string }): Promise<ComplaintDocument[]> | ComplaintDocument[];
  getDocumentById(id: string): Promise<ComplaintDocument | undefined> | ComplaintDocument | undefined;
  addDocument(doc: ComplaintDocument): Promise<ComplaintDocument> | ComplaintDocument;
  deleteDocument(id: string): Promise<boolean> | boolean;

  // Audit Logs
  getAuditLogs(): Promise<AuditLog[]> | AuditLog[];
  addAuditLog(log: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> | AuditLog;

  // Analytics
  getDashboardAnalytics(): Promise<any> | any;
  getPerformanceReport(params: { period?: string; bureau?: string }): Promise<any> | any;

  // Reset demo
  resetDemoData(): Promise<any> | any;
}
