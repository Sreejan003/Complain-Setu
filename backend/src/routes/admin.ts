import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { CORE_ROLES, PERMISSIONS, roleOf, effectiveProfile } from "../security/rbac.js";
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
    return res.json(store.getProfiles().filter(p => p.isActive && roleOf(p.role) === "CASE_OFFICER" && !!req.user!.bureauId && p.bureauId === req.user!.bureauId && (!req.user!.region || p.region === req.user!.region)).map(({passwordHash,...p}) => effectiveProfile({...p,passwordHash:""})).map(({passwordHash,...p})=>p));
  }
  if (role !== "SYSTEM_ADMIN") return res.status(403).json({error:"System administrator required."});
  next();
});
adminRouter.get("/permissions", (_req, res) => res.json(PERMISSIONS.map(p => ({...p, assignments:store.getProfiles().filter(u=>roleOf(u.role)===p.role).length}))));
adminRouter.get("/bureaus", (_req,res) => res.json(store.getBureaus()));
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
  res.json({totalUsers:users.length,activeUsers:users.filter(u=>u.isActive).length,totalBureaus:store.getBureaus().length,systemActivity:store.getAuditLogs().filter(l=>l.createdAt>=since).length,activityPeriod:"Administrative and authentication audit events in the last 30 days"});
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
  if (!Array.isArray(permissions) || permissions.some(p=>!["APPROVE_TRANSFERS","APPROVE_ESCALATIONS","COORDINATE_CROSS_BUREAU","ASSIGN_OFFICERS"].includes(p))) return res.status(400).json({error:"Invalid delegated permissions."});
  const normalizedEmail = email.trim().toLowerCase();
  if (store.getProfiles().some(u=>u.email.toLowerCase()===normalizedEmail && u.id!==existing?.id)) return res.status(409).json({error:"Email already registered."});
  if ((!existing || password) && (typeof password!=="string" || password.length<12)) return res.status(400).json({error:"Credentials must contain at least 12 characters."});
  if (existing && roleOf(existing.role)==="SYSTEM_ADMIN" && (!isActive || role!=="SYSTEM_ADMIN") && store.getProfiles().filter(u=>roleOf(u.role)==="SYSTEM_ADMIN" && u.isActive).length<=1) return res.status(400).json({error:"The last active administrator must be preserved."});
  const now = new Date().toISOString();
  const user = store.saveProfile({...existing,id:existing?.id||randomUUID(),email:normalizedEmail,fullName:fullName.trim(),role,permissions,bureauId:bureauId||undefined,region:region||undefined,isActive,passwordHash:password?bcrypt.hashSync(password,12):existing!.passwordHash,createdAt:existing?.createdAt||now,updatedAt:now});
  store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:existing?"USER_UPDATED":"USER_CREATED",entityType:"Profile",entityId:user.id,details:{role,bureauId,isActive,credentialsChanged:!!password}});
  store.addNotification({id:randomUUID(),recipientRole:"SYSTEM_ADMIN",title:existing?"Account updated":"Account created",message:user.fullName+" — "+role,notificationType:"Status Update",isRead:false,createdAt:now});
  const {passwordHash,...safe}=user;
  return res.status(existing?200:201).json(safe);
}
adminRouter.post("/users", saveUser);
adminRouter.put("/users/:id", saveUser);

// Get users list (Authenticated & Administrator / Senior Management only)
adminRouter.get("/users", requireAuth, requireRole("Administrator", "Senior Management"), (_req, res: Response) => {
  const users = store.getProfiles().map(p=>effectiveProfile(p)).map(({ passwordHash, ...safe }) => safe);
  return res.json(users);
});

// Get system audit logs (Administrator & Senior Management only)
adminRouter.get("/audit-logs", requireAuth, requireRole("Administrator", "Senior Management"), (_req, res: Response) => {
  const logs = store.getAuditLogs();
  return res.json(logs);
});

// Reset demo dataset (Administrator only)
adminRouter.post("/reset-demo-data", requireAuth, requireRole("Administrator"), (req: AuthenticatedRequest, res: Response) => {
  return res.status(403).json({error:"Dataset reset is disabled to preserve historical records."});
  const freshData = store.resetDemoData();
  return res.json({
    message: "Demo dataset successfully reset to baseline synthetic state.",
    institutionsCount: freshData.institutions.length,
    complaintsCount: freshData.complaints.length,
    overlapAlertsCount: freshData.overlapAlerts.length,
    timestamp: freshData.meta.lastReset
  });
});

// Check system integration status (AI service, DB, Supabase readiness) - Authenticated
adminRouter.get("/system-status", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  let aiServiceStatus = "Fallback (In-Process Lexical/Cosine)";
  let aiServiceConnected = false;

  const testAi = await querySemanticService("Faculty salary unpaid", "Faculty remuneration pending");
  if (testAi) {
    aiServiceStatus = `Connected (${testAi.engine})`;
    aiServiceConnected = true;
  }

  // Active database connectivity check (no longer assumes env vars equate to connection)
  const dbHealth = await repository.healthCheck();

  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));

  return res.json({
    system: "AICTE Integrated Institution Complaint Monitoring System",
    status: dbHealth.connected ? "Operational" : "Degraded",
    database: {
      mode: dbHealth.mode,
      connected: dbHealth.connected,
      error: dbHealth.error,
      details: dbHealth.details,
      supabaseConfigured
    },
    aiService: {
      status: aiServiceStatus,
      connected: aiServiceConnected,
      model: "sentence-transformers/all-MiniLM-L6-v2",
      fallbackActive: !aiServiceConnected
    },
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
    const updated = updateEscalationConfig(req.body);
    store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"SLA_CONFIGURATION_UPDATED",entityType:"Configuration",entityId:"sla",details:updated});
    return res.json({
      message: "Statutory SLA & Escalation configuration updated.",
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
    const result = runSlaEvaluationCycle();
    return res.json({
      message: "Statutory SLA evaluation cycle executed successfully.",
      result
    });
  }
);
