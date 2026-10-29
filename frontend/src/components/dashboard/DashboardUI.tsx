import { tr, localizeLabel, useLocaleRender } from "../../i18n/index.js";
import { formatDate, formatNumber } from "../../i18n/localeUtils.js";
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { PageHeader, StatCard, StatusBadge, EmptyState } from "../ui/Interface.js";
import { RefreshCw } from "lucide-react";

export const panel="surface section-card";
export const field="control";
export const button="btn";
export const roleLabels:Record<string,string>={SYSTEM_ADMIN:"System Administrator",COMPETENT_AUTHORITY:"Competent Authority",BUREAU_HEAD:"Bureau/Cell Head",CASE_OFFICER:"Case Handling Officer"};
export function DashboardHeader({title,updated,onRefresh,loading,actions}:{title:string;updated?:string;onRefresh:()=>void;loading?:boolean;actions?:React.ReactNode}) {
  useLocaleRender();
  const {user}=useAuth();
  return <PageHeader title={localizeLabel(title)} eyebrow={tr("navigation:ui.scope")} subtitle={<><bdi dir="auto" className="original-content">{user?.fullName}</bdi> · {localizeLabel(roleLabels[user?.role||""])} · {user?.bureauId || (user?.role==="SYSTEM_ADMIN"?localizeLabel("Administration only"):["BUREAU_HEAD","CASE_OFFICER"].includes(user?.role||"")?localizeLabel("No bureau assigned — case access denied"):localizeLabel("No bureau restriction"))}{user?.region ? tr("dashboard:message", {value1: user.region}) : ""}{updated&&<span className="block text-xs text-slate-500 mt-2">{tr("dashboard:lastRefreshed")}{formatDate(updated, true)}</span>}</>} actions={<>{actions}<button className="btn-secondary" disabled={loading} onClick={onRefresh}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true"/>{loading ? tr("dashboard:refreshing") : tr("common:refresh")}</button></>}/>;
}
export function Metrics({items,onSelect,selected}:{items:{label:string;value:number;view:string}[];onSelect:(view:string)=>void;selected?:string}) {
  useLocaleRender();
  return <div className={`grid grid-cols-2 ${items.length===4?"xl:grid-cols-4":items.length===6?"xl:grid-cols-6":"xl:grid-cols-5"} gap-3 lg:gap-4`}>{items.map(item=><StatCard key={item.label} label={localizeLabel(item.label)} value={item.value} onClick={()=>onSelect(item.view)} selected={selected===item.view}/>)}</div>;
}
export function Pagination({pagination,onPage}:{pagination:any;onPage:(page:number)=>void}) {
  useLocaleRender();
  return <nav aria-label={tr("dashboard:resultsPagination")} className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-4 text-sm"><button className="btn-secondary" disabled={pagination.page<=1} onClick={()=>onPage(pagination.page-1)}>{tr("dashboard:previous")}</button><span>{tr("dashboard:paginationSummary",{page:formatNumber(pagination.page),pages:formatNumber(Math.max(1,pagination.totalPages)),total:formatNumber(pagination.total)})}</span><button className="btn-secondary" disabled={pagination.page>=pagination.totalPages} onClick={()=>onPage(pagination.page+1)}>{tr("dashboard:next")}</button></nav>;
}
export function CaseTable({rows,officer=false}:{rows:any[];officer?:boolean}) {
  useLocaleRender();
  if(!rows.length)return <EmptyState title={tr("dashboard:noComplaintsMatchThisViewWithinYourAuthorizedScope")}/>;
  return <><div className="md:hidden space-y-3">{rows.map(c=><article className="surface p-4 text-sm space-y-2" key={c.id}><h3 className="font-semibold"><bdi dir="ltr" className="canonical-value">{c.complaintId}</bdi></h3><p><bdi dir="auto" className="original-content">{c.institutionName}</bdi></p><p><StatusBadge value={c.status}/> · {localizeLabel(c.priority)}</p><p>{c.nextAction || tr("dashboard:noNextActionRecorded")}</p><p>{tr("dashboard:action_a3531")}{formatDate(c.nextActionDate) || tr("dashboard:notSet")}</p><p>{tr("dashboard:disposal")}{formatDate(c.expectedDisposalDate)}</p>{!officer&&<p>{tr("dashboard:officer")}{c.assignedOfficerName || tr("dashboard:unassigned")}</p>}<Link className="underline text-[#17365D]" to={`/cases/${c.id}`}>{tr("dashboard:openCase")}</Link></article>)}</div><div className="hidden md:block overflow-x-auto"><table className="w-full text-start text-sm"><thead><tr className="bg-slate-50">{["Complaint / Institution", "Status / Priority", "Next Action / Deadline", ...(officer?[]:["Assigned Officer"]),"Action"].map(h=><th scope="col" key={h} className="p-2">{localizeLabel(h)}</th>)}</tr></thead><tbody>{rows.map(c=><tr className="border-t border-slate-200" key={c.id}><td className="p-2"><span className="font-mono text-xs"><bdi dir="ltr" className="canonical-value">{c.complaintId}</bdi></span><div><bdi dir="auto" className="original-content">{c.institutionName}</bdi></div><div className="text-xs text-slate-500 hidden md:block">{c.category} · <bdi dir="ltr" className="canonical-value">{c.currentBureauId}</bdi></div></td><td className="p-2"><StatusBadge value={c.status}/><div className="text-xs text-slate-600">{localizeLabel(c.priority)}</div></td><td className="p-2">{c.nextAction || tr("dashboard:noNextActionRecorded")}<div className="text-xs">{tr("dashboard:action_a3531")}{formatDate(c.nextActionDate) || tr("dashboard:notSet")}</div><div className="text-xs">{tr("dashboard:disposal")}{formatDate(c.expectedDisposalDate)}</div></td>{!officer&&<td className="p-2">{c.assignedOfficerName || tr("dashboard:unassigned")}</td>}<td className="p-2"><Link className="text-[#17365D] underline font-medium" to={`/cases/${c.id}${c.allowedActions?.assign?"#assignment":""}`}>{c.allowedActions?.assign ? tr("dashboard:reviewAssign") : tr("dashboard:openCase")}</Link></td></tr>)}</tbody></table></div></>;
}
export function DecisionTable({rows}:{rows:any[]}) {
  useLocaleRender();
  return rows.length?<div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead><tr>{["Reference / Institution","Matter / Bureau","Requested","Action"].map(h=><th scope="col" key={h} className="p-2">{localizeLabel(h)}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t"><td className="p-2">{r.reference}<div>{r.institution}</div></td><td className="p-2">{localizeLabel(r.type)}<div>{r.bureau}</div></td><td className="p-2">{formatDate(r.date, false)}</td><td className="p-2"><Link className="underline text-[#17365D]" to={r.url}>{localizeLabel(r.action)}</Link></td></tr>)}</tbody></table></div>:<p className="py-4 text-sm">{tr("dashboard:noRecordedDecisionsRequireYourAuthorizedReview")}</p>;
}
