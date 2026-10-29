import { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import { tr, useLocaleRender } from "../../i18n/index.js";
import { SectionCard, ErrorState } from "../ui/Interface.js";
type Entity = { kind: "department" | "programme" | "document_reference"; namespace: string; value: string };
type State = { version: number; entities: Entity[]; canEdit: boolean; configurationVersion: number };
const t = (key: string) => tr("complaints:overlapSettings." + key), field = "w-full border border-slate-200 rounded-lg p-2 bg-white text-sm";
export function CaseOverlapPanel({ caseId }: { caseId: string }) {
  useLocaleRender(); const [state, setState] = useState<State>(), [reason, setReason] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api.request<State>(`case-overlap/${encodeURIComponent(caseId)}`).then(result => { if (active) setState(result); }).catch(() => { if (active) setError(t("failed")); }); return () => { active = false; }; }, [caseId]);
  async function action(rescan: boolean) {
    if (!state) return; setBusy(true); setError(""); setNotice("");
    try { if (rescan) { await api.request(`case-overlap/${encodeURIComponent(caseId)}/rescan`, "POST", { reason }); setNotice(t("rescanned")); } else { setState(await api.request<State>(`case-overlap/${encodeURIComponent(caseId)}/entities`, "PUT", { ...state, reason })); setNotice(t("saved")); } setReason(""); } catch { setError(t("failed")); } finally { setBusy(false); }
  }
  if (!state) return error ? <ErrorState message={error}/> : null;
  const change = (index: number, key: keyof Entity, value: string) => setState({ ...state, entities: state.entities.map((row, i) => i === index ? { ...row, [key]: value } : row) });
  return <SectionCard title={t("caseTitle")} description={t("entityNotice")}>
    {error && <ErrorState message={error}/>} {notice && <p role="status">{notice}</p>}
    <details><summary className="text-sm cursor-pointer font-medium">{t("entityCodes")}</summary><fieldset disabled={!state.canEdit || busy} className="mt-3 space-y-3">
      {state.entities.map((row, index) => <div key={index} className="grid sm:grid-cols-4 gap-2"><label className="text-sm">{t("kind")}<select className={field} value={row.kind} onChange={event => change(index, "kind", event.target.value)}>{["department", "programme", "document_reference"].map(kind => <option key={kind} value={kind}>{t(kind)}</option>)}</select></label><label className="text-sm">{t("namespace")}<input className={field} maxLength={80} value={row.namespace} onChange={event => change(index, "namespace", event.target.value)}/></label><label className="text-sm">{t("value")}<input className={field} maxLength={80} value={row.value} onChange={event => change(index, "value", event.target.value)}/></label><button className="btn-secondary self-end" type="button" onClick={() => setState({ ...state, entities: state.entities.filter((_, i) => i !== index) })}>{t("remove")}</button></div>)}
      {state.canEdit && <><button type="button" className="btn-secondary" disabled={state.entities.length >= 20} onClick={() => setState({ ...state, entities: [...state.entities, { kind: "department", namespace: "", value: "" }] })}>{t("addEntity")}</button><label className="block text-sm">{t("reason")}<textarea className={field} minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)}/></label><div className="flex gap-2"><button type="button" className="btn-secondary" disabled={reason.trim().length < 5} onClick={() => void action(false)}>{t("saveEntities")}</button><button type="button" className="btn-secondary" disabled={reason.trim().length < 5} onClick={() => void action(true)}>{t("rescan")}</button></div></>}
    </fieldset></details><p className="text-xs mt-3">{t("caveat")}</p>
  </SectionCard>;
}
