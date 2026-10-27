import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";

export const analyticsRouter = Router();

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
  requireRole("Administrator", "Senior Management", "Regulation Bureau Officer", "PGRC Officer", "Regional Officer"),
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
