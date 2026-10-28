import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";

export const institutionsRouter = Router();
institutionsRouter.use(requireAuth, (req: AuthenticatedRequest,res,next)=>{
  if(req.user!.role === "SYSTEM_ADMIN") return res.status(403).json({error:"Institution complaint content is outside administration scope."});
  if(req.method!=="GET" && !["BUREAU_HEAD","COMPETENT_AUTHORITY"].includes(req.user!.role)) return res.status(403).json({error:"Supervisory authorization required."});
  next();
});

// Search and list institutions (Authenticated & Role-scoped)
institutionsRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { search, region, state, page, limit, sortBy, sortOrder } = req.query;

  // Institutional User scope: strictly lock to their own institution
  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    const inst = store.getInstitutionById(req.user.institutionId);
    return res.json({
      data: inst ? [inst] : [],
      pagination: { page: 1, limit: 10, total: inst ? 1 : 0, totalPages: 1 }
    });
  }

  let effectiveRegion = region as string;
  if (req.user && req.user.role === "Regional Officer" && req.user.region) {
    effectiveRegion = req.user.region;
  }

  const results = store.getInstitutions({
    search: search as string,
    region: effectiveRegion,
    state: state as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    sortBy: sortBy as string,
    sortOrder: sortOrder as "asc" | "desc"
  });

  return res.json(results);
});

// Single-window institution dashboard metrics endpoint (Feature 1)
institutionsRouter.get("/:id/dashboard-metrics", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const institution = store.getInstitutionById(req.params.id);
  if (!institution) {
    return res.status(404).json({ error: "Institution not found." });
  }

  // Authorization enforcement
  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    if (institution.id !== req.user.institutionId && institution.aictePermanentId !== req.user.institutionId) {
      return res.status(403).json({ error: "Access Denied: You cannot access metrics for another institution." });
    }
  }

  if (req.user && req.user.role === "Regional Officer" && req.user.region) {
    if (!institution.region.toLowerCase().includes(req.user.region.toLowerCase())) {
      return res.status(403).json({ error: "Access Denied: You do not have jurisdiction over institutions in this region." });
    }
  }

  // Fetch all complaints for this institution
  const allCases = store.getComplaints({ institutionId: institution.id, limit: 1000 }).data;
  const today = new Date().toISOString().split("T")[0];

  // KPIs
  const pendingCases = allCases.filter(c => c.status === "Pending");
  const underProcessCases = allCases.filter(c => c.status === "Under Process");
  const resolvedCases = allCases.filter(c => c.status === "Disposed");
  const overdueCases = allCases.filter(c => ["Pending", "Under Process", "Escalated"].includes(c.status) && c.expectedDisposalDate < today);
  const highPriorityCases = allCases.filter(c => c.priority === "Critical" || c.priority === "High");

  const overlaps = store.getOverlapAlerts({ institutionId: institution.id, limit: 100 }).data;
  const activeOverlaps = overlaps.filter(o => ["Pending Review", "Confirmed Related", "Confirmed Duplicate"].includes(o.alertStatus));

  // Distributions
  const statusMap: Record<string, number> = {};
  const priorityMap: Record<string, number> = {};
  const categoryMap: Record<string, number> = {};
  const dateMap: Record<string, number> = {};

  for (const c of allCases) {
    statusMap[c.status] = (statusMap[c.status] || 0) + 1;
    priorityMap[c.priority] = (priorityMap[c.priority] || 0) + 1;
    categoryMap[c.category] = (categoryMap[c.category] || 0) + 1;
    const month = c.receivedDate ? c.receivedDate.substring(0, 7) : "Unknown";
    dateMap[month] = (dateMap[month] || 0) + 1;
  }

  // Urgent & Actionable Lists
  const upcomingDeadlines = allCases
    .filter(c => ["Pending", "Under Process"].includes(c.status) && c.expectedDisposalDate >= today)
    .sort((a, b) => a.expectedDisposalDate.localeCompare(b.expectedDisposalDate))
    .slice(0, 5);

  const overdueList = overdueCases
    .sort((a, b) => a.expectedDisposalDate.localeCompare(b.expectedDisposalDate))
    .slice(0, 5);

  const recentlyUpdated = [...allCases]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  return res.json({
    institution,
    kpis: {
      totalComplaints: allCases.length,
      pendingCount: pendingCases.length,
      underProcessCount: underProcessCases.length,
      resolvedCount: resolvedCases.length,
      overdueCount: overdueCases.length,
      highPriorityCount: highPriorityCases.length,
      activeOverlapCount: activeOverlaps.length
    },
    distribution: {
      byStatus: Object.entries(statusMap).map(([name, count]) => ({ name, count })),
      byPriority: Object.entries(priorityMap).map(([name, count]) => ({ name, count })),
      byCategory: Object.entries(categoryMap).map(([name, count]) => ({ name, count })),
      byDate: Object.entries(dateMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }))
    },
    urgent: {
      upcomingDeadlines,
      overdueComplaints: overdueList,
      recentlyUpdated
    }
  });
});

