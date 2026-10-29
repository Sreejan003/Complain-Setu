import { tr, localizeLabel, localizeError, useLocaleRender } from "../../i18n/index.js";
import { formatDate, formatNumber } from "../../i18n/localeUtils.js";
import { field, button } from "../dashboard/DashboardUI.js";
import { api } from "../../services/api.js";
import React, { useState } from "react";
import {Link} from "react-router-dom";

export function CoordinationPanel({alertId,canDecide=false,canCoordinate=false}:{alertId:string;canDecide?:boolean;canCoordinate?:boolean}) {
  useLocaleRender();
  const [records,setRecords]=useState<any[]>([]),[remarks,setRemarks]=useState("");
  const [responsibleOfficerId,setResponsibleOfficerId]=useState(""),[state,setState]=useState("Requested");
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  const decide=canDecide;
  async function load(){try{setRecords(await api.request(`overlaps/${alertId}/coordination`));setError("");}catch(e:any){setError(e.message);}}
  return <details className="w-full border-t border-slate-200 pt-2 text-xs" onToggle={e=>{if(e.currentTarget.open)void load();}}><summary className="cursor-pointer font-semibold text-[#17365D]">{tr("overlaps:coordinationRequestsAndHistory")}</summary>
    {error&&<p role="alert" className="text-red-800">{localizeError(error)}</p>}
    {canCoordinate&&<Link className="underline block my-2" to={`/coordination?overlapId=${encodeURIComponent(alertId)}`}>{tr("workflow:crossBureau.request")}</Link>}
    <ol className="space-y-2 my-2">{records.map(r=><li key={r.id} className="border-s-2 border-slate-200 ps-2"><p>{formatDate(r.createdAt, true)} · {r.userName} · {localizeLabel(r.details?.state)}</p><p><bdi dir="auto" className="original-content">{r.details?.remarks}</bdi></p>{r.details?.responsibleOfficerName&&<p>{tr("overlaps:responsibleOfficial")}{r.details.responsibleOfficerName}</p>}</li>)}</ol>
    {!records.length&&<p className="my-2">{tr("overlaps:noCoordinationRequestsRecorded")}</p>}
    {canCoordinate&&<form className="space-y-2" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api.request(`overlaps/${alertId}/coordination`,"POST",{remarks,state,...(responsibleOfficerId?{responsibleOfficerId}:{})});setRemarks("");await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}}}><label className="block">{tr("overlaps:coordinationRemarks")}<textarea required maxLength={5000} className={`${field} block w-full`} value={remarks} onChange={e=>setRemarks(e.target.value)}/></label>
      {decide&&<div className="flex flex-wrap gap-2"><label>{tr("overlaps:coordinationStatus")}<select className={`${field} block`} value={state} onChange={e=>setState(e.target.value)}>{["Requested","In Progress","Resolved"].map(s=><option value={s} key={s}>{localizeLabel(s)}</option>)}</select></label><label>{tr("overlaps:responsibleOfficialIdOptional")}<input className={`${field} block`} value={responsibleOfficerId} onChange={e=>setResponsibleOfficerId(e.target.value)}/></label></div>}
      <button className={button} disabled={busy}>{decide ? tr("overlaps:recordCoordinationAction") : tr("overlaps:requestCoordination")}</button>
    </form>}
  </details>;
}
