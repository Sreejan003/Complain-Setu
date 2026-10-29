import { STATUS_TRANSITIONS, COMPLAINT_CATEGORIES, PRIORITIES, DEFAULT_ESCALATION_CONFIG } from "../config/constants.js";
import { roleOf, authorize, caseCapabilities, effectiveProfile, requestScope } from "../security/rbac.js";
import {coordinationAccess} from "../security/coordination.js";
import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest, canAccessComplaint, canMutateComplaint } from "../middleware/auth.js";
import { detectOverlapsForComplaint } from "../services/overlapEngine.js";
import { afterPersistence, LiveEvent, onPersistenceRollback, onPersistenceCommit } from "../db/unitOfWork.js";

const validDate = (value: unknown) => typeof value==="string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
export const complaintsRouter = Router();
complaintsRouter.use(requireAuth, (req: AuthenticatedRequest, res, next) => {
  if (req.path.startsWith("/stream")) return next();
  const role = roleOf(req.user!.role);
  if (role === "SYSTEM_ADMIN") return res.status(403).json({error:"System administration does not grant complaint access."});
  let id: string;
  try { id = decodeURIComponent(req.path.split("/")[1] || ""); } catch { return res.status(404).json({error:"Complaint not found in authorized scope."}); }
  if (id && !["stream", "check-overlap"].includes(id) && !store.getComplaintById(id)) return res.status(404).json({error:"Complaint not found in authorized scope."});
  if (req.method === "PATCH" && req.path.endsWith("/status")) {
    const complaint=store.getComplaintById(id)!;
    const context={region:store.getComplaintRegion(complaint),proposedStatus:req.body.status};
    const status=req.body.status;
    if(complaint.status==="Disposed" && status!=="Under Process") return res.status(403).json({error:"Closed cases require an explicit authorized reopening."});
    const action=complaint.status==="Disposed" ? "case.reopen" : status==="Disposed" ? "case.dispose" : status==="Escalated" ? "case.escalate" : "case.update";
    if (!authorize(req.user!,action,complaint,context)) return res.status(403).json({error:"This case action is not authorized."});
    if (status==="Transferred") return res.status(400).json({error:"Use the recorded transfer workflow."});
    if (req.body.assignedOfficerId!==undefined) {
      if (!authorize(req.user!,"case.assign",complaint,context)) return res.status(403).json({error:"Officer assignment is not authorized."});
      const officer=store.getProfileById(req.body.assignedOfficerId);
      if (!officer || !eligibleOfficer(officer,complaint.currentBureauId,context.region,req.user!)) return res.status(400).json({error:"Select an active case officer eligible for this bureau and region."});
    }
  }
  if (req.method === "POST" && req.path === "/") {
    if (!store.getBureaus().some(b=>b.id===req.body.receivingBureauId)) return res.status(400).json({error:"Select a configured receiving bureau."});
    const institution = store.getInstitutionById(req.body.institutionId);
    if (!institution || (req.user!.region && institution.region!==req.user!.region)) return res.status(403).json({error:"Institution is outside your authorized scope."});
    if (role === "Institutional User" && (!req.user!.institutionId || ![institution.id,institution.aictePermanentId].includes(req.user!.institutionId) || req.body.assignedOfficerId)) return res.status(403).json({error:"Institutional intake is restricted to your own institution, without officer assignment."});
    if (!["BUREAU_HEAD","COMPETENT_AUTHORITY","Institutional User"].includes(role)) return res.status(403).json({error:"Complaint intake requires an authorized Bureau Head."});
    if (req.user!.bureauId && req.body.receivingBureauId !== req.user!.bureauId) return res.status(403).json({error:"Receiving bureau is outside your scope."});
    if (req.body.assignedOfficerId) {
      const officer = store.getProfileById(req.body.assignedOfficerId);
      if (!officer?.isActive || roleOf(officer.role) !== "CASE_OFFICER" || officer.bureauId !== req.body.receivingBureauId || (officer.region && officer.region!==institution.region) || (req.user!.role==="COMPETENT_AUTHORITY" && !req.user!.permissions?.includes("ASSIGN_OFFICERS"))) return res.status(400).json({error:"Invalid case officer assignment."});
    }
  }
  if (req.path.endsWith("/override-sla") && role !== "COMPETENT_AUTHORITY") return res.status(403).json({error:"Supervisory authority required."});
  next();
});

