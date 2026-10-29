import { Router, type Response, type NextFunction } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { caseSecurityService, CaseSecurityError } from "../services/caseSecurity.js";
import { IdentityCryptoError } from "../security/identityCrypto.js";
import {store} from "../db/store.js";
export const caseSecurityRouter = Router();
caseSecurityRouter.use(requireAuth, (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
const route = (operation: (req: AuthenticatedRequest) => unknown) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(operation(req)); }
  catch (error) {
    if (error instanceof CaseSecurityError) res.status(error.status).json({ error: error.status === 404 ? "Record not found in authorized scope." : "The security action could not be completed. Check permissions and current version.", code: error.code });
    else if (error instanceof IdentityCryptoError) res.status(503).json({ error: error.message, code: "IDENTITY_PROTECTION_UNAVAILABLE" });
    else next(error);
  }
};
caseSecurityRouter.get("/configuration", route(req => caseSecurityService.configuration(req.user!)));
caseSecurityRouter.put("/configuration", route(req => caseSecurityService.configure(req.user!, req.body)));
caseSecurityRouter.get("/:id", route(req => {const view=caseSecurityService.view(req.user!,req.params.id);store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"CASE_SECURITY_VIEWED",entityType:"Complaint",entityId:req.params.id,details:{}});return view;}));
caseSecurityRouter.put("/:id", route(req => caseSecurityService.update(req.user!, req.params.id, req.body)));
caseSecurityRouter.put("/:id/identity", route(req => caseSecurityService.storeIdentity(req.user!, req.params.id, req.body)));
caseSecurityRouter.post("/:id/identity/reveal", route(req => caseSecurityService.revealIdentity(req.user!, req.params.id, req.body)));
