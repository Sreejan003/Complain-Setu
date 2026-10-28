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

  const canAdjudicate = (trf: CaseTransfer) => !!user && !!user.permissions?.includes("APPROVE_TRANSFERS") && (user.role === "COMPETENT_AUTHORITY" || (user.role === "BUREAU_HEAD" && !!user.bureauId && user.bureauId === trf.toBureauId));

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-[#cbd5e1] rounded-xs p-3.5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#003366] bg-[#e8eef5] border border-[#b8c9dc] px-2 py-0.5 rounded-xs">
              Statutory Jurisdiction Routing
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">
            Inter-Bureau Case Transfer & Re-allocation Ledger
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Formal re-allocation of grievances between Regulation Bureau (RB), PGRC, and Regional Offices with mandatory recorded rationale.
          </p>
        </div>

        {canInitiate && (
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs text-xs font-semibold border border-[#002147] self-start sm:self-auto transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Initiate Bureau Transfer</span>
          </button>
        )}
      </div>

      {/* Transfers Registry Table */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs overflow-hidden">
        <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#cbd5e1] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#003366]">
            Official Transfer Audit Ledger ({transfers.length} records)
          </span>
          <span className="text-[11px] text-slate-500">Immutable statutory trail &bull; Two-way acceptance lifecycle</span>
        </div>

        <div className="overflow-x-auto">
          <table className="gov-table w-full text-left text-xs">
            <thead>
              <tr>
                <th className="py-2.5 px-3">Complaint Ref ID</th>
                <th className="py-2.5 px-3">Institution Name</th>
                <th className="py-2.5 px-3">Transfer Route</th>
                <th className="py-2.5 px-3">Transfer Justification</th>
                <th className="py-2.5 px-3">Transferred By</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Adjudication</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Loading transfer history...
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No case transfers recorded.
                  </td>
                </tr>
              ) : (
                transfers.map(trf => (
                  <tr key={trf.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#003366] whitespace-nowrap">
                      <Link to={`/cases/${trf.complaintId}`} className="hover:underline">
                        {trf.complaintRefId}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-xs truncate">
                      {trf.institutionName}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 bg-[#f1f5f9] border border-slate-300 px-1.5 py-0.5 rounded-xs text-[10px]">
                        {trf.fromBureauId}
                      </span>
                      <span className="mx-1.5 text-slate-400">&rarr;</span>
                      <span className="font-semibold text-[#003366] bg-[#e8eef5] border border-[#b8c9dc] px-1.5 py-0.5 rounded-xs text-[10px]">
                        {trf.toBureauId}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-md truncate" title={trf.transferReason}>
                      {trf.transferReason}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-800 font-medium">
                      {trf.transferredByName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px] font-mono">
                      {new Date(trf.transferredAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-xs text-[10px] border ${
                          trf.acceptanceStatus === "Accepted"
                            ? "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]"
                            : trf.acceptanceStatus === "Rejected"
                            ? "bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]"
                            : "bg-[#fef3c7] text-[#92400e] border-[#fde68a]"
                        }`}
                      >
                        {trf.acceptanceStatus === "Pending" ? "Pending Acceptance" : trf.acceptanceStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {trf.acceptanceStatus === "Pending" && canAdjudicate(trf) ? (
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjudicate(trf, "Accepted")}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xs text-[11px] font-semibold cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAdjudicate(trf, "Rejected")}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xs text-[11px] font-semibold cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      ) : trf.acceptanceStatus === "Pending" ? (
                        <span className="text-[10px] text-slate-500 italic">
                          Awaiting {trf.toBureauId} Review
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Completed</span>
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-xl max-w-lg w-full overflow-hidden border border-slate-300">
            <div className="px-4 py-2.5 bg-[#003366] text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-4 h-4 text-[#ff9933]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Initiate Inter-Bureau Case Transfer</h3>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInitiateTransfer} className="p-4 space-y-3 text-xs">
              {formError && (
                <div className="p-2 bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5] rounded-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select Case to Transfer <span className="text-[#b91c1c]">*</span>
                </label>
                <select
                  required
                  value={selectedCaseId}
                  onChange={e => setSelectedCaseId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs text-slate-900"
                >
                  <option value="">-- Choose active complaint --</option>
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
                <label className="block font-bold text-slate-700 mb-1">
                  Destination Bureau / Cell <span className="text-[#b91c1c]">*</span>
                </label>
                <select
                  value={destinationBureau}
                  onChange={e => setDestinationBureau(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {bureaus.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Statutory Justification & Grounds <span className="text-[#b91c1c]">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  placeholder="State the regulatory grounds or jurisdiction provisions under which this case is being reassigned..."
                  className="w-full bg-white border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003366]"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xs text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Confirm & Execute Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Adjudication (Accept / Decline) Modal */}
      {adjudicateModalOpen && targetTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-xl max-w-md w-full overflow-hidden border border-slate-300">
            <div className={`px-4 py-2.5 text-white flex items-center justify-between ${
              adjudicateAction === "Accepted" ? "bg-emerald-800" : "bg-rose-800"
            }`}>
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  {adjudicateAction === "Accepted" ? "Accept Incoming Jurisdiction Transfer" : "Decline Case Transfer"}
                </h3>
              </div>
              <button onClick={() => setAdjudicateModalOpen(false)} className="text-slate-200 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAdjudicate} className="p-4 space-y-3 text-xs">
              {adjudicateError && (
                <div className="p-2 bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5] rounded-xs">
                  {adjudicateError}
                </div>
              )}

              <div className="p-2.5 bg-[#f8fafc] border border-slate-200 rounded-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Complaint:</span>
                  <span className="font-mono font-bold text-[#003366]">{targetTransfer.complaintRefId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Institution:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[200px]">{targetTransfer.institutionName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Route:</span>
                  <span className="font-mono text-slate-800">{targetTransfer.fromBureauId} &rarr; {targetTransfer.toBureauId}</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-1 pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Originating Reason:</span> {targetTransfer.transferReason}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Official Adjudication Remarks & Rationale <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={adjudicateRemarks}
                  onChange={e => setAdjudicateRemarks(e.target.value)}
                  placeholder="State the regulatory basis for accepting or declining this jurisdiction transfer..."
                  className="w-full bg-white border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003366]"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAdjudicateModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjudicateSubmitting}
                  className={`px-4 py-1.5 text-white rounded-xs font-semibold disabled:opacity-50 cursor-pointer ${
                    adjudicateAction === "Accepted"
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : "bg-rose-700 hover:bg-rose-800"
                  }`}
                >
                  {adjudicateSubmitting ? "Submitting..." : adjudicateAction === "Accepted" ? "Confirm & Accept Jurisdiction" : "Confirm & Decline Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
