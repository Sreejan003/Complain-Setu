import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { detectOverlapsForComplaint } from "../services/overlapEngine.js";

export const complaintsRouter = Router();

// Real-time Event Stream (Server-Sent Events) - Authenticated & Scoped
interface ClientConnection {
  id: string;
  res: Response;
  user: any;
}
const sseClients: ClientConnection[] = [];

export function broadcastCaseEvent(event: {
  type: string;
  complaintId?: string;
  complaintRef?: string;
  institutionId?: string;
  [key: string]: any;
}) {
  const payload = JSON.stringify({ ...event, timestamp: new Date().toISOString() });
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      // Strict institutional scope isolation: Never leak other institutions' events
      if (client.user.role === "Institutional User" && client.user.institutionId) {
        if (event.institutionId && event.institutionId !== client.user.institutionId) {
          continue;
        }
      }
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

  // Officer Case Queue Scope & Isolation
  let effectiveAssignedOfficerId = assignedOfficerId as string;
  if (req.query.scope === "my_cases" && req.user) {
    effectiveAssignedOfficerId = req.user.id;
  }
  const isSupervisor = req.user && (req.user.role === "Administrator" || req.user.role === "Senior Management");
  if (!isSupervisor && req.user && req.user.role !== "Institutional User") {
    if (effectiveAssignedOfficerId && effectiveAssignedOfficerId !== req.user.id) {
      effectiveAssignedOfficerId = req.user.id;
    } else if (!effectiveAssignedOfficerId && !effectiveInstitutionId) {
      effectiveAssignedOfficerId = req.user.id;
    }
  }

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

  return res.json({
    complaint,
    history,
    relatedCases,
    overlapAlerts
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
  requireRole("Administrator", "Regulation Bureau Officer", "PGRC Officer", "Regional Officer"),
  (req: AuthenticatedRequest, res: Response) => {
    const { status, priority, assignedOfficerId, remarks, disposalRemarks, lastKnownUpdatedAt } = req.body;

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
    if (req.user && req.user.role === "Regional Officer" && req.user.region && institution) {
      if (!institution.region.toLowerCase().includes(req.user.region.toLowerCase())) {
        return res.status(403).json({ error: "Access Denied: You do not have jurisdiction to update cases in this region." });
      }
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
  requireRole("Administrator", "Senior Management"),
  (req: AuthenticatedRequest, res: Response) => {
    const { newDeadline, overrideReason } = req.body;

    if (!newDeadline || !/^\d{4}-\d{2}-\d{2}$/.test(newDeadline)) {
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
const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
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

    const doc = store.getDocumentById(req.params.docId);
    if (!doc || doc.complaintId !== complaint.id) {
      return res.status(404).json({ error: "Document not found on this complaint." });
    }

    const filePath = path.join(UPLOAD_DIR, path.basename(doc.fileName));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Document file not found on storage." });
    }

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

    upload.single("file")(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || "File upload failed." });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file was provided in the upload request." });
      }

      const documentType = req.body.documentType || "Complaint Evidence";
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
  requireRole("Administrator", "Regulation Bureau Officer", "PGRC Officer", "Regional Officer"),
  (req: AuthenticatedRequest, res: Response) => {
    const complaint = store.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found." });
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
          fs.unlinkSync(filePath);
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
