import { getEscalationConfig } from "../services/slaScheduler.js";
import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, (req: AuthenticatedRequest, res, next) => {
  if (["SYSTEM_ADMIN","Institutional User"].includes(req.user!.role)) return res.status(403).json({error:"Case analytics access denied."});
  next();
});

analyticsRouter.get("/role-dashboard", (req: AuthenticatedRequest,res) => {
  const analytics = store.getDashboardAnalytics();
  const cases = store.getComplaints({limit:10,page:Number(req.query.page)||1,search:String(req.query.search||""),status:String(req.query.status||""),category:String(req.query.category||""),assignedOfficerId:String(req.query.officer||""),receivedFrom:String(req.query.from||""),receivedTo:String(req.query.to||""),sortBy:"expectedDisposalDate",sortOrder:"asc"});
  const all = store.getPerformanceReport();
  const today = new Date().toISOString().slice(0,10);
  const threshold = getEscalationConfig().approachingDeadlineDays;
  const until = new Date(Date.now()+threshold*86400000).toISOString().slice(0,10);

  // Counts operate on the full scoped collection, independent of the visible page.
  const extras = store.getRoleCounts(until,today);
  res.json({role:req.user!.role,kpi:analytics.kpi,...extras,cases:{...cases,data:cases.data.map(c=>({...c,lastAction:store.getLastAction(c.id)}))},performance:all,threshold});
});

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

    const complaints = store.getComplaints({
      bureau: bureau as string,
      status: status as string,
      category: category as string,
      priority: priority as string,
      region: effectiveRegion,
      receivedFrom: receivedFrom as string,
      receivedTo: receivedTo as string,
      limit: 5000
    }).data;

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

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="aicte_complaints_${new Date().toISOString().split("T")[0]}.csv"`);
    return res.send(csvContent);
  }
);
