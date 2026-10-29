import {reportingRouter} from "./routes/reporting.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();
// AICTE Complaint Tracker API Server

import { authRouter } from "./routes/auth.js";
import { institutionsRouter } from "./routes/institutions.js";
import { complaintsRouter } from "./routes/complaints.js";
import { overlapsRouter } from "./routes/overlaps.js";
import { transfersRouter } from "./routes/transfers.js";
import { notificationsRouter } from "./routes/notifications.js";
import { analyticsRouter } from "./routes/analytics.js";
import { adminRouter } from "./routes/admin.js";
import {coordinationRouter} from "./routes/coordination.js";
import { intakeRouter } from "./routes/intake.js";
import { requireAuth, AuthenticatedRequest } from "./middleware/auth.js";
import { store } from "./db/store.js";
import { startSlaScheduler } from "./services/slaScheduler.js";
import { initializeOperationalPersistence, operationalMiddleware } from "./db/operationalPostgres.js";
import { dispatchCaseEvent } from "./routes/complaints.js";
import { confidentialityJsonReplacer } from "./security/confidentiality.js";
import { caseSecurityRouter } from "./routes/caseSecurity.js";
import { complaintLanguageRouter } from "./routes/complaintLanguage.js";
import { overlapConfigurationRouter, caseOverlapRouter } from "./routes/overlapConfiguration.js";
import { caseFamilyRouter } from "./routes/caseFamily.js";
import { ingestionRouter } from "./routes/ingestion.js";
import {auditIntegrityRouter} from "./routes/auditIntegrity.js";
import{slaPoliciesRouter,caseSlaRouter,slaAlertsRouter}from"./routes/slaPolicies.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = process.env.DATA_DIR ? path.join(process.env.DATA_DIR,"uploads") : path.resolve(__dirname, "../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const app = express();
app.set("json replacer", function(this: any, key: string, value: unknown) {
  if (key === "hasOverlapAlert") return this?.id ? store.hasVisibleOverlap(this.id) : undefined;
  return confidentialityJsonReplacer(key, value);
});
const PORT = process.env.PORT || 5000;

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// Configured CORS (Restricted to authorized origins)
const rawCors =
  process.env.CORS_ORIGIN ||
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,http://localhost:3000,http://localhost:3001,http://127.0.0.1:5173,http://127.0.0.1:3000,http://127.0.0.1:3001";
const allowedOrigins = rawCors.split(",").map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: Origin ${origin} not allowed.`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "2mb" }));
await initializeOperationalPersistence(dispatchCaseEvent);
app.use(operationalMiddleware);

// Authenticated Evidence File Access (Eliminates public unauthenticated access to confidential uploads)
app.use("/uploads", requireAuth, (req: AuthenticatedRequest, res) => {
  const safeFilename = path.basename(req.path);
  const doc = store.getDocuments({}).find(d => d.fileName === safeFilename);
  if (!doc) return res.status(404).json({error:"Evidence not found in authorized scope."});
  const targetPath = path.join(UPLOADS_DIR, safeFilename);
  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: "Evidence file not found on server." });
  }
  store.addAuditLog({userId:req.user!.id,userName:req.user!.fullName,action:"EVIDENCE_DOWNLOAD_AUTHORIZED",entityType:"Complaint",entityId:doc.complaintId,details:{documentId:doc.id,transport:"legacy_authenticated_upload"}});
  return res.sendFile(targetPath);
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/institutions", institutionsRouter);
app.use("/api/complaints", complaintsRouter);
app.use("/api/overlaps", overlapsRouter);
app.use("/api/transfers", transfersRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/coordination",coordinationRouter);
app.use("/api/intake", intakeRouter);
app.use("/api/case-security", caseSecurityRouter);
app.use("/api/complaint-language", complaintLanguageRouter);
app.use("/api/admin/overlap-settings", overlapConfigurationRouter);
app.use("/api/case-overlap", caseOverlapRouter);
app.use("/api/case-family", caseFamilyRouter);
app.use("/api/imports", ingestionRouter);
app.use("/api/admin/audit-integrity",auditIntegrityRouter);
app.use("/api/admin/sla-policies",slaPoliciesRouter);
app.use("/api/case-sla",caseSlaRouter);
app.use("/api/sla-alerts",slaAlertsRouter);
app.use("/api/reports",reportingRouter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "AICTE Integrated Complaint Monitoring Backend API",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Central Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.message && err.message.startsWith("CORS blocked")) {
    return res.status(403).json({ error: err.message });
  }
  console.error("Internal Server Error", { code: typeof err.code === "string" ? err.code : "INTERNAL_ERROR" });
  return res.status(500).json({
    error: "An internal server error occurred.", code: "INTERNAL_ERROR"
  });
});

export const server = app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`AICTE Integrated Institution Complaint Monitoring System`);
  console.log(`Backend REST API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Mode: ${process.env.NODE_ENV || "development"}`);
  console.log(`================================================================`);

  // Start background Statutory SLA Monitor
  if (process.env.NODE_ENV !== "test") startSlaScheduler(15);
});

export default app;
