import { effectiveProfile, knownRole } from "../security/rbac.js";
import { Router, Response } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { store } from "../db/store.js";
import { generateToken, requireAuth, AuthenticatedRequest } from "../middleware/auth.js";

export const authRouter = Router();

// In-memory brute-force rate-limiting tracker
const loginAttempts = new Map<string, { attempts: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 2 * 60 * 1000; // 2 minutes

// Demo accounts endpoint (Development only, credentials omitted)
authRouter.get("/demo-accounts", (_req, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Demo accounts are disabled in production mode." });
  }

  // Return public profile metadata ONLY — never return passwords or password hashes
  const profiles = store.getProfiles().map(p => ({
    id: p.id,
    email: p.email,
    fullName: p.fullName,
    role: effectiveProfile(p).role,
    bureauId: p.bureauId,
    region: p.region,
    institutionId: p.institutionId,
    institutionName: p.institutionName,
    designation: p.designation
  }));

  return res.json(profiles);
});

// Login endpoint
authRouter.post("/login", (req, res: Response) => {
  const { email, password } = req.body;

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required strings." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Rate limiting check
  const attemptRecord = loginAttempts.get(normalizedEmail);
  const now = Date.now();
  if (attemptRecord && attemptRecord.lockedUntil > now) {
    const waitSeconds = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
    return res.status(429).json({
      error: `Too many failed login attempts. Please try again in ${waitSeconds} seconds.`
    });
  }

  const profile = store.getProfileByEmail(normalizedEmail);
  if (!profile || !profile.isActive || !knownRole(profile.role)) {
    recordFailedAttempt(normalizedEmail);
    return res.status(401).json({ error: "Invalid credentials or inactive official profile." });
  }

  // Cryptographically verify password against bcrypt hash — NO BYPASS PERMITTED
  const isValid = bcrypt.compareSync(password, profile.passwordHash);
  if (!isValid) {
    recordFailedAttempt(normalizedEmail);
    return res.status(401).json({ error: "Invalid credentials. Please verify your password." });
  }

  // Clear failed attempts on successful login
  loginAttempts.delete(normalizedEmail);

  // Generate signed JWT
  profile.lastLogin = new Date().toISOString();
  store.saveProfile(profile);
  store.addAuditLog({userId:profile.id,userName:profile.fullName,action:"LOGIN_SUCCESS",entityType:"Authentication",entityId:profile.id,details:{}});
  const token = generateToken(profile);

  return res.json({
    token,
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: effectiveProfile(profile).role,
      permissions: profile.permissions || [],
      bureauId: effectiveProfile(profile).bureauId,
      region: profile.region,
      institutionId: profile.institutionId,
      institutionName: profile.institutionName,
      designation: profile.designation
    }
  });
});

function recordFailedAttempt(email: string) {
  store.addAuditLog({action:"LOGIN_FAILURE",entityType:"Authentication",entityId:email,details:{}});
  const now = Date.now();
  const existing = loginAttempts.get(email) || { attempts: 0, lockedUntil: 0 };
  const attempts = existing.attempts + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0;
  loginAttempts.set(email, { attempts, lockedUntil });
}

// Current user profile
authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  const { passwordHash, ...safeProfile } = req.user;
  return res.json({ user: safeProfile, ...safeProfile });
});

authRouter.post("/logout", requireAuth, (req: AuthenticatedRequest,res) => {
  const profile = store.getProfileById(req.user!.id)!;
  store.saveProfile({...profile,updatedAt:new Date().toISOString(),sessionVersion:randomUUID()});
  store.addAuditLog({userId:profile.id,userName:profile.fullName,action:"LOGOUT",entityType:"Authentication",entityId:profile.id,details:{}});
  return res.json({success:true});
});