// Real-time Event Stream (Server-Sent Events) - Authenticated & Scoped
interface ClientConnection {
  id: string;
  res: Response;
  user: any;
}
const sseClients: ClientConnection[] = [];

export function broadcastCaseEvent(event: LiveEvent) { afterPersistence(event,()=>dispatchCaseEvent(event)); }
export function dispatchCaseEvent(event: LiveEvent) {
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      const current = store.getProfileById(client.user.id);
      const complaint = event.complaintId ? store.getCoordinationSource(event.complaintId) : undefined;
      if (!current?.isActive || (current.sessionVersion || current.updatedAt) !== (client.user.sessionVersion || client.user.updatedAt)) {client.res.end();sseClients.splice(i,1);continue;}
      if(event.type==="COORDINATION_UPDATED"){
        const session=store.getCoordinationSessions().find(s=>s.id===event.sessionId);
        if(!session||!coordinationAccess(effectiveProfile(current),session,store.getCoordinationSource(session.primaryComplaintId)).read)continue;
      }else if (!complaint || !canAccessComplaint(current, complaint)) continue;
      const payload = JSON.stringify({ ...event,
        ...("hasOverlapAlert" in event && complaint ? { hasOverlapAlert: requestScope.run(effectiveProfile(current), () => store.hasVisibleOverlap(complaint.id)) } : {}),
        timestamp: new Date().toISOString() });
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// Live real-time SSE stream endpoint
complaintsRouter.get("/stream/live", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const clientId = `${req.user!.id}-${Date.now()}`;
  const clientObj: ClientConnection = { id: clientId, res, user: req.user };
  sseClients.push(clientObj);

  res.write(`data: ${JSON.stringify({ type: "CONNECTED", message: "AICTE Real-Time Case Stream connected." })}\n\n`);

  req.on("close", () => {
    const idx = sseClients.findIndex(c => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// List complaints with multi-criteria filters
complaintsRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const {
    institutionId,
    aictePermanentId,
    search,
    bureau,
    region,
    category,
    status,
    priority,
    assignedOfficerId,
    isOverdue,
    isDueSoon,
    hasOverlap,
    receivedFrom,
    receivedTo,
    lastActionFrom,
    lastActionTo,
    page,
    limit,
    sortBy,
    sortOrder
  } = req.query;

  // Institutional User scope: strictly locked to their own institution
  let effectiveInstitutionId = institutionId as string;
  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    effectiveInstitutionId = req.user.institutionId;
  }

  // Regional Officer scope isolation: restrict to their own region unless admin/senior management
  let effectiveRegion = region as string;
  if (req.user && req.user.role === "Regional Officer" && req.user.region) {
    effectiveRegion = req.user.region;
  }

  const effectiveAssignedOfficerId = assignedOfficerId as string;
  const results = store.getComplaints({
    institutionId: effectiveInstitutionId,
    aictePermanentId: aictePermanentId as string,
    search: search as string,
    bureau: bureau as string,
    region: effectiveRegion,
    category: category as string,
    status: status as string,
    priority: priority as string,
    assignedOfficerId: effectiveAssignedOfficerId,
    isOverdue: isOverdue === "true",
    isDueSoon: isDueSoon === "true",
    hasOverlap: hasOverlap !== undefined ? hasOverlap === "true" : undefined,
    receivedFrom: receivedFrom as string,
    receivedTo: receivedTo as string,
    lastActionFrom: lastActionFrom as string,
    lastActionTo: lastActionTo as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    sortBy: sortBy as string,
    sortOrder: sortOrder as "asc" | "desc"
  });

  if(typeof search==="string"&&search.trim())store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"CASE_SEARCH_PERFORMED",entityType:"CaseSearch",entityId:"complaint-register",details:{returned:results.data.length}});
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
  const detectionResult = await detectOverlapsForComplaint(mockComplaint, institution, existingCases, store.getOverlapSettings());

  return res.json(detectionResult);
});

