import type { Profile, Complaint } from "../models/types.js";
import type { CoordinationSession } from "../models/coordination.js";
import { effectiveProfile, mayRead } from "./rbac.js";
export function coordinationAccess(profile: Profile, s: CoordinationSession, c: Complaint | undefined) {
  const u = effectiveProfile(profile), role = u.role;
  const valid = u.isActive && ["COMPETENT_AUTHORITY", "BUREAU_HEAD", "CASE_OFFICER"].includes(role) && (!u.region || u.region === s.region);
  const authority = valid && role === "COMPETENT_AUTHORITY" && (!u.bureauId || [s.leadBureauId, ...s.participants.filter(p => p.status === "Accepted").map(p => p.bureauId)].includes(u.bureauId));
  const leadHead = valid && ((role === "BUREAU_HEAD" && u.bureauId === s.leadBureauId) || (authority && !!u.permissions?.includes("COORDINATE_CROSS_BUREAU")));
  const leadOfficer = valid && role === "CASE_OFFICER" && u.id === s.leadOfficerId && !!c && mayRead(u, c, s.region);
  const participant = s.participants.find(p => p.bureauId === u.bureauId);
  const receivingHead = valid && role === "BUREAU_HEAD" && !!participant && !["Awaiting Origin", "Revoked"].includes(participant.status);
  const member = valid && role === "CASE_OFFICER" && participant?.status === "Accepted" && participant.officerIds.includes(u.id);
  const full = !!(authority || leadHead || leadOfficer || member || (receivingHead && participant?.status === "Accepted"));
  const read = !!(full || receivingHead || (valid && u.id === s.createdBy && u.bureauId === s.leadBureauId && !!c && mayRead(u, c, s.region)));
  const current = !!c && c.currentBureauId === s.leadBureauId && c.assignedOfficerId === s.leadOfficerId;
  return { read, full, authority: !!authority, leadHead: !!leadHead, leadOfficer: !!leadOfficer, receivingHead: !!receivingHead, member: !!member, current, writable: current && c?.status !== "Disposed" && s.status !== "Completed" && s.status !== "Rejected" };
}
