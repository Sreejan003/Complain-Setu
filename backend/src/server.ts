import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authRouter } from "./routes/auth.js";
import { institutionsRouter } from "./routes/institutions.js";
import { complaintsRouter } from "./routes/complaints.js";
import { overlapsRouter } from "./routes/overlaps.js";
import { transfersRouter } from "./routes/transfers.js";
import { notificationsRouter } from "./routes/notifications.js";
import { analyticsRouter } from "./routes/analytics.js";
import { adminRouter } from "./routes/admin.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/institutions", institutionsRouter);
app.use("/api/complaints", complaintsRouter);
app.use("/api/overlaps", overlapsRouter);
app.use("/api/transfers", transfersRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/admin", adminRouter);

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
  console.error("Internal Server Error:", err);
  res.status(500).json({
    error: err.message || "An unexpected internal server error occurred."
  });
});

export const server = app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`AICTE Integrated Institution Complaint Monitoring System`);
  console.log(`Backend REST API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Demo login: admin@aicte.gov.in / Aicte@2026`);
  console.log(`================================================================`);
});

export default app;
