import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { intakeApi, type IntakeConfig, type IntakeRecord, type InstitutionCandidate } from "../services/intake.js";
import { api } from "../services/api.js";
import { tr, localizeLabel, useLocaleRender } from "../i18n/index.js";
import { PageHeader, SectionCard, ErrorState, LoadingSkeleton, EmptyState, ConfirmDialog } from "../components/ui/Interface.js";

const fieldClass = "w-full border border-slate-200 rounded-lg p-2 bg-white text-sm";
const t = (key: string) => tr("complaints:intake." + key);
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm space-y-1"><span className="font-medium text-slate-700">{label}</span>{children}</label>; }
const initial = { recordKind: "complaint", caseTypeId: "grievance", category: "", sourceChannelId: "manual", externalReference: "", sourceReceivedDate: new Date().toISOString().slice(0, 10), programme: "", bureauId: "", institutionText: "", locationHint: "", title: "", description: "", priority: "Medium", sourceNote: "", namespace: "AICTE", identifierValue: "" };

export function IntakeWorkspace() {
  useLocaleRender();
  const { user } = useAuth();
  const [config, setConfig] = useState<IntakeConfig>(), [rows, setRows] = useState<IntakeRecord[]>([]), [form, setForm] = useState(initial);
  const [selected, setSelected] = useState<IntakeRecord>(), [candidates, setCandidates] = useState<InstitutionCandidate[]>([]);
  const [candidateId, setCandidateId] = useState(""), [reason, setReason] = useState(""), [ambiguous, setAmbiguous] = useState(false), [searched, setSearched] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false);
  const [aliases, setAliases] = useState(""), [identifierLines, setIdentifierLines] = useState(""), [matchingVersion, setMatchingVersion] = useState(0);
  const supervisor = ["BUREAU_HEAD", "COMPETENT_AUTHORITY"].includes(user?.role || "");
  function failure(problem: unknown) {
    const code = (problem as { code?: string })?.code || "FAILED";
    setError(tr("complaints:intake.errors." + code, { defaultValue: t("failed") }));
  }
  async function load() {
    try { const [nextConfig, nextRows] = await Promise.all([intakeApi.configuration(), intakeApi.list()]); setConfig(nextConfig); setRows(nextRows); setError(""); setForm(value => ({ ...value, category: value.category || nextConfig.categories[0], bureauId: value.bureauId || nextConfig.bureaus[0]?.id || "" })); }
    catch (problem) { failure(problem); }
  }
  useEffect(() => {
    let active = true;
    Promise.all([intakeApi.configuration(), intakeApi.list()]).then(([nextConfig, nextRows]) => {
      if (!active) return;
      setConfig(nextConfig); setRows(nextRows); setForm(current => ({ ...current, category: nextConfig.categories[0], bureauId: nextConfig.bureaus[0]?.id || "" }));
    }).catch(problem => { if (active) failure(problem); });
    return () => { active = false; };
  }, []);
  function choose(record: IntakeRecord) { setSelected(record); setCandidates([]); setCandidateId(""); setReason(""); setAmbiguous(false); setSearched(false); setNotice(""); setError(""); }
  async function act(operation: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await operation(); } catch (problem) { failure(problem); } finally { setBusy(false); } }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    await act(async () => {
      const record = await intakeApi.create({ ...form, identifier: form.identifierValue ? { namespace: form.namespace, value: form.identifierValue } : undefined });
      await load(); choose(record); setNotice(t("saved")); setForm({ ...initial, bureauId: form.bureauId, category: form.category });
    });
  }
  async function search() {
    if (!selected) return;
    await act(async () => { const result = await intakeApi.candidates({ text: selected.institutionText, locationHint: selected.locationHint, identifier: selected.identifier }); setCandidates(result.candidates); setAmbiguous(result.ambiguous); setSearched(true); setCandidateId(""); });
  }
  async function prepareMatching(id: string) {
    const detail = await api.getInstitutionProfile(id);
    const matching = (detail.institution as { matching?: { aliases: string[]; identifiers: { namespace: string; value: string }[]; version: number } }).matching;
    setAliases(matching?.aliases.join("\n") || ""); setIdentifierLines(matching?.identifiers.map(item => item.namespace + ":" + item.value).join("\n") || ""); setMatchingVersion(matching?.version || 0);
  }
  if (!config) return <><ErrorState message={error || t("loading")} onRetry={() => void load()}/><LoadingSkeleton label={t("loading")}/></>;
  const value = (name: keyof typeof form) => ({ value: form[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(current => ({ ...current, [name]: event.target.value })) });
  return <div className="space-y-5">
    <PageHeader title={t("title")} subtitle={t("description")} actions={<Link className="btn-secondary" to="/imports">{tr("complaints:imports.title")}</Link>}/>
    {error && <ErrorState message={error}/>}{notice && <p role="status" className="surface p-3 text-sm">{notice}</p>}
    <SectionCard title={t("newIntake")} description={t("sourceNotice")}>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={busy} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Field label={t("recordKind")}><select className={fieldClass} {...value("recordKind")}><option value="complaint">{t("complaint")}</option><option value="other_case">{t("otherCase")}</option></select></Field>
          <Field label={t("caseType")}><select className={fieldClass} {...value("caseTypeId")}>{config.caseTypes.filter(item => item.enabled).map(item => <option key={item.id} value={item.id}>{item.label} · {t(item.lifecycle)}</option>)}</select></Field>
          <Field label={t("category")}><select className={fieldClass} {...value("category")}>{config.categories.map(item => <option key={item} value={item}>{localizeLabel(item)}</option>)}</select></Field>
          <Field label={t("source")}><select className={fieldClass} {...value("sourceChannelId")}>{config.channels.filter(item => item.enabled).map(item => <option key={item.id} value={item.id}>{item.label} · {t(item.connection)}</option>)}</select></Field>
          <Field label={t("externalReference")}><input className={fieldClass} maxLength={160} {...value("externalReference")}/></Field>
          <Field label={t("sourceReceivedDate")}><input type="date" required className={fieldClass} {...value("sourceReceivedDate")}/></Field>
          <Field label={t("programme")}><input className={fieldClass} maxLength={200} {...value("programme")}/></Field>
          <Field label={t("bureau")}><select required className={fieldClass} {...value("bureauId")}>{config.bureaus.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label={t("priority")}><select className={fieldClass} {...value("priority")}>{config.priorities.map(item => <option key={item} value={item}>{localizeLabel(item)}</option>)}</select></Field>
          <Field label={t("institutionText")}><input required dir="auto" className={fieldClass} maxLength={300} {...value("institutionText")}/></Field>
          <Field label={t("locationHint")}><input dir="auto" className={fieldClass} maxLength={160} {...value("locationHint")}/></Field>
          <div className="grid grid-cols-2 gap-2"><Field label={t("identifierNamespace")}><input dir="ltr" className={fieldClass} maxLength={40} {...value("namespace")}/></Field><Field label={t("identifierValue")}><input dir="ltr" className={fieldClass} maxLength={160} {...value("identifierValue")}/></Field></div>
          <Field label={t("caseTitle")}><input required dir="auto" className={fieldClass} maxLength={300} {...value("title")}/></Field>
          <Field label={t("narrative")}><textarea required dir="auto" className={fieldClass} maxLength={20000} rows={3} {...value("description")}/></Field>
          <Field label={t("sourceNote")}><textarea dir="auto" className={fieldClass} maxLength={2000} rows={3} {...value("sourceNote")}/></Field>
        </fieldset>
        <button disabled={busy} className="btn" type="submit">{t("saveDraft")}</button>
      </form>
    </SectionCard>
    <SectionCard title={t("reviewQueue")} description={t("queueScope")}>
      {!rows.length ? <EmptyState title={t("noDrafts")}/> : <div className="flex flex-wrap gap-2">{rows.map(record => <button type="button" disabled={busy} key={record.id} className="btn-secondary text-start" aria-pressed={selected?.id === record.id} onClick={() => choose(record)}><bdi dir="auto">{record.institutionText}</bdi> · {t(record.status)}</button>)}</div>}
      {selected && <div className="border-t border-slate-200 mt-4 pt-4 space-y-4">
        <h3 className="font-semibold"><bdi dir="auto">{selected.title}</bdi></h3><p className="text-sm whitespace-pre-wrap" dir="auto">{selected.description}</p>
        <p className="text-sm">{t("caseType")}: {config.caseTypes.find(item => item.id === selected.metadata.caseTypeId)?.label} · {t("source")}: {config.channels.find(item => item.id === selected.metadata.sourceChannelId)?.label} · <bdi dir="ltr">{selected.metadata.externalReference || "—"}</bdi></p>
        {selected.status !== "Registered" && <>
          <button type="button" disabled={busy} className="btn-secondary" onClick={() => void search()}>{t("findCandidates")}</button>
          {searched && <p role="status" className="text-sm">{ambiguous ? t("ambiguous") : t("humanSelection")}</p>}
          {searched && !candidates.length && <EmptyState title={t("noMatches")} description={t("remainUnresolved")}/>}
          {!!candidates.length && <fieldset disabled={busy} className="space-y-3"><legend className="font-medium text-sm">{t("rankedCandidates")}</legend>
            {candidates.map((candidate, index) => <label key={candidate.id} className="surface p-3 flex gap-3 text-sm"><input type="radio" name="institution-candidate" checked={candidateId === candidate.id} onChange={() => { setCandidateId(candidate.id); if (supervisor) void act(() => prepareMatching(candidate.id)); }}/><span><span className="font-semibold">{index + 1}. <bdi dir="auto">{candidate.name}</bdi></span><span className="block"><bdi dir="ltr">{candidate.aictePermanentId}</bdi> · <bdi dir="auto">{candidate.city}, {candidate.state} · {candidate.region}</bdi></span><span className="block text-slate-600">{candidate.reasons.map(key => t(key)).join(" · ")}</span></span></label>)}
            <p className="text-xs text-slate-500">{t("rankingNotice")}</p>
            <Field label={t("resolutionReason")}><textarea className={fieldClass} value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} required/></Field>
            <button className="btn" type="button" disabled={!candidateId || !reason.trim()} onClick={() => void act(async () => { const resolved = await intakeApi.resolve(selected.id, { version: selected.version, institutionId: candidateId, reason }); await load(); setSelected(resolved); setNotice(t("resolved")); })}>{t("confirmInstitution")}</button>
            {supervisor && candidateId && <details className="space-y-3"><summary className="cursor-pointer text-sm font-medium">{t("editMatching")}</summary>
              <p className="text-xs text-slate-500">{t("matchingNotice")}</p>
              <Field label={t("aliases")}><textarea className={fieldClass} rows={3} value={aliases} onChange={event => setAliases(event.target.value)}/></Field>
              <Field label={t("identifiers")}><textarea className={fieldClass} dir="ltr" rows={3} value={identifierLines} onChange={event => setIdentifierLines(event.target.value)}/></Field>
              <button type="button" className="btn-secondary" disabled={!reason.trim()} onClick={() => void act(async () => { await intakeApi.saveMatching(candidateId, { version: matchingVersion, reason, aliases: aliases.split("\n").filter(Boolean), identifiers: identifierLines.split("\n").filter(Boolean).map(line => { const colon = line.indexOf(":"); if (colon < 1) throw new Error(); return { namespace: line.slice(0, colon), value: line.slice(colon + 1) }; }) }); await prepareMatching(candidateId); setNotice(t("matchingSaved")); })}>{t("saveMatching")}</button>
            </details>}
          </fieldset>}
          {selected.status === "NeedsLifecycleReview" && <p className="text-sm" role="status">{t("lifecycleReviewNotice")}</p>}
          {selected.status === "Ready" && supervisor && <button className="btn" type="button" disabled={busy} onClick={() => setConfirm(true)}>{t("registerCase")}</button>}
          {selected.status === "Ready" && !supervisor && <p className="text-sm">{t("supervisorRegistration")}</p>}
        </>}
        {selected.complaintId && <Link className="btn-secondary" to={`/cases/${selected.complaintId}`}>{t("openCase")}</Link>}
      </div>}
    </SectionCard>
    {confirm && selected && <ConfirmDialog title={t("registerCase")} description={t("registrationNotice")} busy={busy} onClose={() => setConfirm(false)} onConfirm={() => void act(async () => { const result = await intakeApi.register(selected.id, selected.version); await load(); setSelected(undefined); setConfirm(false); setNotice(t("registered") + " " + result.complaint.complaintId); })}/>}
  </div>;
}

