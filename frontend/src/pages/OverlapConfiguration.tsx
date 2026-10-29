import React, { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { PageHeader, SectionCard, ErrorState } from "../components/ui/Interface.js";
import { tr, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
type Config = { version: number; weights: Record<string, number>; dateWindowDays: number; reviewScoreThreshold: number; duplicateScoreThreshold: number; lexicalRelatedThreshold: number; lexicalDuplicateThreshold: number; embeddingRelatedThreshold: number; embeddingDuplicateThreshold: number; reason: string; changedAt: string; rollbackOf?: number };
type State = { current: Config; history: Config[]; defaults: Config };
const t = (key: string) => tr("complaints:overlapSettings." + key), field = "w-full border border-slate-200 rounded-lg p-2 bg-white text-sm";
export function OverlapConfiguration() {
  useLocaleRender(); const [state, setState] = useState<State>(), [config, setConfig] = useState<Config>(), [reason, setReason] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { api.request<State>("admin/overlap-settings").then(result => { setState(result); setConfig(result.current); }).catch(() => setError(t("failed"))); }, []);
  async function save(event?: React.FormEvent, rollbackTo?: number) {
    event?.preventDefault(); if (!config) return; setBusy(true); setError(""); setNotice("");
    try { const result = await api.request<State>("admin/overlap-settings", "PUT", { ...config, reason, rollbackTo }); setState(result); setConfig(result.current); setReason(""); setNotice(t("saved")); } catch { setError(t("failed")); } finally { setBusy(false); }
  }
  const thresholds = ["reviewScoreThreshold", "duplicateScoreThreshold", "lexicalRelatedThreshold", "lexicalDuplicateThreshold", "embeddingRelatedThreshold", "embeddingDuplicateThreshold"] as const;
  return <div className="space-y-5"><PageHeader title={t("title")} subtitle={t("configurationNotice")}/>{error && <ErrorState message={error}/>} {notice && <p role="status">{notice}</p>}
    {config && state && <form onSubmit={event => void save(event)}><fieldset disabled={busy} className="space-y-4"><p className="text-sm">{t("configurationVersion")}: {formatNumber(config.version)}</p><SectionCard title={t("weights")} description={t("missingNotice")}><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{Object.entries(config.weights).map(([key, value]) => <label className="text-sm" key={key}>{t(key)}<input type="number" min={0} max={100} step="any" required className={field} value={value} onChange={event => setConfig({ ...config, weights: { ...config.weights, [key]: Number(event.target.value) } })}/></label>)}</div></SectionCard>
      <SectionCard title={t("thresholds")}><div className="grid md:grid-cols-3 gap-3">{thresholds.map(key => <label className="text-sm" key={key}>{t(key)}<input className={field} type="number" min={0} max={100} step="any" required value={config[key]} onChange={event => setConfig({ ...config, [key]: Number(event.target.value) })}/></label>)}<label className="text-sm">{t("dateWindowDays")}<input className={field} type="number" min={1} max={3650} required value={config.dateWindowDays} onChange={event => setConfig({ ...config, dateWindowDays: Number(event.target.value) })}/></label></div><p className="text-sm mt-3">{t("mandatoryNotice")}</p><p className="text-sm mt-2">{t("dateNotice")}</p></SectionCard>
      <label className="block text-sm">{t("reason")}<textarea className={field} minLength={5} maxLength={1000} required value={reason} onChange={event => setReason(event.target.value)}/></label><div className="flex gap-2"><button className="btn" type="submit">{t("save")}</button><button className="btn-secondary" type="button" onClick={() => setConfig({ ...state.defaults, version: config.version })}>{t("loadDefaults")}</button></div>
      <SectionCard title={t("history")} description={t("rollbackNotice")}><div className="overflow-x-auto"><table className="w-full text-sm text-start"><thead><tr>{["configurationVersion", "date", "reason", "rollback"].map(key => <th className="p-2 text-start" scope="col" key={key}>{t(key)}</th>)}</tr></thead><tbody>{state.history.map(row => <tr className="border-t border-slate-200" key={row.version}><td className="p-2">{formatNumber(row.version)}</td><td className="p-2">{formatDate(row.changedAt)}</td><td className="p-2">{row.reason}</td><td className="p-2"><button type="button" className="btn-secondary" disabled={row.version === config.version || reason.trim().length < 5} onClick={() => void save(undefined, row.version)}>{t("restore")} {formatNumber(row.version)}</button></td></tr>)}</tbody></table></div></SectionCard>
    </fieldset></form>}
  </div>;
}
