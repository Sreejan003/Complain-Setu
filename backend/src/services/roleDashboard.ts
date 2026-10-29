import { store } from "../db/store.js";
import { authorize, effectiveProfile, roleOf } from "../security/rbac.js";
import { getEscalationConfig } from "./slaScheduler.js";
import type { Complaint, Profile } from "../models/types.js";

const active = (c: Complaint) => c.status !== "Disposed";
function paginate<T>(rows: T[], page: number, limit = 10) {
  return {data:rows.slice((page-1)*limit,page*limit), pagination:{page,limit,total:rows.length,totalPages:Math.ceil(rows.length/limit)}};
}

/** One scoped collection supplies every metric, filter, workload and queue. */
export function roleDashboard(user: Profile, query: Record<string, any>) {
  const today = new Date().toISOString().slice(0,10);
  const threshold = getEscalationConfig().approachingDeadlineDays;
  const until = new Date(Date.now()+threshold*86400000).toISOString().slice(0,10);
  const page = Math.max(1,Number(query.page)||1);
  const search = String(query.search||"").toLowerCase();
  const region = String(query.region||"");
  const bureau = String(query.bureau||"");
  const from = String(query.from||"");
  const to = String(query.to||"");
  const scoped = store.getScopedComplaints();
  const cases = scoped.filter(c=>(!bureau||c.currentBureauId===bureau) && (!region||store.getComplaintRegion(c)===region) && (!from||c.receivedDate>=from) && (!to||c.receivedDate<=to));
  const overdue = (c:Complaint) => active(c) && c.expectedDisposalDate<today;
  const dueSoon = (c:Complaint) => active(c) && c.expectedDisposalDate>=today && c.expectedDisposalDate<=until;
  const dueToday = (c:Complaint) => active(c) && c.nextActionDate===today;
  const ids = new Set(cases.map(c=>c.id));
  const transfers = store.getTransfers().filter(t=> {
    const c=store.getTransferComplaint(t.complaintId);
    return !!c && (!region||store.getComplaintRegion(c)===region) && (!bureau||[t.fromBureauId,t.toBureauId].includes(bureau)) && (!from||c.receivedDate>=from) && (!to||c.receivedDate<=to);
  });
  const incoming = transfers.filter(t=>t.acceptanceStatus==="Pending" && (!user.bureauId || t.toBureauId===user.bureauId)).map(t=> {
    const c=store.getTransferComplaint(t.complaintId)!;
    return {...t,canDecide:authorize(user,"transfer.respond",c,{region:store.getComplaintRegion(c),receivingBureauId:t.toBureauId,pending:true})};
  });
  const requests = store.getWorkflowRequests().filter(r=>roleOf(user.role)==="CASE_OFFICER" || ids.has(r.complaintId)).map(r=>({...r,caseAccessible:ids.has(r.complaintId),canReview:store.canReviewRequest(user,r)}));
  const decisions = requests.filter(r=>r.status==="Pending" && r.canReview).map(r=>({id:r.id,caseId:r.complaintId,reference:r.complaintRef,institution:r.institutionName,bureau:r.bureauId,type:r.type+" recommendation",date:r.requestedAt,action:"Review request",url:`/cases/${r.complaintId}#requests`}));
  for (const t of incoming.filter(t=>t.canDecide)) decisions.push({id:t.id,caseId:t.complaintId,reference:t.complaintRefId,institution:t.institutionName,bureau:t.toBureauId,type:"Incoming transfer",date:t.transferredAt,action:"Review transfer",url:"/transfers"});
  const overlaps = store.getOverlapAlerts({limit:100}).data.filter(o=>ids.has(o.complaintIdA)||ids.has(o.complaintIdB));
  // Fetch additional pages; no summary is silently capped by list pagination.
  for(let p=2;p<=Math.ceil(store.getOverlapAlerts({limit:100}).pagination.total/100);p++) overlaps.push(...store.getOverlapAlerts({limit:100,page:p}).data.filter(o=>ids.has(o.complaintIdA)||ids.has(o.complaintIdB)));
  const pendingOverlaps = overlaps.filter(o=>o.alertStatus==="Pending Review" && o.bureauA!==o.bureauB);
  for (const o of pendingOverlaps) {
    const c=cases.find(c=>[o.complaintIdA,o.complaintIdB].includes(c.id));
    if(c && authorize(user,"overlap.decide",c,{region:store.getComplaintRegion(c)})) decisions.push({id:o.id,caseId:c.id,reference:o.alertId,institution:o.institutionName,bureau:`${o.bureauA} / ${o.bureauB}`,type:"Potential overlap",date:o.createdAt,action:"Review overlap",url:"/overlaps"});
  }
  for (const c of cases.filter(c=>c.status==="Escalated")) decisions.push({id:`escalation-${c.id}`,caseId:c.id,reference:c.complaintId,institution:c.institutionName,bureau:c.currentBureauId,type:"Escalated case",date:c.updatedAt,action:"Review case",url:`/cases/${c.id}`});
  const role=roleOf(user.role);
  const metric = (label:string,value:number,view:string) => ({label,value,view});
  const metrics = role==="CASE_OFFICER" ? [metric("My Assigned Cases",cases.length,"all"),metric("Actions Due Today",cases.filter(dueToday).length,"today"),metric("Upcoming Deadlines",cases.filter(dueSoon).length,"soon"),metric("Completed Cases",cases.filter(c=>!active(c)).length,"completed")] : role==="BUREAU_HEAD" ? [metric("Total Bureau Cases",cases.length,"all"),metric("Unassigned Cases",cases.filter(c=>active(c)&&!c.assignedOfficerId).length,"unassigned"),metric("Overdue Cases",cases.filter(overdue).length,"overdue"),metric("Cases Due Soon",cases.filter(dueSoon).length,"soon"),metric("Pending Bureau Decisions",decisions.length,"decisions")] : [metric("Total Complaints in Scope",cases.length,"all"),metric("Active Complaints",cases.filter(active).length,"active"),metric("Overdue Complaints",cases.filter(overdue).length,"overdue"),metric("Pending Supervisory Decisions",decisions.length,"decisions"),metric("Potential Cross-Bureau Overlaps",pendingOverlaps.length,"overlaps")];
  const view=String(query.view || (role==="BUREAU_HEAD"?"unassigned":"all"));
  let rows=cases.filter(c=>!search||`${c.complaintId} ${c.institutionName} ${c.aictePermanentId}`.toLowerCase().includes(search));
  const predicates:Record<string,(c:Complaint)=>boolean> = {unassigned:c=>active(c)&&!c.assignedOfficerId,active,today:dueToday,soon:dueSoon,overdue:c=>overdue(c)||(role==="CASE_OFFICER"&&active(c)&&!!c.nextActionDate&&c.nextActionDate<today),pending:c=>c.status==="Pending",process:c=>c.status==="Under Process",completed:c=>!active(c)};
  if(predicates[view]) rows=rows.filter(predicates[view]);
  const priority:Record<string,number>={Critical:0,High:1,Medium:2,Low:3};
  const rank=(c:Complaint)=>!active(c)?4:c.nextActionDate&&c.nextActionDate<today?0:dueToday(c)?1:dueSoon(c)||overdue(c)?2:3;
  rows.sort((a,b)=>rank(a)-rank(b)||(a.nextActionDate||a.expectedDisposalDate).localeCompare(b.nextActionDate||b.expectedDisposalDate)||priority[a.priority]-priority[b.priority]||a.receivedDate.localeCompare(b.receivedDate));
  const bureauPerformance=store.getBureaus().filter(b=>!user.bureauId||b.id===user.bureauId).map(b=>{const list=cases.filter(c=>c.currentBureauId===b.id);return {bureau:b.id,total:list.length,pending:list.filter(c=>c.status==="Pending").length,disposed:list.filter(c=>!active(c)).length,overdue:list.filter(overdue).length};});
  const workload=store.getProfiles().map(effectiveProfile).filter(p=>role==="BUREAU_HEAD"&&p.isActive&&p.role==="CASE_OFFICER"&&p.bureauId===user.bureauId&&(!user.region||p.region===user.region)).map(p=>{const list=cases.filter(c=>c.assignedOfficerId===p.id);const last=list.map(c=>store.getLastAction(c.id)).filter(Boolean).sort((a,b)=>b!.createdAt.localeCompare(a!.createdAt))[0];return {id:p.id,name:p.fullName,active:list.filter(active).length,pending:list.filter(c=>c.status==="Pending").length,overdue:list.filter(overdue).length,dueSoon:list.filter(dueSoon).length,lastAction:last?.createdAt};});
  const countBy=(key:(c:Complaint)=>string)=>Object.entries(cases.reduce<Record<string,number>>((counts,c)=>{const k=key(c);counts[k]=(counts[k]||0)+1;return counts;},{})).map(([name,count])=>({name,count}));
  const institutions=Object.entries(cases.reduce<Record<string,{name:string;count:number}>>((all,c)=>{all[c.institutionId]??={name:c.institutionName,count:0};all[c.institutionId].count++;return all;},{})).map(([id,value])=>({id,...value})).sort((a,b)=>b.count-a.count).slice(0,5);
  const queue=paginate(rows,page);
  return {role,generatedAt:new Date().toISOString(),today,threshold,view,metrics,definitions:{today:"Active complaints whose recorded nextActionDate equals today (UTC calendar date); disposal dates are not substituted.",decisions:"Pending recommendations the account may review, delegated incoming transfer decisions, pending overlap reviews, and escalated cases; each row is a separate recorded matter."},
    kpi:{totalComplaints:cases.length},cases:{...queue,data:queue.data.map(c=>({...c,lastAction:store.getLastAction(c.id),allowedActions:{assign:authorize(user,"case.assign",c,{region:store.getComplaintRegion(c)})}}))},
    decisions:paginate((view==="overlaps"?pendingOverlaps.map(o=>({id:o.id,caseId:o.complaintIdA,reference:o.alertId,institution:o.institutionName,bureau:o.bureauA+" / "+o.bureauB,type:"Potential overlap",date:o.createdAt,action:"Open overlap",url:"/overlaps"})):decisions).sort((a,b)=>a.date.localeCompare(b.date)),page),requests:paginate(requests.sort((a,b)=>b.requestedAt.localeCompare(a.requestedAt)),page),incoming:paginate(incoming,page),outgoing:paginate(transfers.filter(t=>!user.bureauId||t.fromBureauId===user.bureauId),page),workload,
    statusDistribution:countBy(c=>c.status),disposalTrend:countBy(c=>c.status==="Disposed"?(c.disposalDate||"Unknown").slice(0,7):"active").filter(x=>x.name!=="active"),categoryDistribution:countBy(c=>c.category),regions:countBy(c=>store.getComplaintRegion(c)||"Unspecified"),bureauPerformance,overlapSummary:overlaps.reduce<Record<string,number>>((a,o)=>{a[o.alertStatus]=(a[o.alertStatus]||0)+1;return a;},{}),institutions,
    filterOptions:{bureaus:store.getBureaus().filter(b=>!user.bureauId||b.id===user.bureauId).map(b=>b.id),regions:[...new Set(scoped.map(c=>store.getComplaintRegion(c)).filter(Boolean))]}};
}
