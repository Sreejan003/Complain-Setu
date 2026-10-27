import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { broadcastCaseEvent } from "./complaints.js";

export const transfersRouter = Router();

// Get transfer history (Authenticated)
transfersRouter.get("/", requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const transfers = store.getTransfers();
  return res.json(transfers);
});

// Initiate case transfer
transfersRouter.post(
  "/",
  requireAuth,
  requireRole("Administrator", "Regulation Bureau Officer", "PGRC Officer", "Regional Officer"),
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
