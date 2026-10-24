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
  const [decisionType, setDecisionType] = useState<"Confirmed Related" | "Confirmed Duplicate" | "Marked Unrelated" | "Resolved">("Confirmed Related");
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

  const handleOpenDecision = (alert: OverlapAlert, type: "Confirmed Related" | "Confirmed Duplicate" | "Marked Unrelated") => {
    setTargetAlert(alert);
    setDecisionType(type);
    setReviewRemarks(
      type === "Confirmed Related"
        ? "Cross-Bureau overlap verified. Both files require joint inquiry between Regulation Bureau and PGRC."
        : type === "Confirmed Duplicate"
        ? "Duplicate petition submitted by same aggrieved party regarding identical violation."
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-aicte-navy-900 tracking-tight">
              Cross-Bureau Overlap Detection Center
            </h1>
            <span className="text-[11px] bg-amber-500/10 text-amber-900 font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
              Core Innovation Hub
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Intelligent detection of simultaneous complaints concerning the same institution across Regulation Bureau, PGRC, and Regional Offices.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">Filter Alerts:</span>

          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-medium"
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
            className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
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
            className="flex items-center space-x-1 text-slate-500 hover:text-slate-800 underline text-xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Overlap Cards Grid */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500 text-xs">
            Loading cross-bureau overlap intelligence records...
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500 text-xs">
            No overlap alerts found matching your filter criteria.
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`bg-white border ${
                alert.alertStatus === "Pending Review" ? "border-amber-300 ring-1 ring-amber-100" : "border-slate-200"
              } rounded-lg p-5 shadow-xs hover:shadow-md transition space-y-4`}
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-950 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
                    {alert.alertId}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      alert.alertStatus === "Pending Review"
                        ? "bg-amber-500 text-white"
                        : alert.alertStatus === "Confirmed Related"
                        ? "bg-blue-600 text-white"
                        : alert.alertStatus === "Confirmed Duplicate"
                        ? "bg-purple-600 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {alert.alertStatus}
                  </span>
                  <span className="text-xs text-slate-500">
                    Detected on: {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded">
                    Rule Score: {alert.ruleMatchScore}%
                  </span>
                  {alert.semanticSimilarityScore !== undefined && (
                    <span className="text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      <span>AI Similarity: {alert.semanticSimilarityScore}%</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Institution Row */}
              <div className="flex items-center space-x-2 text-xs">
                <Building2 className="w-4 h-4 text-aicte-navy-800" />
                <span className="font-bold text-slate-900 text-sm">{alert.institutionName}</span>
                <span className="font-mono text-slate-500 text-[11px]">({alert.aictePermanentId})</span>
              </div>

              {/* Cross-Bureau Complaints Comparison Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Case A Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-blue-700">
                      {alert.complaintRefA}
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-900 font-semibold px-2 py-0.5 rounded">
                      Bureau: {alert.bureauA}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800">{alert.complaintTitleA}</div>
                  <div className="text-[11px] text-slate-600 line-clamp-2">{alert.complaintDescA}</div>
                  <div className="text-[10px] text-slate-400">
                    Category: <span className="font-medium text-slate-600">{alert.categoryA}</span>
                  </div>
                </div>

                {/* Case B Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-purple-700">
                      {alert.complaintRefB}
                    </span>
                    <span className="text-[10px] bg-purple-100 text-purple-900 font-semibold px-2 py-0.5 rounded">
                      Bureau: {alert.bureauB}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800">{alert.complaintTitleB}</div>
                  <div className="text-[11px] text-slate-600 line-clamp-2">{alert.complaintDescB}</div>
                  <div className="text-[10px] text-slate-400">
                    Category: <span className="font-medium text-slate-600">{alert.categoryB}</span>
                  </div>
                </div>
              </div>

              {/* Reasons & Recommended Action */}
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-md p-3 text-xs space-y-1.5">
                <div className="text-slate-700">
                  <span className="font-semibold text-amber-900">Explainable Match Factors: </span>
                  {alert.matchReasons.join(" • ")}
                </div>
                <div className="text-slate-700">
                  <span className="font-semibold text-slate-900">Recommended Coordination Step: </span>
                  <span className="italic">{alert.recommendedAction}</span>
                </div>
                {alert.reviewRemarks && (
                  <div className="text-slate-700 pt-1 border-t border-amber-200/60">
                    <span className="font-semibold text-blue-900">
                      Review Record ({alert.reviewedByName || "Officer"} on{" "}
                      {alert.reviewedAt ? new Date(alert.reviewedAt).toLocaleDateString() : "Recent"}):{" "}
                    </span>
                    <span>{alert.reviewRemarks}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => handleOpenSideBySide(alert)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-medium transition inline-flex items-center space-x-1.5 border border-slate-300"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Open Side-by-Side Comparison</span>
                </button>

                {canReview && alert.alertStatus === "Pending Review" && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenDecision(alert, "Confirmed Related")}
                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold shadow-xs flex items-center space-x-1"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Confirm Related</span>
                    </button>
                    <button
                      onClick={() => handleOpenDecision(alert, "Confirmed Duplicate")}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-semibold shadow-xs flex items-center space-x-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Mark Duplicate</span>
                    </button>
                    <button
                      onClick={() => handleOpenDecision(alert, "Marked Unrelated")}
                      className="px-3 py-1.5 border border-slate-300 hover:bg-red-50 hover:border-red-300 hover:text-red-700 text-slate-700 rounded text-xs font-medium transition flex items-center space-x-1"
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                      <span>Reject Overlap</span>
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-aicte-navy-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <GitMerge className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold">Side-by-Side Cross-Bureau Grievance Comparison</h3>
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Institution: {selectedAlert.institutionName} ({selectedAlert.aictePermanentId})
                </div>
              </div>
              <button
                onClick={() => setCompareModalOpen(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Subheader / AI Intelligence Badge */}
            <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-3">
                <span className="font-bold text-amber-900">
                  Rule Score: {selectedAlert.ruleMatchScore}%
                </span>
                <span className="text-slate-300">|</span>
                <span className="font-bold text-blue-900 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    Semantic Score:{" "}
                    {liveCompareData ? `${liveCompareData.semanticScore}% (${liveCompareData.engine})` : "Calculating..."}
                  </span>
                </span>
              </div>

              {liveCompareData && liveCompareData.commonKeywords.length > 0 && (
                <div className="text-[11px] text-slate-600">
                  <strong>Common Lexical Keywords:</strong>{" "}
                  <span className="text-blue-800 font-mono">
                    [{liveCompareData.commonKeywords.slice(0, 7).join(", ")}]
                  </span>
                </div>
              )}
            </div>

            {/* Side by side columns */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Complaint A */}
              <div className="space-y-3 pr-0 md:pr-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Case A Reference</span>
                    <div className="font-mono text-sm font-bold text-blue-700">
                      {selectedAlert.complaintRefA}
                    </div>
                  </div>
                  <span className="text-xs font-semibold bg-blue-100 text-blue-900 px-2.5 py-1 rounded">
                    Bureau: {selectedAlert.bureauA}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">Category</span>
                  <span className="text-xs font-semibold text-slate-800">{selectedAlert.categoryA}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">Grievance Title</span>
                  <span className="text-xs font-bold text-slate-900">{selectedAlert.complaintTitleA}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Grievance Description Text</span>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {selectedAlert.complaintDescA}
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    to={`/cases/${selectedAlert.complaintIdA}`}
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    View Full Case A File &rarr;
                  </Link>
                </div>
              </div>

              {/* Complaint B */}
              <div className="space-y-3 pt-4 md:pt-0 pl-0 md:pl-6">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Case B Reference</span>
                    <div className="font-mono text-sm font-bold text-purple-700">
                      {selectedAlert.complaintRefB}
                    </div>
                  </div>
                  <span className="text-xs font-semibold bg-purple-100 text-purple-900 px-2.5 py-1 rounded">
                    Bureau: {selectedAlert.bureauB}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">Category</span>
                  <span className="text-xs font-semibold text-slate-800">{selectedAlert.categoryB}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">Grievance Title</span>
                  <span className="text-xs font-bold text-slate-900">{selectedAlert.complaintTitleB}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Grievance Description Text</span>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {selectedAlert.complaintDescB}
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    to={`/cases/${selectedAlert.complaintIdB}`}
                    className="text-xs text-purple-600 hover:underline font-semibold"
                  >
                    View Full Case B File &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-100"
              >
                Close Comparison
              </button>

              {canReview && selectedAlert.alertStatus === "Pending Review" && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenDecision(selectedAlert, "Confirmed Related")}
                    className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold shadow-xs flex items-center space-x-1.5"
                  >
                    <Link2 className="w-4 h-4" />
                    <span>Confirm Related</span>
                  </button>
                  <button
                    onClick={() => handleOpenDecision(selectedAlert, "Confirmed Duplicate")}
                    className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-semibold shadow-xs flex items-center space-x-1.5"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Mark Duplicate</span>
                  </button>
                  <button
                    onClick={() => handleOpenDecision(selectedAlert, "Marked Unrelated")}
                    className="px-3 py-2 border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 rounded text-xs font-semibold flex items-center space-x-1.5"
                  >
                    <XCircle className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-aicte-navy-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Record Overlap Review Decision</h3>
              <button onClick={() => setDecisionModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDecision} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Regulatory Determination Decision <span className="text-red-500">*</span>
                </label>
                <select
                  value={decisionType}
                  onChange={e => setDecisionType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs font-semibold"
                >
                  <option value="Confirmed Related">Confirmed Related (Link for Cross-Bureau Coordination)</option>
                  <option value="Confirmed Duplicate">Confirmed Duplicate (Merge Proceedings)</option>
                  <option value="Marked Unrelated">Marked Unrelated (Dismiss Overlap Conflict)</option>
                  <option value="Resolved">Resolved (Joint Hearing Concluded)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Administrative Remarks & Review Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={reviewRemarks}
                  onChange={e => setReviewRemarks(e.target.value)}
                  placeholder="Record justification, cross-verification findings, and officer orders..."
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs"
                />
              </div>

              {decisionType !== "Marked Unrelated" && (
                <label className="flex items-center space-x-2 text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={linkAsRelated}
                    onChange={e => setLinkAsRelated(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Create two-way link in Related Cases registry</span>
                </label>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setDecisionModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className="px-4 py-1.5 bg-aicte-navy-900 text-white rounded text-xs font-semibold hover:bg-aicte-navy-800 disabled:opacity-50"
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
