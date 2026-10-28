import { AsyncLocalStorage } from "node:async_hooks";
import type { Profile, Complaint } from "../models/types.js";

export const CORE_ROLES = ["SYSTEM_ADMIN", "COMPETENT_AUTHORITY", "BUREAU_HEAD", "CASE_OFFICER"] as const;
export type CoreRole = typeof CORE_ROLES[number];
export const roleAliases: Record<string, string> = {
  Administrator: "SYSTEM_ADMIN", "Senior Management": "COMPETENT_AUTHORITY",
  "Competent Authority": "COMPETENT_AUTHORITY", "Regulation Bureau Officer": "CASE_OFFICER",
  "PGRC Officer": "CASE_OFFICER", "Bureau Officer": "CASE_OFFICER", "Regional Officer": "CASE_OFFICER"
};
export const roleOf = (role: string): string => roleAliases[role] || role;
export const requestScope = new AsyncLocalStorage<Profile>();
export function effectiveProfile(user: Profile): Profile {
  return { ...user, role: roleOf(user.role) as Profile["role"],
    bureauId: user.bureauId || (user.role === "Regulation Bureau Officer" ? "RB" : user.role === "PGRC Officer" ? "PGRC" : undefined) };
}
export function mayRead(user: Profile, complaint: Complaint, region?: string): boolean {
  const role = roleOf(user.role);
  if (role === "Institutional User") return !!user.institutionId && [complaint.institutionId, complaint.aictePermanentId].includes(user.institutionId);
  if (role === "SYSTEM_ADMIN") return false;
  if (user.region && user.region !== region) return false;
  if (role === "COMPETENT_AUTHORITY") return !user.bureauId || user.bureauId === complaint.currentBureauId;
  if (!user.bureauId || user.bureauId !== complaint.currentBureauId) return false;
  return role === "BUREAU_HEAD" || (role === "CASE_OFFICER" && complaint.assignedOfficerId === user.id);
}
export const PERMISSIONS = [
  { role: "SYSTEM_ADMIN", actions: "Manage users, roles, bureaus, configuration and administrative audit", scope: "Administration only" },
  { role: "COMPETENT_AUTHORITY", actions: "Read cases, supervisory decisions, coordination, reports", scope: "Authorized bureau/region, organization-wide when unbounded" },
  { role: "BUREAU_HEAD", actions: "Read and update bureau cases, assign officers, coordinate, transfer", scope: "Current bureau and optional region" },
  { role: "CASE_OFFICER", actions: "Read and update assigned cases, evidence and coordination requests", scope: "Assigned cases in current bureau and optional region" }
];
