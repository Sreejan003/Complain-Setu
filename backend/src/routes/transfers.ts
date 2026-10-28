import { roleOf } from "../security/rbac.js";
import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { broadcastCaseEvent } from "./complaints.js";

export const transfersRouter = Router();
transfersRouter.use(requireAuth, (req: AuthenticatedRequest, res, next) => {
  const role = roleOf(req.user!.role);
  if (!["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"].includes(role)) return res.status(403).json({error:"Transfer access denied."});
  if (req.method !== "GET" && role === "CASE_OFFICER") return res.status(403).json({error:"Transfers require supervisory authorization."});
  if (req.method === "PATCH") {
    if (!req.user!.permissions?.includes("APPROVE_TRANSFERS")) return res.status(403).json({error:"Transfer approval has not been delegated to this account."});
    const transfer = store.getTransfers().find(t => t.id === req.path.split("/")[1]);
    if (!transfer || transfer.acceptanceStatus !== "Pending" || (role === "BUREAU_HEAD" && req.user!.bureauId !== transfer.toBureauId)) return res.status(403).json({error:"Only the receiving Bureau Head or authorized authority may respond to a pending transfer."});
  }
  next();
});

// Get transfer history (Authenticated)
transfersRouter.get("/", requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const transfers = store.getTransfers();
  return res.json(transfers);
});

// Initiate case transfer
transfersRouter.post(
  "/",
  requireAuth,
  requireRole("BUREAU_HEAD", "COMPETENT_AUTHORITY", "Regulation Bureau Officer", "PGRC Officer", "Bureau Officer", "Regional Officer", "Competent Authority"),
  (req: AuthenticatedRequest, res: Response) => {
    const { complaintId, toBureauId, toOfficerId, transferReason } = req.body;

    if (!complaintId || !toBureauId || !transferReason) {
      return res.status(400).json({ error: "Complaint ID, destination bureau, and reason are required." });
    }

    const complaint = store.getComplaintById(complaintId);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint record not found." });
    }

    if (req.user && req.user.role === "Regulation Bureau Officer" && complaint.currentBureauId !== "RB") {
      return res.status(403).json({ error: "Access Denied: You can only transfer cases currently in the Regulation Bureau." });
    }

    if (req.user && req.user.role === "PGRC Officer" && complaint.currentBureauId !== "PGRC") {
      return res.status(403).json({ error: "Access Denied: You can only transfer cases currently in PGRC." });
    }

    try {
      const transfer = store.transferCase(
        complaintId,
        {
          toBureauId,
          toOfficerId,
          transferReason
        },
        req.user!
      );

      broadcastCaseEvent({
        type: "CASE_TRANSFERRED",
        complaintId: transfer.complaintId,
        complaintRef: transfer.complaintRefId,
        fromBureau: transfer.fromBureauId,
        toBureau: transfer.toBureauId
      });

      return res.status(201).json(transfer);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Failed to process case transfer." });
    }
  }
);

// Accept or reject incoming case transfer (Recipient bureau / Administrator / Competent Authority)
transfersRouter.patch(
  "/:id/respond",
  requireAuth,
  requireRole("BUREAU_HEAD", "COMPETENT_AUTHORITY", "Regulation Bureau Officer", "PGRC Officer", "Bureau Officer", "Regional Officer", "Competent Authority"),
  (req: AuthenticatedRequest, res: Response) => {
    const { action, remarks } = req.body;
    if (!action || !["Accepted", "Rejected"].includes(action)) {
      return res.status(400).json({ error: "Action must be either 'Accepted' or 'Rejected'." });
    }
    if (!remarks || typeof remarks !== "string" || remarks.trim().length === 0) {
      return res.status(400).json({ error: "Administrative remarks are required for transfer adjudication." });
    }

    try {
      const updated = store.respondToTransfer(req.params.id, action, remarks.trim(), req.user!);
      broadcastCaseEvent({
        type: action === "Accepted" ? "TRANSFER_ACCEPTED" : "TRANSFER_REJECTED",
        transferId: updated.id,
        complaintId: updated.complaintId,
        complaintRef: updated.complaintRefId,
        fromBureau: updated.fromBureauId,
        toBureau: updated.toBureauId
      });
      return res.json(updated);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Failed to process transfer response." });
    }
  }
);
