import { Router, type Response, type NextFunction } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { complaintLanguageService, ComplaintLanguageError } from "../services/complaintLanguage.js";
import {store} from "../db/store.js";
export const complaintLanguageRouter = Router();
complaintLanguageRouter.use(requireAuth);
const route = (operation: (req: AuthenticatedRequest) => unknown) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(operation(req)); }
  catch (error) { if (error instanceof ComplaintLanguageError) res.status(error.status).json({ error: error.status === 404 ? "Record not found in authorized scope." : "The language annotation could not be completed. Check access, source version and review requirements.", code: error.code }); else next(error); }
};
complaintLanguageRouter.get("/:id", route(req => {const view=complaintLanguageService.view(req.user!,req.params.id);store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"CASE_LANGUAGE_VIEWED",entityType:"Complaint",entityId:req.params.id,details:{}});return view;}));
complaintLanguageRouter.post("/:id", route(req => complaintLanguageService.annotate(req.user!, req.params.id, req.body)));
