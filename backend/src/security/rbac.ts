import { AsyncLocalStorage } from "node:async_hooks";
import type { Profile, Complaint, Institution } from "../models/types.js";
import { STATUS_TRANSITIONS } from "../config/constants.js";

export const CORE_ROLES = ["SYSTEM_ADMIN", "COMPETENT_AUTHORITY", "BUREAU_HEAD", "CASE_OFFICER"] as const;
export type CoreRole = typeof CORE_ROLES[number];
export const roleAliases: Record<string, string> = {
  Administrator: "SYSTEM_ADMIN", "Senior Management": "COMPETENT_AUTHORITY",
  "Competent Authority": "COMPETENT_AUTHORITY", "Regulation Bureau Officer": "CASE_OFFICER",
  "PGRC Officer": "CASE_OFFICER", "Bureau Officer": "CASE_OFFICER", "Regional Officer": "CASE_OFFICER"
};
export const roleOf = (role: string): string => roleAliases[role] || role;
export const knownRole = (role: string) => [...CORE_ROLES, "Institutional User"].includes(roleOf(role));
export const DELEGATIONS = ["APPROVE_TRANSFERS", "APPROVE_ESCALATIONS", "COORDINATE_CROSS_BUREAU", "ASSIGN_OFFICERS"] as const;
export function eligibleDelegations(role: string): readonly string[] {
  if (roleOf(role) === "COMPETENT_AUTHORITY") return DELEGATIONS;
  if (roleOf(role) === "BUREAU_HEAD") return DELEGATIONS.filter(p => p !== "ASSIGN_OFFICERS");
  return [];
}
export const requestScope = new AsyncLocalStorage<Profile>();
/** Institution master data/aggregates are separate from confidential case access. */
export function mayViewInstitution(user: Profile, institution: Institution): boolean {
  const profile=effectiveProfile(user);
  if(!profile.isActive || !knownRole(profile.role))return false;
  if(profile.role==="Institutional User")return !!profile.institutionId && [institution.id,institution.aictePermanentId].includes(profile.institutionId);
  return true;
}
export function effectiveProfile(user: Profile): Profile {
  return { ...user, role: roleOf(user.role) as Profile["role"],
    bureauId: user.bureauId || (user.role === "Regulation Bureau Officer" ? "RB" : user.role === "PGRC Officer" ? "PGRC" : undefined) };
}
export function mayRead(user: Profile, complaint: Complaint, region?: string): boolean {
  user = effectiveProfile(user);
  if (!user.isActive || !knownRole(user.role)) return false;
  const role = roleOf(user.role);
  if (role === "Institutional User") return !!user.institutionId && [complaint.institutionId, complaint.aictePermanentId].includes(user.institutionId);
  if (role === "SYSTEM_ADMIN") return false;
  if (user.region && user.region !== region) return false;
  if (role === "COMPETENT_AUTHORITY") return !user.bureauId || user.bureauId === complaint.currentBureauId;
  if (!user.bureauId || user.bureauId !== complaint.currentBureauId) return false;
  return role === "BUREAU_HEAD" || (role === "CASE_OFFICER" && complaint.assignedOfficerId === user.id);
}

export type Action = "admin.manage" | "case.read" | "case.update" | "case.assign" | "case.dispose" | "case.reopen" | "case.escalate" | "case.request" | "evidence.upload" | "transfer.initiate" | "transfer.respond" | "overlap.decide";
export interface AuthorizationContext { region?: string; receivingBureauId?: string; pending?: boolean; proposedStatus?: string }

/** Delegation permits an action only after role, jurisdiction and resource-state checks. */
export function authorize(user: Profile, action: Action, resource?: Complaint, context: AuthorizationContext = {}): boolean {
  user = effectiveProfile(user);
  const role = roleOf(user.role);
  if (!user.isActive || !knownRole(role)) return false;
  if (action === "admin.manage") return role === "SYSTEM_ADMIN";
  if (role === "SYSTEM_ADMIN" || !resource) return false;
  if (action === "transfer.respond") {
    const receiving = context.receivingBureauId;
    return !!receiving && context.pending === true && !!user.permissions?.includes("APPROVE_TRANSFERS") &&
      ["COMPETENT_AUTHORITY", "BUREAU_HEAD"].includes(role) &&
      (!user.region || user.region === context.region) &&
      (role === "BUREAU_HEAD" ? !!user.bureauId && user.bureauId === receiving : !user.bureauId || user.bureauId === receiving);
  }
  if (!mayRead(user, resource, context.region)) return false;
  if (action === "case.read") return true;
  if (role === "Institutional User") return action === "evidence.upload";
  if (action === "case.reopen") return role === "COMPETENT_AUTHORITY" && resource.status === "Disposed";
  if (action === "overlap.decide") return role === "COMPETENT_AUTHORITY" || (role === "BUREAU_HEAD" && !!user.permissions?.includes("COORDINATE_CROSS_BUREAU"));
  if (resource.status === "Disposed") return false;
  if (action === "case.update" && role==="CASE_OFFICER" && ["Escalated","Transferred"].includes(resource.status) && context.proposedStatus && context.proposedStatus!==resource.status) return false;
  if (action === "case.assign") return role === "BUREAU_HEAD" || (role === "COMPETENT_AUTHORITY" && !!user.permissions?.includes("ASSIGN_OFFICERS"));
  if (action === "case.dispose") return ["BUREAU_HEAD", "COMPETENT_AUTHORITY"].includes(role) && !!STATUS_TRANSITIONS[resource.status]?.includes("Disposed");
  if (action === "case.escalate") return ["BUREAU_HEAD", "COMPETENT_AUTHORITY"].includes(role) && !!user.permissions?.includes("APPROVE_ESCALATIONS") && !!STATUS_TRANSITIONS[resource.status]?.includes("Escalated");
  if (action === "transfer.initiate") return ["BUREAU_HEAD", "COMPETENT_AUTHORITY"].includes(role);
  return ["case.update", "case.request", "evidence.upload"].includes(action) && ["COMPETENT_AUTHORITY", "BUREAU_HEAD", "CASE_OFFICER"].includes(role);
}

export function caseCapabilities(user: Profile, complaint: Complaint, region?: string) {
  const can = (action: Action) => authorize(user, action, complaint, {region});
  const statuses = (STATUS_TRANSITIONS[complaint.status] || []).filter(status => {
    if (status === "Transferred") return false; // Dedicated recorded transfer workflow only.
    if (complaint.status === "Disposed") return can("case.reopen");
    return status === "Disposed" ? can("case.dispose") : status === "Escalated" ? can("case.escalate") : authorize(user,"case.update",complaint,{region,proposedStatus:status});
  });
  return { update: can("case.update"), assign: can("case.assign"), upload: can("evidence.upload"), request: can("case.request"), transfer: can("transfer.initiate"), reopen:can("case.reopen"), overrideSla:roleOf(user.role)==="COMPETENT_AUTHORITY" && can("case.read"), permittedStatuses:statuses };
}
export const PERMISSIONS = [
  { role: "SYSTEM_ADMIN", actions: "Manage users, roles, bureaus, configuration and administrative audit", scope: "Administration only" },
  { role: "COMPETENT_AUTHORITY", actions: "Read cases, supervisory decisions, coordination, reports", scope: "Authorized bureau/region, organization-wide when unbounded" },
  { role: "BUREAU_HEAD", actions: "Read and update bureau cases, assign officers, coordinate, transfer", scope: "Current bureau and optional region" },
  { role: "CASE_OFFICER", actions: "Read and update assigned cases, evidence and coordination requests", scope: "Assigned cases in current bureau and optional region" }
];
