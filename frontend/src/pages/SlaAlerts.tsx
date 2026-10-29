import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {api} from "../services/api.js";
import {tr,useLocaleRender} from "../i18n/index.js";
import {formatDate,formatNumber} from "../i18n/localeUtils.js";
import {PageHeader,SectionCard,ErrorState} from "../components/ui/Interface.js";
type Alert={id:string;kind:string;caseIds:string[];createdAt:string;acknowledgedAt?:string;deliveries:{id:string;channel:string;status:string;attempts:number;nextAttemptAt?:string}[]};
const t=(key:string)=>tr("complaints:slaPolicy."+key);
export function SlaAlerts(){
  useLocaleRender();const[rows,setRows]=useState<Alert[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;api.request<Alert[]>("sla-alerts").then(value=>{if(active)setRows(value);}).catch(()=>{if(active)setError(t("failed"));});return()=>{active=false;};},[]);
  async function acknowledge(id:string){setBusy(true);setError("");try{await api.request(`sla-alerts/${encodeURIComponent(id)}/acknowledge`,"POST",{});setRows(await api.request<Alert[]>("sla-alerts"));}catch{setError(t("failed"));}finally{setBusy(false);}}
  return <div className="space-y-5"><PageHeader title={t("alerts")} subtitle={t("deliveryNotice")}/>{error&&<ErrorState message={error}/>}<p className="text-sm">{t("acknowledgementNotice")}</p>{!rows.length&&!error&&<p role="status">{t("noAlerts")}</p>}{rows.map(row=><SectionCard key={row.id} title={row.kind} description={formatDate(row.createdAt)}><div className="flex flex-wrap gap-3">{row.caseIds.map(id=><Link key={id} className="text-sm underline" to={`/cases/${encodeURIComponent(id)}`}>{t("openCase")} · {id}</Link>)}</div><ul className="mt-3 text-sm">{row.deliveries.map(delivery=><li key={delivery.id}>{delivery.channel} · {t(delivery.status==="failed"?"failedDelivery":delivery.status)} · {t("attempts")}: {formatNumber(delivery.attempts)}{delivery.nextAttemptAt?" · "+formatDate(delivery.nextAttemptAt):""}</li>)}</ul>{row.acknowledgedAt?<p className="mt-3 text-sm">{t("acknowledged")} · {formatDate(row.acknowledgedAt)}</p>:<button className="btn-secondary mt-3" disabled={busy} onClick={()=>void acknowledge(row.id)}>{t("acknowledge")}</button>}</SectionCard>)}</div>;
}
