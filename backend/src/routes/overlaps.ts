import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { computeInProcessCosineSimilarity, querySemanticService, extractKeywords } from "../services/overlapEngine.js";
import { broadcastCaseEvent } from "./complaints.js";

export const overlapsRouter = Router();

// List overlap alerts (Authenticated & Scoped)
overlapsRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { bureau, alertStatus, institutionId, page, limit } = req.query;

  let effectiveInstitutionId = institutionId as string;
  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    effectiveInstitutionId = req.user.institutionId;
  }

  const results = store.getOverlapAlerts({
    bureau: bureau as string,
    alertStatus: alertStatus as string,
    institutionId: effectiveInstitutionId,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined
  });

  return res.json(results);
});

// Get single overlap alert details (Authenticated & Scoped)
overlapsRouter.get("/:id", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const alert = store.getOverlapAlertById(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: "Overlap alert record not found." });
  }

  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    if (alert.institutionId !== req.user.institutionId && alert.aictePermanentId !== req.user.institutionId) {
      return res.status(403).json({ error: "Access Denied: You cannot view overlap alerts for other institutions." });
    }
  }

  const compA = store.getComplaintById(alert.complaintIdA);
  const compB = store.getComplaintById(alert.complaintIdB);

  return res.json({
    alert,
    complaintA: compA,
    complaintB: compB
  });
});

// Officer review of overlap alert
overlapsRouter.post(
  "/:id/review",
  requireAuth,
  requireRole("Administrator", "Regulation Bureau Officer", "PGRC Officer", "Senior Management"),
  (req: AuthenticatedRequest, res: Response) => {
    const { decision, remarks, linkAsRelated } = req.body;

    if (!decision || !remarks) {
      return res.status(400).json({ error: "Review decision and administrative remarks are required." });
    }

    const validDecisions = ["Confirmed Related", "Confirmed Duplicate", "Marked Unrelated", "Dismissed", "Resolved"];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ error: `Invalid review decision. Must be one of: ${validDecisions.join(", ")}` });
    }

    try {
      const reviewed = store.reviewOverlapAlert(
        req.params.id,
        {
          decision,
          remarks,
          linkAsRelated
        },
        req.user!
      );

      broadcastCaseEvent({
        type: "OVERLAP_REVIEWED",
        alertId: reviewed.alertId,
        institutionId: reviewed.institutionId,
        decision: reviewed.alertStatus
      });

      return res.json(reviewed);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Failed to submit overlap review." });
    }
  }
);

// Dynamic live side-by-side text comparison endpoint (Authenticated)
overlapsRouter.post("/compare-live", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { textA, textB } = req.body;
  if (!textA || !textB) {
    return res.status(400).json({ error: "Both textA and textB are required." });
  }

  const kwA = extractKeywords(textA);
  const kwB = extractKeywords(textB);
  const commonKeywords = kwA.filter(k => kwB.includes(k));

  let semanticScore: number;
  let engine = "TF-IDF Fallback";

  const aiRes = await querySemanticService(textA, textB);
  if (aiRes) {
    semanticScore = aiRes.score;
    engine = aiRes.engine;
  } else {
    semanticScore = computeInProcessCosineSimilarity(textA, textB);
  }

  return res.json({
    semanticScore,
    engine,
    commonKeywords,
    keywordOverlapCount: commonKeywords.length
  });
});
