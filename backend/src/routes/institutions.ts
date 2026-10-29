import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";

export const institutionsRouter = Router();
institutionsRouter.use(requireAuth, (req: AuthenticatedRequest, res, next) => {
  if (req.method !== "GET" && !["BUREAU_HEAD", "COMPETENT_AUTHORITY"].includes(req.user!.role)) return res.status(403).json({ error: "Supervisory authorization required." });
  next();
});

// Search and list institutions (Authenticated & Role-scoped)
institutionsRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { search, region, state, stateOrRegion, district, city, page, limit, sortBy, sortOrder, institutionType, complaintStatus, bureau } = req.query;

  // Institutional User scope: strictly lock to their own institution
  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    const inst = store.getInstitutionById(req.user.institutionId);
    return res.json({
      data: inst ? [inst] : [],
      pagination: { page: 1, limit: 10, total: inst ? 1 : 0, totalPages: 1 }
    });
  }

  // If no geographic filter or search query is specified, default Regional Officers to their region.
  // If an explicit region, state, stateOrRegion, or search is provided, allow directory exploration across records.
  let effectiveRegion = region as string;
  let effectiveState = state as string;
  let effectiveStateOrRegion = stateOrRegion as string;
  if (!effectiveRegion && !effectiveState && !effectiveStateOrRegion && !search && req.user && req.user.role === "Regional Officer" && req.user.region) {
    effectiveRegion = req.user.region;
  }

  const results = store.getInstitutions({
    search: search ? (search as string).trim() : undefined,
    region: effectiveRegion ? (effectiveRegion as string).trim() : undefined,
    state: effectiveState ? (effectiveState as string).trim() : undefined,
    stateOrRegion: effectiveStateOrRegion ? (effectiveStateOrRegion as string).trim() : undefined,
    district: district ? (district as string).trim() : undefined,
    city: city ? (city as string).trim() : undefined,
    institutionType: institutionType ? (institutionType as string).trim() : undefined,
    complaintStatus: complaintStatus ? (complaintStatus as string).trim() : undefined,
    bureau: bureau ? (bureau as string).trim() : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    sortBy: sortBy as string,
    sortOrder: sortOrder as "asc" | "desc"
  });

  return res.json(results);
});

// Distinct filter metadata (states, districts, cities, types, regions, stateRegionPairs)
institutionsRouter.get("/filters", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { state, district } = req.query;
  const filters = store.getInstitutionFilters({
    state: state as string,
    district: district as string
  });
  return res.json(filters);
});

// Autocomplete and quick search (Name / Permanent ID / State / Region)
institutionsRouter.get("/search", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { q, limit, state, region, stateOrRegion } = req.query;
  const filterScope = (stateOrRegion || state || region) as string | undefined;
  const matches = store.searchInstitutions((q as string) || "", limit ? Number(limit) : 20, filterScope);
  return res.json(matches);
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
  const first = store.getComplaints({ institutionId: institution.id, limit: 100 });
  const allCases = [...first.data];
  for (let page = 2; page <= first.pagination.totalPages; page++)allCases.push(...store.getComplaints({ institutionId: institution.id, limit: 100, page }).data);
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

  const overview = store.getInstitutionOverview(institution.id)!;
  return res.json({
    institution: overview.institution,
    bureauInvolvement: overview.bureauInvolvement,
    coordination: overview.coordination,
    visibility: overview.visibility,
    kpis: {
      ...overview.kpis,
      overdueCount: overdueCases.length,
      highPriorityCount: highPriorityCases.length
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

// Dedicated complaints endpoint for an institution
institutionsRouter.get("/:id/complaints", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const institution = store.getInstitutionById(req.params.id);
  if (!institution) {
    return res.status(404).json({ error: "Institution not found." });
  }

  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    if (institution.id !== req.user.institutionId && institution.aictePermanentId !== req.user.institutionId) {
      return res.status(403).json({ error: "Access Denied: You do not have permission to access another institution's complaints." });
    }
  }

  if (req.user && req.user.role === "Regional Officer" && req.user.region) {
    if (!institution.region.toLowerCase().includes(req.user.region.toLowerCase())) {
      return res.status(403).json({ error: "Access Denied: You do not have jurisdiction over institutions in this region." });
    }
  }

  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const complaints = store.getComplaints({ institutionId: institution.id, page, limit });
  return res.json(complaints);
});

// Dedicated summary statistics endpoint for an institution
institutionsRouter.get("/:id/statistics", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const institution = store.getInstitutionById(req.params.id);
  if (!institution) {
    return res.status(404).json({ error: "Institution not found." });
  }

  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    if (institution.id !== req.user.institutionId && institution.aictePermanentId !== req.user.institutionId) {
      return res.status(403).json({ error: "Access Denied: You do not have permission to access another institution's statistics." });
    }
  }

  if (req.user && req.user.role === "Regional Officer" && req.user.region) {
    if (!institution.region.toLowerCase().includes(req.user.region.toLowerCase())) {
      return res.status(403).json({ error: "Access Denied: You do not have jurisdiction over institutions in this region." });
    }
  }

  const complaintsRes = store.getComplaints({ institutionId: institution.id, limit: 1000 });
  const allComplaints = complaintsRes.data || [];
  const statusCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  for (const c of allComplaints) {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    priorityCounts[c.priority] = (priorityCounts[c.priority] || 0) + 1;
  }
  const overlapsRes = store.getOverlapAlerts({ institutionId: institution.id, limit: 100 });

  return res.json({
    institutionId: institution.id,
    permanentId: institution.aictePermanentId,
    name: institution.name,
    totalComplaints: allComplaints.length,
    activeComplaints: allComplaints.filter(c => ["Pending", "Under Process", "Escalated"].includes(c.status)).length,
    disposedComplaints: allComplaints.filter(c => c.status === "Disposed").length,
    overlapAlertsCount: overlapsRes.pagination.total || 0,
    statusCounts,
    priorityCounts
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
