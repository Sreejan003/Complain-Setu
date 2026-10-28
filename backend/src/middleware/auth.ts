import "dotenv/config";
import { roleOf, effectiveProfile, mayRead, requestScope } from "../security/rbac.js";
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
      sessionVersion: profile.updatedAt,
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
    // Only permit URL query tokens for Server-Sent Events (SSE) connections where EventSource cannot pass custom headers
    const isSsePath = req.baseUrl?.includes("complaints") && req.path?.includes("stream");
    if (isSsePath) {
      token = queryToken;
    } else {
      return res.status(401).json({
        error: "Insecure token transport: Authentication tokens in URL query parameters are rejected. Please use the Authorization: Bearer header."
      });
    }
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
    if (!user || !user.isActive || decoded.sessionVersion !== user.updatedAt) {
      return res.status(403).json({ error: "User account inactive, session revoked, or not found.", code:"SESSION_REVOKED" });
    }

    req.user = effectiveProfile(user);
    requestScope.run(req.user, () => next());
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

    if (!allowedRoles.some(role => roleOf(role) === roleOf(req.user!.role))) {
      return res.status(403).json({
        error: `Access Denied: Role "${req.user.role}" does not have permission to perform this operation.`,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
}

/**
 * Checks if the authenticated user has jurisdictional scope to view a complaint.
 */
export function canAccessComplaint(user: Profile, complaint: Complaint, institutionRegion?: string): boolean {
  return mayRead(effectiveProfile(user), complaint, institutionRegion || store.getInstitutionById(complaint.institutionId)?.region);
}
export function canMutateComplaint(user: Profile, complaint: Complaint, institutionRegion?: string): { allowed: boolean; reason?: string } {
  const allowed = roleOf(user.role) !== "Institutional User" && canAccessComplaint(user, complaint, institutionRegion);
  return { allowed, reason: allowed ? undefined : "Access denied: complaint is outside your authorized scope." };
}
