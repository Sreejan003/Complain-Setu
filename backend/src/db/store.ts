import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
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
import type { IRepository, DatabaseHealthResult } from "./repository.js";
import { generateSeedData } from "./seedData.js";
import { detectOverlapsForComplaint, evaluateComplaintPair, fuzzyMatchInstitution } from "../services/overlapEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const DB_FILE = path.join(DATA_DIR, "db.json");

interface DatabaseSchema {
  profiles: Profile[];
  institutions: Institution[];
  complaints: Complaint[];
  overlapAlerts: OverlapAlert[];
  caseHistory: CaseHistory[];
  caseTransfers: CaseTransfer[];
  relatedCases: RelatedCase[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  documents?: ComplaintDocument[];
  meta: {
    lastReset: string;
    version: string;
  };
}

export class Store implements IRepository {
  public readonly mode = "Local Persistent JSON Store (ACID)";
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadData();
  }

  public async healthCheck(): Promise<DatabaseHealthResult> {
    try {
      const exists = fs.existsSync(DB_FILE);
      const stats = exists ? fs.statSync(DB_FILE) : null;
      return {
        connected: exists,
        mode: "Local Persistent JSON Store (ACID)",
        details: {
          file: DB_FILE,
          sizeBytes: stats?.size || 0,
          totalComplaints: this.data.complaints.length,
          totalInstitutions: this.data.institutions.length,
          lastReset: this.data.meta.lastReset
        }
      };
    } catch (err: any) {
      return {
        connected: false,
        mode: "Local Persistent JSON Store (ACID)",
        error: err.message
      };
    }
  }

