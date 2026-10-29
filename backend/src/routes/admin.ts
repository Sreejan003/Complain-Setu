import { SLA_DAYS } from "../config/constants.js";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { CORE_ROLES, PERMISSIONS, roleOf, effectiveProfile, eligibleDelegations, requestScope } from "../security/rbac.js";
import { Router, Response } from "express";
import { store } from "../db/store.js";
import { repository } from "../db/index.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { querySemanticService } from "../services/overlapEngine.js";
import {
  getEscalationConfig,
  updateEscalationConfig,
  runSlaEvaluationCycle
} from "../services/slaScheduler.js";

export const adminRouter = Router();
// User directory is also available to heads, limited to eligible officers in their own bureau.
adminRouter.use(requireAuth, (req: AuthenticatedRequest, res, next) => {
  const role = roleOf(req.user!.role);
  if (req.method === "GET" && req.path === "/users" && role === "BUREAU_HEAD") {
    return res.json(store.getProfiles().filter(p => p.isActive && roleOf(p.role) === "CASE_OFFICER" && !!req.user!.bureauId && effectiveProfile(p).bureauId === req.user!.bureauId && (!req.user!.region || p.region === req.user!.region)).map(({passwordHash,...p}) => effectiveProfile({...p,passwordHash:""})).map(({passwordHash,...p})=>p));
  }
  if (role !== "SYSTEM_ADMIN") return res.status(403).json({error:"System administrator required."});
  next();
});
adminRouter.get("/permissions", (_req, res) => res.json(PERMISSIONS.map(p => ({...p, assignments:store.getProfiles().filter(u=>roleOf(u.role)===p.role).length}))));
adminRouter.get("/bureaus", (_req,res) => res.json(store.getBureaus().map(b=>({...b,activeStaff:store.getProfiles().filter(p=>p.isActive&&effectiveProfile(p).bureauId===b.id).length,heads:store.getProfiles().filter(p=>p.isActive&&roleOf(p.role)==="BUREAU_HEAD"&&p.bureauId===b.id).map(p=>p.fullName)}))));
adminRouter.put("/bureaus/:id", (req: AuthenticatedRequest,res) => {
  const {name,description} = req.body;
  if (!/^[A-Z0-9_-]{2,16}$/.test(req.params.id) || typeof name !== "string" || !name.trim() || typeof description !== "string") return res.status(400).json({error:"Valid bureau code, name and description required."});
  const bureau = store.saveBureau({id:req.params.id,code:req.params.id,name:name.trim(),description});
  store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"BUREAU_UPDATED",entityType:"Bureau",entityId:bureau.id,details:{name:bureau.name}});
  return res.json(bureau);
});
adminRouter.get("/summary", (_req,res) => {
  const users = store.getProfiles().filter(u=>roleOf(u.role)!=="Institutional User");
  const since = new Date(Date.now()-30*86400000).toISOString();
  res.json({totalUsers:users.length,activeUsers:users.filter(u=>u.isActive).length,inactiveUsers:users.filter(u=>!u.isActive).length,totalBureaus:store.getBureaus().length,systemActivity:store.getAuditLogs().filter(l=>l.createdAt>=since).length,activityPeriod:"Administrative and authentication audit events in the last 30 days"});
});
function saveUser(req: AuthenticatedRequest,res: Response) {
  const existing = req.params.id ? store.getProfileById(req.params.id) : undefined;
  if (req.params.id && !existing) return res.status(404).json({error:"User not found."});
  if (req.params.id === req.user!.id) return res.status(403).json({error:"Administrators cannot modify their own access or credentials."});
  const {email,fullName,role,bureauId,region,isActive,password,permissions=[]} = req.body;
  if (typeof email!=="string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof fullName!=="string" || !fullName.trim() || !CORE_ROLES.includes(role) || typeof isActive!=="boolean") return res.status(400).json({error:"Valid name, email, core role and account status required."});
  if (["BUREAU_HEAD","CASE_OFFICER"].includes(role) && !store.getBureaus().some(b=>b.id===bureauId)) return res.status(400).json({error:"A configured bureau is required."});
  if (bureauId && !store.getBureaus().some(b=>b.id===bureauId)) return res.status(400).json({error:"Unknown bureau."});
  if (region !== undefined && typeof region !== "string") return res.status(400).json({error:"Invalid region."});
  if (!Array.isArray(permissions) || permissions.some(p=>!eligibleDelegations(role).includes(p))) return res.status(400).json({error:"Invalid delegated permissions."});
  const normalizedEmail = email.trim().toLowerCase();
  if (store.getProfiles().some(u=>u.email.toLowerCase()===normalizedEmail && u.id!==existing?.id)) return res.status(409).json({error:"Email already registered."});
  if ((!existing || password) && (typeof password!=="string" || password.length<12)) return res.status(400).json({error:"Credentials must contain at least 12 characters."});
  if (existing && roleOf(existing.role)==="SYSTEM_ADMIN" && (!isActive || role!=="SYSTEM_ADMIN") && store.getProfiles().filter(u=>roleOf(u.role)==="SYSTEM_ADMIN" && u.isActive).length<=1) return res.status(400).json({error:"The last active administrator must be preserved."});
  const now = new Date().toISOString();
  const user = store.transaction(()=>{
  const user = store.saveProfile({...existing,id:existing?.id||randomUUID(),email:normalizedEmail,fullName:fullName.trim(),role,permissions,bureauId:bureauId||undefined,region:region||undefined,isActive,passwordHash:password?bcrypt.hashSync(password,12):existing!.passwordHash,createdAt:existing?.createdAt||now,updatedAt:now,sessionVersion:randomUUID()});
  store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:existing?"USER_UPDATED":"USER_CREATED",entityType:"Profile",entityId:user.id,details:{before:existing?{role:roleOf(existing.role),bureauId:existing.bureauId,region:existing.region,permissions:existing.permissions,isActive:existing.isActive}:undefined,after:{role,bureauId,region,permissions,isActive},credentialsChanged:!!password,sessionRevoked:!!existing}});
  store.addNotification({id:randomUUID(),recipientRole:"SYSTEM_ADMIN",title:existing?"Account updated":"Account created",message:user.fullName+" — "+role,notificationType:"Status Update",isRead:false,createdAt:now});
  return user;
  });
  const {passwordHash,...safe}=user;
  return res.status(existing?200:201).json(safe);
}
const atomicUserSave = saveUser;
adminRouter.post("/users", atomicUserSave);
adminRouter.put("/users/:id", atomicUserSave);

