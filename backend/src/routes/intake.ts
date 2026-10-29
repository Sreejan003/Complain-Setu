import { Router, type Response, type NextFunction } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { intakeService, IntakeError } from "../services/intake.js";
import { COMPLAINT_CATEGORIES, PRIORITIES } from "../config/constants.js";
import { store } from "../db/store.js";
import { broadcastCaseEvent } from "./complaints.js";

export const intakeRouter = Router();
intakeRouter.use(requireAuth);
const route = (operation: (req: AuthenticatedRequest) => unknown, status = 200) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.status(status).json(await operation(req)); }
  catch (error) { if (error instanceof IntakeError) res.status(error.status).json({ error: "Intake request could not be completed. Review the fields or refresh your access.", code: error.code }); else next(error); }
};
intakeRouter.get("/configuration", route(req => ({ ...intakeService.configuration(req.user!), categories: COMPLAINT_CATEGORIES, priorities: PRIORITIES, bureaus: store.getBureaus().filter(bureau => !req.user!.bureauId || bureau.id === req.user!.bureauId) })));
intakeRouter.get("/configuration/history", route(req => intakeService.configurationHistory(req.user!)));
intakeRouter.put("/configuration", route(req => intakeService.updateConfiguration(req.user!, req.body)));
intakeRouter.post("/institutions/resolve", route(req => intakeService.candidates(req.user!, req.body)));
intakeRouter.put("/institutions/:id/matching", route(req => intakeService.saveMatching(req.user!, req.params.id, req.body)));
intakeRouter.get("/", route(req => intakeService.list(req.user!)));
intakeRouter.post("/", route(req => intakeService.create(req.user!, req.body), 201));
intakeRouter.post("/:id/resolve", route(req => intakeService.resolve(req.user!, req.params.id, req.body)));
intakeRouter.post("/:id/register", route(async req => {
  const result = await intakeService.register(req.user!, req.params.id, req.body);
  broadcastCaseEvent({ type: "CASE_REGISTERED", complaintId: result.complaint.id, complaintRef: result.complaint.complaintId, institutionId: result.complaint.institutionId });
  // Return the authorized new case, not unfiltered overlap candidates from other bureaus.
  return { complaint: result.complaint };
}, 201));
