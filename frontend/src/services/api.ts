import {
  UserProfile,
  Institution,
  Complaint,
  CaseHistory,
  CaseTransfer,
  OverlapAlert,
  Notification,
  DashboardAnalytics,
  RelatedCase,
  AuditLog
} from "./types.js";

const API_BASE = "/api";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("aicte_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Auth
  async login(email: string, password?: string): Promise<{ token: string; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: password || "Aicte@2026" })
    });
    return handleResponse(res);
  },

  async getDemoAccounts(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/auth/demo-accounts`);
    return handleResponse(res);
  },

  async getCurrentUser(): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Institutions
  async getInstitutions(params?: Record<string, any>): Promise<{ data: Institution[]; pagination: any }> {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/institutions?${query}`);
    return handleResponse(res);
  },

  async getInstitutionProfile(id: string): Promise<{ institution: Institution; complaints: Complaint[]; overlapAlerts: OverlapAlert[] }> {
    const res = await fetch(`${API_BASE}/institutions/${id}`);
    return handleResponse(res);
  },

  async registerInstitution(data: Partial<Institution>): Promise<Institution> {
    const res = await fetch(`${API_BASE}/institutions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Complaints
  async getComplaints(params?: Record<string, any>): Promise<{ data: Complaint[]; pagination: any }> {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/complaints?${query}`);
    return handleResponse(res);
  },

  async getComplaintDetails(id: string): Promise<{ complaint: Complaint; history: CaseHistory[]; relatedCases: RelatedCase[]; overlapAlerts: OverlapAlert[] }> {
    const res = await fetch(`${API_BASE}/complaints/${id}`);
    return handleResponse(res);
  },

  async checkPreSubmissionOverlap(data: {
    institutionId: string;
    category: string;
    title: string;
    description: string;
    receivingBureauId: string;
  }): Promise<{ hasOverlap: boolean; candidateAlerts: any[] }> {
    const res = await fetch(`${API_BASE}/complaints/check-overlap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async registerComplaint(data: {
    institutionId: string;
    category: string;
    title: string;
    description: string;
    receivingBureauId: string;
    assignedOfficerId?: string;
    priority: string;
    expectedDisposalDate?: string;
  }): Promise<{ complaint: Complaint; detectedOverlaps: any[] }> {
    const res = await fetch(`${API_BASE}/complaints`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async updateComplaintStatus(
    id: string,
    updates: {
      status?: string;
      priority?: string;
      assignedOfficerId?: string;
      remarks: string;
      disposalRemarks?: string;
    }
  ): Promise<Complaint> {
    const res = await fetch(`${API_BASE}/complaints/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(updates)
    });
    return handleResponse(res);
  },

  // Overlap Detection Center
  async getOverlapAlerts(params?: Record<string, any>): Promise<{ data: OverlapAlert[]; pagination: any }> {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/overlaps?${query}`);
    return handleResponse(res);
  },

  async getOverlapDetails(id: string): Promise<{ alert: OverlapAlert; complaintA?: Complaint; complaintB?: Complaint }> {
    const res = await fetch(`${API_BASE}/overlaps/${id}`);
    return handleResponse(res);
  },

  async reviewOverlapAlert(
    id: string,
    reviewData: {
      decision: "Confirmed Related" | "Confirmed Duplicate" | "Marked Unrelated" | "Resolved";
      remarks: string;
      linkAsRelated?: boolean;
    }
  ): Promise<OverlapAlert> {
    const res = await fetch(`${API_BASE}/overlaps/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(reviewData)
    });
    return handleResponse(res);
  },

  async compareLiveTexts(textA: string, textB: string): Promise<{
    semanticScore: number;
    engine: string;
    commonKeywords: string[];
    keywordOverlapCount: number;
  }> {
    const res = await fetch(`${API_BASE}/overlaps/compare-live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ textA, textB })
    });
    return handleResponse(res);
  },

  // Transfers
  async getTransfers(): Promise<CaseTransfer[]> {
    const res = await fetch(`${API_BASE}/transfers`);
    return handleResponse(res);
  },

  async createTransfer(data: {
    complaintId: string;
    toBureauId: string;
    toOfficerId?: string;
    transferReason: string;
  }): Promise<CaseTransfer> {
    const res = await fetch(`${API_BASE}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: "PATCH",
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async markAllNotificationsRead(): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
      method: "POST",
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Analytics
  async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    const res = await fetch(`${API_BASE}/analytics/dashboard`);
    return handleResponse(res);
  },

  getExportCsvUrl(filters?: Record<string, string>): string {
    const query = new URLSearchParams(filters).toString();
    return `${API_BASE}/analytics/export-csv?${query}`;
  },

  // Admin
  async getUsers(): Promise<UserProfile[]> {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async resetDemoData(): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/reset-demo-data`, {
      method: "POST",
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getSystemStatus(): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/system-status`);
    return handleResponse(res);
  }
};
