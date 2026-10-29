import React, { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import { tr, useLocaleRender } from "../../i18n/index.js";
import { SectionCard, ErrorState } from "../ui/Interface.js";
type Grant = { profileId: string; read: boolean; evidence: boolean; identity: boolean; manage: boolean; expiresAt?: string };
type Policy = {
  version: number; level: string; reviewStatus: string; sensitivitySignals: string[]; grants: Grant[];
  capabilities: { manage: boolean; identity: boolean; evidence: boolean }; identityRecorded: boolean; encryptionAvailable: boolean;
  eligibleProfiles: { id: string; name: string; role: string; bureauId?: string }[];
};
const t = (key: string) => tr("complaints:security." + key);
const field = "w-full border border-slate-200 rounded-lg p-2 bg-white text-sm";
export function CaseSecurityPanel({ caseId, onChanged }: { caseId: string; onChanged: () => void }) {
  useLocaleRender();
  const [policy, setPolicy] = useState<Policy>(), [reason, setReason] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [identity, setIdentity] = useState<Record<string, string>>();
  const [input, setInput] = useState({ name: "", email: "", phone: "", address: "" });
  useEffect(() => { let active = true; api.request<Policy>(`case-security/${encodeURIComponent(caseId)}`).then(result => { if (active) setPolicy(result); }).catch(() => { if (active) setError(t("failed")); }); return () => { active = false; }; }, [caseId]);
  useEffect(() => { if (!identity) return; const timer = setTimeout(() => setIdentity(undefined), 60000); return () => clearTimeout(timer); }, [identity]);
  async function act(operation: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await operation(); } catch { setError(t("failed")); } finally { setBusy(false); } }
  if (!policy) return error ? <ErrorState message={error}/> : null;
  function grant(profileId: string, key: "read" | "evidence" | "identity" | "manage", checked: boolean) {
    if (!policy) return;
    const current = policy.grants.find(item => item.profileId === profileId) || { profileId, read: false, evidence: false, identity: false, manage: false };
    const next = { ...current, [key]: checked };
    if (checked && key !== "read") next.read = true;
    if (!checked && key === "read") { next.evidence = false; next.identity = false; next.manage = false; }
    setPolicy({ ...policy, grants: [...policy.grants.filter(item => item.profileId !== profileId), next] });
  }
  return <SectionCard title={t("title")} description={t("matrixNotice")}>
    {error && <ErrorState message={error}/>} {notice && <p role="status" className="text-sm mb-3">{notice}</p>}
    <p className="text-sm">{t("level")}: {t(policy.level)} · {t("reviewStatus")}: {t(policy.reviewStatus)}</p>
    {!!policy.sensitivitySignals.length && <p className="text-sm mt-2">{t("signals")}: <bdi dir="ltr">{policy.sensitivitySignals.join(", ")}</bdi>. {t("signalsNotice")}</p>}
    {policy.capabilities.manage && <form className="space-y-4 mt-4" onSubmit={event => { event.preventDefault(); void act(async () => { const saved = await api.request<Policy>(`case-security/${encodeURIComponent(caseId)}`, "PUT", { version: policy.version, level: policy.level, grants: policy.grants, reason }); setPolicy(saved); setReason(""); setIdentity(undefined); setNotice(t("saved")); onChanged(); }); }}>
      <fieldset disabled={busy} className="space-y-4"><label className="block text-sm">{t("level")}<select className={field} value={policy.level} onChange={event => setPolicy({ ...policy, level: event.target.value })}>{["internal", "restricted", "sealed"].map(level => <option value={level} key={level}>{t(level)}</option>)}</select></label>
        <div className="overflow-x-auto"><table className="w-full text-start text-sm"><caption className="text-start text-slate-500 mb-2">{t("grantNotice")}</caption><thead><tr>{["profile", "read", "evidence", "identity", "manage"].map(key => <th className="p-2" key={key} scope="col">{t(key)}</th>)}</tr></thead><tbody>{policy.eligibleProfiles.map(profile => <tr key={profile.id} className="border-t border-slate-200"><th scope="row" className="p-2 text-start font-normal"><bdi dir="auto">{profile.name}</bdi> · <bdi dir="ltr">{profile.bureauId || "AICTE"}</bdi></th>{(["read", "evidence", "identity", "manage"] as const).map(key => <td key={key} className="p-2"><input type="checkbox" aria-label={t(key) + " — " + profile.name} checked={!!policy.grants.find(item => item.profileId === profile.id)?.[key]} disabled={key === "manage" && profile.role !== "COMPETENT_AUTHORITY"} onChange={event => grant(profile.id, key, event.target.checked)}/></td>)}</tr>)}</tbody></table></div>
        <label className="block text-sm">{t("reason")}<textarea required minLength={5} maxLength={1000} className={field} value={reason} onChange={event => setReason(event.target.value)}/></label>
        <button className="btn" type="submit">{t("saveReview")}</button>
      </fieldset>
    </form>}
    {policy.capabilities.identity && <div className="mt-5 pt-4 border-t border-slate-200 space-y-3">
      <h3 className="font-semibold">{t("identityTitle")}</h3><p className="text-sm">{t("identityNotice")}</p>
      {!policy.encryptionAvailable && <p role="status" className="text-sm">{t("keyUnavailable")}</p>}
      <label className="block text-sm">{t("identityReason")}<input className={field} minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)}/></label>
      <button className="btn-secondary" type="button" disabled={busy || !policy.identityRecorded || !policy.encryptionAvailable || reason.trim().length < 5} onClick={() => void act(async () => { const result = await api.request<{ identity: Record<string, string> }>(`case-security/${encodeURIComponent(caseId)}/identity/reveal`, "POST", { reason }); setIdentity(result.identity); })}>{t("reveal")}</button>
      {identity && <div className="surface p-3 text-sm"><dl>{Object.entries(identity).map(([key, value]) => <div key={key}><dt className="text-slate-500">{t(key)}</dt><dd><bdi dir="auto">{value}</bdi></dd></div>)}</dl><button type="button" className="btn-secondary mt-2" onClick={() => setIdentity(undefined)}>{t("clearIdentity")}</button></div>}
      <details><summary className="cursor-pointer text-sm font-medium">{t("recordIdentity")}</summary><form className="space-y-3 mt-3" onSubmit={event => { event.preventDefault(); void act(async () => { await api.request(`case-security/${encodeURIComponent(caseId)}/identity`, "PUT", { reason, identity: Object.fromEntries(Object.entries(input).filter(([, value]) => value.trim())) }); setInput({ name: "", email: "", phone: "", address: "" }); setPolicy({ ...policy, identityRecorded: true }); setIdentity(undefined); setNotice(t("identitySaved")); }); }}><fieldset disabled={busy || !policy.encryptionAvailable} className="grid sm:grid-cols-2 gap-3">{(["name", "email", "phone", "address"] as const).map(key => <label className="block text-sm" key={key}>{t(key)}<input className={field} dir="auto" autoComplete="off" maxLength={key === "address" ? 2000 : 300} value={input[key]} onChange={event => setInput({ ...input, [key]: event.target.value })}/></label>)}</fieldset><button type="submit" className="btn-secondary" disabled={busy || !policy.encryptionAvailable || reason.trim().length < 5 || !Object.values(input).some(Boolean)}>{t("protectIdentity")}</button></form></details>
    </div>}
  </SectionCard>;
}
