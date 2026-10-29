import { createHash, randomUUID } from "node:crypto";
import { store } from "../db/store.js";
import { effectiveProfile, mayRead, requestScope } from "../security/rbac.js";
import { coordinationAccess } from "../security/coordination.js";
import type { Complaint, Profile } from "../models/types.js";
import type { CaseMerge, MergeProposal } from "../models/caseFamily.js";
export class CaseFamilyError extends Error { constructor(public code: string, public status = 400) { super(code); } }
function fail(code: string, status=400): never { throw new CaseFamilyError(code,status); }
function actor(user: Profile, manage=false) {
  const current=store.getProfileById(user.id);
  if (!current?.isActive) fail("FAMILY_NOT_FOUND",404);
  const profile=effectiveProfile(current);
  if (!["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"].includes(profile.role) || manage && profile.role!=="COMPETENT_AUTHORITY") fail("FAMILY_FORBIDDEN",403);
  return profile;
}
function caseRecord(profile: Profile, id: unknown) {
  if (typeof id!=="string") fail("FAMILY_NOT_FOUND",404);
  const record=store.getComplaintById(id);
  if (!record || !mayRead(profile,record,store.getComplaintRegion(record))) fail("FAMILY_NOT_FOUND",404);
  return record;
}
function reason(value: unknown) { if(typeof value!=="string"||value.trim().length<10||value.length>1000)fail("MERGE_REASON_REQUIRED");return value.trim(); }
function requestId(value: unknown) { if(typeof value!=="string"||!/^[A-Za-z0-9_-]{8,100}$/.test(value))fail("MERGE_REQUEST_ID_REQUIRED");return value; }
function activeMerges() { const records=store.getCaseFamilyRecords(); return records.merges.filter(row=>!records.reversals.some(reversal=>reversal.mergeId===row.id)); }
function connected(ids: string[], merges: CaseMerge[]) {
  const members=new Set(ids);let changed=true;
  while(changed){changed=false;for(const edge of merges)if(members.has(edge.sourceId)||members.has(edge.canonicalId))for(const id of [edge.sourceId,edge.canonicalId])if(!members.has(id)){members.add(id);changed=true;}}
  return [...members].sort();
}
function authorizedMembers(profile: Profile, ids: string[]) {
  // Conservative merge management: every affected family member must be fully readable now.
  return ids.map(id=>caseRecord(profile,id));
}
function plan(profile: Profile, sourceId: unknown, canonicalId: unknown) {
  const source=caseRecord(profile,sourceId), canonical=caseRecord(profile,canonicalId), merges=activeMerges();
  if(source.id===canonical.id||source.institutionId!==canonical.institutionId)fail("MERGE_INVALID_PAIR");
  if(merges.some(row=>row.sourceId===source.id||row.sourceId===canonical.id))fail("MERGE_INVALID_STATE",409);
  const members=authorizedMembers(profile,connected([source.id,canonical.id],merges));
  if(connected([source.id],merges).includes(canonical.id))fail("MERGE_CYCLE_OR_REPEAT",409);
  return { source,canonical,members,merges };
}
function node(record: Complaint) { return { id:record.id,reference:record.complaintId,title:record.title,status:record.status,bureauId:record.currentBureauId,receivedDate:record.metadata?.sourceReceivedDate||record.receivedDate,deadline:record.expectedDisposalDate,source:record.metadata?.sourceChannelId||"unrecorded",externalReference:record.metadata?.externalReference,caseType:record.metadata?.caseTypeId||"unrecorded" }; }
function preparedHash(members: Complaint[], merges: CaseMerge[]) {
  const ids=new Set(members.map(row=>row.id)), snapshot=store.exportSnapshot();
  const stable=(rows:{id:string}[])=>rows.filter(row=>ids.has((row as any).complaintId)).sort((a,b)=>a.id.localeCompare(b.id));
  const payload={ cases:[...members].sort((a,b)=>a.id.localeCompare(b.id)), merges:merges.filter(row=>ids.has(row.sourceId)||ids.has(row.canonicalId)).sort((a,b)=>a.id.localeCompare(b.id)), documents:stable(snapshot.documents||[]),history:stable(snapshot.caseHistory),transfers:stable(snapshot.caseTransfers),requests:stable(snapshot.workflowRequests||[]),coordination:(snapshot.coordinationSessions||[]).filter(row=>ids.has(row.primaryComplaintId)).sort((a,b)=>a.id.localeCompare(b.id)) };
  // Hash only; no original text, evidence contents or identity envelope enters an audit entry/response.
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
function proposalView(profile: Profile, proposal: MergeProposal) {
  const source=caseRecord(profile,proposal.sourceId), canonical=caseRecord(profile,proposal.canonicalId), records=store.getCaseFamilyRecords();
  return { ...proposal,source:node(source),canonical:node(canonical),applied:records.merges.find(row=>row.proposalId===proposal.id)?.id,expired:Date.parse(proposal.expiresAt)<=Date.now(),preservation:"Each original case retains its ID, status, source obligations, deadline, evidence, assignment, transfers and unresolved tasks. A canonical merge does not close or pause any source case or widen access." };
}
function audit(profile: Profile, action: string, id: string, details: Record<string,unknown>) { store.addAuditLog({userId:profile.id,userName:profile.fullName,action,entityType:"CaseMerge",entityId:id,details}); }
export const caseFamilyService={
  view(user: Profile,institutionId: string) {
    const profile=actor(user), institution=store.getInstitutionById(institutionId);if(!institution)fail("FAMILY_NOT_FOUND",404);
    const cases=requestScope.run(profile,()=>store.getScopedComplaints()).filter(row=>row.institutionId===institution.id), ids=new Set(cases.map(row=>row.id));
    const records=store.getCaseFamilyRecords(), merges=activeMerges().filter(row=>ids.has(row.sourceId)&&ids.has(row.canonicalId));
    const related=records.related.filter(row=>ids.has(row.complaintIdA)&&ids.has(row.complaintIdB));
    const coordination=store.getCoordinationSessions().filter(session=>ids.has(session.primaryComplaintId)&&coordinationAccess(profile,session,store.getCoordinationSource(session.primaryComplaintId)).read).map(session=>({id:session.id,caseId:session.primaryComplaintId,status:session.status,bureaus:session.participants.filter(row=>row.status!=="Revoked"&&row.status!=="Rejected").map(row=>row.bureauId),responseDate:session.responseDate}));
    return { institutionId:institution.id,nodes:cases.map(node),edges:[...related.map(row=>({id:row.id,sourceId:row.complaintIdA,targetId:row.complaintIdB,kind:row.relationshipType==="Duplicate"?"duplicate":"related",date:row.createdAt})),...merges.map(row=>({id:row.id,sourceId:row.sourceId,targetId:row.canonicalId,kind:"merged",date:row.createdAt}))],coordination,
      merges:records.merges.filter(row=>ids.has(row.sourceId)&&ids.has(row.canonicalId)&&row.preservedCaseIds.every(id=>ids.has(id))).map(row=>({id:row.id,sourceId:row.sourceId,canonicalId:row.canonicalId,reason:row.reason,createdAt:row.createdAt,actorId:row.actorId,reversal:records.reversals.find(reversal=>reversal.mergeId===row.id)})),canMerge:profile.role==="COMPETENT_AUTHORITY" };
  },
  caseView(user: Profile,id: string) {
    const profile=actor(user),record=caseRecord(profile,id), family=this.view(profile,record.institutionId);
    const edge=family.edges.find(row=>row.kind==="merged"&&row.sourceId===record.id);
    return {caseId:record.id,institutionId:record.institutionId,canonical:edge?family.nodes.find(row=>row.id===edge.targetId):undefined,sources:family.edges.filter(row=>row.kind==="merged"&&row.targetId===record.id).map(row=>family.nodes.find(node=>node.id===row.sourceId))};
  },
  prepare(user: Profile,input: any) {
    return store.transaction(()=>{
      const profile=actor(user,true), request=requestId(input?.requestId), explanation=reason(input?.reason);
      const existing=store.getCaseFamilyRecords().proposals.find(row=>row.actorId===profile.id&&row.requestId===request);
      if(existing){const source=caseRecord(profile,input?.sourceId),canonical=caseRecord(profile,input?.canonicalId);if(existing.sourceId!==source.id||existing.canonicalId!==canonical.id||existing.reason!==explanation)fail("MERGE_REQUEST_CONFLICT",409);return proposalView(profile,existing);}
      const {source,canonical,members,merges}=plan(profile,input?.sourceId,input?.canonicalId);
      const proposal: MergeProposal={id:randomUUID(),sourceId:source.id,canonicalId:canonical.id,actorId:profile.id,reason:explanation,requestId:request,preparedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+15*60000).toISOString(),preparedHash:preparedHash(members,merges)};
      store.appendMergeProposal(proposal);audit(profile,"CASE_MERGE_PREPARED",source.id,{proposalId:proposal.id,canonicalId:canonical.id,reason:explanation});return {...proposalView(profile,proposal),affectedCases:members.map(node)};
    });
  },
  confirm(user: Profile,id: string,input: any) {
    return store.transaction(()=>{
      const profile=actor(user,true), records=store.getCaseFamilyRecords(), proposal=records.proposals.find(row=>row.id===id&&row.actorId===profile.id);if(!proposal)fail("FAMILY_NOT_FOUND",404);
      caseRecord(profile,proposal.sourceId);caseRecord(profile,proposal.canonicalId);
      if(input?.reviewed!==true||input?.preparedHash!==proposal.preparedHash)fail("MERGE_REVIEW_REQUIRED");
      const existing=records.merges.find(row=>row.proposalId===proposal.id);if(existing){authorizedMembers(profile,existing.preservedCaseIds);return {merge:existing,reversal:records.reversals.find(row=>row.mergeId===existing.id)};}
      if(Date.parse(proposal.expiresAt)<=Date.now())fail("MERGE_PREPARATION_EXPIRED",409);
      const {source,canonical,members,merges}=plan(profile,proposal.sourceId,proposal.canonicalId);
      if(preparedHash(members,merges)!==proposal.preparedHash)fail("MERGE_INPUT_CHANGED",409);
      const merge:CaseMerge={id:randomUUID(),proposalId:proposal.id,sourceId:source.id,canonicalId:canonical.id,actorId:profile.id,reason:proposal.reason,preparedHash:proposal.preparedHash,preservedCaseIds:members.map(row=>row.id).sort(),createdAt:new Date().toISOString()};
      store.appendCaseMerge(merge);
      for(const record of [source,canonical])store.appendFamilyHistory(record.id,"Canonical merge recorded","Reviewed canonical relationship recorded. Details are available only in the currently authorized family view. Original records and independent work remain intact.",profile,merge.id);
      audit(profile,"CASE_MERGE_CONFIRMED",source.id,{mergeId:merge.id,canonicalId:canonical.id,reason:proposal.reason,preparedHash:proposal.preparedHash});return {merge};
    });
  },
  reverse(user: Profile,id: string,input: any) {
    return store.transaction(()=>{
      const profile=actor(user,true), records=store.getCaseFamilyRecords(),merge=records.merges.find(row=>row.id===id);if(!merge)fail("FAMILY_NOT_FOUND",404);
      caseRecord(profile,merge.sourceId);caseRecord(profile,merge.canonicalId);
      authorizedMembers(profile,merge.preservedCaseIds);
      const explanation=reason(input?.reason),request=requestId(input?.requestId);if(input?.reviewed!==true)fail("MERGE_REVIEW_REQUIRED");
      const existing=records.reversals.find(row=>row.mergeId===id);
      if(existing){if(existing.actorId!==profile.id||existing.requestId!==request||existing.reason!==explanation)fail("MERGE_ALREADY_REVERSED",409);return existing;}
      authorizedMembers(profile,connected([merge.sourceId,merge.canonicalId],activeMerges()));
      const reversal={id:randomUUID(),mergeId:merge.id,actorId:profile.id,reason:explanation,requestId:request,createdAt:new Date().toISOString()};
      store.appendMergeReversal(reversal);for(const complaintId of [merge.sourceId,merge.canonicalId])store.appendFamilyHistory(complaintId,"Canonical merge reversed","Canonical relationship corrected by an audited reversal. Original records and independent obligations remain intact.",profile,merge.id);
      audit(profile,"CASE_MERGE_REVERSED",merge.sourceId,{mergeId:merge.id,reversalId:reversal.id,canonicalId:merge.canonicalId,reason:explanation});return reversal;
    });
  }
};
