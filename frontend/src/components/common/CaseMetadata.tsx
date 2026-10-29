import type { Complaint } from "../../services/types.js";
import { tr } from "../../i18n/index.js";
import { formatDate } from "../../i18n/localeUtils.js";
import { SectionCard } from "../ui/Interface.js";
export function CaseMetadata({ complaint }: { complaint: Complaint }) {
  const metadata = complaint.metadata;
  return <SectionCard title={tr("complaints:intake.classificationAndProvenance")}>
    {!metadata ? <p className="text-sm">{tr("complaints:intake.legacyMetadataNotice")}</p> : <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
      {[
        ["recordKind", tr("complaints:intake." + (metadata.recordKind === "complaint" ? "complaint" : "otherCase"))],
        ["caseType", metadata.caseTypeId], ["source", metadata.sourceChannelId], ["externalReference", metadata.externalReference || "—"],
        ["sourceReceivedDate", formatDate(metadata.sourceReceivedDate)], ["programme", metadata.programme || "—"],
        ["originalInstitutionText", metadata.provenance.originalInstitutionText || "—"], ["resolutionReason", metadata.provenance.resolutionReason || "—"],
        ["sourceNote", metadata.provenance.sourceNote || "—"]
      ].map(([key, value]) => <div key={key}><dt className="text-slate-500">{tr("complaints:intake." + key)}</dt><dd className="mt-1 whitespace-pre-wrap"><bdi dir="auto">{value}</bdi></dd></div>)}
    </dl>}
  </SectionCard>;
}
