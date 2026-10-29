import React, { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { tr, useLocaleRender } from "../i18n/index.js";
import { PageHeader, SectionCard, ErrorState } from "../components/ui/Interface.js";
type Signal = { id: string; enabled: boolean; caseTypeIds: string[]; categories: string[]; terms: string[] };
type Config = { version: number; signals: Signal[]; reason: string };
const t = (key: string) => tr("complaints:security." + key);
const field = "w-full border border-slate-200 rounded-lg p-2 bg-white text-sm";
export function SensitivityConfiguration() {
  useLocaleRender();
  const [config, setConfig] = useState<Config>(), [reason, setReason] = useState(""), [newId, setNewId] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { api.request<Config>("case-security/configuration").then(setConfig).catch(() => setError(t("failed"))); }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { setConfig(await api.request<Config>("case-security/configuration", "PUT", { ...config, signals: config?.signals.map(signal => ({ ...signal, caseTypeIds: signal.caseTypeIds.map(value => value.trim()).filter(Boolean), categories: signal.categories.map(value => value.trim()).filter(Boolean), terms: signal.terms.map(value => value.trim()).filter(Boolean) })), reason })); setReason(""); setNotice(t("saved")); } catch { setError(t("failed")); } finally { setBusy(false); }
  }
  return <div className="space-y-5"><PageHeader title={t("configurationTitle")} subtitle={t("signalsNotice")}/>{error && <ErrorState message={error}/>} {notice && <p role="status">{notice}</p>}
    {config && <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
      {config.signals.map((signal, index) => <SectionCard key={signal.id} title={signal.id}><label className="text-sm"><input type="checkbox" checked={signal.enabled} onChange={event => setConfig({ ...config, signals: config.signals.map((row, i) => i === index ? { ...row, enabled: event.target.checked } : row) })}/> {t("enabled")}</label><div className="grid md:grid-cols-3 gap-3 mt-3">{(["caseTypeIds", "categories", "terms"] as const).map(key => <label key={key} className="text-sm">{t(key)}<textarea className={field} rows={4} value={signal[key].join("\n")} onChange={event => setConfig({ ...config, signals: config.signals.map((row, i) => i === index ? { ...row, [key]: event.target.value.split("\n") } : row) })}/></label>)}</div></SectionCard>)}
      <p className="text-sm text-slate-500">{t("onePerLine")}</p><div className="flex gap-2"><input className={field} aria-label={t("newSignal")} value={newId} onChange={event => setNewId(event.target.value)}/><button type="button" className="btn-secondary" disabled={!/^[a-z][a-z0-9_]{0,39}$/.test(newId) || config.signals.some(signal => signal.id === newId)} onClick={() => { setConfig({ ...config, signals: [...config.signals, { id: newId, enabled: true, caseTypeIds: [], categories: [], terms: [] }] }); setNewId(""); }}>{t("addSignal")}</button></div>
      <label className="block text-sm">{t("reason")}<textarea required minLength={5} maxLength={1000} className={field} value={reason} onChange={event => setReason(event.target.value)}/></label><button type="submit" className="btn">{t("saveConfiguration")}</button>
    </fieldset></form>}
  </div>;
}
