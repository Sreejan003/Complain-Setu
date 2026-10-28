import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext.js";
import { roleRequest, field, button } from "../../pages/RoleDashboard.js";

export function CoordinationPanel({alertId}:{alertId:string}) {
  const {user}=useAuth();
  const [records,setRecords]=useState<any[]>([]),[remarks,setRemarks]=useState("");
  const [responsibleOfficerId,setResponsibleOfficerId]=useState(""),[state,setState]=useState("Requested");
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  const decide=user?.role==="COMPETENT_AUTHORITY" || (user?.role==="BUREAU_HEAD" && user.permissions?.includes("COORDINATE_CROSS_BUREAU"));
  async function load(){try{setRecords(await roleRequest(`overlaps/${alertId}/coordination`));setError("");}catch(e:any){setError(e.message);}}
  return <details className="w-full border-t border-slate-200 pt-2 text-xs" onToggle={e=>{if(e.currentTarget.open)void load();}}><summary className="cursor-pointer font-semibold text-[#17365D]">Coordination requests and history</summary>
    {error&&<p role="alert" className="text-red-800">{error}</p>}
    <ol className="space-y-2 my-2">{records.map(r=><li key={r.id} className="border-l-2 border-slate-200 pl-2"><p>{r.createdAt} · {r.userName} · {r.details?.state}</p><p>{r.details?.remarks}</p>{r.details?.responsibleOfficerName&&<p>Responsible official: {r.details.responsibleOfficerName}</p>}</li>)}</ol>
    {!records.length&&<p className="my-2">No coordination requests recorded.</p>}
    <form className="space-y-2" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await roleRequest(`overlaps/${alertId}/coordination`,"POST",{remarks,state,...(responsibleOfficerId?{responsibleOfficerId}:{})});setRemarks("");await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}}}><label className="block">Coordination remarks<textarea required maxLength={5000} className={`${field} block w-full`} value={remarks} onChange={e=>setRemarks(e.target.value)}/></label>
      {decide&&<div className="flex flex-wrap gap-2"><label>Coordination status<select className={`${field} block`} value={state} onChange={e=>setState(e.target.value)}>{["Requested","In Progress","Resolved"].map(s=><option key={s}>{s}</option>)}</select></label><label>Responsible official ID (optional)<input className={`${field} block`} value={responsibleOfficerId} onChange={e=>setResponsibleOfficerId(e.target.value)}/></label></div>}
      <button className={button} disabled={busy}>{decide?"Record coordination action":"Request coordination"}</button>
    </form>
  </details>;
}
