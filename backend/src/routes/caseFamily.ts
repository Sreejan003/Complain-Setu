import { Router,type Response,type NextFunction } from "express";
import { requireAuth,type AuthenticatedRequest } from "../middleware/auth.js";
import { caseFamilyService,CaseFamilyError } from "../services/caseFamily.js";
export const caseFamilyRouter=Router();caseFamilyRouter.use(requireAuth);
const route=(operation:(req:AuthenticatedRequest)=>unknown)=>(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{
  try{res.json(operation(req));}catch(error){if(error instanceof CaseFamilyError)res.status(error.status).json({error:error.status===404?"Record not found in authorized scope.":"Family action unavailable under the current scope or state. Check the selected cases, preparation version, reason and review confirmation.",code:error.code});else next(error);}
};
caseFamilyRouter.get("/institutions/:id",route(req=>caseFamilyService.view(req.user!,req.params.id)));
caseFamilyRouter.get("/cases/:id",route(req=>caseFamilyService.caseView(req.user!,req.params.id)));
caseFamilyRouter.post("/merges/prepare",route(req=>caseFamilyService.prepare(req.user!,req.body)));
caseFamilyRouter.post("/merges/:id/confirm",route(req=>caseFamilyService.confirm(req.user!,req.params.id,req.body)));
caseFamilyRouter.post("/merges/:id/reverse",route(req=>caseFamilyService.reverse(req.user!,req.params.id,req.body)));
