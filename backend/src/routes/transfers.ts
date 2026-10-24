import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";

export const transfersRouter = Router();

// Get transfer history
transfersRouter.get("/", (_req, res: Response) => {
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

      return res.status(201).json(transfer);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Failed to process case transfer." });
    }
  }
);
