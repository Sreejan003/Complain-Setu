import { Router, Response } from "express";
import { store } from "../db/store.js";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { querySemanticService } from "../services/overlapEngine.js";

export const adminRouter = Router();

// Get users list
adminRouter.get("/users", requireAuth, (_req, res: Response) => {
  const users = store.getProfiles().map(({ passwordHash, ...safe }) => safe);
  return res.json(users);
});

// Get system audit logs
adminRouter.get("/audit-logs", requireAuth, requireRole("Administrator", "Senior Management"), (_req, res: Response) => {
  const logs = store.getAuditLogs();
  return res.json(logs);
});

// Reset demo dataset
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

// Check system integration status (AI service, DB, Supabase readiness)
adminRouter.get("/system-status", async (_req, res: Response) => {
  let aiServiceStatus = "Fallback (In-Process Lexical/Cosine)";
  let aiServiceConnected = false;

  const testAi = await querySemanticService("Faculty salary unpaid", "Faculty remuneration pending");
  if (testAi) {
    aiServiceStatus = `Connected (${testAi.engine})`;
    aiServiceConnected = true;
  }

  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

  return res.json({
    system: "AICTE Integrated Institution Complaint Monitoring System",
    status: "Operational",
    database: {
      mode: supabaseConfigured ? "Supabase PostgreSQL" : "Local Persistent JSON Store (ACID)",
      connected: true,
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