// Get complaint details
complaintsRouter.get("/:id", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const complaint = store.getComplaintById(req.params.id);
  if (!complaint) {
    return res.status(404).json({ error: "Complaint record not found." });
  }

  // Institutional User access boundary
  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    if (complaint.institutionId !== req.user.institutionId && complaint.aictePermanentId !== req.user.institutionId) {
      return res.status(403).json({ error: "Access Denied: You cannot view complaints filed against other institutions." });
    }
  }

  const institution = store.getInstitutionById(complaint.institutionId);
  if (req.user && req.user.role === "Regional Officer" && req.user.region && institution) {
    if (!institution.region.toLowerCase().includes(req.user.region.toLowerCase())) {
      return res.status(403).json({ error: "Access Denied: You do not have jurisdiction over cases in this region." });
    }
  }

  const history = store.getCaseHistory(complaint.id);
  const relatedCases = store.getRelatedCases(complaint.id);
  const overlapAlerts = store.getOverlapAlerts({}).data.filter(
    o => o.complaintIdA === complaint.id || o.complaintIdB === complaint.id
  );

  store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"CASE_VIEWED",entityType:"Complaint",entityId:complaint.id,details:{confidentiality:complaint.security?.level||"internal"}});

  return res.json({
    complaint,
    allowedActions: {...caseCapabilities(req.user!,complaint,store.getComplaintRegion(complaint)),approachingDeadlineDays:store.getSlaSettings()?.approachingDeadlineDays || DEFAULT_ESCALATION_CONFIG.approachingDeadlineDays},
    permittedStatuses: caseCapabilities(req.user!,complaint,store.getComplaintRegion(complaint)).permittedStatuses,
    history,
    relatedCases,
    overlapAlerts: overlapAlerts.map(o => ({...o,complaintDescA:store.getComplaintById(o.complaintIdA)?o.complaintDescA:"",complaintDescB:store.getComplaintById(o.complaintIdB)?o.complaintDescB:"",explanation:undefined}))
  });
});

// Get complaint history timeline
complaintsRouter.get("/:id/history", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const complaint = store.getComplaintById(req.params.id);
  if (!complaint) {
    return res.status(404).json({ error: "Complaint record not found." });
  }

  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    if (complaint.institutionId !== req.user.institutionId && complaint.aictePermanentId !== req.user.institutionId) {
      return res.status(403).json({ error: "Access Denied: You cannot view case history for other institutions." });
    }
  }

  const history = store.getCaseHistory(complaint.id);
  return res.json(history);
});

// Get related cases
complaintsRouter.get("/:id/related", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const complaint = store.getComplaintById(req.params.id);
  if (!complaint) {
    return res.status(404).json({ error: "Complaint record not found." });
  }

  if (req.user && req.user.role === "Institutional User" && req.user.institutionId) {
    if (complaint.institutionId !== req.user.institutionId && complaint.aictePermanentId !== req.user.institutionId) {
      return res.status(403).json({ error: "Access Denied: You cannot view related cases for other institutions." });
    }
  }

  const related = store.getRelatedCases(complaint.id);
  return res.json(related);
});

