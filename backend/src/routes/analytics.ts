import { roleDashboard } from "../services/roleDashboard.js";
import { getEscalationConfig } from "../services/slaScheduler.js";
import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, (req: AuthenticatedRequest, res, next) => {
  if (["SYSTEM_ADMIN","Institutional User"].includes(req.user!.role)) return res.status(403).json({error:"Case analytics access denied."});
  next();
});

analyticsRouter.get("/role-dashboard", (req: AuthenticatedRequest,res) => res.json(roleDashboard(req.user!,req.query)));

// Overall dashboard analytics KPIs and charts (Authenticated)
analyticsRouter.get("/dashboard", requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const analytics = store.getDashboardAnalytics();
  return res.json(analytics);
});

// Comprehensive performance and statutory compliance report (Authenticated)
analyticsRouter.get("/performance-report", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { period, bureau } = req.query;
  const report = store.getPerformanceReport({
    period: period as string,
    bureau: bureau as string
  });
  return res.json(report);
});

/**
 * Escapes and neutralizes CSV injection payloads (formula injection).
 * If a cell begins with '=', '+', '-', '@', '\t', or '\r', prefix with a single quote.
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// CSV Export for complaints (Authenticated & Role-governed)
analyticsRouter.get(
  "/export-csv",
  requireAuth,
  requireRole("BUREAU_HEAD", "CASE_OFFICER", "COMPETENT_AUTHORITY", "Senior Management", "Regulation Bureau Officer", "PGRC Officer", "Bureau Officer", "Regional Officer", "Competent Authority"),
  (req: AuthenticatedRequest, res: Response) => {
    const { bureau, status, category, priority, receivedFrom, receivedTo } = req.query;

    let effectiveRegion: string | undefined;
    if (req.user && req.user.role === "Regional Officer" && req.user.region) {
      effectiveRegion = req.user.region;
    }

    const filter = {
      bureau: bureau as string,
      status: status as string,
      category: category as string,
      priority: priority as string,
      region: effectiveRegion,
      receivedFrom: receivedFrom as string,
      receivedTo: receivedTo as string,
      limit: 100
    };
    const first = store.getComplaints(filter);
    const complaints = [...first.data];
    for(let page=2;page<=first.pagination.totalPages;page++) complaints.push(...store.getComplaints({...filter,page}).data);

    // Generate CSV formatted content
    const headers = [
      "Complaint ID",
      "Institution Name",
      "AICTE Permanent ID",
      "Category",
      "Receiving Bureau",
      "Current Bureau",
      "Status",
      "Priority",
      "Received Date",
      "Expected Disposal Date",
      "Disposal Date",
      "Has Overlap Alert"
    ];

    const rows = complaints.map(c => [
      sanitizeCsvCell(c.complaintId),
      sanitizeCsvCell(c.institutionName),
      sanitizeCsvCell(c.aictePermanentId),
      sanitizeCsvCell(c.category),
      sanitizeCsvCell(c.receivingBureauId),
      sanitizeCsvCell(c.currentBureauId),
      sanitizeCsvCell(c.status),
      sanitizeCsvCell(c.priority),
      sanitizeCsvCell(c.receivedDate),
      sanitizeCsvCell(c.expectedDisposalDate),
      sanitizeCsvCell(c.disposalDate || "N/A"),
      sanitizeCsvCell(c.hasOverlapAlert ? "YES" : "NO")
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"REPORT_EXPORTED",entityType:"CaseReport",entityId:"complaint-register",details:{format:"csv",rows:complaints.length,filterFields:Object.entries(filter).filter(([,value])=>value!==undefined).map(([key])=>key)}});

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="aicte_complaints_${new Date().toISOString().split("T")[0]}.csv"`);
    return res.send(csvContent);
  }
);
