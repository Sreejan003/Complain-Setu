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

// Get users list (Authenticated & Administrator / Senior Management only)
adminRouter.get("/users", requireAuth, requireRole("Administrator", "Senior Management"), (_req, res: Response) => {
  const users = store.getProfiles().map(({ passwordHash, ...safe }) => safe);
  return res.json(users);
});

// Get system audit logs (Administrator & Senior Management only)
adminRouter.get("/audit-logs", requireAuth, requireRole("Administrator", "Senior Management"), (_req, res: Response) => {
  const logs = store.getAuditLogs();
  return res.json(logs);
});

// Reset demo dataset (Administrator only)
adminRouter.post("/reset-demo-data", requireAuth, requireRole("Administrator"), (req: AuthenticatedRequest, res: Response) => {
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
    const updated = updateEscalationConfig(req.body);
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
