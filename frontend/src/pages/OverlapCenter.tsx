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
        linkAsRelated
      });

      setDecisionModalOpen(false);
      setCompareModalOpen(false);
      fetchAlerts();
    } catch (err: any) {
      alert(err.message || "Failed to record decision.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  const canReview = ["Administrator", "Regulation Bureau Officer", "PGRC Officer", "Senior Management"].includes(
    user?.role || ""
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-[#cbd5e1] rounded-xs p-3.5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#003366] bg-[#e8eef5] border border-[#b8c9dc] px-2 py-0.5 rounded-xs">
              Automated Regulatory Cross-Check
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">
            Cross-Bureau Overlap Detection & Joint Adjudication Center
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Intelligent detection of concurrent grievances concerning identical institutions across Regulation Bureau (RB), PGRC, and Regional Offices.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-bold text-slate-700">Filter Alerts:</span>

          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-slate-300 rounded-xs px-2.5 py-1 text-slate-900 font-medium"
          >
            <option value="">All Review Statuses</option>
            <option value="Pending Review">Pending Review (Action Needed)</option>
            <option value="Confirmed Related">Confirmed Related</option>
            <option value="Confirmed Duplicate">Confirmed Duplicate</option>
            <option value="Marked Unrelated">Marked Unrelated</option>
            <option value="Resolved">Resolved</option>
          </select>

          <select
            value={bureauFilter}
            onChange={e => {
              setBureauFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-slate-300 rounded-xs px-2.5 py-1 text-slate-900"
          >
            <option value="">All Bureaus Involved</option>
            <option value="RB">Regulation Bureau (RB)</option>
            <option value="PGRC">Public Grievance Redressal Cell (PGRC)</option>
            <option value="RO">Regional Offices (RO)</option>
            <option value="AB">Approval Bureau (AB)</option>
          </select>
        </div>

        {(statusFilter || bureauFilter) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setBureauFilter("");
              setPage(1);
            }}
            className="flex items-center space-x-1 text-[#003366] hover:underline text-xs font-semibold"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Overlap Cards Grid */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white border border-[#cbd5e1] rounded-xs p-10 text-center text-slate-500 text-xs">
            Loading cross-bureau overlap intelligence records...
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white border border-[#cbd5e1] rounded-xs p-10 text-center text-slate-500 text-xs">
            No overlap alerts found matching your filter criteria.
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`bg-white border ${
                alert.alertStatus === "Pending Review" ? "border-[#f59e0b]" : "border-[#cbd5e1]"
              } rounded-xs p-4 space-y-3`}
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#003366] bg-[#e8eef5] px-2 py-0.5 rounded-xs border border-[#b8c9dc]">
                    {alert.alertId}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-xs border ${
                      alert.alertStatus === "Pending Review"
                        ? "bg-[#fef3c7] text-[#92400e] border-[#fcd34d]"
                        : alert.alertStatus === "Confirmed Related"
                        ? "bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]"
                        : alert.alertStatus === "Confirmed Duplicate"
                        ? "bg-[#f5f3ff] text-[#5b21b6] border-[#ddd6fe]"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    {alert.alertStatus}
                  </span>
                  {alert.confidenceCategory && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-xs bg-slate-100 text-slate-700 border border-slate-300">
                      {alert.confidenceCategory}
                    </span>
                  )}
                  {alert.detectionMethod && (
                    <span className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded-xs font-mono border border-slate-200">
                      {alert.detectionMethod}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 font-mono">
                    Detected: {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold bg-[#fffbeb] text-[#92400e] border border-[#fcd34d] px-2 py-0.5 rounded-xs">
                    Rule Match: {alert.ruleMatchScore}%
                  </span>
                  {alert.semanticSimilarityScore !== undefined && (
                    <span className="text-xs font-bold bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe] px-2 py-0.5 rounded-xs flex items-center space-x-1">
                      <span>Semantic Score: {alert.semanticSimilarityScore}%</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Institution Row */}
              <div className="flex items-center space-x-2 text-xs">
                <Building2 className="w-4 h-4 text-[#003366]" />
                <span className="font-bold text-slate-900 text-sm">{alert.institutionName}</span>
                <span className="font-mono text-slate-500 text-[11px]">({alert.aictePermanentId})</span>
              </div>

              {/* Cross-Bureau Complaints Comparison Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Case A Box */}
                <div className="bg-[#f8fafc] border border-slate-200 rounded-xs p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#003366]">
                      {alert.complaintRefA}
                    </span>
                    <span className="text-[10px] bg-white text-[#003366] border border-slate-300 font-bold px-1.5 py-0.2 rounded-xs">
                      Bureau: {alert.bureauA}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900">{alert.complaintTitleA}</div>
                  <div className="text-[11px] text-slate-700 line-clamp-2">{alert.complaintDescA}</div>
                  <div className="text-[10px] text-slate-500">
                    Category: <span className="font-medium text-slate-800">{alert.categoryA}</span>
                  </div>
                </div>

                {/* Case B Box */}
                <div className="bg-[#f8fafc] border border-slate-200 rounded-xs p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#003366]">
                      {alert.complaintRefB}
                    </span>
                    <span className="text-[10px] bg-white text-[#003366] border border-slate-300 font-bold px-1.5 py-0.2 rounded-xs">
                      Bureau: {alert.bureauB}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900">{alert.complaintTitleB}</div>
                  <div className="text-[11px] text-slate-700 line-clamp-2">{alert.complaintDescB}</div>
                  <div className="text-[10px] text-slate-500">
                    Category: <span className="font-medium text-slate-800">{alert.categoryB}</span>
                  </div>
                </div>
              </div>

              {/* Reasons & Recommended Action */}
              <div className="bg-[#fffbeb] border border-[#fcd34d] rounded-xs p-3 text-xs space-y-2">
                {alert.explanation ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-white p-2 rounded-xs border border-amber-200">
                        <span className="text-slate-500 block text-[10px] font-bold uppercase">Institution Match</span>
                        <span className="font-bold text-slate-900">100% Verified</span>
                      </div>
                      <div className="bg-white p-2 rounded-xs border border-amber-200">
                        <span className="text-slate-500 block text-[10px] font-bold uppercase">Bureau Boundary</span>
                        <span className="font-bold text-[#003366]">
                          {alert.explanation.crossBureauMatch.isCrossBureau ? "Cross-Bureau Overlap" : "Intra-Bureau Case"}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xs border border-amber-200">
                        <span className="text-slate-500 block text-[10px] font-bold uppercase">Category Alignment</span>
                        <span className="font-bold text-slate-900">
                          {alert.explanation.categoryMatch.exactMatch ? "Identical Category" : "Related Category"}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xs border border-amber-200">
                        <span className="text-slate-500 block text-[10px] font-bold uppercase">Semantic Alignment</span>
                        <span className="font-bold text-[#003366]">
                          {alert.explanation.semanticMatch.score}% ({alert.explanation.semanticMatch.engine.split(" ")[0]})
                        </span>
                      </div>
                    </div>

                    {alert.explanation.keywordMatch.matchedTerms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-slate-600 text-[11px] font-bold">Matched Keywords:</span>
                        {alert.explanation.keywordMatch.matchedTerms.map((kw, i) => (
                          <span key={i} className="bg-white text-slate-800 border border-slate-300 font-mono text-[10px] px-1.5 py-0.5 rounded-xs">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-slate-800 text-[11px]">
                      <span className="font-bold text-[#92400e]">Redressal Assessment: </span>
                      {alert.matchReasons.join(" • ")}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-800">
                    <span className="font-bold text-[#92400e]">Redressal Assessment: </span>
                    {alert.matchReasons.join(" • ")}
                  </div>
                )}

                <div className="text-slate-800 pt-1 border-t border-[#fed7aa] flex items-start space-x-1.5">
                  <span className="font-bold text-slate-900 shrink-0">Recommended Action:</span>
                  <span className="text-slate-800 font-medium">{alert.recommendedAction}</span>
                </div>

                {alert.reviewRemarks && (
                  <div className="text-slate-800 pt-1 border-t border-[#fed7aa]">
                    <span className="font-bold text-[#003366]">
                      Review Record ({alert.reviewedByName || "Officer"} on{" "}
                      {alert.reviewedAt ? new Date(alert.reviewedAt).toLocaleDateString() : "Recent"}):{" "}
                    </span>
                    <span>{alert.reviewRemarks}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  onClick={() => handleOpenSideBySide(alert)}
                  className="px-2.5 py-1 bg-white hover:bg-[#f1f5f9] text-[#003366] rounded-xs text-xs font-semibold transition inline-flex items-center space-x-1.5 border border-[#cbd5e1]"
                >
                  <Eye className="w-3.5 h-3.5 text-[#003366]" />
                  <span>Inspect Side-by-Side</span>
                </button>

                {canReview && alert.alertStatus === "Pending Review" && (
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleOpenDecision(alert, "Confirmed Related")}
                      className="px-2.5 py-1 bg-[#003366] hover:bg-[#002147] text-white rounded-xs text-xs font-semibold flex items-center space-x-1 border border-[#002147]"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Confirm Related</span>
                    </button>
                    <button
                      onClick={() => handleOpenDecision(alert, "Confirmed Duplicate")}
                      className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-xs text-xs font-semibold flex items-center space-x-1 border border-slate-800"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Mark Duplicate</span>
                    </button>
                    <button
                      onClick={() => handleOpenDecision(alert, "Marked Unrelated")}
                      className="px-2.5 py-1 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xs text-xs font-semibold transition flex items-center space-x-1"
                    >
                      <XCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reject Overlap</span>
                    </button>
                    <button
                      onClick={() => handleOpenDecision(alert, "Dismissed")}
                      className="px-2 py-1 border border-slate-300 hover:bg-slate-100 text-slate-500 rounded-xs text-xs font-medium transition"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: SIDE-BY-SIDE COMPLAINT COMPARISON */}
      {compareModalOpen && selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-300">
            {/* Modal Header */}
            <div className="px-4 py-2.5 bg-[#003366] text-white flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <GitMerge className="w-4 h-4 text-[#ff9933]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Side-by-Side Grievance Comparison</h3>
                </div>
                <div className="text-[10px] text-slate-300">
                  {selectedAlert.institutionName} • PID: {selectedAlert.aictePermanentId}
                </div>
              </div>
              <button onClick={() => setCompareModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Subheader / AI Intelligence Badge */}
            <div className="px-4 py-2 bg-[#fffbeb] border-b border-[#fed7aa] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-3">
                <span className="font-bold text-[#92400e]">
                  Rule Match: {selectedAlert.ruleMatchScore}%
                </span>
                <span className="text-slate-300">|</span>
                <span className="font-bold text-[#003366] flex items-center space-x-1">
                  <span>
                    Semantic Score:{" "}
                    {liveCompareData ? `${liveCompareData.semanticScore}% (${liveCompareData.engine})` : "Calculating..."}
                  </span>
                </span>
              </div>

              {liveCompareData && liveCompareData.commonKeywords.length > 0 && (
                <div className="text-[11px] text-slate-700">
                  <strong className="text-slate-900 font-bold">Common Keywords:</strong>{" "}
                  <span className="text-[#003366] font-mono font-semibold">
                    [{liveCompareData.commonKeywords.slice(0, 7).join(", ")}]
                  </span>
                </div>
              )}
            </div>

            {/* Side by side columns */}
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Complaint A */}
              <div className="bg-[#f8fafc] border border-slate-200 rounded-xs p-3 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Case A Reference</span>
                    <div className="font-mono text-sm font-bold text-[#003366]">
                      {selectedAlert.complaintRefA}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-white text-[#003366] border border-slate-300 px-1.5 py-0.2 rounded-xs">
                    Bureau: {selectedAlert.bureauA}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Category</span>
                  <span className="text-xs font-semibold text-slate-800">{selectedAlert.categoryA}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Grievance Title</span>
                  <span className="text-xs font-bold text-slate-900">{selectedAlert.complaintTitleA}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Grievance Description Text</span>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xs text-xs text-slate-800 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {selectedAlert.complaintDescA}
                  </div>
                </div>

                <div className="pt-1">
                  <Link
                    to={`/cases/${selectedAlert.complaintIdA}`}
                    className="text-xs text-[#003366] hover:underline font-semibold"
                  >
                    View Full Case A File &rarr;
                  </Link>
                </div>
              </div>

              {/* Complaint B */}
              <div className="bg-[#f8fafc] border border-slate-200 rounded-xs p-3 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Case B Reference</span>
                    <div className="font-mono text-sm font-bold text-[#003366]">
                      {selectedAlert.complaintRefB}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-white text-[#003366] border border-slate-300 px-1.5 py-0.2 rounded-xs">
                    Bureau: {selectedAlert.bureauB}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Category</span>
                  <span className="text-xs font-semibold text-slate-800">{selectedAlert.categoryB}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Grievance Title</span>
                  <span className="text-xs font-bold text-slate-900">{selectedAlert.complaintTitleB}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Grievance Description Text</span>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xs text-xs text-slate-800 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {selectedAlert.complaintDescB}
                  </div>
                </div>

                <div className="pt-1">
                  <Link
                    to={`/cases/${selectedAlert.complaintIdB}`}
                    className="text-xs text-[#003366] hover:underline font-semibold"
                  >
                    View Full Case B File &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-4 py-2.5 bg-[#f8fafc] border-t border-[#cbd5e1] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-xs text-xs text-slate-700 hover:bg-slate-100"
              >
                Close Comparison
              </button>

              {canReview && selectedAlert.alertStatus === "Pending Review" && (
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleOpenDecision(selectedAlert, "Confirmed Related")}
                    className="px-3 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs text-xs font-semibold flex items-center space-x-1 border border-[#002147]"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Confirm Related</span>
                  </button>
                  <button
                    onClick={() => handleOpenDecision(selectedAlert, "Confirmed Duplicate")}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xs text-xs font-semibold flex items-center space-x-1 border border-slate-800"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Mark Duplicate</span>
                  </button>
                  <button
                    onClick={() => handleOpenDecision(selectedAlert, "Marked Unrelated")}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-xs text-xs font-semibold flex items-center space-x-1"
                  >
                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reject Relationship</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: OFFICIAL REVIEW DECISION FORM */}
      {decisionModalOpen && targetAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-xl max-w-lg w-full overflow-hidden border border-slate-300">
            <div className="px-4 py-2.5 bg-[#003366] text-white flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Record Overlap Review Determination</h3>
              <button onClick={() => setDecisionModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDecision} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Regulatory Determination Decision <span className="text-[#b91c1c]">*</span>
                </label>
                <select
                  value={decisionType}
                  onChange={e => setDecisionType(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                >
                  <option value="Confirmed Related">Confirmed Related (Link for Cross-Bureau Coordination)</option>
                  <option value="Confirmed Duplicate">Confirmed Duplicate (Merge Proceedings)</option>
                  <option value="Marked Unrelated">Marked Unrelated (Reject Overlap Conflict)</option>
                  <option value="Dismissed">Dismissed (Coincidental wording / No Action Needed)</option>
                  <option value="Resolved">Resolved (Joint Hearing Concluded)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Official Administrative Remarks & Review Notes <span className="text-[#b91c1c]">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={reviewRemarks}
                  onChange={e => setReviewRemarks(e.target.value)}
                  placeholder="Record justification, cross-verification findings, and officer orders..."
                  className="w-full bg-white border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003366]"
                />
              </div>

              {decisionType !== "Marked Unrelated" && (
                <label className="flex items-center space-x-2 text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={linkAsRelated}
                    onChange={e => setLinkAsRelated(e.target.checked)}
                    className="rounded-xs text-[#003366]"
                  />
                  <span>Create two-way link in Related Cases registry</span>
                </label>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setDecisionModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xs text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className="px-4 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs text-xs font-semibold disabled:opacity-50"
                >
                  {submittingDecision ? "Committing..." : "Commit Official Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