function eligibleOfficer(profile: any, bureau: string, region: string | undefined, actor: any) {
  const officer=effectiveProfile(profile);
  return officer.isActive && officer.role==="CASE_OFFICER" && officer.bureauId===bureau && (!officer.region || officer.region===region) && (!actor.region || officer.region===actor.region);
}
complaintsRouter.get("/:id/eligible-officers", (req: AuthenticatedRequest,res)=>{
  const complaint=store.getComplaintById(req.params.id)!;
  if (!authorize(req.user!,"case.assign",complaint,{region:store.getComplaintRegion(complaint)})) return res.status(403).json({error:"Assignment lookup not authorized."});
  const search=String(req.query.search||"").toLowerCase();
  return res.json(store.getProfiles().filter(p=>eligibleOfficer(p,complaint.currentBureauId,store.getComplaintRegion(complaint),req.user!)).filter(p=>p.fullName.toLowerCase().includes(search)).map(p=>({id:p.id,fullName:p.fullName,bureauId:effectiveProfile(p).bureauId,region:p.region,activeCases:store.getScopedComplaints().filter(c=>c.assignedOfficerId===p.id&&c.status!=="Disposed").length})));
});
complaintsRouter.get("/:id/requests", (req: AuthenticatedRequest,res)=>res.json(store.getWorkflowRequests().filter(r=>r.complaintId===req.params.id).map(r=>({...r,canReview:store.canReviewRequest(req.user!,r),canApprove:store.canApproveRequest(req.user!,r)}))));
complaintsRouter.post("/:id/requests", (req: AuthenticatedRequest,res)=>{
  try {return res.status(201).json(store.submitWorkflowRequest(req.params.id,req.body,req.user!));}
  catch(error:any){return res.status(error.status||400).json({error:error.message});}
});
complaintsRouter.patch("/:id/requests/:requestId/decision", (req: AuthenticatedRequest,res)=>{
  try {return res.json(store.decideWorkflowRequest(req.params.id,req.params.requestId,req.body,req.user!));}
  catch(error:any){return res.status(error.status||400).json({error:error.message});}
});

// Register new complaint
complaintsRouter.post(
  "/",
  requireAuth,
  requireRole("Institutional User", "BUREAU_HEAD", "COMPETENT_AUTHORITY", "Regulation Bureau Officer", "PGRC Officer", "Regional Officer"),
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

    if (!institutionId || !category || typeof title!=="string" || !title.trim() || typeof description!=="string" || !description.trim() || !receivingBureauId || !PRIORITIES.includes(priority) || !COMPLAINT_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "All mandatory complaint registration fields must be filled." });
    }

    if(expectedDisposalDate!==undefined && !validDate(expectedDisposalDate)) return res.status(400).json({error:"Expected disposal date must be a valid calendar date."});
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

      // Broadcast live SSE event
      broadcastCaseEvent({
        type: "CASE_REGISTERED",
        complaintId: result.complaint.id,
        complaintRef: result.complaint.complaintId,
        institutionId: result.complaint.institutionId,
        hasOverlapAlert: result.complaint.hasOverlapAlert
      });

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Failed to register complaint." });
    }
  }
);

