import { ErrorState, LoadingSkeleton } from "../components/ui/Interface.js";
import { tr, localizeLabel, localizeError, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber, formatMonth } from "../i18n/localeUtils.js";
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../services/api.js";
import { AdminWorkspace } from "./AdminWorkspace.js";
import { DashboardHeader, Metrics, CaseTable, DecisionTable, Pagination, panel, field } from "../components/dashboard/DashboardUI.js";

export function RoleDashboard() {
  useLocaleRender();
  const {user}=useAuth();
  return user?.role==="SYSTEM_ADMIN"?<AdminWorkspace/>:<ComplaintDashboard/>;
}
function ComplaintDashboard() {
  useLocaleRender();
  const {user}=useAuth();
  const [params,setParams]=useSearchParams();
  const [data,setData]=useState<any>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
  const query=params.toString();
  useEffect(()=>{
    let active=true;
    const load=async()=>{setLoading(true);try{const result=await api.request(`analytics/role-dashboard?${query}`);if(active){setData(result);setError("");}}catch(e:any){if(active)setError(e.message);}finally{if(active)setLoading(false);}};
    const debounce=setTimeout(load,200),timer=setInterval(load,30000);
    return ()=>{active=false;clearTimeout(debounce);clearInterval(timer);};
  },[query,refresh,user?.id]);
  useEffect(()=>setData(null),[user?.id]);
  const setFilter=(key:string,value:string)=>{const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);if(key!=="page")next.set("page","1");setParams(next);};
  const role=user?.role;
  const title=tr(role==="COMPETENT_AUTHORITY"?"navigation:ui.authorityTitle":role==="BUREAU_HEAD"?"navigation:ui.bureauTitle":"navigation:ui.officerTitle");
  return <div className="space-y-4"><DashboardHeader actions={<Link to="/coordination" className="btn-secondary">{tr("workflow:crossBureau.title")}</Link>} title={title} updated={data?.generatedAt} loading={loading} onRefresh={()=>setRefresh(n=>n+1)}/>
    {error&&<ErrorState message={localizeError(error)} onRetry={()=>setRefresh(n=>n+1)}/>}
    {!data ? <LoadingSkeleton label={loading ? tr("dashboard:loadingAuthorizedRecords") : tr("dashboard:dashboardCouldNotBeLoadedUseRefreshToRetry")}/> : <>
      <Metrics items={data.metrics} selected={data.view} onSelect={view=>{const next=new URLSearchParams(params);next.delete("search");next.set("view",view);next.set("page","1");setParams(next);}}/>
      {role!=="CASE_OFFICER" && <div className="filter-bar" aria-label={tr("dashboard:dashboardFilters")}>
        {role==="COMPETENT_AUTHORITY"&&<><label className="text-sm">{tr("dashboard:bureau")}<select className={`${field} block`} value={params.get("bureau")||""} onChange={e=>setFilter("bureau",e.target.value)}><option value="">{tr("dashboard:authorizedBureaus")}</option>{data.filterOptions.bureaus.map((b:string)=><option value={b} key={b}>{b}</option>)}</select></label><label className="text-sm">{tr("dashboard:region")}<select className={`${field} block`} value={params.get("region")||""} onChange={e=>setFilter("region",e.target.value)}><option value="">{tr("dashboard:authorizedRegions")}</option>{data.filterOptions.regions.map((r:string)=><option value={r} key={r}>{r}</option>)}</select></label></>}
        {<><label className="text-sm">{tr("dashboard:receivedFrom")}<input type="date" className={`${field} block`} value={params.get("from")||""} onChange={e=>setFilter("from",e.target.value)}/></label><label className="text-sm">{tr("dashboard:receivedTo")}<input type="date" className={`${field} block`} value={params.get("to")||""} onChange={e=>setFilter("to",e.target.value)}/></label></>}
      </div>}
      {role==="COMPETENT_AUTHORITY"?<CompetentAuthorityDashboard data={data} setFilter={setFilter}/>:role==="BUREAU_HEAD"?<BureauHeadDashboard data={data} params={params} setFilter={setFilter}/>:<CaseOfficerDashboard data={data} params={params} setFilter={setFilter}/>}
    </>}
  </div>;
}
function Queue({data,params,setFilter,officer=false}:any) {
  useLocaleRender();
  const views=officer?[['all','All Assigned'],['today','Due Today'],['soon','Due Soon'],['overdue','Overdue'],['pending','Pending'],['process','Under Process'],['completed','Completed']]:[['unassigned','Unassigned'],['soon','Due Soon'],['overdue','Overdue'],['decisions','Pending Review'],['active','Active Cases'],['transfers','Pending Transfers'],['all','All Cases']];
  return <section className={panel}><h2 className="font-bold mb-3">{officer ? tr("dashboard:myAssignedComplaints") : tr("dashboard:priorityActionQueue")}</h2><div className="tab-bar">{views.map(([value,label])=><button className="tab-button" aria-pressed={data.view===value} onClick={()=>setFilter("view",value)} key={value}>{localizeLabel(label)}</button>)}</div>
    <label className="block text-sm mb-3">{tr("dashboard:searchComplaintOrInstitution")}<input className={`${field} block w-full md:max-w-sm`} value={params.get("search")||""} onChange={e=>setFilter("search",e.target.value)}/></label>
    {data.view==="decisions" ? <><DecisionTable rows={data.decisions.data}/><Pagination pagination={data.decisions.pagination} onPage={p=>setFilter("page",String(p))}/></> : data.view==="transfers" ? <TransferInbox data={data}/> : <><CaseTable rows={data.cases.data} officer={officer}/><Pagination pagination={data.cases.pagination} onPage={p=>setFilter("page",String(p))}/></>}
  </section>;
}
function CompetentAuthorityDashboard({data,setFilter}:any) {
  useLocaleRender();
  return <><section className={panel}><h2 className="font-bold mb-3">{["all","active","overdue"].includes(data.view) ? tr("dashboard:authorizedComplaintOverview") : tr("dashboard:decisionsRequiringAttention")}</h2>{["all","active","overdue"].includes(data.view) ? <><CaseTable rows={data.cases.data}/><Pagination pagination={data.cases.pagination} onPage={p=>setFilter("page",String(p))}/></> : <><p className="text-xs text-slate-500 mb-3">{localizeLabel(data.definitions.decisions)}</p><DecisionTable rows={data.decisions.data}/><Pagination pagination={data.decisions.pagination} onPage={p=>setFilter("page",String(p))}/></>}</section>
    <section className={panel}><h2 className="font-bold mb-3">{tr("dashboard:complaintPerformanceOverview")}</h2><div className="grid md:grid-cols-2 gap-6"><div><h3 className="text-sm font-semibold">{tr("dashboard:statusDistribution")}</h3>{data.statusDistribution.map((s:any)=><div className="flex gap-3 items-center text-sm my-2" key={s.name}><span className="w-28 shrink-0">{localizeLabel(s.name)}</span><meter aria-label={localizeLabel(s.name)} className="w-full" min={0} max={Math.max(1,data.kpi.totalComplaints)} value={s.count}/><span>{formatNumber(s.count)}</span></div>)}</div><div><h3 className="text-sm font-semibold">{tr("dashboard:recordedDisposalsByMonth")}</h3>{data.disposalTrend.length ? data.disposalTrend.map((s:any)=><p key={s.name} className="text-sm mt-2">{formatMonth(s.name)}: {formatNumber(s.count)}</p>) : <p className="text-sm mt-2">{tr("dashboard:noDisposalRecordsInThisPeriod")}</p>}<p className="text-xs text-slate-500 mt-4">{tr("dashboard:allFiguresUseTheSameAuthorizedBureauRegionAnd")}</p></div></div><BureauPerformance data={data}/></section>
    <details className={panel}><summary className="font-bold cursor-pointer">{tr("dashboard:crossBureauCoordinationInstitutionInsights")}</summary><div className="grid md:grid-cols-2 gap-4 mt-3"><div><h3 className="font-semibold text-sm">{tr("dashboard:recordedOverlapOutcomes")}</h3>{Object.entries(data.overlapSummary).map(([state,count])=><p className="text-sm mt-1" key={state}>{localizeLabel(state)}: {formatNumber(Number(count))}</p>)}<Link className="underline text-sm text-[#17365D]" to="/overlaps">{tr("dashboard:reviewPotentialOverlapsAndRecordedDecisions")}</Link><p className="text-xs text-slate-500 mt-2">{tr("dashboard:detectionIdentifiesPotentialRelationshipsAuthorizedReviewRecordsTheOfficial")}</p></div><div><h3 className="text-sm font-semibold">{tr("dashboard:institutionsWithMostCasesInScope")}</h3>{data.institutions.map((i:any)=><p className="text-sm mt-1" key={i.id}><Link className="underline" to={`/institutions/${i.id}`}>{i.name}</Link> · {formatNumber(i.count)}</p>)}<Link className="underline text-sm" to="/analytics">{tr("dashboard:openScopedReportsAndExports")}</Link></div></div></details>
  </>;
}
function BureauHeadDashboard({data,params,setFilter}:any) {
  useLocaleRender();
  return <><Queue data={data} params={params} setFilter={setFilter}/><section className={panel}><h2 className="font-bold mb-3">{tr("dashboard:officerWorkload")}</h2><div className="overflow-x-auto"><table className="w-full text-sm text-start"><thead><tr>{["Officer","Active","Pending","Overdue","Due Soon","Last Case Action"].map(s=><th className="p-2" scope="col" key={s}>{localizeLabel(s)}</th>)}</tr></thead><tbody>{data.workload.map((o:any)=><tr className="border-t" key={o.id}><td className="p-2">{o.name}</td><td>{formatNumber(o.active)}</td><td>{formatNumber(o.pending)}</td><td>{formatNumber(o.overdue)}</td><td>{formatNumber(o.dueSoon)}</td><td>{o.lastAction ? formatDate(o.lastAction, false) : tr("dashboard:noRecordedAction")}</td></tr>)}</tbody></table></div>{!data.workload.length&&<p>{tr("dashboard:noEligibleActiveOfficersInThisScope")}</p>}</section><details className={panel}><summary className="font-bold cursor-pointer">{tr("dashboard:transferCoordinationInboxBureauPerformance")}</summary><div className="mt-3"><TransferInbox data={data}/><Link to="/overlaps" className="text-sm underline">{tr("dashboard:reviewBureauOverlapAndCoordinationRecords")}</Link><BureauPerformance data={data}/></div></details></>;
}
function CaseOfficerDashboard({data,params,setFilter}:any) {
  useLocaleRender();
  return <><details className="text-xs text-slate-600"><summary className="cursor-pointer font-medium">{tr("navigation:ui.priorityDefinition")}</summary><p className="mt-2">{localizeLabel(data.definitions.today)}{tr("dashboard:upcomingDisposalDeadlinesUseTheConfigured")}{formatNumber(data.threshold)}{tr("dashboard:dayWindow")}</p></details><Queue data={data} params={params} setFilter={setFilter} officer/><section className={panel}><h2 className="font-bold mb-3">{tr("dashboard:mySupervisoryRequests")}</h2>{data.requests.data.length ? <ul className="space-y-3 text-sm">{data.requests.data.map((r:any)=><li key={r.id} className="border-b pb-2">{r.caseAccessible?<Link className="underline" to={`/cases/${r.complaintId}#requests`}><bdi dir="ltr" className="canonical-value">{r.complaintRef}</bdi></Link>:<span><bdi dir="ltr" className="canonical-value">{r.complaintRef}</bdi>{tr("dashboard:caseAccessFollowsCurrentAssignment")}</span>} · {localizeLabel(r.type)} · <strong>{localizeLabel(r.status)}</strong><p><bdi dir="auto" className="original-content">{r.remarks}</bdi></p><p className="text-xs text-slate-500">{tr("dashboard:requested")}{formatDate(r.requestedAt, true)}{r.reviewedByName ? ` · ${r.reviewedByName}: ${r.decisionRemarks} (${formatDate(r.decidedAt, true)})` : tr("dashboard:awaitingAuthorizedSupervisoryReview")}</p></li>)}</ul> : <p className="text-sm">{tr("dashboard:noSupervisoryRequestsSubmittedForYourCurrentAssignedCases")}</p>}<Pagination pagination={data.requests.pagination} onPage={p=>setFilter("page",String(p))}/></section></>;
}
function TransferInbox({data}:any) {
  useLocaleRender();
  return <div className="grid md:grid-cols-2 gap-4 text-sm"><div><h3 className="font-semibold">{tr("dashboard:incomingPendingTransfers")}</h3>{data.incoming.data.length ? data.incoming.data.map((t:any)=><p className="mt-2" key={t.id}><bdi dir="ltr" className="canonical-value">{t.complaintRefId}</bdi> · <bdi dir="ltr" className="canonical-value">{t.fromBureauId}</bdi><br/><bdi dir="auto" className="original-content">{t.transferReason}</bdi><br/><Link to="/transfers" className="underline">{t.canDecide ? tr("dashboard:reviewAuthorizedDecision") : tr("dashboard:viewPermittedTransferReference")}</Link></p>) : <p className="mt-2">{tr("dashboard:noIncomingPendingTransfers")}</p>}</div><div><h3 className="font-semibold">{tr("dashboard:outgoingTransfers")}</h3>{data.outgoing.data.length ? data.outgoing.data.map((t:any)=><p className="mt-2" key={t.id}><bdi dir="ltr" className="canonical-value">{t.complaintRefId}</bdi> → <bdi dir="ltr" className="canonical-value">{t.toBureauId}</bdi> · {localizeLabel(t.acceptanceStatus)}<br/>{t.decisionRemarks || t.transferReason}</p>) : <p className="mt-2">{tr("dashboard:noOutgoingTransfers")}</p>}<Link className="underline" to="/transfers">{tr("dashboard:openFullTransferHistory")}</Link></div></div>;
}
function BureauPerformance({data}:any) {
  useLocaleRender();
  return <details className="mt-4"><summary className="text-sm font-semibold cursor-pointer">{tr("dashboard:bureauComparisonAndRegionalTotals")}</summary><div className="overflow-x-auto mt-2"><table className="text-sm w-full text-start"><thead><tr>{["Bureau","Total","Pending","Disposed","Overdue"].map(h=><th scope="col" className="p-2" key={h}>{localizeLabel(h)}</th>)}</tr></thead><tbody>{data.bureauPerformance.map((b:any)=><tr className="border-t" key={b.bureau}><td className="p-2">{b.bureau}</td><td>{formatNumber(b.total)}</td><td>{formatNumber(b.pending)}</td><td>{formatNumber(b.disposed)}</td><td>{formatNumber(b.overdue)}</td></tr>)}</tbody></table></div>{data.regions.map((r:any)=><p className="text-sm mt-2" key={r.name}>{r.name}: {formatNumber(r.count)}</p>)}</details>;
}
