import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Profile } from "../models/types.js";
import { store } from "../db/store.js";
import { UserRole } from "../config/constants.js";

const JWT_SECRET = process.env.JWT_SECRET || "aicte_sih_secure_jwt_secret_key_2026";

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
      region: profile.region
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication token required. Please log in." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = store.getProfileById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(403).json({ error: "User account inactive or not found." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired authentication session." });
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
        error: `Access Denied: Role "${req.user.role}" does not have permission to perform this administrative operation.`,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
}
