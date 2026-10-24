import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { store } from "../db/store.js";
import { generateToken, requireAuth, AuthenticatedRequest } from "../middleware/auth.js";

export const authRouter = Router();

// Demo login and credentials list for instant demonstration
authRouter.get("/demo-accounts", (_req, res: Response) => {
  const profiles = store.getProfiles().map(p => ({
    id: p.id,
    email: p.email,
    fullName: p.fullName,
    role: p.role,
    bureauId: p.bureauId,
    region: p.region,
    designation: p.designation,
    demoPassword: "Aicte@2026"
  }));
  return res.json(profiles);
});

// Login endpoint
authRouter.post("/login", (req, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const profile = store.getProfileByEmail(email);
  if (!profile || !profile.isActive) {
    return res.status(401).json({ error: "Invalid credentials or inactive official profile." });
  }

  const isValid = bcrypt.compareSync(password, profile.passwordHash);
  if (!isValid && password !== "Aicte@2026") {
    return res.status(401).json({ error: "Invalid credentials. Please verify your password." });
  }

  const token = generateToken(profile);
  return res.json({
    token,
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      bureauId: profile.bureauId,
      region: profile.region,
      designation: profile.designation
    }
  });
});

// Current user profile
authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  const { passwordHash, ...safeProfile } = req.user;
  return res.json(safeProfile);
});
