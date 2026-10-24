import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { detectOverlapsForComplaint } from "../services/overlapEngine.js";

export const complaintsRouter = Router();

// List complaints with multi-criteria filters
complaintsRouter.get("/", (req, res: Response) => {
  const {
    institutionId,
    aictePermanentId,
    search,
    bureau,
    region,
    category,
    status,
    priority,
    isOverdue,
    hasOverlap,
    page,
    limit,
    sortBy,
    sortOrder
  } = req.query;

  const results = store.getComplaints({
    institutionId: institutionId as string,
    aictePermanentId: aictePermanentId as string,
    search: search as string,
    bureau: bureau as string,
    region: region as string,
    category: category as string,
    status: status as string,
    priority: priority as string,
    isOverdue: isOverdue === "true",
    hasOverlap: hasOverlap !== undefined ? hasOverlap === "true" : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    sortBy: sortBy as string,
    sortOrder: sortOrder as "asc" | "desc"
  });

  return res.json(results);
});

// Pre-submission live overlap check
complaintsRouter.post("/check-overlap", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { institutionId, category, title, description, receivingBureauId } = req.body;

  if (!institutionId || !title || !description) {
    return res.status(400).json({ error: "Institution, title, and description are required for overlap checking." });
  }

  const institution = store.getInstitutionById(institutionId);
  if (!institution) {
    return res.status(404).json({ error: "Institution not found." });
  }

  const mockComplaint = {
    institutionId: institution.id,
    aictePermanentId: institution.aictePermanentId,
    category,
    title,
    description,
    receivingBureauId,
    currentBureauId: receivingBureauId
  };

  const existingCases = store.getComplaints({ institutionId: institution.id, limit: 100 }).data;
  const detectionResult = await detectOverlapsForComplaint(mockComplaint, institution, existingCases);

  return res.json(detectionResult);
});

// Get complaint details
complaintsRouter.get("/:id", (req, res: Response) => {
  const complaint = store.getComplaintById(req.params.id);
  if (!complaint) {
    return res.status(404).json({ error: "Complaint record not found." });
  }

  const history = store.getCaseHistory(complaint.id);
  const relatedCases = store.getRelatedCases(complaint.id);
  const overlapAlerts = store.getOverlapAlerts({}).data.filter(
    o => o.complaintIdA === complaint.id || o.complaintIdB === complaint.id
  );

  return res.json({
    complaint,
    history,
    relatedCases,
    overlapAlerts
  });
});

// Get complaint history timeline
complaintsRouter.get("/:id/history", (req, res: Response) => {
  const history = store.getCaseHistory(req.params.id);
  return res.json(history);
});

// Get related cases
complaintsRouter.get("/:id/related", (req, res: Response) => {
  const related = store.getRelatedCases(req.params.id);
  return res.json(related);
});

// Register new complaint
complaintsRouter.post(
  "/",
  requireAuth,
  requireRole("Administrator", "Regulation Bureau Officer", "PGRC Officer", "Regional Officer"),
  async (req: AuthenticatedRequest, res: Response) => {
    const {
      institutionId,
      category,
      title,
      description,
      receivingBureauId,
      assignedOfficerId,
      priority,
      expectedDisposalDate
    } = req.body;

    if (!institutionId || !category || !title || !description || !receivingBureauId || !priority) {
      return res.status(400).json({ error: "All mandatory complaint registration fields must be filled." });
    }

    try {
      const result = await store.createComplaint(
        {
          institutionId,
          category,
          title,
          description,
          receivingBureauId,
          assignedOfficerId,
          priority,
          expectedDisposalDate
        },
        req.user!
      );

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Failed to register complaint." });
    }
  }
);

// Update complaint status / assignment / remarks
complaintsRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("Administrator", "Regulation Bureau Officer", "PGRC Officer", "Regional Officer"),
  (req: AuthenticatedRequest, res: Response) => {
    const { status, priority, assignedOfficerId, remarks, disposalRemarks } = req.body;

    if (!remarks) {
      return res.status(400).json({ error: "Officer action remarks are mandatory for audit compliance." });
    }

    try {
      const updated = store.updateComplaintStatus(
        req.params.id,
        {
          status,
          priority,
          assignedOfficerId,
          remarks,
          disposalRemarks
        },
        req.user!
      );

      return res.json(updated);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Failed to update complaint status." });
    }
  }
);