export function IntakeConfigurationPage() {
  useLocaleRender();
  const [config, setConfig] = useState<IntakeConfig>(), [reason, setReason] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [newType, setNewType] = useState(""), [newChannel, setNewChannel] = useState("");
  useEffect(() => { intakeApi.configuration().then(setConfig).catch(() => setError(t("failed"))); }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { await intakeApi.configure({ ...config, reason }); setConfig(await intakeApi.configuration()); setReason(""); setNotice(t("configurationSaved")); } catch { setError(t("failed")); } finally { setBusy(false); }
  }
  return <div className="space-y-5"><PageHeader title={t("configurationTitle")} subtitle={t("configurationNotice")} actions={<div className="flex flex-wrap gap-2"><Link className="btn-secondary" to="/admin/confidentiality">{tr("complaints:security.configurationTitle")}</Link><Link className="btn-secondary" to="/admin/overlap-settings">{tr("complaints:overlapSettings.title")}</Link><Link className="btn-secondary" to="/admin/sla-policies">{tr("complaints:slaPolicy.title")}</Link><Link className="btn-secondary" to="/admin/audit-integrity">{tr("complaints:auditIntegrity.title")}</Link></div>}/>{error && <ErrorState message={error}/>} {notice && <p role="status">{notice}</p>}
    {config && <form onSubmit={save} className="space-y-5"><fieldset disabled={busy} className="space-y-5">
      <SectionCard title={t("caseType")} description={t("lifecycleConfigurationNotice")}><div className="space-y-4">{config.caseTypes.map((item, index) => <div key={item.id} className="grid md:grid-cols-3 gap-3 items-center"><Field label={item.id}><input required maxLength={100} className={fieldClass} value={item.label} onChange={event => setConfig({ ...config, caseTypes: config.caseTypes.map((row, i) => i === index ? { ...row, label: event.target.value } : row) })}/></Field><Field label={t("lifecycle")}><select className={fieldClass} value={item.lifecycle} onChange={event => setConfig({ ...config, caseTypes: config.caseTypes.map((row, i) => i === index ? { ...row, lifecycle: event.target.value as typeof row.lifecycle } : row) })}><option value="review_required">{t("review_required")}</option><option value="complaint_default">{t("complaint_default")}</option></select></Field><label className="text-sm"><input type="checkbox" checked={item.enabled} onChange={event => setConfig({ ...config, caseTypes: config.caseTypes.map((row, i) => i === index ? { ...row, enabled: event.target.checked } : row) })}/> {t("enabled")}</label></div>)}
      <div className="flex gap-2"><input aria-label={t("newTypeId")} className={fieldClass} value={newType} onChange={event => setNewType(event.target.value)} pattern="[a-z][a-z0-9_]{0,39}"/><button type="button" className="btn-secondary" disabled={!/^[a-z][a-z0-9_]{0,39}$/.test(newType) || config.caseTypes.some(item => item.id === newType)} onClick={() => { setConfig({ ...config, caseTypes: [...config.caseTypes, { id: newType, label: newType, enabled: true, lifecycle: "review_required" }] }); setNewType(""); }}>{t("addType")}</button></div></div></SectionCard>
      <SectionCard title={t("source")} description={t("sourceNotice")}><div className="space-y-4">{config.channels.map((item, index) => <div key={item.id} className="grid md:grid-cols-3 gap-3 items-center"><Field label={item.id}><input required maxLength={100} className={fieldClass} value={item.label} onChange={event => setConfig({ ...config, channels: config.channels.map((row, i) => i === index ? { ...row, label: event.target.value } : row) })}/></Field><p className="text-sm">{t(item.connection)}</p><label className="text-sm"><input type="checkbox" checked={item.enabled} onChange={event => setConfig({ ...config, channels: config.channels.map((row, i) => i === index ? { ...row, enabled: event.target.checked } : row) })}/> {t("enabled")}</label></div>)}
      <div className="flex gap-2"><input aria-label={t("newChannelId")} className={fieldClass} value={newChannel} onChange={event => setNewChannel(event.target.value)} pattern="[a-z][a-z0-9_]{0,39}"/><button type="button" className="btn-secondary" disabled={!/^[a-z][a-z0-9_]{0,39}$/.test(newChannel) || config.channels.some(item => item.id === newChannel)} onClick={() => { setConfig({ ...config, channels: [...config.channels, { id: newChannel, label: newChannel, enabled: true, connection: "not_connected" }] }); setNewChannel(""); }}>{t("addChannel")}</button></div></div></SectionCard>
      <Field label={t("configurationReason")}><textarea required maxLength={1000} className={fieldClass} value={reason} onChange={event => setReason(event.target.value)}/></Field><button type="submit" className="btn">{t("saveConfiguration")}</button>
    </fieldset></form>}
  </div>;
}


