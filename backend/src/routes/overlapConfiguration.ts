import { Router, type Response, type NextFunction } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { overlapSettingsService, OverlapError } from "../services/overlapSettings.js";
import { overlapReviewService } from "../services/overlapReview.js";
export const overlapConfigurationRouter = Router(), caseOverlapRouter = Router();
const route = (operation: (req: AuthenticatedRequest) => unknown) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await operation(req)); }
  catch (error) { if (error instanceof OverlapError) res.status(error.status).json({ error: error.status === 404 ? "Record not found in authorized scope." : "Overlap action could not be completed. Check access, version, reason and values.", code: error.code }); else next(error); }
};
overlapConfigurationRouter.use(requireAuth);
overlapConfigurationRouter.get("/", route(req => overlapSettingsService.view(req.user!)));
overlapConfigurationRouter.put("/", route(req => overlapSettingsService.save(req.user!, req.body)));
caseOverlapRouter.use(requireAuth);
caseOverlapRouter.get("/:id", route(req => overlapReviewService.view(req.user!, req.params.id)));
caseOverlapRouter.put("/:id/entities", route(req => overlapReviewService.entities(req.user!, req.params.id, req.body)));
caseOverlapRouter.post("/:id/rescan", route(req => overlapReviewService.rescan(req.user!, req.params.id, req.body)));
