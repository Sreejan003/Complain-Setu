import {useEffect,useState} from "react";
import {api} from "../services/api.js";
import {tr,useLocaleRender} from "../i18n/index.js";
import {PageHeader,SectionCard,ErrorState} from "../components/ui/Interface.js";
type Policy={id:string;name:string;enabled:boolean;precedence:number;effectiveFrom:string;effectiveTo?:string;days:number;calendar:string;timezone:string;startBasis:string;categories:string[];caseTypes:string[];sources:string[];priorities:string[];holidays:string[];allowedPauseReasons:string[];reference?:string};
type Configuration={version:number;policies:Policy[];reminderDays:number[];inactivityDays:number;cooldownHours:number;duplicateStorm:{enabled:boolean;windowDays:number;threshold:number}};
type State={current:Configuration;history:(Configuration&{reason:string})[];categories:string[];priorities:string[];caseTypes:{id:string;label:string}[];sources:{id:string;label:string}[]};
const t=(key:string)=>tr("complaints:slaPolicy."+key),field="w-full border border-slate-200 rounded-lg p-2 bg-white text-sm";
export function SlaPolicies(){
  useLocaleRender();const[state,setState]=useState<State>(),[reason,setReason]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;api.request<State>("admin/sla-policies").then(value=>{if(active)setState(value);}).catch(()=>{if(active)setError(t("failed"));});return()=>{active=false;};},[]);
  const config=state?.current;
  function change(patch:Partial<Configuration>){if(state)setState({...state,current:{...state.current,...patch}});}
  function policy(index:number,patch:Partial<Policy>){if(config)change({policies:config.policies.map((row,i)=>i===index?{...row,...patch}:row)});}
  async function save(rollbackTo?:number){if(!config)return;setBusy(true);setError("");setNotice("");try{setState(await api.request<State>("admin/sla-policies","PUT",{...config,policies:config.policies.map(row=>({...row,...Object.fromEntries((["categories","caseTypes","sources","priorities","holidays","allowedPauseReasons"] as const).map(key=>[key,row[key].map(value=>value.trim()).filter(Boolean)]))})),reason,rollbackTo}));setReason("");setNotice(t("saved"));}catch{setError(t("failed"));}finally{setBusy(false);}}
  return <div className="space-y-5"><PageHeader title={t("title")} subtitle={t("operationalNotice")}/>{error&&<ErrorState message={error}/>} {notice&&<p role="status">{notice}</p>}
    {config&&state&&<form onSubmit={event=>{event.preventDefault();void save();}}><fieldset disabled={busy} className="space-y-5">
      <SectionCard title={t("matching")} description={t("matchingNotice")}><p className="text-sm">{t("configurationVersion")}: {config.version}</p><p className="text-sm mt-2">{t("availableCodes")}: {state.categories.join(", ")} · {state.priorities.join(", ")} · {state.caseTypes.map(row=>row.id).join(", ")} · {state.sources.map(row=>row.id).join(", ")}</p></SectionCard>
      {config.policies.map((row,index)=><SectionCard key={row.id} title={row.name+" · "+row.id}><details><summary className="cursor-pointer text-sm">{t("editPolicy")}</summary><div className="grid md:grid-cols-2 gap-3 mt-3">
        <label className="text-sm"><input type="checkbox" checked={row.enabled} onChange={event=>policy(index,{enabled:event.target.checked})}/> {t("enabled")}</label>
        {["name","timezone","reference"].map(key=><label key={key} className="block text-sm">{t(key)}<input className={field} value={String(row[key as keyof Policy]||"")} required={key!=="reference"} maxLength={key==="reference"?1000:150} onChange={event=>policy(index,{[key]:event.target.value})}/></label>)}
        {["precedence","days"].map(key=><label key={key} className="block text-sm">{t(key)}<input type="number" className={field} min={key==="days"?1:0} max={key==="days"?3650:10000} required value={Number(row[key as keyof Policy])} onChange={event=>policy(index,{[key]:Number(event.target.value)})}/></label>)}
        {["effectiveFrom","effectiveTo"].map(key=><label key={key} className="block text-sm">{t(key)}<input type="date" className={field} required={key==="effectiveFrom"} value={String(row[key as keyof Policy]||"")} onChange={event=>policy(index,{[key]:event.target.value||undefined})}/></label>)}
        {([ ["calendar",["calendar","business"]],["startBasis",["received_date","source_received_date"]] ] as const).map(([key,options])=><label key={key} className="block text-sm">{t(key==="calendar"?"calendarMode":key)}<select className={field} value={row[key]} onChange={event=>policy(index,{[key]:event.target.value})}>{options.map(value=><option key={value} value={value}>{t(value)}</option>)}</select></label>)}
        {(["categories","caseTypes","sources","priorities","holidays","allowedPauseReasons"] as const).map(key=><label key={key} className="block text-sm">{t(key)}<input className={field} value={row[key].join(",")} onChange={event=>policy(index,{[key]:event.target.value.split(",")})}/></label>)}
      </div></details></SectionCard>)}
      <button type="button" className="btn-secondary" disabled={config.policies.length>=60} onClick={()=>change({policies:[...config.policies,{...config.policies[0],id:"policy-"+crypto.randomUUID().slice(0,8),name:t("newPolicy"),enabled:false,categories:[],caseTypes:[],sources:[],priorities:[],holidays:[],allowedPauseReasons:[],reference:undefined}]})}>{t("addPolicy")}</button>
      <SectionCard title={t("alerts")} description={t("deliveryNotice")}><div className="grid md:grid-cols-3 gap-3">
        <div>{t("reminderDays")}{[7,3,1].map(day=><label key={day} className="block text-sm"><input type="checkbox" checked={config.reminderDays.includes(day)} onChange={event=>change({reminderDays:event.target.checked?[...config.reminderDays,day]:config.reminderDays.filter(value=>value!==day)})}/> T-{day}</label>)}</div>
        {(["inactivityDays","cooldownHours"] as const).map(key=><label key={key} className="block text-sm">{t(key)}<input className={field} type="number" min={1} max={key==="inactivityDays"?3650:8760} value={config[key]} onChange={event=>change({[key]:Number(event.target.value)})}/></label>)}
        <label className="text-sm"><input type="checkbox" checked={config.duplicateStorm.enabled} onChange={event=>change({duplicateStorm:{...config.duplicateStorm,enabled:event.target.checked}})}/> {t("duplicateStorm")}</label>
        {(["windowDays","threshold"] as const).map(key=><label key={key} className="block text-sm">{t(key)}<input className={field} type="number" min={key==="threshold"?2:1} max={key==="threshold"?1000:365} value={config.duplicateStorm[key]} onChange={event=>change({duplicateStorm:{...config.duplicateStorm,[key]:Number(event.target.value)}})}/></label>)}
      </div></SectionCard>
      <label className="block text-sm">{t("reason")}<textarea required minLength={5} maxLength={1000} className={field} value={reason} onChange={event=>setReason(event.target.value)}/></label><button className="btn" disabled={reason.trim().length<5}>{t("save")}</button>
      <SectionCard title={t("history")}><div className="space-y-2">{state.history.map(row=><div key={row.version} className="text-sm flex flex-wrap gap-3"><span>{t("configurationVersion")} {row.version} · {row.reason}</span><button type="button" className="btn-secondary" disabled={reason.trim().length<5} onClick={()=>void save(row.version)}>{t("rollback")}</button></div>)}</div></SectionCard>
    </fieldset></form>}
  </div>;
}
