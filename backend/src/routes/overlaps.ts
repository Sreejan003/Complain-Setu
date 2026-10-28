import { randomUUID } from "node:crypto";
import { roleOf } from "../security/rbac.js";
import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { computeInProcessCosineSimilarity, querySemanticService, extractKeywords } from "../services/overlapEngine.js";
import { broadcastCaseEvent } from "./complaints.js";

export function scopedOverlap(alert: any) {
  const safe = {...alert};
  if (!store.getComplaintById(alert.complaintIdA)) {safe.complaintTitleA="Restricted related case";safe.complaintDescA="";}
  if (!store.getComplaintById(alert.complaintIdB)) {safe.complaintTitleB="Restricted related case";safe.complaintDescB="";}
  if (!store.getComplaintById(alert.complaintIdA) || !store.getComplaintById(alert.complaintIdB)) {safe.explanation=undefined; safe.matchReasons=["Potential institution overlap across authorized bureaus"];}
  return safe;
}
export const overlapsRouter = Router();
overlapsRouter.use(requireAuth, (req: AuthenticatedRequest, res, next) => {
  if (["SYSTEM_ADMIN","Institutional User"].includes(roleOf(req.user!.role))) return res.status(403).json({error:"Overlap access denied."});
  const id = req.path.split("/")[1];
  if (id && id !== "compare-live" && !store.getOverlapAlertById(id)) return res.status(404).json({error:"Overlap not found in authorized scope."});
  if (req.path.endsWith("/review") && roleOf(req.user!.role) === "BUREAU_HEAD" && !req.user!.permissions?.includes("COORDINATE_CROSS_BUREAU")) return res.status(403).json({error:"Cross-Bureau coordination has not been delegated."});
  if (req.path.endsWith("/review") && roleOf(req.user!.role) === "CASE_OFFICER") return res.status(403).json({error:"Submit coordination remarks for supervisory review."});
  next();
});
overlapsRouter.get("/:id/coordination", (req,res)=>res.json(store.getCoordinationHistory(req.params.id)));
overlapsRouter.post("/:id/coordination", (req: AuthenticatedRequest, res) => {
  const alert = store.getOverlapAlertById(req.params.id)!;
  if (typeof req.body.remarks !== "string" || !req.body.remarks.trim()) return res.status(400).json({error:"Coordination remarks required."});
  const {responsibleOfficerId,state="Requested"} = req.body;
  if (!["Requested","In Progress","Resolved"].includes(state)) return res.status(400).json({error:"Invalid coordination state."});
  const officer = responsibleOfficerId ? store.getProfileById(responsibleOfficerId) : undefined;
  if ((responsibleOfficerId || state!=="Requested") && !(req.user!.role==="COMPETENT_AUTHORITY" || (req.user!.role==="BUREAU_HEAD" && req.user!.permissions?.includes("COORDINATE_CROSS_BUREAU")))) return res.status(403).json({error:"Coordination decision permission required."});
  if (responsibleOfficerId && (!officer?.isActive || !officer.bureauId || ![alert.bureauA,alert.bureauB].includes(officer.bureauId) || (req.user!.role==="BUREAU_HEAD" && officer.bureauId!==req.user!.bureauId))) return res.status(400).json({error:"Responsible officer must belong to an authorized involved bureau."});
  store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"COORDINATION_"+state.toUpperCase().replace(" ","_"),entityType:"OverlapAlert",entityId:alert.id,details:{remarks:req.body.remarks.trim(),state,responsibleOfficerId,responsibleOfficerName:officer?.fullName}});
  store.getProfiles().filter(p=>p.isActive && (p.role==="COMPETENT_AUTHORITY" || (p.role==="BUREAU_HEAD" && !!p.bureauId && [alert.bureauA,alert.bureauB].includes(p.bureauId)))).forEach(p=>store.addNotification({id:randomUUID(),recipientId:p.id,title:"Overlap coordination request",message:req.body.remarks.trim(),notificationType:"Overlap Alert",referenceId:alert.id,referenceType:"overlap",isRead:false,createdAt:new Date().toISOString()}));
  return res.json({success:true});
});

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

  return res.json({...results,data:results.data.map(scopedOverlap)});
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
    alert: scopedOverlap(alert),
    complaintA: compA,
    complaintB: compB
  });
});

// Officer review of overlap alert
overlapsRouter.post(
  "/:id/review",
  requireAuth,
  requireRole("BUREAU_HEAD", "COMPETENT_AUTHORITY", "Regulation Bureau Officer", "PGRC Officer", "Bureau Officer", "Regional Officer", "Senior Management", "Competent Authority"),
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

      return res.json(scopedOverlap(reviewed));
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