// Update complaint status / assignment / remarks with concurrency check
complaintsRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("BUREAU_HEAD", "COMPETENT_AUTHORITY", "Regulation Bureau Officer", "PGRC Officer", "Bureau Officer", "Regional Officer", "Competent Authority"),
  (req: AuthenticatedRequest, res: Response) => {
    const { status, priority, assignedOfficerId, remarks, disposalRemarks, lastKnownUpdatedAt, nextAction, nextActionDate } = req.body;

    if ((nextAction !== undefined && (typeof nextAction !== "string" || nextAction.length>2000)) || (nextActionDate && (typeof nextActionDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(nextActionDate) || !Number.isFinite(Date.parse(nextActionDate)) || new Date(nextActionDate).toISOString().slice(0,10)!==nextActionDate))) return res.status(400).json({error:"Invalid next action or action date."});
    if (priority && !["Low","Medium","High","Critical"].includes(priority)) return res.status(400).json({error:"Invalid priority."});
    if (!remarks || typeof remarks !== "string" || remarks.trim().length === 0) {
      return res.status(400).json({ error: "Officer action remarks are mandatory for audit compliance." });
    }

    const complaint = store.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found." });
    }

    // Optimistic Concurrency Control: Prevent simultaneous edits from silently overwriting each other
    if (lastKnownUpdatedAt && complaint.updatedAt !== lastKnownUpdatedAt) {
      return res.status(409).json({
        error: "Conflict: This complaint was modified concurrently by another officer. Please reload and review the latest case record.",
        currentUpdatedAt: complaint.updatedAt
      });
    }

    const institution = store.getInstitutionById(complaint.institutionId);
    const mutationPerm = canMutateComplaint(req.user!, complaint, institution?.region);
    if (!mutationPerm.allowed && !(req.body.status && authorize(req.user!,"case.reopen",complaint,{region:institution?.region}))) {
      return res.status(403).json({ error: mutationPerm.reason || "Access Denied: You do not have permission to modify this complaint." });
    }

    try {
      const updated = store.updateComplaintStatus(
        req.params.id,
        {
          status,
          priority,
          assignedOfficerId,
          remarks,
          disposalRemarks, nextAction, nextActionDate
        },
        req.user!
      );

      // Broadcast real-time mutation event
      broadcastCaseEvent({
        type: "CASE_UPDATED",
        complaintId: updated.id,
        complaintRef: updated.complaintId,
        institutionId: updated.institutionId,
        status: updated.status,
        updatedAt: updated.updatedAt
      });

      return res.json(updated);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Failed to update complaint status." });
    }
  }
);

// Authorized Statutory SLA Deadline Override (Administrator & Senior Management only)
complaintsRouter.post(
  "/:id/override-sla",
  requireAuth,
  requireRole("BUREAU_HEAD", "COMPETENT_AUTHORITY", "Senior Management"),
  (req: AuthenticatedRequest, res: Response) => {
    const { newDeadline, overrideReason } = req.body;

    if (!validDate(newDeadline)) {
      return res.status(400).json({ error: "A valid statutory deadline in YYYY-MM-DD format is required." });
    }

    if (!overrideReason || typeof overrideReason !== "string" || overrideReason.trim().length < 5) {
      return res.status(400).json({ error: "A mandatory justification (minimum 5 characters) is required for SLA override." });
    }

    const complaint = store.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found." });
    }

    try {
      const updated = store.overrideSlaDeadline(complaint.id, newDeadline, overrideReason.trim(), req.user!);

      broadcastCaseEvent({
        type: "SLA_OVERRIDDEN",
        complaintId: updated.id,
        complaintRef: updated.complaintId,
        institutionId: updated.institutionId,
        newDeadline
      });

      return res.json(updated);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Failed to override SLA deadline." });
    }
  }
);

// ====================================================================
// SUPPORTING DOCUMENTS ROUTES
// ====================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = process.env.DATA_DIR ? path.join(process.env.DATA_DIR,"uploads") : path.resolve(__dirname, "../../uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const sanitized = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${Date.now()}-${sanitized}${ext}`);
  }
});

const allowedMimes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip"
];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed formats: PDF, PNG, JPG, DOC, DOCX, ZIP"));
    }
  }
});

// List documents for a complaint
complaintsRouter.get("/:id/documents", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const complaint = store.getComplaintById(req.params.id);
  if (!complaint) {
    return res.status(404).json({ error: "Complaint not found." });
  }

  if (!canAccessComplaint(req.user!, complaint)) {
    return res.status(403).json({ error: "Access Denied: You do not have permission to view documents for this complaint." });
  }

  const documents = store.getDocuments({ complaintId: complaint.id });
  return res.json(documents);
});