// Get institution consolidated profile by ID or Permanent ID
institutionsRouter.get("/:id", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const institution = store.getInstitutionById(req.params.id);
  if (!institution) {
    return res.status(404).json({ error: "Institution not found." });
  }

  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    if (institution.id !== req.user.institutionId && institution.aictePermanentId !== req.user.institutionId) {
      return res.status(403).json({ error: "Access Denied: You do not have permission to access another institution's profile." });
    }
  }

  if (req.user && req.user.role === "Regional Officer" && req.user.region) {
    if (!institution.region.toLowerCase().includes(req.user.region.toLowerCase())) {
      return res.status(403).json({ error: "Access Denied: You do not have jurisdiction over institutions in this region." });
    }
  }

  // Retrieve all complaints and documents associated with this institution
  const complaints = store.getComplaints({ institutionId: institution.id, limit: 100 }).data;
  const overlapAlerts = store.getOverlapAlerts({ institutionId: institution.id, limit: 50 }).data;
  const documents = store.getDocuments({ institutionId: institution.id });

  return res.json({
    institution,
    complaints,
    overlapAlerts,
    documents
  });
});

// Get institution documents directly
institutionsRouter.get("/:id/documents", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const institution = store.getInstitutionById(req.params.id);
  if (!institution) {
    return res.status(404).json({ error: "Institution not found." });
  }

  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    if (institution.id !== req.user.institutionId && institution.aictePermanentId !== req.user.institutionId) {
      return res.status(403).json({ error: "Access Denied: You do not have permission to access another institution's documents." });
    }
  }

  if (req.user && req.user.role === "Regional Officer" && req.user.region) {
    if (!institution.region.toLowerCase().includes(req.user.region.toLowerCase())) {
      return res.status(403).json({ error: "Access Denied: You do not have jurisdiction over institutions in this region." });
    }
  }

  const documents = store.getDocuments({ institutionId: institution.id });
  return res.json(documents);
});

// Register new institution (Admin, RB Officer, PGRC Officer)
institutionsRouter.post(
  "/",
  requireAuth,
  requireRole("BUREAU_HEAD", "COMPETENT_AUTHORITY", "Regulation Bureau Officer", "PGRC Officer"),
  (req: AuthenticatedRequest, res: Response) => {
    const {
      aictePermanentId,
      name,
      institutionType,
      address,
      city,
      state,
      region,
      pincode,
      contactEmail,
      contactPhone,
      accreditationStatus,
      yearEstablished
    } = req.body;

    if (!aictePermanentId || !name || !institutionType || !address || !city || !state || !region) {
      return res.status(400).json({ error: "Mandatory institution fields missing." });
    }

    try {
      const newInst = store.createInstitution({
        aictePermanentId,
        name,
        institutionType,
        address,
        city,
        state,
        region,
        pincode: pincode || "110001",
        contactEmail: contactEmail || `registrar@${name.toLowerCase().replace(/[^a-z]/g, "")}.edu.in`,
        contactPhone: contactPhone || "+91 11 29581000",
        accreditationStatus: accreditationStatus || "AICTE Approved",
        yearEstablished: Number(yearEstablished) || 2010
      });

      return res.status(201).json(newInst);
    } catch (err: any) {
      return res.status(409).json({ error: err.message || "Failed to create institution record." });
    }
  }
);
