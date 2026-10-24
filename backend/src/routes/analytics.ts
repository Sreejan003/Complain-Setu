import { Router, Response } from "express";
import { store } from "../db/store.js";

export const analyticsRouter = Router();

// Overall dashboard analytics KPIs and charts
analyticsRouter.get("/dashboard", (_req, res: Response) => {
  const analytics = store.getDashboardAnalytics();
  return res.json(analytics);
});

// CSV Export for complaints
analyticsRouter.get("/export-csv", (req, res: Response) => {
  const { bureau, status, category, priority } = req.query;

  const complaints = store.getComplaints({
    bureau: bureau as string,
    status: status as string,
    category: category as string,
    priority: priority as string,
    limit: 1000
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
    `"${c.complaintId}"`,
    `"${c.institutionName.replace(/"/g, '""')}"`,
    `"${c.aictePermanentId}"`,
    `"${c.category}"`,
    `"${c.receivingBureauId}"`,
    `"${c.currentBureauId}"`,
    `"${c.status}"`,
    `"${c.priority}"`,
    `"${c.receivedDate}"`,
    `"${c.expectedDisposalDate}"`,
    `"${c.disposalDate || "N/A"}"`,
    `"${c.hasOverlapAlert ? "YES" : "NO"}"`
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="aicte_complaints_${new Date().toISOString().split("T")[0]}.csv"`);
  return res.send(csvContent);
});