// Download document securely (Authenticated & jurisdiction checked)
complaintsRouter.get(
  "/:id/documents/:docId/download",
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const complaint = store.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found." });
    }

    if (!canAccessComplaint(req.user!, complaint)) {
      return res.status(403).json({ error: "Access Denied: You do not have permission to download documents for this complaint." });
    }

    const doc = store.getDocumentById(req.params.docId);
    if (!doc || doc.complaintId !== complaint.id) {
      return res.status(404).json({ error: "Document not found on this complaint." });
    }

    const filePath = path.join(UPLOAD_DIR, path.basename(doc.fileName));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Document file not found on storage." });
    }

    store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"EVIDENCE_DOWNLOAD_AUTHORIZED",entityType:"Complaint",entityId:complaint.id,details:{documentId:doc.id}});
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    return fs.createReadStream(filePath).pipe(res);
  }
);

// Upload document for a complaint
complaintsRouter.post(
  "/:id/documents",
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const complaint = store.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found." });
    }

    if (!authorize(req.user!, "evidence.upload", complaint, {region:store.getComplaintRegion(complaint)})) {
      return res.status(403).json({ error: "Access Denied: You do not have permission to attach documents to this complaint." });
    }

    upload.single("file")(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || "File upload failed." });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file was provided in the upload request." });
      }

      const documentType = req.body.documentType || "Complaint Evidence";
      const newUploadPath = path.join(UPLOAD_DIR,path.basename(req.file.filename));
      onPersistenceRollback(()=>{if(fs.existsSync(newUploadPath))fs.unlinkSync(newUploadPath);});
      const docId = uuidv4();

      const newDoc = store.addDocument({
        id: docId,
        complaintId: complaint.id,
        institutionId: complaint.institutionId,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        fileUrl: `/api/complaints/${complaint.id}/documents/${docId}/download`,
        documentType,
        uploadedBy: req.user!.id,
        uploadedByName: req.user!.fullName,
        uploadedAt: new Date().toISOString()
      });

      // Record in Case History
      store.addCaseHistory({
        id: uuidv4(),
        complaintId: complaint.id,
        actionType: "Document Uploaded",
        remarks: `Attached ${documentType}: "${req.file.originalname}" (${Math.round(req.file.size / 1024)} KB)`,
        performedBy: req.user!.id,
        performedByName: req.user!.fullName,
        createdAt: new Date().toISOString()
      });

      return res.status(201).json(newDoc);
    });
  }
);

// Delete a document from a complaint
complaintsRouter.delete(
  "/:id/documents/:docId",
  requireAuth,
  requireRole("BUREAU_HEAD", "COMPETENT_AUTHORITY", "Regulation Bureau Officer", "PGRC Officer", "Bureau Officer", "Regional Officer", "Competent Authority"),
  (req: AuthenticatedRequest, res: Response) => {
    const complaint = store.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found." });
    }

    const mutationPerm = canMutateComplaint(req.user!, complaint);
    if (!mutationPerm.allowed) {
      return res.status(403).json({ error: mutationPerm.reason || "Access Denied: You do not have permission to delete documents from this complaint." });
    }

    const doc = store.getDocumentById(req.params.docId);
    if (!doc || doc.complaintId !== complaint.id) {
      return res.status(404).json({ error: "Document not found on this complaint." });
    }

    const deleted = store.deleteDocument(doc.id);
    if (deleted) {
      // Remove file from disk if present
      const filePath = path.join(UPLOAD_DIR, doc.fileName);
      if (fs.existsSync(filePath)) {
        try {
          onPersistenceCommit(()=>{if(fs.existsSync(filePath))fs.unlinkSync(filePath);});
        } catch (e) {
          console.warn("Failed to delete file from disk:", e);
        }
      }

      // Record in Case History
      store.addCaseHistory({
        id: uuidv4(),
        complaintId: complaint.id,
        actionType: "Document Removed",
        remarks: `Removed document: "${doc.originalName}"`,
        performedBy: req.user!.id,
        performedByName: req.user!.fullName,
        createdAt: new Date().toISOString()
      });

      return res.json({ message: "Document successfully removed." });
    }

    return res.status(400).json({ error: "Failed to delete document." });
  }
);
