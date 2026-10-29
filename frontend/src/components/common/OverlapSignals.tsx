import type { OverlapAssessment } from "../../services/types.js";
import { tr } from "../../i18n/index.js";
import { formatNumber } from "../../i18n/localeUtils.js";
const t = (key: string) => tr("complaints:overlapSettings." + key);
export function OverlapSignals({ assessment }: { assessment?: OverlapAssessment }) {
  if (!assessment) return null;
  return <details className="mt-3"><summary className="cursor-pointer font-medium">{t("explanation")}</summary>
    <p className="text-sm mt-2">{t("configurationVersion")}: {formatNumber(assessment.configurationVersion)} · {assessment.algorithmVersion}</p>
    <p className="text-sm mt-2">{assessment.mandatoryReview ? t("mandatoryNotice") : t("optionalNotice")}</p>
    <p className="text-sm mt-2">{t(assessment.relationshipCandidate)}</p>
    <div className="overflow-x-auto mt-3"><table className="w-full text-sm text-start"><caption className="text-start mb-2">{t("signalTable")}</caption><thead><tr>{["signal", "weight", "contribution", "reason"].map(key => <th scope="col" className="p-2 text-start" key={key}>{t(key)}</th>)}</tr></thead><tbody>{assessment.signals.map(signal => <tr key={signal.key} className="border-t border-slate-200"><th scope="row" className="p-2 text-start font-medium">{t(signal.key)}</th><td className="p-2">{signal.available ? formatNumber(signal.weight) : t("excluded")}</td><td className="p-2">{formatNumber(signal.contribution)}</td><td className="p-2">{signal.reason}</td></tr>)}</tbody></table></div>
    <p className="text-xs mt-2">{assessment.date.sourceA} / {assessment.date.sourceB} · {assessment.date.distanceDays === undefined ? t("unknownDate") : formatNumber(assessment.date.distanceDays) + " " + t("days")} · {assessment.date.missingBehavior}</p><p className="text-xs mt-2">{t("caveat")}</p>
  </details>;
}
