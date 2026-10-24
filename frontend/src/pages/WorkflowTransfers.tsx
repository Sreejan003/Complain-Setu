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

  const bureaus = [
    { id: "RB", name: "Regulation Bureau (RB)" },
    { id: "PGRC", name: "Public Grievance Redressal Cell (PGRC)" },
    { id: "RO", name: "Regional Offices (RO)" },
    { id: "AB", name: "Approval Bureau (AB)" },
    { id: "PB", name: "Policy & Academic Bureau (PB)" }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-aicte-navy-900 tracking-tight">
            Inter-Bureau Case Transfer & Routing Workflow
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Formal re-allocation of grievances between Regulation Bureau, PGRC, and Regional Offices with recorded rationale.
          </p>
        </div>

        {["Administrator", "Regulation Bureau Officer", "PGRC Officer", "Regional Officer"].includes(
          user?.role || ""
        ) && (
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-aicte-navy-900 hover:bg-aicte-navy-800 text-white rounded-md text-xs font-semibold shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Initiate New Transfer</span>
          </button>
        )}
      </div>

      {/* Transfers Registry Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Official Transfer Audit Ledger ({transfers.length} records)
          </span>
          <span className="text-[11px] text-slate-500">All transitions recorded immutably</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Case Ref ID</th>
                <th className="py-3 px-4">Institution Name</th>
                <th className="py-3 px-4">Transfer Route</th>
                <th className="py-3 px-4">Transfer Justification</th>
                <th className="py-3 px-4">Transferred By</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading transfer history...
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No case transfers recorded.
                  </td>
                </tr>
              ) : (
                transfers.map(trf => (
                  <tr key={trf.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                      <Link to={`/cases/${trf.complaintId}`} className="hover:underline">
                        {trf.complaintRefId}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 max-w-xs truncate">
                      {trf.institutionName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                        {trf.fromBureauId}
                      </span>
                      <span className="mx-1 text-slate-400">&rarr;</span>
                      <span className="font-semibold text-purple-800 bg-purple-100 px-2 py-0.5 rounded text-[10px]">
                        {trf.toBureauId}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md truncate">{trf.transferReason}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                      {trf.transferredByName}
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(trf.transferredAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                        {trf.acceptanceStatus}
                      </span>
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-aicte-navy-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">Initiate Inter-Bureau Case Transfer</h3>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInitiateTransfer} className="p-5 space-y-4">
              {formError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Case to Transfer <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedCaseId}
                  onChange={e => setSelectedCaseId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Bureau / Cell <span className="text-red-500">*</span>
                </label>
                <select
                  value={destinationBureau}
                  onChange={e => setDestinationBureau(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs"
                >
                  {bureaus.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Statutory Justification & Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  placeholder="State the regulatory grounds or jurisdiction provisions under which this case is being reassigned..."
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-purple-700 text-white rounded text-xs font-semibold hover:bg-purple-800 disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Confirm & Execute Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