// Get users list (Authenticated & Administrator / Senior Management only)
adminRouter.get("/users", (req,res) => {
  let users=store.getProfiles().map(p=>effectiveProfile(p)).map(({passwordHash,...safe})=>safe);
  if (req.query.paginated!=="true") return res.json(users); // Existing API consumers retain their array response.
  const search=String(req.query.search||"").toLowerCase();
  users=users.filter(u=>(!req.query.role||u.role===req.query.role) && (!req.query.status || u.isActive===(req.query.status==="active")) && (u.fullName+" "+u.email).toLowerCase().includes(search));
  const page=Math.max(1,Number(req.query.page)||1),limit=Math.max(1,Math.min(50,Number(req.query.limit)||10));
  return res.json({data:users.slice((page-1)*limit,page*limit),pagination:{page,limit,total:users.length,totalPages:Math.ceil(users.length/limit)}});
});

// Get system audit logs (Administrator & Senior Management only)
adminRouter.get("/audit-logs", requireAuth, requireRole("Administrator", "Senior Management"), (_req, res: Response) => {
  const logs = store.getAuditLogs();
  return res.json(logs);
});

// Reset demo dataset (Administrator only)
adminRouter.post("/reset-demo-data", requireAuth, requireRole("Administrator"), (req: AuthenticatedRequest, res: Response) => {
  return res.status(403).json({error:"Dataset reset is disabled to preserve historical records."});

});

// Check system integration status (AI service, DB, Supabase readiness) - Authenticated
adminRouter.get("/system-status", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  let aiServiceStatus = "Fallback (In-Process Lexical/Cosine)";
  let aiServiceConnected = false;

  const configuredMode = process.env.SIMILARITY_MODE || "auto";
  const testAi = configuredMode === "auto" ? await querySemanticService("Synthetic faculty salary example", "Synthetic remuneration example") : null;
  if (testAi) {
    aiServiceStatus = `Connected (${testAi.engine})`;
    aiServiceConnected = true;
  }

  // Active database connectivity check (no longer assumes env vars equate to connection)
  const dbHealth = await store.healthCheck();

  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));

  return res.json({
    system: "AICTE Integrated Institution Complaint Monitoring System",
    status: dbHealth.connected ? "Operational" : "Degraded",
    database: {
      mode: dbHealth.mode,
      connected: dbHealth.connected,
      error: dbHealth.error,
      details: {mode:dbHealth.mode},
      supabaseConfigured
    },
    aiService: {
      status: aiServiceStatus,
      connected: aiServiceConnected,
      mode: configuredMode === "unavailable" ? "unavailable" : testAi?.mode || "lexical_fallback",
      model: testAi?.model || (configuredMode === "unavailable" ? "none" : "token-frequency-cosine"),
      revision: testAi?.revision || "1",
      fallbackActive: configuredMode !== "unavailable" && testAi?.mode !== "multilingual_embeddings"
    },
    prioritySlaDays: SLA_DAYS,
    timestamp: new Date().toISOString()
  });
});

// Get SLA and Escalation Configuration
adminRouter.get("/sla-config", requireAuth, (_req, res: Response) => {
  return res.json(getEscalationConfig());
});

// Update SLA and Escalation Configuration
adminRouter.put(
  "/sla-config",
  requireAuth,
  requireRole("Administrator"),
  (req: AuthenticatedRequest, res: Response) => {
    const keys = ["approachingDeadlineDays","autoEscalateOverdueDays","reminderIntervalHours","seniorManagementNotifyDays"];
    if (Object.keys(req.body).some(key=>!keys.includes(key) || !Number.isInteger(req.body[key]) || req.body[key]<1 || req.body[key]>365)) return res.status(400).json({error:"Configuration values must be integers between 1 and 365."});
    const updated = store.transaction(()=>{
      const config=updateEscalationConfig(req.body);
      store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"SLA_CONFIGURATION_UPDATED",entityType:"Configuration",entityId:"sla",details:config});
      return config;
    });
    return res.json({
      message: "Operational SLA & Escalation configuration updated.",
      config: updated
    });
  }
);

// Manually trigger SLA evaluation cycle
adminRouter.post(
  "/run-sla-scheduler",
  requireAuth,
  requireRole("Administrator", "Senior Management"),
  (_req, res: Response) => {
    // Run the existing configured system job as a system operation, not as a user's case decision.
    const result = requestScope.exit(()=>runSlaEvaluationCycle());
    store.addAuditLog({userId:(_req as AuthenticatedRequest).user!.id,userName:(_req as AuthenticatedRequest).user!.fullName,action:"SLA_MONITOR_TRIGGERED",entityType:"SystemOperation",entityId:"sla-monitor",details:{timestamp:result.timestamp}});
    return res.json({
      message: "Operational SLA evaluation cycle executed successfully.",
      result
    });
  }
);