  private loadData(): DatabaseSchema {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed: DatabaseSchema = JSON.parse(raw);
        if (!parsed.documents) {
          parsed.documents = [];
        }
        return parsed;
      } catch (err) {
        console.error("Error reading db.json, generating fresh seed data:", err);
      }
    }

    return this.initializeWithSeedData();
  }

  private initializeWithSeedData(): DatabaseSchema {
    console.log("Initializing database with fresh AICTE synthetic seed dataset...");
    const seed = generateSeedData();
    const initialData: DatabaseSchema = {
      profiles: seed.profiles,
      institutions: seed.institutions,
      complaints: seed.complaints,
      overlapAlerts: seed.overlapAlerts,
      caseHistory: seed.caseHistory,
      caseTransfers: seed.caseTransfers,
      relatedCases: [],
      notifications: seed.notifications,
      auditLogs: [],
      documents: [
        {
          id: "doc-seed-001",
          complaintId: seed.complaints[0]?.id || "c-001",
          institutionId: seed.complaints[0]?.institutionId,
          fileName: "Inspection_Report_Preliminary.pdf",
          originalName: "Inspection_Report_Preliminary.pdf",
          fileSize: 245800,
          mimeType: "application/pdf",
          fileUrl: "/uploads/Inspection_Report_Preliminary.pdf",
          documentType: "Investigation Report",
          uploadedBy: seed.profiles[0]?.id || "admin",
          uploadedByName: seed.profiles[0]?.fullName || "AICTE Official",
          uploadedAt: new Date(Date.now() - 5 * 86400000).toISOString()
        },
        {
          id: "doc-seed-002",
          complaintId: seed.complaints[0]?.id || "c-001",
          institutionId: seed.complaints[0]?.institutionId,
          fileName: "Petitioner_Grievance_Annexure.pdf",
          originalName: "Petitioner_Grievance_Annexure.pdf",
          fileSize: 154200,
          mimeType: "application/pdf",
          fileUrl: "/uploads/Petitioner_Grievance_Annexure.pdf",
          documentType: "Complaint Evidence",
          uploadedBy: seed.profiles[1]?.id || "officer",
          uploadedByName: seed.profiles[1]?.fullName || "Desk Officer",
          uploadedAt: new Date(Date.now() - 7 * 86400000).toISOString()
        }
      ],
      meta: {
        lastReset: new Date().toISOString(),
        version: "1.0.0"
      }
    };
    this.persist(initialData);
    return initialData;
  }

  private persist(dataToSave?: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave || this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to persist database file:", err);
    }
  }

  public resetDemoData(): DatabaseSchema {
    this.data = this.initializeWithSeedData();
    return this.data;
  }

  // ====================================================================
  // PROFILES / AUTH
  // ====================================================================
  public getProfiles(): Profile[] {
    return this.data.profiles;
  }

  public getProfileByEmail(email: string): Profile | undefined {
    return this.data.profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
  }

  public getProfileById(id: string): Profile | undefined {
    return this.data.profiles.find(p => p.id === id);
  }

  // ====================================================================
  // INSTITUTIONS
  // ====================================================================
  public getInstitutions(params: {
    search?: string;
    region?: string;
    state?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    let result = [...this.data.institutions];

    if (params.search) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          i.aictePermanentId.toLowerCase().includes(q) ||
          i.city.toLowerCase().includes(q)
      );
    }

    if (params.region) {
      result = result.filter(i => i.region === params.region);
    }

    if (params.state) {
      result = result.filter(i => i.state.toLowerCase() === params.state?.toLowerCase());
    }

    // Refresh dynamic counters for institutions
    result.forEach(inst => {
      const instComplaints = this.data.complaints.filter(c => c.institutionId === inst.id);
      inst.totalComplaintsCount = instComplaints.length;
      inst.activeComplaintsCount = instComplaints.filter(c =>
        ["Pending", "Under Process", "Escalated"].includes(c.status)
      ).length;
      inst.overlapCount = this.data.overlapAlerts.filter(o => o.institutionId === inst.id).length;
    });

    const sortBy = params.sortBy || "name";
    const sortOrder = params.sortOrder === "desc" ? -1 : 1;

    result.sort((a: any, b: any) => {
      if (a[sortBy] < b[sortBy]) return -1 * sortOrder;
      if (a[sortBy] > b[sortBy]) return 1 * sortOrder;
      return 0;
    });

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const total = result.length;
    const paginated = result.slice((page - 1) * limit, page * limit);

    return {
      data: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public getInstitutionById(id: string): Institution | undefined {
    const inst = this.data.institutions.find(i => i.id === id || i.aictePermanentId === id);
    if (inst) {
      const instComplaints = this.data.complaints.filter(c => c.institutionId === inst.id);
      inst.totalComplaintsCount = instComplaints.length;
      inst.activeComplaintsCount = instComplaints.filter(c =>
        ["Pending", "Under Process", "Escalated"].includes(c.status)
      ).length;
      inst.overlapCount = this.data.overlapAlerts.filter(o => o.institutionId === inst.id).length;
    }
    return inst;
  }

  public findInstitutionsByFuzzyName(query: string): { institution: Institution; score: number }[] {
    if (!query || query.trim().length === 0) return [];
    const results: { institution: Institution; score: number }[] = [];
    const qClean = query.toLowerCase().trim();

    for (const inst of this.data.institutions) {
      if (inst.aictePermanentId.toLowerCase() === qClean) {
        results.push({ institution: inst, score: 100 });
        continue;
      }
      const matchRes = fuzzyMatchInstitution(query, inst.name);
      if (matchRes.match || matchRes.score >= 40) {
        results.push({ institution: inst, score: matchRes.score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  public createInstitution(data: Omit<Institution, "id" | "totalComplaintsCount" | "activeComplaintsCount" | "overlapCount" | "createdAt" | "updatedAt">): Institution {
    const exists = this.data.institutions.some(i => i.aictePermanentId === data.aictePermanentId);
    if (exists) {
      throw new Error(`Institution with AICTE Permanent ID ${data.aictePermanentId} already exists.`);
    }

    const newInst: Institution = {
      ...data,
      id: `inst-${Date.now()}`,
      totalComplaintsCount: 0,
      activeComplaintsCount: 0,
      overlapCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.institutions.push(newInst);
    this.persist();
    return newInst;
  }

  // ====================================================================
  // COMPLAINTS
  // ====================================================================
  public getComplaints(params: {
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
  }) {
    let result = [...this.data.complaints];

    if (params.institutionId) {
      result = result.filter(c => c.institutionId === params.institutionId || c.aictePermanentId === params.institutionId);
    }

    if (params.aictePermanentId) {
      result = result.filter(c => c.aictePermanentId === params.aictePermanentId);
    }

    if (params.search) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        c =>
          c.complaintId.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)) ||
          c.institutionName.toLowerCase().includes(q) ||
          c.aictePermanentId.toLowerCase().includes(q) ||
          (c.category && c.category.toLowerCase().includes(q))
      );
    }

    if (params.bureau) {
      result = result.filter(c => c.currentBureauId === params.bureau || c.receivingBureauId === params.bureau);
    }

    if (params.category) {
      result = result.filter(c => c.category === params.category);
    }

    if (params.status) {
      result = result.filter(c => c.status === params.status);
    }

    if (params.priority) {
      result = result.filter(c => c.priority === params.priority);
    }

    if (params.assignedOfficerId) {
      result = result.filter(c => c.assignedOfficerId === params.assignedOfficerId);
    }

    if (params.hasOverlap !== undefined) {
      result = result.filter(c => c.hasOverlapAlert === params.hasOverlap);
    }

    if (params.isOverdue) {
      const today = new Date().toISOString().split("T")[0];
      result = result.filter(
        c => ["Pending", "Under Process", "Escalated"].includes(c.status) && c.expectedDisposalDate < today
      );
    }

    if ((params as any).isDueSoon) {
      const today = new Date().toISOString().split("T")[0];
      const dueSoonTarget = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
      result = result.filter(
        c => ["Pending", "Under Process"].includes(c.status) && c.expectedDisposalDate >= today && c.expectedDisposalDate <= dueSoonTarget
      );
    }

    // Date-range filters on receivedDate (ISO date string comparison)
    if (params.receivedFrom) {
      result = result.filter(c => c.receivedDate >= params.receivedFrom!);
    }
    if (params.receivedTo) {
      result = result.filter(c => c.receivedDate <= params.receivedTo!);
    }

    // Date-range filters on last action (updatedAt)
    if (params.lastActionFrom) {
      result = result.filter(c => c.updatedAt.split("T")[0] >= params.lastActionFrom!);
    }
    if (params.lastActionTo) {
      result = result.filter(c => c.updatedAt.split("T")[0] <= params.lastActionTo!);
    }

    const sortBy = params.sortBy || "receivedDate";
    const sortOrder = params.sortOrder === "asc" ? 1 : -1;

    const PRIORITY_ORDER: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

    result.sort((a: any, b: any) => {
      if (sortBy === "priority") {
        const pA = PRIORITY_ORDER[a.priority] || 0;
        const pB = PRIORITY_ORDER[b.priority] || 0;
        return (pA - pB) * sortOrder;
      }
      if (a[sortBy] < b[sortBy]) return -1 * sortOrder;
      if (a[sortBy] > b[sortBy]) return 1 * sortOrder;
      return 0;
    });

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const total = result.length;
    const paginated = result.slice((page - 1) * limit, page * limit);

    return {
      data: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public getComplaintById(id: string): Complaint | undefined {
    return this.data.complaints.find(c => c.id === id || c.complaintId === id);
  }

  /**
   * Register a new complaint with integrated Overlap Detection workflow
   */
  public async createComplaint(
    data: {
      institutionId: string;
      category: string;
      title: string;
      description: string;
      receivingBureauId: string;
      assignedOfficerId?: string;
      priority: "Low" | "Medium" | "High" | "Critical";
      expectedDisposalDate?: string;
    },
    user: Profile
  ): Promise<{ complaint: Complaint; detectedOverlaps: any[] }> {
    const institution = this.getInstitutionById(data.institutionId);
    if (!institution) {
      throw new Error(`Institution ID "${data.institutionId}" not found. Institution must be registered before filing complaints.`);
    }

    const count = this.data.complaints.length + 101;
    const complaintId = `AICTE/${data.receivingBureauId}/2026/${String(count).padStart(5, "0")}`;
    const today = new Date().toISOString().split("T")[0];

    // Calculate default SLA expected disposal date if not given
    const slaDays = data.priority === "Critical" ? 7 : data.priority === "High" ? 15 : data.priority === "Medium" ? 30 : 45;
    const expDate = data.expectedDisposalDate || new Date(Date.now() + slaDays * 86400000).toISOString().split("T")[0];

    let assignedOfficerName = "";
    if (data.assignedOfficerId) {
      const officer = this.getProfileById(data.assignedOfficerId);
      assignedOfficerName = officer?.fullName || "";
    } else {
      // Default officer mapping by bureau
      assignedOfficerName = data.receivingBureauId === "RB" ? "Smt. Sunita Venkataraman" : data.receivingBureauId === "PGRC" ? "Shri Arvind K. Mukhopadhyay" : "Dr. Meenakshi Sundaram";
    }

    const newComplaint: Complaint = {
      id: `comp-${Date.now()}`,
      complaintId,
      institutionId: institution.id,
      aictePermanentId: institution.aictePermanentId,
      institutionName: institution.name,
      category: data.category,
      title: data.title,
      description: data.description,
      receivedDate: today,
      expectedDisposalDate: expDate,
      slaTargetDays: slaDays,
      receivingBureauId: data.receivingBureauId,
      currentBureauId: data.receivingBureauId,
      assignedOfficerId: data.assignedOfficerId,
      assignedOfficerName,
      status: "Pending",
      priority: data.priority,
      hasOverlapAlert: false,
      createdBy: user.id,
      createdByName: user.fullName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Run Overlap Detection Engine across existing cases of this institution
    const detectionResult = await detectOverlapsForComplaint(newComplaint, institution, this.data.complaints);

    if (detectionResult.hasOverlap) {
      newComplaint.hasOverlapAlert = true;

      // Create Overlap Alert records with deduplication
      detectionResult.candidateAlerts.forEach((cand, idx) => {
        const alreadyExists = this.data.overlapAlerts.some(
          o =>
            (o.complaintIdA === cand.existingComplaint.id && o.complaintIdB === newComplaint.id) ||
            (o.complaintIdA === newComplaint.id && o.complaintIdB === cand.existingComplaint.id)
        );
        if (alreadyExists) return;

        const combinedScore = Math.min(100, Math.round(cand.ruleScore * 0.6 + (cand.semanticScore || 0) * 0.4));
        const confidenceCategory: "High-Confidence Duplicate" | "Related Grievance" | "Low-Confidence Match" =
          combinedScore >= 80 ? "High-Confidence Duplicate" : combinedScore >= 50 ? "Related Grievance" : "Low-Confidence Match";

        const alertId = `OVL-2026-${String(this.data.overlapAlerts.length + idx + 1).padStart(4, "0")}`;
        const alert: OverlapAlert = {
          id: `ovl-${Date.now()}-${idx}`,
          alertId,
          institutionId: institution.id,
          aictePermanentId: institution.aictePermanentId,
          institutionName: institution.name,
          complaintIdA: cand.existingComplaint.id,
          complaintRefA: cand.existingComplaint.complaintId,
          complaintTitleA: cand.existingComplaint.title,
          complaintDescA: cand.existingComplaint.description,
          complaintIdB: newComplaint.id,
          complaintRefB: newComplaint.complaintId,
          complaintTitleB: newComplaint.title,
          complaintDescB: newComplaint.description,
          bureauA: cand.existingComplaint.currentBureauId,
          bureauB: newComplaint.receivingBureauId,
          categoryA: cand.existingComplaint.category,
          categoryB: newComplaint.category,
          statusA: cand.existingComplaint.status,
          statusB: newComplaint.status,
          ruleMatchScore: cand.ruleScore,
          semanticSimilarityScore: cand.semanticScore,
          matchReasons: cand.reasons,
          explanation: cand.explanation,
          confidenceCategory,
          detectionMethod: cand.explanation?.semanticMatch?.engine || "Rule & Cosine Fallback",
          alertStatus: "Pending Review",
          recommendedAction: cand.recommendation,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.data.overlapAlerts.push(alert);

        // Notify officers
        this.data.notifications.push({
          id: `notif-${Date.now()}-${idx}`,
          recipientRole: "Regulation Bureau Officer",
          title: `Potential Overlap Detected: ${institution.name}`,
          message: `Cross-Bureau overlap identified between ${alert.complaintRefA} (${alert.bureauA}) and newly registered ${alert.complaintRefB} (${alert.bureauB}).`,
          notificationType: "Overlap Alert",
          referenceId: alert.alertId,
          referenceType: "overlap",
          isRead: false,
          createdAt: new Date().toISOString()
        });
      });
    }

    this.data.complaints.push(newComplaint);

    // Record initial case history
    this.data.caseHistory.push({
      id: `hist-${Date.now()}`,
      complaintId: newComplaint.id,
      actionType: "Complaint Registered",
      toStatus: "Pending",
      remarks: `Complaint registered in ${newComplaint.receivingBureauId}. ${newComplaint.hasOverlapAlert ? 'Overlap detection engine flagged potential related cases.' : 'No initial cross-bureau conflicts.'}`,
      performedBy: user.id,
      performedByName: user.fullName,
      createdAt: new Date().toISOString()
    });

    // Record audit log
    this.data.auditLogs.push({
      id: `audit-${Date.now()}`,
      userId: user.id,
      userName: user.fullName,
      action: "REGISTER_COMPLAINT",
      entityType: "Complaint",
      entityId: newComplaint.complaintId,
      details: {
        institution: institution.name,
        category: newComplaint.category,
        bureau: newComplaint.receivingBureauId,
        hasOverlapAlert: newComplaint.hasOverlapAlert
      },
      createdAt: new Date().toISOString()
    });

    this.persist();

    return {
      complaint: newComplaint,
      detectedOverlaps: detectionResult.candidateAlerts
    };
  }

  public updateComplaintStatus(
    complaintId: string,
    updates: {
      status?: "Pending" | "Under Process" | "Disposed" | "Transferred" | "Escalated";
      priority?: "Low" | "Medium" | "High" | "Critical";
      assignedOfficerId?: string;
      remarks: string;
      disposalRemarks?: string;
    },
    user: Profile
  ): Complaint {
    const comp = this.getComplaintById(complaintId);
    if (!comp) {
      throw new Error(`Complaint ${complaintId} not found`);
    }

    const fromStatus = comp.status;
    let actionType = "Status Update";

    // Validate permitted transitions
    const VALID_TRANSITIONS: Record<string, string[]> = {
      "Pending": ["Under Process", "Escalated", "Transferred"],
      "Under Process": ["Disposed", "Escalated", "Transferred", "Pending"],
      "Escalated": ["Under Process", "Disposed", "Transferred"],
      "Transferred": ["Under Process", "Pending", "Escalated"],
      "Disposed": ["Under Process"] // Reopen, admin only
    };

    if (updates.status && updates.status !== fromStatus) {
      const allowed = VALID_TRANSITIONS[fromStatus] || [];
      if (!allowed.includes(updates.status)) {
        throw new Error(`Invalid status transition: Cannot transition complaint from "${fromStatus}" to "${updates.status}". Permitted transitions: ${allowed.join(", ")}`);
      }
    }

    if (fromStatus === "Disposed" && updates.status && updates.status !== "Disposed") {
      if (user.role !== "Administrator") {
        throw new Error("Disposed cases are closed and can only be reopened by an Administrator.");
      }
      actionType = "Case Reopened";
    }

    if (updates.status) {
      comp.status = updates.status;
      if (updates.status === "Disposed") {
        comp.disposalDate = new Date().toISOString().split("T")[0];
        comp.disposalRemarks = updates.disposalRemarks || updates.remarks;
        actionType = "Case Disposed";
      } else if (updates.status === "Escalated") {
        actionType = "Case Escalated";
      }
    }

    if (updates.priority) {
      comp.priority = updates.priority;
    }

    if (updates.assignedOfficerId) {
      const officer = this.getProfileById(updates.assignedOfficerId);
      comp.assignedOfficerId = updates.assignedOfficerId;
      comp.assignedOfficerName = officer?.fullName || "";
      actionType = "Officer Assigned";
    }

    comp.updatedAt = new Date().toISOString();

    // Add case history entry
    this.data.caseHistory.push({
      id: `hist-${Date.now()}`,
      complaintId: comp.id,
      actionType,
      fromStatus,
      toStatus: comp.status,
      remarks: updates.remarks,
      performedBy: user.id,
      performedByName: user.fullName,
      createdAt: new Date().toISOString()
    });

    // Add audit log
    this.data.auditLogs.push({
      id: `audit-${Date.now()}`,
      userId: user.id,
      userName: user.fullName,
      action: actionType.toUpperCase().replace(/\s+/g, "_"),
      entityType: "Complaint",
      entityId: comp.complaintId,
      details: { fromStatus, toStatus: comp.status, remarks: updates.remarks },
      createdAt: new Date().toISOString()
    });

    this.persist();
    return comp;
  }

  // ====================================================================
  // CASE TRANSFERS
  // ====================================================================
  public transferCase(
    complaintId: string,
    transferData: {
      toBureauId: string;
      toOfficerId?: string;
      transferReason: string;
    },
    user: Profile
  ): CaseTransfer {
    const comp = this.getComplaintById(complaintId);
    if (!comp) throw new Error("Complaint not found");

    if (transferData.toBureauId === comp.currentBureauId) {
      throw new Error(`Cannot transfer case to the same bureau (${transferData.toBureauId}). Destination must be different.`);
    }

    const fromBureau = comp.currentBureauId;
    const fromStatus = comp.status;
    const fromOfficerId = comp.assignedOfficerId;
    const fromOfficerName = comp.assignedOfficerName;

    let toOfficerName = "";
    if (transferData.toOfficerId) {
      const off = this.getProfileById(transferData.toOfficerId);
      toOfficerName = off?.fullName || "";
    }

    comp.currentBureauId = transferData.toBureauId;
    comp.assignedOfficerId = transferData.toOfficerId;
    comp.assignedOfficerName = toOfficerName;
    comp.status = "Transferred";
    comp.updatedAt = new Date().toISOString();

    const transfer: CaseTransfer = {
      id: `trf-${Date.now()}`,
      complaintId: comp.id,
      complaintRefId: comp.complaintId,
      institutionName: comp.institutionName,
      fromBureauId: fromBureau,
      toBureauId: transferData.toBureauId,
      fromOfficerId,
      fromOfficerName,
      toOfficerId: transferData.toOfficerId,
      toOfficerName,
      transferReason: transferData.transferReason,
      transferredBy: user.id,
      transferredByName: user.fullName,
      transferredAt: new Date().toISOString(),
      acceptanceStatus: "Accepted"
    };

    this.data.caseTransfers.push(transfer);

    // Case History entry
    this.data.caseHistory.push({
      id: `hist-${Date.now()}`,
      complaintId: comp.id,
      actionType: "Case Transferred",
      fromStatus,
      toStatus: "Transferred",
      remarks: `Transferred from ${fromBureau} to ${transferData.toBureauId}. Reason: ${transferData.transferReason}`,
      performedBy: user.id,
      performedByName: user.fullName,
      createdAt: new Date().toISOString()
    });

    // Notify receiving bureau
    this.data.notifications.push({
      id: `notif-${Date.now()}`,
      recipientRole: transferData.toBureauId === "RB" ? "Regulation Bureau Officer" : "PGRC Officer",
      title: `Case Transferred: ${comp.complaintId}`,
      message: `Case ${comp.complaintId} has been transferred to ${transferData.toBureauId} by ${user.fullName}. Reason: ${transferData.transferReason}`,
      notificationType: "Transfer",
      referenceId: comp.complaintId,
      referenceType: "complaint",
      isRead: false,
      createdAt: new Date().toISOString()
    });

    this.persist();
    return transfer;
  }

  public getTransfers() {
    return [...this.data.caseTransfers].sort((a, b) => b.transferredAt.localeCompare(a.transferredAt));
  }

  // ====================================================================
  // CASE HISTORY
  // ====================================================================
  public getCaseHistory(complaintId: string): CaseHistory[] {
    const comp = this.getComplaintById(complaintId);
    if (!comp) return [];
    return this.data.caseHistory
      .filter(h => h.complaintId === comp.id || h.complaintId === comp.complaintId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public addCaseHistory(history: CaseHistory): CaseHistory {
    this.data.caseHistory.push(history);
    this.persist();
    return history;
  }

  // ====================================================================
  // OVERLAP ALERTS & RELATED CASES
  // ====================================================================
  public getOverlapAlerts(params: {
    bureau?: string;
    alertStatus?: string;
    institutionId?: string;
    page?: number;
    limit?: number;
  }) {
    let result = [...this.data.overlapAlerts];

    if (params.bureau) {
      result = result.filter(o => o.bureauA === params.bureau || o.bureauB === params.bureau);
    }

    if (params.alertStatus) {
      result = result.filter(o => o.alertStatus === params.alertStatus);
    }

    if (params.institutionId) {
      result = result.filter(o => o.institutionId === params.institutionId || o.aictePermanentId === params.institutionId);
    }

    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const total = result.length;
    const paginated = result.slice((page - 1) * limit, page * limit);

    return {
      data: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public getOverlapAlertById(id: string): OverlapAlert | undefined {
    return this.data.overlapAlerts.find(o => o.id === id || o.alertId === id);
  }

  public reviewOverlapAlert(
    alertId: string,
    reviewData: {
      decision: "Confirmed Related" | "Confirmed Duplicate" | "Marked Unrelated" | "Resolved";
      remarks: string;
      linkAsRelated?: boolean;
    },
    user: Profile
  ): OverlapAlert {
    const alert = this.getOverlapAlertById(alertId);
    if (!alert) throw new Error("Overlap alert not found");

    alert.alertStatus = reviewData.decision;
    alert.reviewedBy = user.id;
    alert.reviewedByName = user.fullName;
    alert.reviewedAt = new Date().toISOString();
    alert.reviewRemarks = reviewData.remarks;
    alert.updatedAt = new Date().toISOString();

    // If confirmed related or duplicate, link the two cases in related_cases table
    if (reviewData.decision === "Confirmed Related" || reviewData.decision === "Confirmed Duplicate" || reviewData.linkAsRelated) {
      const relationType = reviewData.decision === "Confirmed Duplicate" ? "Duplicate" : "Related";
      
      const alreadyLinked = this.data.relatedCases.some(
        r =>
          (r.complaintIdA === alert.complaintIdA && r.complaintIdB === alert.complaintIdB) ||
          (r.complaintIdA === alert.complaintIdB && r.complaintIdB === alert.complaintIdA)
      );

      if (!alreadyLinked) {
        this.data.relatedCases.push({
          id: `rel-${Date.now()}`,
          complaintIdA: alert.complaintIdA,
          complaintIdB: alert.complaintIdB,
          complaintRefA: alert.complaintRefA,
          complaintRefB: alert.complaintRefB,
          relationshipType: relationType,
          linkedBy: user.id,
          linkedByName: user.fullName,
          notes: reviewData.remarks,
          createdAt: new Date().toISOString()
        });
      }

      // Add Case History entries for both complaints
      this.data.caseHistory.push({
        id: `hist-${Date.now()}-1`,
        complaintId: alert.complaintIdA,
        actionType: "Overlap Confirmed",
        remarks: `Cross-Bureau relationship confirmed with ${alert.complaintRefB}. Decision: ${reviewData.decision}. Officer notes: ${reviewData.remarks}`,
        performedBy: user.id,
        performedByName: user.fullName,
        createdAt: new Date().toISOString()
      });

      this.data.caseHistory.push({
        id: `hist-${Date.now()}-2`,
        complaintId: alert.complaintIdB,
        actionType: "Overlap Confirmed",
        remarks: `Cross-Bureau relationship confirmed with ${alert.complaintRefA}. Decision: ${reviewData.decision}. Officer notes: ${reviewData.remarks}`,
        performedBy: user.id,
        performedByName: user.fullName,
        createdAt: new Date().toISOString()
      });
    } else if (reviewData.decision === "Marked Unrelated") {
      this.data.caseHistory.push({
        id: `hist-${Date.now()}`,
        complaintId: alert.complaintIdB,
        actionType: "Overlap Dismissed",
        remarks: `Potential overlap with ${alert.complaintRefA} marked as unrelated by ${user.fullName}. Rationale: ${reviewData.remarks}`,
        performedBy: user.id,
        performedByName: user.fullName,
        createdAt: new Date().toISOString()
      });
    }

    // Add Audit Log entry for review
    this.data.auditLogs.push({
      id: `audit-${Date.now()}`,
      userId: user.id,
      userName: user.fullName,
      action: "REVIEW_OVERLAP_ALERT",
      entityType: "OverlapAlert",
      entityId: alert.alertId,
      details: {
        decision: reviewData.decision,
        remarks: reviewData.remarks,
        ruleScore: alert.ruleMatchScore,
        semanticScore: alert.semanticSimilarityScore,
        complaintRefA: alert.complaintRefA,
        complaintRefB: alert.complaintRefB,
        detectionMethod: alert.detectionMethod || alert.explanation?.semanticMatch?.engine || "TF-IDF Fallback"
      },
      createdAt: new Date().toISOString()
    });

    this.persist();
    return alert;
  }

  public overrideSlaDeadline(
    complaintId: string,
    newDeadline: string,
    overrideReason: string,
    user: Profile
  ): Complaint {
    const comp = this.getComplaintById(complaintId);
    if (!comp) throw new Error("Complaint not found");

    if (!overrideReason || overrideReason.trim().length < 5) {
      throw new Error("A comprehensive administrative reason (at least 5 characters) is required to override SLA deadlines.");
    }

    const oldDeadline = comp.expectedDisposalDate;
    comp.expectedDisposalDate = newDeadline;
    comp.updatedAt = new Date().toISOString();

    // Case History
    this.data.caseHistory.push({
      id: `hist-${Date.now()}`,
      complaintId: comp.id,
      actionType: "SLA Deadline Overridden",
      fromStatus: comp.status,
      toStatus: comp.status,
      remarks: `Statutory deadline adjusted from ${oldDeadline} to ${newDeadline}. Official Justification: ${overrideReason}`,
      performedBy: user.id,
      performedByName: user.fullName,
      createdAt: new Date().toISOString()
    });

    // Audit Log
    this.data.auditLogs.push({
      id: `audit-${Date.now()}`,
      userId: user.id,
      userName: user.fullName,
      action: "SLA_DEADLINE_OVERRIDDEN",
      entityType: "Complaint",
      entityId: comp.complaintId,
      details: { previousDeadline: oldDeadline, newDeadline, reason: overrideReason },
      createdAt: new Date().toISOString()
    });

    this.persist();
    return comp;
  }

  public getRelatedCases(complaintId: string): RelatedCase[] {
    const comp = this.getComplaintById(complaintId);
    if (!comp) return [];
    return this.data.relatedCases.filter(
      r => r.complaintIdA === comp.id || r.complaintIdB === comp.id
    );
  }

  // ====================================================================
  // NOTIFICATIONS
  // ====================================================================
  public getNotifications(userRole?: string) {
    let result = [...this.data.notifications];
    if (userRole && userRole !== "Administrator") {
      result = result.filter(n => !n.recipientRole || n.recipientRole === userRole);
    }
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public markNotificationRead(id: string) {
    const notif = this.data.notifications.find(n => n.id === id);
    if (notif) {
      notif.isRead = true;
      this.persist();
    }
  }

  public markAllNotificationsRead(userRole?: string) {
    this.data.notifications.forEach(n => {
      if (!userRole || !n.recipientRole || n.recipientRole === userRole) {
        n.isRead = true;
      }
    });
    this.persist();
  }

  public addNotification(notification: Notification): Notification {
    if (!this.data.notifications) this.data.notifications = [];
    this.data.notifications.unshift(notification);
    this.persist();
    return notification;
  }

  // ====================================================================
  // AUDIT LOGS
  // ====================================================================
  public getAuditLogs() {
    return [...this.data.auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public addAuditLog(log: Omit<AuditLog, "id" | "createdAt">): AuditLog {
    const entry: AuditLog = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...log
    };
    this.data.auditLogs.push(entry);
    this.persist();
    return entry;
  }

  // ====================================================================
  // DASHBOARD ANALYTICS & METRICS
  // ====================================================================
  public getDashboardAnalytics() {
    const complaints = this.data.complaints;
    const today = new Date().toISOString().split("T")[0];

    const total = complaints.length;
    const pending = complaints.filter(c => c.status === "Pending").length;
    const underProcess = complaints.filter(c => c.status === "Under Process").length;
    const disposed = complaints.filter(c => c.status === "Disposed").length;
    const transferred = complaints.filter(c => c.status === "Transferred").length;
    const escalated = complaints.filter(c => c.status === "Escalated").length;
    const overdue = complaints.filter(
      c => ["Pending", "Under Process"].includes(c.status) && c.expectedDisposalDate < today
    ).length;
    const unresolvedOverlaps = this.data.overlapAlerts.filter(o => o.alertStatus === "Pending Review").length;

    // Status distribution
    const statusDistribution = [
      { name: "Pending", count: pending, color: "#f59e0b" },
      { name: "Under Process", count: underProcess, color: "#3b82f6" },
      { name: "Disposed", count: disposed, color: "#10b981" },
      { name: "Transferred", count: transferred, color: "#8b5cf6" },
      { name: "Escalated", count: escalated, color: "#ef4444" }
    ];

    // Bureau-wise workload
    const bureaus = ["RB", "PGRC", "RO", "AB", "PB"];
    const bureauWorkload = bureaus.map(b => {
      const bureauComplaints = complaints.filter(c => c.currentBureauId === b);
      return {
        bureau: b,
        total: bureauComplaints.length,
        pending: bureauComplaints.filter(c => c.status === "Pending").length,
        active: bureauComplaints.filter(c => ["Pending", "Under Process", "Escalated"].includes(c.status)).length,
        disposed: bureauComplaints.filter(c => c.status === "Disposed").length
      };
    });

    // Monthly trends (Last 6 months)
    const monthCounts: Record<string, { month: string; filed: number; disposed: number }> = {};
    const monthNames = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    monthNames.forEach(m => {
      monthCounts[m] = { month: m, filed: 0, disposed: 0 };
    });

    complaints.forEach(c => {
      const d = new Date(c.receivedDate);
      const m = d.toLocaleString("en-US", { month: "short" });
      if (monthCounts[m]) {
        monthCounts[m].filed++;
      }
      if (c.disposalDate) {
        const dd = new Date(c.disposalDate);
        const dm = dd.toLocaleString("en-US", { month: "short" });
        if (monthCounts[dm]) {
          monthCounts[dm].disposed++;
        }
      }
    });

    // Region-wise complaint distribution
    const regionCounts: Record<string, number> = {};
    this.data.institutions.forEach(inst => {
      const count = complaints.filter(c => c.institutionId === inst.id).length;
      const reg = inst.region.split("(")[0].trim();
      regionCounts[reg] = (regionCounts[reg] || 0) + count;
    });

    const regionDistribution = Object.keys(regionCounts).map(k => ({
      region: k,
      count: regionCounts[k]
    }));

    // Case Ageing distribution for active complaints
    const nowTime = new Date().getTime();
    let ageUnder15 = 0;
    let age15To30 = 0;
    let age30To60 = 0;
    let ageOver60 = 0;

    complaints.forEach(c => {
      if (["Pending", "Under Process", "Escalated"].includes(c.status)) {
        const diffDays = Math.floor((nowTime - new Date(c.receivedDate).getTime()) / (1000 * 3600 * 24));
        if (diffDays < 15) ageUnder15++;
        else if (diffDays <= 30) age15To30++;
        else if (diffDays <= 60) age30To60++;
        else ageOver60++;
      }
    });

    const caseAgeing = [
      { range: "< 15 Days", count: ageUnder15, color: "#10b981" },
      { range: "15-30 Days", count: age15To30, color: "#3b82f6" },
      { range: "30-60 Days", count: age30To60, color: "#f59e0b" },
      { range: "> 60 Days", count: ageOver60, color: "#ef4444" }
    ];

    // Recent activity feed (last 10 events)
    const recentActivity = [...this.data.caseHistory]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);

    // Critical Alerts (active overdue + critical overlap alerts)
    const criticalAlerts = this.data.overlapAlerts
      .filter(o => o.alertStatus === "Pending Review" && (o.ruleMatchScore > 85 || (o.semanticSimilarityScore || 0) > 80))
      .slice(0, 5);

    return {
      kpi: {
        totalComplaints: total,
        pendingComplaints: pending,
        underProcessComplaints: underProcess,
        disposedComplaints: disposed,
        transferredComplaints: transferred,
        escalatedComplaints: escalated,
        overdueComplaints: overdue,
        unresolvedOverlapAlerts: unresolvedOverlaps,
        disposalRatePercentage: total > 0 ? Math.round((disposed / total) * 100) : 0
      },
      statusDistribution,
      bureauWorkload,
      monthlyTrends: Object.values(monthCounts),
      regionDistribution,
      caseAgeing,
      recentActivity,
      criticalAlerts
    };
  }

  // ====================================================================
  // SUPPORTING DOCUMENTS
  // ====================================================================
  public getDocuments(params: { complaintId?: string; institutionId?: string }): ComplaintDocument[] {
    if (!this.data.documents) {
      this.data.documents = [];
    }
    return this.data.documents.filter(doc => {
      if (params.complaintId && doc.complaintId !== params.complaintId) return false;
      if (params.institutionId && doc.institutionId !== params.institutionId) return false;
      return true;
    });
  }

  public getDocumentById(id: string): ComplaintDocument | undefined {
    if (!this.data.documents) this.data.documents = [];
    return this.data.documents.find(d => d.id === id);
  }

  public addDocument(doc: ComplaintDocument): ComplaintDocument {
    if (!this.data.documents) this.data.documents = [];
    this.data.documents.unshift(doc);
    this.persist();
    return doc;
  }

  public deleteDocument(id: string): boolean {
    if (!this.data.documents) this.data.documents = [];
    const idx = this.data.documents.findIndex(d => d.id === id);
    if (idx !== -1) {
      this.data.documents.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // ====================================================================
  // COMPREHENSIVE PERFORMANCE & STATUTORY REPORTS
  // ====================================================================
  public getPerformanceReport(params?: { period?: string; bureau?: string }) {
    let complaints = [...this.data.complaints];
    const now = new Date();

    if (params?.period === "30d") {
      const cutoff = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
      complaints = complaints.filter(c => c.receivedDate >= cutoff);
    } else if (params?.period === "90d") {
      const cutoff = new Date(now.getTime() - 90 * 86400000).toISOString().split("T")[0];
      complaints = complaints.filter(c => c.receivedDate >= cutoff);
    } else if (params?.period === "q1") {
      complaints = complaints.filter(c => c.receivedDate >= "2026-01-01" && c.receivedDate <= "2026-03-31");
    }

    if (params?.bureau) {
      complaints = complaints.filter(c => c.currentBureauId === params.bureau || c.receivingBureauId === params.bureau);
    }

    const total = complaints.length;
    const disposed = complaints.filter(c => c.status === "Disposed").length;
    const pending = complaints.filter(c => c.status === "Pending").length;
    const underProcess = complaints.filter(c => c.status === "Under Process").length;
    const escalated = complaints.filter(c => c.status === "Escalated").length;
    const overdue = complaints.filter(
      c => c.status !== "Disposed" && c.expectedDisposalDate && c.expectedDisposalDate < now.toISOString().split("T")[0]
    ).length;

    // Bureau detailed breakdown
    const bureaus = ["RB", "PGRC", "RO", "AB", "PB"];
    const bureauPerformance = bureaus.map(bId => {
      const bCases = complaints.filter(c => c.currentBureauId === bId || c.receivingBureauId === bId);
      const bDisposed = bCases.filter(c => c.status === "Disposed");
      const bOverdue = bCases.filter(
        c => c.status !== "Disposed" && c.expectedDisposalDate && c.expectedDisposalDate < now.toISOString().split("T")[0]
      ).length;

      let totalDays = 0;
      bDisposed.forEach(c => {
        if (c.disposalDate && c.receivedDate) {
          const days = Math.max(1, Math.round((new Date(c.disposalDate).getTime() - new Date(c.receivedDate).getTime()) / 86400000));
          totalDays += days;
        }
      });
      const avgDisposalDays = bDisposed.length > 0 ? Math.round((totalDays / bDisposed.length) * 10) / 10 : 0;
      const bOverlaps = this.data.overlapAlerts.filter(o => o.bureauA === bId || o.bureauB === bId).length;

      return {
        bureau: bId,
        total: bCases.length,
        disposed: bDisposed.length,
        active: bCases.length - bDisposed.length,
        overdue: bOverdue,
        avgDisposalDays,
        disposalRate: bCases.length > 0 ? Math.round((bDisposed.length / bCases.length) * 100) : 0,
        overlapsCount: bOverlaps
      };
    });

    // Overlap alert breakdown
    const overlapStatusCounts: Record<string, number> = {
      "Pending Review": 0,
      "Confirmed Related": 0,
      "Confirmed Duplicate": 0,
      "Marked Unrelated": 0,
      "Resolved": 0
    };
    this.data.overlapAlerts.forEach(o => {
      overlapStatusCounts[o.alertStatus] = (overlapStatusCounts[o.alertStatus] || 0) + 1;
    });

    // Regional breakdown
    const regionMap: Record<string, { total: number; disposed: number; active: number }> = {};
    complaints.forEach(c => {
      const inst = this.getInstitutionById(c.institutionId);
      const reg = inst?.region || "Other";
      if (!regionMap[reg]) regionMap[reg] = { total: 0, disposed: 0, active: 0 };
      regionMap[reg].total++;
      if (c.status === "Disposed") regionMap[reg].disposed++;
      else regionMap[reg].active++;
    });

    const regionalCompliance = Object.entries(regionMap)
      .map(([region, stats]) => ({
        region,
        total: stats.total,
        disposed: stats.disposed,
        active: stats.active,
        complianceRate: stats.total > 0 ? Math.round((stats.disposed / stats.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);

    // Top institutions by complaint volume
    const instComplaintsMap: Record<string, { name: string; permId: string; total: number; active: number; overlapCount: number }> = {};
    complaints.forEach(c => {
      if (!instComplaintsMap[c.institutionId]) {
        instComplaintsMap[c.institutionId] = {
          name: c.institutionName,
          permId: c.aictePermanentId,
          total: 0,
          active: 0,
          overlapCount: this.data.overlapAlerts.filter(o => o.institutionId === c.institutionId).length
        };
      }
      instComplaintsMap[c.institutionId].total++;
      if (c.status !== "Disposed") instComplaintsMap[c.institutionId].active++;
    });

    const topInstitutions = Object.values(instComplaintsMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      period: params?.period || "all",
      kpi: {
        totalComplaints: total,
        disposedComplaints: disposed,
        pendingComplaints: pending,
        underProcessComplaints: underProcess,
        escalatedComplaints: escalated,
        overdueComplaints: overdue,
        disposalRatePercentage: total > 0 ? Math.round((disposed / total) * 100) : 0,
        totalOverlapAlerts: this.data.overlapAlerts.length,
        unresolvedOverlapAlerts: this.data.overlapAlerts.filter(o => o.alertStatus === "Pending Review").length
      },
      bureauPerformance,
      overlapStatusCounts: Object.entries(overlapStatusCounts).map(([status, count]) => ({ status, count })),
      regionalCompliance,
      topInstitutions
    };
  }
}

// Export singleton instance
export const store = new Store();
export const JsonRepository = Store;

