import { ModalFrame } from "../components/ui/Interface.js";
import { tr, localizeLabel, localizeError, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightLeft,
  Search,
  Building2,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  Send,
  Plus,
  X
} from "lucide-react";
import { api } from "../services/api.js";
import { CaseTransfer, Complaint } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

export const WorkflowTransfers: React.FC = () => {
  useLocaleRender();
  const [transfers, setTransfers] = useState<CaseTransfer[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const { user } = useAuth();

  // Form State
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [destinationBureau, setDestinationBureau] = useState("RB");
  const [transferReason, setTransferReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const data = await api.getTransfers();
      setTransfers(data);
      const comps = await api.getComplaints({ limit: 100 });
      setComplaints(comps.data);
    } catch (err) {
      console.error("Failed to load transfers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleInitiateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !transferReason.trim()) {
      setFormError("Select a case and enter a valid transfer reason.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      await api.createTransfer({
        complaintId: selectedCaseId,
        toBureauId: destinationBureau,
        transferReason
      });

      setShowTransferModal(false);
      setSelectedCaseId("");
      setTransferReason("");
      fetchTransfers();
    } catch (err: any) {
      setFormError(err.message || "Failed to execute transfer.");
    } finally {
      setSubmitting(false);
    }
  };

  // Response/Adjudication Modal State
  const [adjudicateModalOpen, setAdjudicateModalOpen] = useState(false);
  const [targetTransfer, setTargetTransfer] = useState<CaseTransfer | null>(null);
  const [adjudicateAction, setAdjudicateAction] = useState<"Accepted" | "Rejected">("Accepted");
  const [adjudicateRemarks, setAdjudicateRemarks] = useState("");
  const [adjudicateSubmitting, setAdjudicateSubmitting] = useState(false);
  const [adjudicateError, setAdjudicateError] = useState("");

  const handleOpenAdjudicate = (transfer: CaseTransfer, action: "Accepted" | "Rejected") => {
    setTargetTransfer(transfer);
    setAdjudicateAction(action);
    setAdjudicateRemarks(
      action === "Accepted"
        ? `Jurisdiction transfer acknowledged and accepted by ${transfer.toBureauId}. Case allocated for active investigation.`
        : `Transfer declined by ${transfer.toBureauId}. Case retained under originating bureau jurisdiction.`
    );
    setAdjudicateError("");
    setAdjudicateModalOpen(true);
  };

  const handleConfirmAdjudicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTransfer || !adjudicateRemarks.trim()) {
      setAdjudicateError("Official justification remarks are required.");
      return;
    }
    setAdjudicateSubmitting(true);
    setAdjudicateError("");
    try {
      await api.respondToTransfer(targetTransfer.id, {
        action: adjudicateAction,
        remarks: adjudicateRemarks.trim()
      });
      setAdjudicateModalOpen(false);
      setTargetTransfer(null);
      fetchTransfers();
    } catch (err: any) {
      setAdjudicateError(err.message || "Failed to process transfer adjudication.");
    } finally {
      setAdjudicateSubmitting(false);
    }
  };

  const canInitiate = ["BUREAU_HEAD", "COMPETENT_AUTHORITY"].includes(user?.role || "");

  const canAdjudicate = (trf: CaseTransfer) => !!(trf as any).canDecide;

  const bureaus = [
    { id: "RB", name: "Regulation Bureau (RB)" },
    { id: "PGRC", name: "Public Grievance Redressal Cell (PGRC)" },
    { id: "RO", name: "Regional Offices (RO)" },
    { id: "AB", name: "Approval Bureau (AB)" },
    { id: "PB", name: "Policy & Academic Bureau (PB)" }
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-bold text-aicte-navy-700 bg-[#e8eef5] border border-[#b8c9dc] px-2 py-0.5 rounded-lg">{tr("workflow:statutoryJurisdictionRouting")}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">{tr("navigation:workflowTransfers")}</h1>
          <p className="text-xs text-slate-600 mt-0.5">{tr("workflow:formalReAllocationOfGrievancesBetweenRegulationBureauRb")}</p>
        </div>

        {canInitiate && (
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg text-xs font-semibold border border-[#002147] self-start sm:self-auto transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{tr("workflow:initiateBureauTransfer")}</span>
          </button>
        )}
      </div>

      {/* Transfers Registry Table */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg overflow-hidden">
        <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#e5eaf0] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700">{tr("workflow:officialTransferAuditLedger")}{transfers.length}{tr("workflow:records")}</span>
          <span className="text-xs text-slate-500">{tr("workflow:immutableStatutoryTrailTwoWayAcceptanceLifecycle")}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="gov-table w-full text-start text-xs">
            <thead>
              <tr>
                <th className="py-2.5 px-3">{tr("workflow:complaintRefId")}</th>
                <th className="py-2.5 px-3">{tr("complaints:institutionName")}</th>
                <th className="py-2.5 px-3">{tr("workflow:transferRoute")}</th>
                <th className="py-2.5 px-3">{tr("workflow:transferJustification")}</th>
                <th className="py-2.5 px-3">{tr("workflow:transferredBy")}</th>
                <th className="py-2.5 px-3">{tr("workflow:timestamp")}</th>
                <th className="py-2.5 px-3 text-center">{tr("complaints:status_bae7d")}</th>
                <th className="py-2.5 px-3 text-center">{tr("workflow:adjudication")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">{tr("workflow:loadingTransferHistory")}</td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">{tr("workflow:noCaseTransfersRecorded")}</td>
                </tr>
              ) : (
                transfers.map(trf => (
                  <tr key={trf.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-aicte-navy-700 whitespace-nowrap">
                      <Link to={`/cases/${trf.complaintId}`} className="hover:underline">
                        <bdi dir="ltr" className="canonical-value">{trf.complaintRefId}</bdi>
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-xs truncate">
                      <bdi dir="auto" className="original-content">{trf.institutionName}</bdi>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 bg-[#f1f5f9] border border-slate-200 px-1.5 py-0.5 rounded-lg text-xs">
                        <bdi dir="ltr" className="canonical-value">{trf.fromBureauId}</bdi>
                      </span>
                      <span className="mx-1.5 text-slate-500">&rarr;</span>
                      <span className="font-semibold text-aicte-navy-700 bg-[#e8eef5] border border-[#b8c9dc] px-1.5 py-0.5 rounded-lg text-xs">
                        <bdi dir="ltr" className="canonical-value">{trf.toBureauId}</bdi>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-md truncate" title={trf.transferReason}>
                      <bdi dir="auto" className="original-content">{trf.transferReason}</bdi>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-800 font-medium">
                      {trf.transferredByName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-xs font-mono">
                      {formatDate(trf.transferredAt, true)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-lg text-xs border ${
                          trf.acceptanceStatus === "Accepted"
                            ? "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]"
                            : trf.acceptanceStatus === "Rejected"
                            ? "bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]"
                            : "bg-[#fef3c7] text-[#92400e] border-[#fde68a]"
                        }`}
                      >
                        {trf.acceptanceStatus === "Pending" ? tr("workflow:pendingAcceptance") : localizeLabel(trf.acceptanceStatus)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {trf.acceptanceStatus === "Pending" && canAdjudicate(trf) ? (
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjudicate(trf, "Accepted")}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                          >{tr("workflow:accept")}</button>
                          <button
                            type="button"
                            onClick={() => handleOpenAdjudicate(trf, "Rejected")}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                          >{tr("workflow:decline")}</button>
                        </div>
                      ) : trf.acceptanceStatus === "Pending" ? (
                        <span className="text-xs text-slate-500 italic">{tr("workflow:awaiting")}<bdi dir="ltr" className="canonical-value">{trf.toBureauId}</bdi>{tr("workflow:review_69ded")}</span>
                      ) : (
                        <span className="text-xs text-slate-500">{tr("dashboard:completed")}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <ModalFrame className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClose={() => setShowTransferModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-4 py-2.5 bg-aicte-navy-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-4 h-4 text-[#ff9933]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">{tr("workflow:initiateInterBureauCaseTransfer")}</h3>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-300 hover:text-white" aria-label={tr("common:cancel")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInitiateTransfer} className="p-4 space-y-3 text-xs">
              {formError && (
                <div className="p-2 bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5] rounded-lg">
                  {localizeError(formError)}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">{tr("workflow:selectCaseToTransfer")}<span className="text-[#b91c1c]">*</span>
                </label>
                <select aria-label={tr("workflow:selectCaseToTransfer")}
                  required
                  value={selectedCaseId}
                  onChange={e => setSelectedCaseId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                >
                  <option value="">{tr("workflow:chooseActiveComplaint")}</option>
                  {complaints
                    .filter(c => ["Pending", "Under Process"].includes(c.status))
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.complaintId} - {c.institutionName} ({c.currentBureauId})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{tr("workflow:destinationBureauCell")}<span className="text-[#b91c1c]">*</span>
                </label>
                <select aria-label={tr("workflow:destinationBureauCell")}
                  value={destinationBureau}
                  onChange={e => setDestinationBureau(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {bureaus.map(b => (
                    <option key={b.id} value={b.id}>
                      {localizeLabel(b.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{tr("workflow:statutoryJustificationGrounds")}<span className="text-[#b91c1c]">*</span>
                </label>
                <textarea aria-label={tr("workflow:statutoryJustificationGrounds")}
                  rows={4}
                  required
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  placeholder={tr("workflow:stateTheRegulatoryGroundsOrJurisdictionProvisionsUnderWhich")}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003366]"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
                >{tr("common:cancel")}</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {submitting ? tr("workflow:processing") : tr("workflow:confirmExecuteTransfer")}
                </button>
              </div>
            </form>
          </div>
        </ModalFrame>
      )}

      {/* Transfer Adjudication (Accept / Decline) Modal */}
      {adjudicateModalOpen && targetTransfer && (
        <ModalFrame className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClose={() => setAdjudicateModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className={`px-4 py-2.5 text-white flex items-center justify-between ${
              adjudicateAction === "Accepted" ? "bg-emerald-800" : "bg-rose-800"
            }`}>
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  {adjudicateAction === "Accepted" ? tr("workflow:acceptIncomingJurisdictionTransfer") : tr("complaints:declineCaseTransfer")}
                </h3>
              </div>
              <button onClick={() => setAdjudicateModalOpen(false)} className="text-slate-200 hover:text-white cursor-pointer" aria-label={tr("common:cancel")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAdjudicate} className="p-4 space-y-3 text-xs">
              {adjudicateError && (
                <div className="p-2 bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5] rounded-lg">
                  {localizeError(adjudicateError)}
                </div>
              )}

              <div className="p-2.5 bg-[#f8fafc] border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">{tr("workflow:complaint")}</span>
                  <span className="font-mono font-bold text-aicte-navy-700"><bdi dir="ltr" className="canonical-value">{targetTransfer.complaintRefId}</bdi></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">{tr("complaints:institution")}</span>
                  <span className="font-bold text-slate-800 truncate max-w-[200px]"><bdi dir="auto" className="original-content">{targetTransfer.institutionName}</bdi></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">{tr("complaints:route_61ab9")}</span>
                  <span className="font-mono text-slate-800"><bdi dir="ltr" className="canonical-value">{targetTransfer.fromBureauId}</bdi> &rarr; <bdi dir="ltr" className="canonical-value">{targetTransfer.toBureauId}</bdi></span>
                </div>
                <div className="text-xs text-slate-600 mt-1 pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">{tr("complaints:originatingReason")}</span> <bdi dir="auto" className="original-content">{targetTransfer.transferReason}</bdi>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{tr("workflow:officialAdjudicationRemarksRationale")}<span className="text-red-600">*</span>
                </label>
                <textarea aria-label={tr("workflow:officialAdjudicationRemarksRationale")}
                  rows={3}
                  required
                  value={adjudicateRemarks}
                  onChange={e => setAdjudicateRemarks(e.target.value)}
                  placeholder={tr("workflow:stateTheRegulatoryBasisForAcceptingOrDecliningThis")}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003366]"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAdjudicateModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                >{tr("common:cancel")}</button>
                <button
                  type="submit"
                  disabled={adjudicateSubmitting}
                  className={`px-4 py-1.5 text-white rounded-lg font-semibold disabled:opacity-50 cursor-pointer ${
                    adjudicateAction === "Accepted"
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : "bg-rose-700 hover:bg-rose-800"
                  }`}
                >
                  {adjudicateSubmitting ? tr("complaints:submitting") : adjudicateAction === "Accepted" ? tr("workflow:confirmAcceptJurisdiction") : tr("workflow:confirmDeclineTransfer")}
                </button>
              </div>
            </form>
          </div>
        </ModalFrame>
      )}
    </div>
  );
};
