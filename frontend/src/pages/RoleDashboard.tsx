import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { AdminWorkspace } from "./AdminWorkspace.js";

export async function roleRequest(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`/api/${path}`, { method, headers: {Authorization:`Bearer ${localStorage.getItem("aicte_token") || ""}`, "Content-Type":"application/json"}, ...(body ? {body:JSON.stringify(body)} : {}) });
  const data = await res.json();
  if (!res.ok) {
    if (res.status===401 || data.code==="SESSION_REVOKED") window.dispatchEvent(new Event("aicte-session-expired"));
    throw new Error(data.error || "Request failed");
  }
  return data;
}
export const panel = "bg-white border border-[#E2E8F0] rounded-xs p-4 shadow-xs";
export const field = "border border-slate-300 rounded-xs p-2 text-xs bg-white";
export const button = "bg-[#17365D] text-white px-3 py-2 rounded-xs text-xs disabled:opacity-50";
export function Metrics({items}: {items: [string, number][]}) {
  return <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">{items.map(([label,value])=><div className={panel} key={label}><p className="text-xs font-semibold text-slate-600">{label}</p><p className="text-2xl font-bold font-mono mt-2">{value}</p></div>)}</div>;
}
export function RoleDashboard() {
  const {user} = useAuth();
  if (user?.role === "SYSTEM_ADMIN") return <AdminWorkspace />;
  return <CaseWorkspace />;
}
function CaseWorkspace() {
  const {user} = useAuth();
  const [data,setData] = useState<any>(null), [error,setError] = useState("");
  const [page,setPage] = useState(1), [search,setSearch] = useState(""), [status,setStatus] = useState("");
  const [category,setCategory] = useState(""), [officer,setOfficer] = useState(""), [from,setFrom] = useState(""), [to,setTo] = useState("");
  const [refresh,setRefresh] = useState(0);
  useEffect(()=> {
    let active=true;
    setData(null);
    const load=()=>roleRequest(`analytics/role-dashboard?${new URLSearchParams({page:String(page),search,status,category,officer,from,to})}`).then(d=>{if(active){setData(d);setError("");}}).catch(e=>{if(active)setError(e.message);});
    const debounce=setTimeout(load,250), timer=setInterval(load,30000);
    return ()=>{active=false;clearTimeout(debounce);clearInterval(timer);};
  },[page,search,status,category,officer,from,to,refresh,user?.id]);
  const authority=user?.role==="COMPETENT_AUTHORITY", head=user?.role==="BUREAU_HEAD";
  const title=authority?"Competent Authority Dashboard":head?`${user?.bureauId || "Bureau"} — Bureau/Cell Head Dashboard`:"Case Handling Officer Dashboard";
  const k=data?.kpi;
  const metrics: [string,number][] = !data?[]:authority?[["Total Complaints",k.totalComplaints],["Pending Complaints",k.pendingComplaints],["Under Process",k.underProcessComplaints],["Disposed Complaints",k.disposedComplaints],["Overdue Complaints",k.overdueComplaints]]:head?[["Total Bureau Cases",k.totalComplaints],["Pending Cases",k.pendingComplaints],["Under Process",k.underProcessComplaints],["Overdue Cases",k.overdueComplaints],["Unassigned Cases",data.unassigned]]:[["My Assigned Cases",k.totalComplaints],["Pending Actions",data.pendingActions],["Due Soon",data.dueSoon],["Completed Cases",k.disposedComplaints]];
  return <div className="space-y-4 text-slate-900">
    <div className={`${panel} flex justify-between items-center gap-3`}><h1 className="text-xl font-bold">{title}</h1><button className={button} onClick={()=>setRefresh(x=>x+1)}>Refresh</button></div>
    {error && <p role="alert" className="text-red-800">{error}</p>}
    {!data?<p role="status">Loading authorized dashboard records…</p>:<>
      <Metrics items={metrics}/>
      <section className={panel}><h2 className="font-bold text-sm mb-3">{authority?"AICTE-wide Complaint Overview":head?"Bureau Complaint Overview":"My Assigned Complaints"}</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <input aria-label="Search complaints or institution" placeholder="Search complaints / institution" className={field} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
          <select aria-label="Status filter" className={field} value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">All statuses</option>{["Pending","Under Process","Escalated","Transferred","Disposed"].map(s=><option key={s}>{s}</option>)}</select>
          <input aria-label="Category filter" placeholder="Category" className={field} value={category} onChange={e=>{setCategory(e.target.value);setPage(1);}}/>
          {head && <input aria-label="Assigned officer ID filter" placeholder="Assigned officer ID" className={field} value={officer} onChange={e=>{setOfficer(e.target.value);setPage(1);}}/>}
          <label className="text-xs">Received from <input type="date" className={field} value={from} onChange={e=>{setFrom(e.target.value);setPage(1);}}/></label>
          <label className="text-xs">to <input type="date" className={field} value={to} onChange={e=>{setTo(e.target.value);setPage(1);}}/></label>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs gov-table"><thead><tr>{["Complaint ID","Institution / Permanent ID","Category","Bureau / Officer","Status","Last Action","Next Action","Received","Expected Disposal","Action"].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{data.cases.data.map((c:any)=><tr className="border-t border-slate-200" key={c.id}><td className="p-2 font-mono">{c.complaintId}</td><td className="p-2">{c.institutionName}<div>{c.aictePermanentId}</div></td><td className="p-2">{c.category}</td><td className="p-2">{c.currentBureauId}<div>{c.assignedOfficerName || "Unassigned"}</div></td><td className="p-2">{c.status}</td><td className="p-2">{c.lastAction?.actionType || "No recorded action"}<div>{c.lastAction?.createdAt}</div></td><td className="p-2">{c.nextAction || "Review case"}{c.nextActionDate && <div>{c.nextActionDate}</div>}</td><td className="p-2">{c.receivedDate}</td><td className="p-2">{c.expectedDisposalDate}</td><td className="p-2"><Link className="text-[#17365D] underline" to={`/cases/${c.id}`}>{head?"Review / Assign":"Open case"}</Link></td></tr>)}</tbody></table></div>
        {!data.cases.data.length && <p className="text-xs py-4">No complaints match your authorized scope and filters.</p>}
        <div className="flex gap-3 items-center mt-3 text-xs"><button className={button} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} · {data.cases.pagination.total} records</span><button className={button} disabled={page>=data.cases.pagination.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></div>
      </section>
      {(authority||head) && <section className={panel}><h2 className="text-sm font-bold mb-3">Bureau Performance</h2><div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr>{["Bureau","Total","Pending","Disposed","Overdue","Disposal rate"].map(s=><th className="p-2" key={s}>{s}</th>)}</tr></thead><tbody>{data.performance.bureauPerformance?.filter((b:any)=>authority||b.bureau===user?.bureauId).map((b:any)=><tr key={b.bureau}><td className="p-2">{b.bureau}</td><td>{b.total}</td><td>{b.pending ?? 0}</td><td>{b.disposed}</td><td>{b.overdue}</td><td>{b.disposalRate}%</td></tr>)}</tbody></table></div><div className="flex flex-wrap gap-4 mt-3 text-xs underline"><Link to="/overlaps">Review overlapping cases</Link><Link to="/cases?status=Escalated">Escalation monitoring</Link><Link to="/analytics">Reports and exports</Link></div></section>}
      {!authority&&!head && <section className={panel}><h2 className="font-bold text-sm">Upcoming Deadlines</h2><p className="text-xs text-slate-600 my-2">Assigned active cases due within the configured {data.threshold} calendar days. Pending actions appear first by disposal deadline in the table above.</p>{data.upcoming.length?data.upcoming.map((c:any)=><p className="text-xs py-1" key={c.id}><Link className="underline" to={`/cases/${c.id}`}>{c.complaintId}</Link> · {c.expectedDisposalDate}</p>):<p className="text-xs">No upcoming deadlines.</p>}</section>}
    </>}
  </div>;
}
