import {useEffect,useState} from "react";
import {api} from "../services/api.js";
import {tr,useLocaleRender} from "../i18n/index.js";
import {formatNumber} from "../i18n/localeUtils.js";
import {PageHeader,SectionCard,ErrorState} from "../components/ui/Interface.js";
type State={valid:boolean;code:string;sequence?:number;entries?:number;legacyCount?:number;head?:string;externalCheckpoint?:string};
const t=(key:string)=>tr("complaints:auditIntegrity."+key);
export function AuditIntegrity(){
  useLocaleRender();const[state,setState]=useState<State>(),[error,setError]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  useEffect(()=>{let active=true;api.request<State>("admin/audit-integrity").then(result=>{if(active)setState(result);}).catch(()=>{if(active)setError(t("failed"));});return()=>{active=false;};},[]);
  async function verify(){setBusy(true);setError("");try{setState(await api.request<State>("admin/audit-integrity"));}catch{setError(t("failed"));}finally{setBusy(false);}}
  async function checkpoint(){setBusy(true);setError("");try{const value=await api.request("admin/audit-integrity/checkpoints","POST",{}),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"})),link=document.createElement("a");link.href=url;link.download="audit-checkpoint.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(t("exported"));setState(await api.request<State>("admin/audit-integrity"));}catch{setError(t("failed"));}finally{setBusy(false);}}
  return <div className="space-y-5"><PageHeader title={t("title")} subtitle={t("notice")} actions={<button className="btn-secondary" disabled={busy} onClick={()=>void verify()}>{t("verify")}</button>}/>{error&&<ErrorState message={error}/>} {notice&&<p role="status">{notice}</p>}
    {state&&<SectionCard title={state.valid?t("valid"):t("invalid")}><dl className="grid sm:grid-cols-2 gap-3 text-sm"><div><dt>{t("result")}</dt><dd>{state.code}</dd></div><div><dt>{t("sequence")}</dt><dd>{state.sequence===undefined?t("none"):formatNumber(state.sequence)}</dd></div><div><dt>{t("entries")}</dt><dd>{state.entries===undefined?t("unknown"):formatNumber(state.entries)}</dd></div><div><dt>{t("legacy")}</dt><dd>{state.legacyCount===undefined?t("unknown"):formatNumber(state.legacyCount)}</dd></div><div className="sm:col-span-2"><dt>{t("head")}</dt><dd className="font-mono break-all">{state.head||t("unknown")}</dd></div><div><dt>{t("external")}</dt><dd>{state.externalCheckpoint==="verified"?t("externalVerified"):t("notConfigured")}</dd></div></dl></SectionCard>}
    <SectionCard title={t("checkpointTitle")} description={t("checkpointNotice")}><button className="btn" disabled={busy||!state?.valid} onClick={()=>void checkpoint()}>{t("export")}</button><p className="text-sm mt-3">{t("threatModel")}</p><p className="text-sm mt-3">{t("onFailure")}</p></SectionCard>
  </div>;
}
