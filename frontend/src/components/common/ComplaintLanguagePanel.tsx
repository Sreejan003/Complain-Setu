import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.js";
import { api } from "../../services/api.js";
import { languages } from "../../i18n/languageRegistry.js";
import { tr, useLocaleRender } from "../../i18n/index.js";
import { SectionCard, ErrorState } from "../ui/Interface.js";
type Analysis = { sourceHash: string; preprocessingVersion: string; language: { code: string; scripts: string[]; method: string }; translation: { status: string; text?: string; targetLanguage?: string; suppliedBy?: string } };
type State = { analysis: Analysis; languages: string[]; capabilities: { annotate: boolean; review: boolean } };
const t = (key: string) => tr("complaints:text." + key), field = "w-full border border-slate-200 rounded-lg p-2 bg-white text-sm";
export function ComplaintLanguagePanel({ caseId }: { caseId: string }) {
  useLocaleRender(); const { user } = useAuth();
  const [state, setState] = useState<State>(), [language, setLanguage] = useState("und"), [target, setTarget] = useState("en"), [text, setText] = useState(""), [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  useEffect(() => { let active = true; api.request<State>(`complaint-language/${encodeURIComponent(caseId)}`).then(result => { if (active) { setState(result); setLanguage(result.analysis.language.code); } }).catch(() => { if (active) setError(t("failed")); }); return () => { active = false; }; }, [caseId]);
  async function submit(action: string) {
    if (!state) return; setBusy(true); setError(""); setNotice("");
    try { const result = await api.request<State>(`complaint-language/${encodeURIComponent(caseId)}`, "POST", { action, sourceHash: state.analysis.sourceHash, language, targetLanguage: target, text, reason }); setState(result); setText(""); setReason(""); setNotice(t("saved")); } catch { setError(t("failed")); } finally { setBusy(false); }
  }
  const name = (code: string) => languages.find(item => item.code === code)?.nativeName || t(code);
  if (!state) return error ? <ErrorState message={error}/> : null;
  return <SectionCard title={t("title")} description={t("originalNotice")}>
    {error && <ErrorState message={error}/>} {notice && <p role="status" className="text-sm mb-2">{notice}</p>}
    <p className="text-sm">{t("language")}: {name(state.analysis.language.code)} · {t(state.analysis.language.method)}</p><p className="text-xs text-slate-500 mt-2">{t("heuristicNotice")}</p>
    <p className="text-sm mt-2">{t("translationStatus")}: {t(state.analysis.translation.status)}</p>
    {state.analysis.translation.text && <div className="border border-slate-200 rounded-lg p-3 mt-3"><p className="text-xs text-slate-500 mb-2">{t("humanTranslation")} · {name(state.analysis.translation.targetLanguage || "und")}</p><p dir="auto" className="whitespace-pre-wrap text-sm">{state.analysis.translation.text}</p></div>}
    {state.capabilities.annotate && <details className="mt-3"><summary className="text-sm font-medium cursor-pointer">{t("annotate")}</summary><fieldset disabled={busy} className="space-y-3 mt-3">
      <label className="block text-sm">{t("reason")}<textarea minLength={5} maxLength={1000} className={field} value={reason} onChange={event => setReason(event.target.value)}/></label>
      <label className="block text-sm">{t("declaredLanguage")}<select className={field} value={language} onChange={event => setLanguage(event.target.value)}>{["und", "mul", ...state.languages].map(code => <option key={code} value={code}>{name(code)}</option>)}</select></label><button type="button" className="btn-secondary" disabled={reason.trim().length < 5} onClick={() => void submit("declare_language")}>{t("recordLanguage")}</button>
      <label className="block text-sm">{t("targetLanguage")}<select className={field} value={target} onChange={event => setTarget(event.target.value)}>{state.languages.map(code => <option key={code} value={code}>{name(code)}</option>)}</select></label>
      <label className="block text-sm">{t("translationText")}<textarea dir="auto" maxLength={20000} className={field} rows={4} value={text} onChange={event => setText(event.target.value)}/></label><p className="text-xs text-slate-500">{t("translationNotice")}</p>
      <button type="button" className="btn-secondary" disabled={reason.trim().length < 5 || !text.trim()} onClick={() => void submit("supply_translation")}>{t("saveDraft")}</button>
      {state.capabilities.review && state.analysis.translation.status === "draft" && state.analysis.translation.suppliedBy !== user?.id && <button type="button" className="btn-secondary ms-2" disabled={reason.trim().length < 5} onClick={() => void submit("review_translation")}>{t("reviewTranslation")}</button>}
    </fieldset></details>}
  </SectionCard>;
}
