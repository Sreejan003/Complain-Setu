import { ModalFrame } from "../components/ui/Interface.js";
import { tr, localizeLabel, localizeError, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
import { CoordinationPanel } from "../components/common/CoordinationPanel.js";
import { OverlapSignals } from "../components/common/OverlapSignals.js";
import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  GitMerge,
  Filter,
  CheckCircle2,
  XCircle,
  Copy,
  Link2,
  AlertTriangle,
  RotateCcw,
  Eye,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Building2,
  X,
  FileText
} from "lucide-react";
import { api } from "../services/api.js";
import { OverlapAlert, Complaint } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

export const OverlapCenter: React.FC = () => {
  useLocaleRender();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [alerts, setAlerts] = useState<OverlapAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [bureauFilter, setBureauFilter] = useState(searchParams.get("bureau") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("alertStatus") || "Pending Review");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Side-by-side comparison modal
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<OverlapAlert | null>(null);
  const [liveCompareData, setLiveCompareData] = useState<{
    semanticScore: number;
    engine: string;
    commonKeywords: string[];
    keywordOverlapCount: number;
  } | null>(null);

  // Decision Modal State
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [targetAlert, setTargetAlert] = useState<OverlapAlert | null>(null);
  const [decisionType, setDecisionType] = useState<"Confirmed Related" | "Confirmed Duplicate" | "Marked Unrelated" | "Dismissed" | "Resolved">("Confirmed Related");
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [linkAsRelated, setLinkAsRelated] = useState(true);
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.getOverlapAlerts({
        bureau: bureauFilter,
        alertStatus: statusFilter,
        page,
        limit: 12
      });
      setAlerts(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.error("Failed to load overlap alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [bureauFilter, statusFilter, page]);

  const handleOpenSideBySide = async (alert: OverlapAlert) => {
    setSelectedAlert(alert);
    setCompareModalOpen(true);
    setLiveCompareData(null);

    try {
      const liveRes = await api.compareLiveTexts(
        `${alert.complaintTitleA} ${alert.complaintDescA}`,
        `${alert.complaintTitleB} ${alert.complaintDescB}`
      );
      setLiveCompareData(liveRes);
    } catch (err) {
      console.error("Live text comparison error:", err);
    }
  };

  const handleOpenDecision = (alert: OverlapAlert, type: "Confirmed Related" | "Confirmed Duplicate" | "Marked Unrelated" | "Dismissed" | "Resolved") => {
    setTargetAlert(alert);
    setDecisionType(type);
    setReviewRemarks(
      type === "Confirmed Related"
        ? "Cross-Bureau overlap verified. Both files require joint inquiry between Regulation Bureau and PGRC."
        : type === "Confirmed Duplicate"
        ? "Duplicate petition submitted by same aggrieved party regarding identical violation."
        : type === "Dismissed"
        ? "Reviewed and dismissed: coincidental phrasing with distinct institutional substance."
        : "Examined case records: distinct complaints involving different departments within the institution."
    );
    setDecisionModalOpen(true);
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAlert || !reviewRemarks.trim()) return;

    setSubmittingDecision(true);
    try {
      await api.reviewOverlapAlert(targetAlert.id, {
        decision: decisionType,
        remarks: reviewRemarks,
        linkAsRelated, expectedUpdatedAt: targetAlert.updatedAt
      });

      setDecisionModalOpen(false);
      setCompareModalOpen(false);
      fetchAlerts();
    } catch (err: any) {
      alert(localizeError(err.message || tr("overlaps:failedToRecordDecision")));
    } finally {
      setSubmittingDecision(false);
    }
  };


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-bold text-aicte-navy-700 bg-[#e8eef5] border border-[#b8c9dc] px-2 py-0.5 rounded-lg">{tr("overlaps:automatedRegulatoryCrossCheck")}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">{tr("navigation:overlapDetection")}</h1>
          <p className="text-xs text-slate-600 mt-0.5">{tr("overlaps:intelligentDetectionOfConcurrentGrievancesConcerningIdenticalInstitutionsAcross")}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-bold text-slate-700">{tr("overlaps:filterAlerts")}</span>

          <select
            aria-label={tr("overlaps:filterAlerts")} value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 font-medium"
          >
            <option value="">{tr("overlaps:allReviewStatuses")}</option>
            <option value="Pending Review">{tr("overlaps:pendingReviewActionNeeded")}</option>
            <option value="Confirmed Related">{tr("overlaps:confirmedRelated")}</option>
            <option value="Confirmed Duplicate">{tr("overlaps:confirmedDuplicate")}</option>
            <option value="Marked Unrelated">{tr("overlaps:markedUnrelated")}</option>
            <option value="Resolved">{tr("overlaps:resolved")}</option>
          </select>

          <select
            aria-label={tr("complaints:bureau")} value={bureauFilter}
            onChange={e => {
              setBureauFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900"
          >
            <option value="">{tr("overlaps:allBureausInvolved")}</option>
            <option value="RB">{tr("complaints:regulationBureauRb")}</option>
            <option value="PGRC">{tr("complaints:publicGrievanceRedressalCellPgrc")}</option>
            <option value="RO">{tr("complaints:regionalOfficesRo")}</option>
            <option value="AB">{tr("complaints:approvalBureauAb")}</option>
          </select>
        </div>

        {(statusFilter || bureauFilter) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setBureauFilter("");
              setPage(1);
            }}
            className="flex items-center space-x-1 text-aicte-navy-700 hover:underline text-xs font-semibold"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{tr("complaints:resetFilters")}</span>
          </button>
        )}
      </div>

      {/* Overlap Cards Grid */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white border border-[#e5eaf0] rounded-lg p-10 text-center text-slate-500 text-xs">{tr("overlaps:loadingCrossBureauOverlapIntelligenceRecords")}</div>
        ) : alerts.length === 0 ? (
          <div className="bg-white border border-[#e5eaf0] rounded-lg p-10 text-center text-slate-500 text-xs">{tr("overlaps:noOverlapAlertsFoundMatchingYourFilterCriteria")}</div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`bg-white border ${
                alert.alertStatus === "Pending Review" ? "border-[#f59e0b]" : "border-[#e5eaf0]"
              } rounded-lg p-4 space-y-3`}
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-aicte-navy-700 bg-[#e8eef5] px-2 py-0.5 rounded-lg border border-[#b8c9dc]">
                    {alert.alertId}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                      alert.alertStatus === "Pending Review"
                        ? "bg-[#fef3c7] text-[#92400e] border-[#fcd34d]"
                        : alert.alertStatus === "Confirmed Related"
                        ? "bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]"
                        : alert.alertStatus === "Confirmed Duplicate"
                        ? "bg-[#f5f3ff] text-[#5b21b6] border-[#ddd6fe]"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {alert.alertStatus}
                  </span>
                  {alert.confidenceCategory && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      {alert.assessment ? tr("complaints:overlapSettings." + alert.assessment.relationshipCandidate) : alert.confidenceCategory}
                    </span>
                  )}
                  {alert.detectionMethod && (
                    <span className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded-lg font-mono border border-slate-200">
                      {alert.detectionMethod}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 font-mono">{tr("overlaps:detected")}{formatDate(alert.createdAt, false)}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold bg-[#fffbeb] text-[#92400e] border border-[#fcd34d] px-2 py-0.5 rounded-lg">{tr("overlaps:ruleMatch")}{alert.ruleMatchScore}%
                  </span>
                  {alert.semanticSimilarityScore !== undefined && (
                    <span className="text-xs font-bold bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe] px-2 py-0.5 rounded-lg flex items-center space-x-1">
                      <span>{alert.assessment ? tr("complaints:overlapSettings.text") + ": " : tr("overlaps:semanticScore")}{alert.semanticSimilarityScore}/100</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Institution Row */}
              <div className="flex items-center space-x-2 text-xs">
                <Building2 className="w-4 h-4 text-aicte-navy-700" />
                <span className="font-bold text-slate-900 text-sm"><bdi dir="auto" className="original-content">{alert.institutionName}</bdi></span>
                <span className="font-mono text-slate-500 text-xs">({alert.aictePermanentId})</span>
              </div>

              {/* Cross-Bureau Complaints Comparison Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Case A Box */}
                <div className="bg-[#f8fafc] border border-slate-200 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-aicte-navy-700">
                      {alert.complaintRefA}
                    </span>
                    <span className="text-xs bg-white text-aicte-navy-700 border border-slate-200 font-bold px-1.5 py-0.2 rounded-lg">{tr("complaints:bureau")}{alert.bureauA}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900">{alert.complaintTitleA}</div>
                  <div className="text-xs text-slate-700 line-clamp-2">{alert.complaintDescA}</div>
                  <div className="text-xs text-slate-500">{tr("complaints:category_56899")}<span className="font-medium text-slate-800">{alert.categoryA}</span>
                  </div>
                </div>

                {/* Case B Box */}
                <div className="bg-[#f8fafc] border border-slate-200 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-aicte-navy-700">
                      {alert.complaintRefB}
                    </span>
                    <span className="text-xs bg-white text-aicte-navy-700 border border-slate-200 font-bold px-1.5 py-0.2 rounded-lg">{tr("complaints:bureau")}{alert.bureauB}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900">{alert.complaintTitleB}</div>
                  <div className="text-xs text-slate-700 line-clamp-2">{alert.complaintDescB}</div>
                  <div className="text-xs text-slate-500">{tr("complaints:category_56899")}<span className="font-medium text-slate-800">{alert.categoryB}</span>
                  </div>
                </div>
              </div>

              {/* Reasons & Recommended Action */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm space-y-3">
                <OverlapSignals assessment={alert.assessment}/>
                {alert.explanation ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700">{tr("navigation:ui.similarityNotice")}</p><details><summary className="text-sm font-medium cursor-pointer text-aicte-navy-700">{tr("navigation:ui.showTechnicalDetails")}</summary><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-3">
                      <div className="bg-white p-2 rounded-lg border border-amber-200">
                        <span className="text-slate-500 block text-xs font-bold uppercase">{tr("overlaps:institutionMatch")}</span>
                        <span className="font-bold text-slate-900">{tr("overlaps:100Verified")}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-amber-200">
                        <span className="text-slate-500 block text-xs font-bold uppercase">{tr("overlaps:bureauBoundary")}</span>
                        <span className="font-bold text-aicte-navy-700">
                          {alert.explanation.crossBureauMatch.isCrossBureau ? tr("overlaps:crossBureauOverlap") : tr("overlaps:intraBureauCase")}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-amber-200">
                        <span className="text-slate-500 block text-xs font-bold uppercase">{tr("overlaps:categoryAlignment")}</span>
                        <span className="font-bold text-slate-900">
                          {alert.explanation.categoryMatch.exactMatch ? tr("overlaps:identicalCategory") : tr("overlaps:relatedCategory")}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-amber-200">
                        <span className="text-slate-500 block text-xs font-bold uppercase">{tr("overlaps:semanticAlignment")}</span>
                        <span className="font-bold text-aicte-navy-700">
                          {alert.explanation.semanticMatch.mode === "unavailable" ? tr("complaints:text.mode.unavailable") : <>{alert.explanation.semanticMatch.score}/100 ({alert.explanation.semanticMatch.engine})</>}
                        </span>
                      </div>
                    </div>

                    {alert.explanation.keywordMatch.matchedTerms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-slate-600 text-xs font-bold">{tr("overlaps:matchedKeywords")}</span>
                        {alert.explanation.keywordMatch.matchedTerms.map((kw, i) => (
                          <span key={i} className="bg-white text-slate-800 border border-slate-200 font-mono text-xs px-1.5 py-0.5 rounded-lg">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    </details><div className="text-slate-800 text-sm leading-6">
                      <span className="font-bold text-[#92400e]">{tr("overlaps:redressalAssessment")}</span>
                      {alert.matchReasons.join(" • ")}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-800">
                    <span className="font-bold text-[#92400e]">{tr("overlaps:redressalAssessment")}</span>
                    {alert.matchReasons.join(" • ")}
                  </div>
                )}

                <div className="text-slate-800 pt-1 border-t border-[#fed7aa] flex items-start space-x-1.5">
                  <span className="font-bold text-slate-900 shrink-0">{tr("overlaps:recommendedAction")}</span>
                  <span className="text-slate-800 font-medium">{alert.recommendedAction}</span>
                </div>

                {alert.reviewRemarks && (
                  <div className="text-slate-800 pt-1 border-t border-[#fed7aa]">
                    <span className="font-bold text-aicte-navy-700">{tr("overlaps:reviewRecord")}{alert.reviewedByName || tr("navigation:officer")} on{" "}
                      {alert.reviewedAt ? formatDate(alert.reviewedAt, false) : tr("overlaps:recent")}):{" "}
                    </span>
                    <span>{alert.reviewRemarks}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  onClick={() => handleOpenSideBySide(alert)}
                  className="px-2.5 py-1 bg-white hover:bg-[#f1f5f9] text-aicte-navy-700 rounded-lg text-xs font-semibold transition inline-flex items-center space-x-1.5 border border-[#e5eaf0]"
                >
                  <Eye className="w-3.5 h-3.5 text-aicte-navy-700" />
                  <span>{tr("overlaps:inspectSideBySide")}</span>
                </button>

                <CoordinationPanel alertId={alert.id} canDecide={!!alert.canDecide} canCoordinate={!!alert.canCoordinate} />
                {alert.canDecide && alert.alertStatus === "Pending Review" && (
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleOpenDecision(alert, "Confirmed Related")}
                      className="px-2.5 py-1 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 border border-[#002147]"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>{tr("overlaps:confirmRelated")}</span>
                    </button>
                    <button
                      onClick={() => handleOpenDecision(alert, "Confirmed Duplicate")}
                      className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 border border-slate-800"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{tr("overlaps:markDuplicate")}</span>
                    </button>
                    <button
                      onClick={() => handleOpenDecision(alert, "Marked Unrelated")}
                      className="px-2.5 py-1 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center space-x-1"
                    >
                      <XCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>{tr("overlaps:rejectOverlap")}</span>
                    </button>
                    <button
                      onClick={() => handleOpenDecision(alert, "Dismissed")}
                      className="px-2 py-1 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-lg text-xs font-medium transition"
                    >{tr("overlaps:dismiss")}</button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: SIDE-BY-SIDE COMPLAINT COMPARISON */}
      {compareModalOpen && selectedAlert && (
        <ModalFrame className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClose={() => setCompareModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-4 py-2.5 bg-aicte-navy-700 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <GitMerge className="w-4 h-4 text-[#ff9933]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">{tr("overlaps:sideBySideGrievanceComparison")}</h3>
                </div>
                <div className="text-xs text-slate-300">
                  <bdi dir="auto" className="original-content">{selectedAlert.institutionName}</bdi>{tr("overlaps:pid")}{selectedAlert.aictePermanentId}
                </div>
              </div>
              <button onClick={() => setCompareModalOpen(false)} className="text-slate-300 hover:text-white" aria-label={tr("common:cancel")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Subheader / AI Intelligence Badge */}
            <div className="px-4 py-2 bg-[#fffbeb] border-b border-[#fed7aa] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-3">
                <span className="font-bold text-[#92400e]">{tr("overlaps:ruleMatch")}{selectedAlert.ruleMatchScore}%
                </span>
                <span className="text-slate-300">|</span>
                <span className="font-bold text-aicte-navy-700 flex items-center space-x-1">
                  <span>{tr("overlaps:semanticScore_829d4")}{" "}
                    {liveCompareData ? tr("overlaps:message", {value1: liveCompareData.semanticScore, value2: liveCompareData.engine}) : tr("overlaps:calculating")}
                  </span>
                </span>
              </div>

              {liveCompareData && liveCompareData.commonKeywords.length > 0 && (
                <div className="text-xs text-slate-700">
                  <strong className="text-slate-900 font-bold">{tr("overlaps:commonKeywords")}</strong>{" "}
                  <span className="text-aicte-navy-700 font-mono font-semibold">
                    [{liveCompareData.commonKeywords.slice(0, 7).join(", ")}]
                  </span>
                </div>
              )}
            </div>

            {/* Side by side columns */}
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Complaint A */}
              <div className="bg-[#f8fafc] border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <div>
                    <span className="text-xs uppercase font-bold text-slate-500">{tr("overlaps:caseAReference")}</span>
                    <div className="font-mono text-sm font-bold text-aicte-navy-700">
                      {selectedAlert.complaintRefA}
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-white text-aicte-navy-700 border border-slate-200 px-1.5 py-0.2 rounded-lg">{tr("complaints:bureau")}{selectedAlert.bureauA}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold block">{tr("complaints:category")}</span>
                  <span className="text-xs font-semibold text-slate-800">{selectedAlert.categoryA}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold block">{tr("overlaps:grievanceTitle")}</span>
                  <span className="text-xs font-bold text-slate-900">{selectedAlert.complaintTitleA}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold block mb-1">{tr("overlaps:grievanceDescriptionText")}</span>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {selectedAlert.complaintDescA}
                  </div>
                </div>

                <div className="pt-1">
                  <Link
                    to={`/cases/${selectedAlert.complaintIdA}`}
                    className="text-xs text-aicte-navy-700 hover:underline font-semibold"
                  >{tr("overlaps:viewFullCaseAFile")}</Link>
                </div>
              </div>

              {/* Complaint B */}
              <div className="bg-[#f8fafc] border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <div>
                    <span className="text-xs uppercase font-bold text-slate-500">{tr("overlaps:caseBReference")}</span>
                    <div className="font-mono text-sm font-bold text-aicte-navy-700">
                      {selectedAlert.complaintRefB}
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-white text-aicte-navy-700 border border-slate-200 px-1.5 py-0.2 rounded-lg">{tr("complaints:bureau")}{selectedAlert.bureauB}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold block">{tr("complaints:category")}</span>
                  <span className="text-xs font-semibold text-slate-800">{selectedAlert.categoryB}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold block">{tr("overlaps:grievanceTitle")}</span>
                  <span className="text-xs font-bold text-slate-900">{selectedAlert.complaintTitleB}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold block mb-1">{tr("overlaps:grievanceDescriptionText")}</span>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {selectedAlert.complaintDescB}
                  </div>
                </div>

                <div className="pt-1">
                  <Link
                    to={`/cases/${selectedAlert.complaintIdB}`}
                    className="text-xs text-aicte-navy-700 hover:underline font-semibold"
                  >{tr("overlaps:viewFullCaseBFile")}</Link>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-4 py-2.5 bg-[#f8fafc] border-t border-[#e5eaf0] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 hover:bg-slate-100"
              >{tr("overlaps:closeComparison")}</button>

              {selectedAlert.canDecide && selectedAlert.alertStatus === "Pending Review" && (
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleOpenDecision(selectedAlert, "Confirmed Related")}
                    className="px-3 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 border border-[#002147]"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>{tr("overlaps:confirmRelated")}</span>
                  </button>
                  <button
                    onClick={() => handleOpenDecision(selectedAlert, "Confirmed Duplicate")}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 border border-slate-800"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{tr("overlaps:markDuplicate")}</span>
                  </button>
                  <button
                    onClick={() => handleOpenDecision(selectedAlert, "Marked Unrelated")}
                    className="px-3 py-1.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center space-x-1"
                  >
                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>{tr("overlaps:rejectRelationship")}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </ModalFrame>
      )}

      {/* MODAL 2: OFFICIAL REVIEW DECISION FORM */}
      {decisionModalOpen && targetAlert && (
        <ModalFrame className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClose={() => setDecisionModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-4 py-2.5 bg-aicte-navy-700 text-white flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">{tr("overlaps:recordOverlapReviewDetermination")}</h3>
              <button onClick={() => setDecisionModalOpen(false)} className="text-slate-300 hover:text-white" aria-label={tr("common:cancel")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDecision} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{tr("overlaps:regulatoryDeterminationDecision")}<span className="text-[#b91c1c]">*</span>
                </label>
                <select aria-label={tr("overlaps:regulatoryDeterminationDecision")}
                  value={decisionType}
                  onChange={e => setDecisionType(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                >
                  <option value="Confirmed Related">{tr("overlaps:confirmedRelatedLinkForCrossBureauCoordination")}</option>
                  <option value="Confirmed Duplicate">{tr("overlaps:confirmedDuplicateMergeProceedings")}</option>
                  <option value="Marked Unrelated">{tr("overlaps:markedUnrelatedRejectOverlapConflict")}</option>
                  <option value="Dismissed">{tr("overlaps:dismissedCoincidentalWordingNoActionNeeded")}</option>
                  <option value="Resolved">{tr("overlaps:resolvedJointHearingConcluded")}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{tr("overlaps:officialAdministrativeRemarksReviewNotes")}<span className="text-[#b91c1c]">*</span>
                </label>
                <textarea aria-label={tr("overlaps:officialAdministrativeRemarksReviewNotes")}
                  rows={4}
                  required
                  value={reviewRemarks}
                  onChange={e => setReviewRemarks(e.target.value)}
                  placeholder={tr("overlaps:recordJustificationCrossVerificationFindingsAndOfficerOrders")}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003366]"
                />
              </div>

              {decisionType !== "Marked Unrelated" && (
                <label className="flex items-center space-x-2 text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={linkAsRelated}
                    onChange={e => setLinkAsRelated(e.target.checked)}
                    className="rounded-lg text-aicte-navy-700"
                  />
                  <span>{tr("overlaps:createTwoWayLinkInRelatedCasesRegistry")}</span>
                </label>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setDecisionModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
                >{tr("common:cancel")}</button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className="px-4 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {submittingDecision ? tr("complaints:committing") : tr("overlaps:commitOfficialDecision")}
                </button>
              </div>
            </form>
          </div>
        </ModalFrame>
      )}
    </div>
  );
};
