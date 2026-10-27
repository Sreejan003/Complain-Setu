import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Profile, Complaint } from "../models/types.js";
import { store } from "../db/store.js";
import { UserRole } from "../config/constants.js";

const DEFAULT_DEV_SECRET = "aicte_sih_secure_jwt_secret_key_2026_dev_only";

// Validate JWT Secret strength and production rules
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!secret || secret.length < 32 || secret.includes("dev_only") || secret.includes("aicte_sih_secure")) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: Production mode requires a cryptographically strong, non-default JWT_SECRET (minimum 32 characters)."
      );
    }
    return secret;
  }

  return secret || DEFAULT_DEV_SECRET;
}

const JWT_SECRET = getJwtSecret();

export interface AuthenticatedRequest extends Request {
  user?: Profile;
}

export function generateToken(profile: Profile): string {
  return jwt.sign(
    {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      fullName: profile.fullName,
      bureauId: profile.bureauId,
      region: profile.region,
      institutionId: profile.institutionId
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  let token: string | undefined;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    return res.status(401).json({ error: "Authentication token required. Please log in." });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: "Invalid token payload." });
    }

    const user = store.getProfileById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(403).json({ error: "User account inactive or not found." });
    }

    req.user = user;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Authentication session expired. Please log in again.", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ error: "Invalid authentication token. Please log in.", code: "INVALID_TOKEN" });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    if (req.user.role === "Administrator") {
      // Administrator has global oversight
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access Denied: Role "${req.user.role}" does not have permission to perform this operation.`,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
}

/**
 * Checks if the authenticated user has jurisdictional scope to view or mutate a complaint.
 */
export function canAccessComplaint(user: Profile, complaint: Complaint, institutionRegion?: string): boolean {
  if (user.role === "Administrator" || user.role === "Senior Management") {
    return true;
  }

  if (user.role === "Regulation Bureau Officer") {
    return complaint.currentBureauId === "RB" || complaint.receivingBureauId === "RB";
  }

  if (user.role === "PGRC Officer") {
    return complaint.currentBureauId === "PGRC" || complaint.receivingBureauId === "PGRC";
  }

  if (user.role === "Regional Officer") {
    if (!user.region) return true;
    let reg = institutionRegion;
    if (!reg && complaint.institutionId) {
      const inst = store.getInstitutionById(complaint.institutionId);
      reg = inst?.region;
    }
    if (!reg) return false;
    return reg.toLowerCase().includes(user.region.toLowerCase());
  }

  if (user.role === "Institutional User") {
    if (!user.institutionId) return false;
    return complaint.institutionId === user.institutionId || complaint.aictePermanentId === user.institutionId;
  }

  return false;
}
