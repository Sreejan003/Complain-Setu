import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";

export const institutionsRouter = Router();

// Search and list institutions (Public / Authenticated)
institutionsRouter.get("/", (req, res: Response) => {
  const { search, region, state, page, limit, sortBy, sortOrder } = req.query;

  const results = store.getInstitutions({
    search: search as string,
    region: region as string,
    state: state as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    sortBy: sortBy as string,
    sortOrder: sortOrder as "asc" | "desc"
  });

  return res.json(results);
});

// Get institution consolidated profile by ID or Permanent ID
institutionsRouter.get("/:id", (req, res: Response) => {
  const institution = store.getInstitutionById(req.params.id);
  if (!institution) {
    return res.status(404).json({ error: "Institution not found." });
  }

  // Retrieve all complaints associated with this institution
  const complaints = store.getComplaints({ institutionId: institution.id, limit: 100 }).data;
  const overlapAlerts = store.getOverlapAlerts({ institutionId: institution.id, limit: 50 }).data;

  return res.json({
    institution,
    complaints,
    overlapAlerts
  });
});

// Register new institution (Admin, RB Officer, PGRC Officer)
institutionsRouter.post(
  "/",
  requireAuth,
  requireRole("Administrator", "Regulation Bureau Officer", "PGRC Officer"),
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
