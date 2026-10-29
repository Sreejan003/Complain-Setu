import { queryString } from "./query.js";
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
  AuditLog,
  ComplaintDocument,
  InstitutionDashboardMetrics
} from "./types.js";

const API_BASE = "/api";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("aicte_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status===401 || errorBody.code==="SESSION_REVOKED") window.dispatchEvent(new Event("aicte-session-expired"));
    throw Object.assign(new Error(errorBody.error || `HTTP ${res.status}: ${res.statusText}`),{code:errorBody.code,status:res.status});
  }
  return res.json();
}

export const api = {
  async reportDownload(path:string,name:string,body?:unknown){const response=await fetch(`${API_BASE}/reports/${path}`,{method:body===undefined?"GET":"POST",headers:{...getAuthHeader(),"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!response.ok){await handleResponse(response);return;}const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  async importFile<T>(path:string,file:File,fields:Record<string,string>={}){const form=new FormData();form.set("file",file);for(const[key,value]of Object.entries(fields))form.set(key,value);return handleResponse<T>(await fetch(`${API_BASE}/imports/${path}`,{method:"POST",headers:getAuthHeader(),body:form}));},
  async importDownload(path:string,name:string){const response=await fetch(`${API_BASE}/imports/${path}`,{headers:getAuthHeader()});if(!response.ok){await handleResponse(response);return;}const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  async request<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
    const res=await fetch(API_BASE+"/"+path,{method,headers:{...getAuthHeader(),"Content-Type":"application/json"},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    return handleResponse<T>(res);
  },
  async downloadCsv(filters: Record<string,string> = {}) {
    const res=await fetch(API_BASE+"/analytics/export-csv?"+new URLSearchParams(filters),{headers:getAuthHeader()});
    if(!res.ok) {await handleResponse(res);return;}
    const url=URL.createObjectURL(await res.blob());
    const link=document.createElement("a");link.href=url;link.download="aicte-complaints.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
  // Auth
  async login(email: string, password?: string): Promise<{ token: string; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
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
    const res = await fetch(`${API_BASE}/institutions?${query}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getInstitutionProfile(id: string): Promise<{
    institution: Institution;
    complaints: Complaint[];
    overlapAlerts: OverlapAlert[];
    documents?: ComplaintDocument[];
  }> {
    const res = await fetch(`${API_BASE}/institutions/${id}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getInstitutionDashboardMetrics(id: string): Promise<InstitutionDashboardMetrics> {
    const res = await fetch(`${API_BASE}/institutions/${id}/dashboard-metrics`, {
      headers: { ...getAuthHeader() }
    });
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
    const query = queryString(params);
    const res = await fetch(`${API_BASE}/complaints?${query}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getComplaintDetails(id: string): Promise<{ complaint: Complaint; allowedActions?: any; permittedStatuses?: string[]; history: CaseHistory[]; relatedCases: RelatedCase[]; overlapAlerts: OverlapAlert[] }> {
    const res = await fetch(`${API_BASE}/complaints/${encodeURIComponent(id)}`, {
      headers: { ...getAuthHeader() }
    });
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
      nextAction?: string;
      nextActionDate?: string;
      lastKnownUpdatedAt?: string;
    }
  ): Promise<Complaint> {
    const res = await fetch(`${API_BASE}/complaints/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(updates)
    });
    return handleResponse(res);
  },

  async overrideSlaDeadline(
    id: string,
    arg2: string | { newDeadline: string; overrideReason: string },
    arg3?: string
  ): Promise<Complaint> {
    const payload = typeof arg2 === "string" ? { newDeadline: arg2, overrideReason: arg3 } : arg2;
    const res = await fetch(`${API_BASE}/complaints/${id}/override-sla`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  // Supporting Documents
  async getComplaintDocuments(complaintId: string): Promise<ComplaintDocument[]> {
    const res = await fetch(`${API_BASE}/complaints/${complaintId}/documents`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async uploadComplaintDocument(
    complaintId: string,
    file: File,
    documentType: string = "Complaint Evidence"
  ): Promise<ComplaintDocument> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);

    const token = localStorage.getItem("aicte_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/complaints/${complaintId}/documents`, {
      method: "POST",
      headers,
      body: formData
    });
    return handleResponse(res);
  },

  async downloadComplaintDocument(complaintId: string, docId: string, filename: string): Promise<void> {
    const res = await fetch(`${API_BASE}/complaints/${complaintId}/documents/${docId}/download`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) {
      throw new Error(`Failed to download document: ${res.statusText}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async deleteComplaintDocument(complaintId: string, docId: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/complaints/${complaintId}/documents/${docId}`, {
      method: "DELETE",
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getInstitutionDocuments(institutionId: string): Promise<ComplaintDocument[]> {
    const res = await fetch(`${API_BASE}/institutions/${institutionId}/documents`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Overlap Detection Center
  async getOverlapAlerts(params?: Record<string, any>): Promise<{ data: OverlapAlert[]; pagination: any }> {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/overlaps?${query}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getOverlapDetails(id: string): Promise<{ alert: OverlapAlert; complaintA?: Complaint; complaintB?: Complaint }> {
    const res = await fetch(`${API_BASE}/overlaps/${id}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async reviewOverlapAlert(
    id: string,
    reviewData: {
      decision: "Confirmed Related" | "Confirmed Duplicate" | "Marked Unrelated" | "Dismissed" | "Resolved";
      remarks: string;
      linkAsRelated?: boolean;
      expectedUpdatedAt?: string;
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
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ textA, textB })
    });
    return handleResponse(res);
  },

  // Transfers
  async getTransfers(): Promise<CaseTransfer[]> {
    const res = await fetch(`${API_BASE}/transfers`, {
      headers: { ...getAuthHeader() }
    });
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

  async respondToTransfer(
    transferId: string,
    data: { action: "Accepted" | "Rejected"; remarks: string }
  ): Promise<CaseTransfer> {
    const res = await fetch(`${API_BASE}/transfers/${transferId}/respond`, {
      method: "PATCH",
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
    const res = await fetch(`${API_BASE}/analytics/dashboard`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getPerformanceReport(params?: Record<string, string>): Promise<any> {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/analytics/performance-report?${query}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  getExportCsvUrl(filters?: Record<string, string>): string {
    const query = new URLSearchParams(filters);
    // The URL is a location only; authenticated downloads use downloadCsv().
    return `${API_BASE}/analytics/export-csv?${query.toString()}`;
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
    const res = await fetch(`${API_BASE}/admin/system-status`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getSlaConfig(): Promise<{
    approachingDeadlineDays: number;
    autoEscalateOverdueDays: number;
    reminderIntervalHours: number;
    seniorManagementNotifyDays: number;
  }> {
    const res = await fetch(`${API_BASE}/admin/sla-config`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async updateSlaConfig(config: any): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/sla-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(config)
    });
    return handleResponse(res);
  },

  async runSlaEvaluation(): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/run-sla-scheduler`, {
      method: "POST",
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Real-Time Events Subscription
  subscribeLiveEvents(onEvent: (event: any) => void): () => void {
    const token = localStorage.getItem("aicte_token");
    if (!token) return () => {};

    const url = `${API_BASE}/complaints/stream/live?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed);
      } catch (err) {
        console.warn("SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      // EventSource auto-reconnects on drop
    };

    return () => {
      eventSource.close();
    };
  }
};
