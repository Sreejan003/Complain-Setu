import { randomUUID } from "node:crypto";
import { roleOf, authorize, requestScope, effectiveProfile, mayRead } from "../security/rbac.js";
import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { computeInProcessCosineSimilarity, querySemanticService, extractKeywords } from "../services/overlapEngine.js";
import { broadcastCaseEvent } from "./complaints.js";
import { compareTexts } from "../services/similarityProvider.js";

export function scopedOverlap(alert: any) {
  if(!alert)return {canDecide:false,canCoordinate:false};
  const safe = {...alert};
  if (!store.getComplaintById(alert.complaintIdA)) {safe.complaintTitleA="Restricted related case";safe.complaintDescA="";}
  if (!store.getComplaintById(alert.complaintIdB)) {safe.complaintTitleB="Restricted related case";safe.complaintDescB="";}
  if (!store.getComplaintById(alert.complaintIdA) || !store.getComplaintById(alert.complaintIdB)) {safe.explanation=undefined; safe.assessment=undefined; safe.matchReasons=["Potential institution overlap across authorized bureaus"];}
  const complaint=store.getComplaintById(alert.complaintIdA)||store.getComplaintById(alert.complaintIdB);
  const user=requestScope.getStore();
  safe.canDecide=!!user&&!!complaint&&authorize(user,"overlap.decide",complaint,{region:store.getComplaintRegion(complaint)});
  safe.canCoordinate=!!user&&!!complaint&&(safe.canDecide||authorize(user,"case.request",complaint,{region:store.getComplaintRegion(complaint)}));
  return safe;
}
export const overlapsRouter = Router();
overlapsRouter.use(requireAuth, (req: AuthenticatedRequest, res, next) => {
  if (["SYSTEM_ADMIN","Institutional User"].includes(roleOf(req.user!.role))) return res.status(403).json({error:"Overlap access denied."});
  const id = req.path.split("/")[1];
  if (id && id !== "compare-live" && !store.getOverlapAlertById(id)) return res.status(404).json({error:"Overlap not found in authorized scope."});
  if(req.path.endsWith("/review") && !scopedOverlap(store.getOverlapAlertById(id)).canDecide) return res.status(403).json({error:"Overlap decision is not authorized in this scope."});
  next();
});
overlapsRouter.get("/:id/coordination", (req,res)=>res.json(store.getCoordinationHistory(req.params.id)));
overlapsRouter.get("/:id/feedback", (req, res) => {
  const alert = store.getOverlapAlertById(req.params.id)!;
  if (!store.getComplaintById(alert.complaintIdA) || !store.getComplaintById(alert.complaintIdB)) return res.json([]);
  return res.json(store.getOverlapFeedback(alert.id));
});
overlapsRouter.post("/:id/coordination", (req: AuthenticatedRequest, res) => {
  const alert = store.getOverlapAlertById(req.params.id)!;
  if(!scopedOverlap(alert).canCoordinate) return res.status(403).json({error:"Coordination action is not authorized."});
  if (typeof req.body.remarks !== "string" || !req.body.remarks.trim() || req.body.remarks.length>5000) return res.status(400).json({error:"Coordination remarks required."});
  const {responsibleOfficerId,state="Requested"} = req.body;
  if (!["Requested","In Progress","Resolved"].includes(state)) return res.status(400).json({error:"Invalid coordination state."});
  const storedOfficer=responsibleOfficerId ? store.getProfileById(responsibleOfficerId) : undefined;
  const officer=storedOfficer?effectiveProfile(storedOfficer):undefined;
  const scopedCase=store.getComplaintById(alert.complaintIdA)||store.getComplaintById(alert.complaintIdB);
  if ((responsibleOfficerId || state!=="Requested") && !scopedOverlap(alert).canDecide) return res.status(403).json({error:"Coordination decision permission required."});
  if (responsibleOfficerId && (!officer?.isActive || !["CASE_OFFICER","BUREAU_HEAD","COMPETENT_AUTHORITY"].includes(officer.role) || (officer.region && scopedCase && officer.region!==store.getComplaintRegion(scopedCase)) || (req.user!.region && officer.region!==req.user!.region) || !officer.bureauId || ![alert.bureauA,alert.bureauB].includes(officer.bureauId) || (req.user!.role==="BUREAU_HEAD" && officer.bureauId!==req.user!.bureauId))) return res.status(400).json({error:"Responsible officer must belong to an authorized involved bureau."});
  store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"COORDINATION_"+state.toUpperCase().replace(" ","_"),entityType:"OverlapAlert",entityId:alert.id,details:{remarks:req.body.remarks.trim(),state,bureauId:req.user!.bureauId,responsibleOfficerId,responsibleOfficerName:officer?.fullName}});
  store.getProfiles().filter(p=>p.isActive && scopedCase && mayRead(p,scopedCase,store.getComplaintRegion(scopedCase)) && ["COMPETENT_AUTHORITY","BUREAU_HEAD"].includes(roleOf(p.role))).forEach(p=>store.addNotification({id:randomUUID(),recipientId:p.id,title:"Overlap coordination request",message:"An authorized overlap coordination record requires review.",notificationType:"Overlap Alert",referenceId:alert.id,referenceType:"overlap",isRead:false,createdAt:new Date().toISOString()}));
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
    const { decision, remarks, linkAsRelated, requestId, expectedUpdatedAt } = req.body;

    if (typeof decision !== "string" || typeof remarks !== "string" || remarks.trim().length < 5 || remarks.length > 5000 || linkAsRelated !== undefined && typeof linkAsRelated !== "boolean" || requestId !== undefined && (typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) || expectedUpdatedAt !== undefined && typeof expectedUpdatedAt !== "string") {
      return res.status(400).json({ error: "Review decision and administrative remarks are required." });
    }

    const validDecisions = ["Confirmed Related", "Confirmed Duplicate", "Marked Unrelated", "Dismissed", "Resolved"] as const;
    const reviewedDecision = validDecisions.find(value => value === decision);
    if (!reviewedDecision) {
      return res.status(400).json({ error: `Invalid review decision. Must be one of: ${validDecisions.join(", ")}` });
    }

    try {
      const reviewed = store.reviewOverlapAlert(
        req.params.id,
        {
          decision: reviewedDecision,
          remarks,
          linkAsRelated, requestId, expectedUpdatedAt
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
  if (typeof textA !== "string" || typeof textB !== "string" || !textA.trim() || !textB.trim() || textA.length > 20000 || textB.length > 20000) {
    return res.status(400).json({ error: "Both textA and textB are required." });
  }

  const kwA = extractKeywords(textA);
  const kwB = extractKeywords(textB);
  const commonKeywords = kwA.filter(k => kwB.includes(k));

  // This ad-hoc tool has no source-case classification; use local processing only.
  const result = await compareTexts(textA, textB, false);

  return res.json({
    semanticScore: result.score,
    engine: result.engine,
    mode: result.mode, model: result.model, revision: result.revision, preprocessingVersion: result.preprocessingVersion, limitation: result.limitation,
    commonKeywords,
    keywordOverlapCount: commonKeywords.length
  });
});
