import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Flame,
  GitMerge,
  History,
  User,
  Shield,
  Send,
  ChevronLeft,
  X,
  FileCheck
} from "lucide-react";
import { api } from "../services/api.js";
import { Complaint, CaseHistory, RelatedCase, OverlapAlert } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

export const ComplaintDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [history, setHistory] = useState<CaseHistory[]>([]);
  const [relatedCases, setRelatedCases] = useState<RelatedCase[]>([]);
  const [overlapAlerts, setOverlapAlerts] = useState<OverlapAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Status Action Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<any>("Under Process");
  const [actionRemarks, setActionRemarks] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  // Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferBureau, setTransferBureau] = useState("RB");
  const [transferReason, setTransferReason] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.getComplaintDetails(id);
      setComplaint(res.complaint);
      setHistory(res.history);
      setRelatedCases(res.relatedCases);
      setOverlapAlerts(res.overlapAlerts);
    } catch (err) {
      console.error("Failed to load complaint details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !actionRemarks.trim()) {
      setActionError("Official action remarks are required for audit trail.");
      return;
    }

    setActionSubmitting(true);
    setActionError("");
    try {
      await api.updateComplaintStatus(complaint.id, {
        status: newStatus,
        remarks: actionRemarks,
        disposalRemarks: newStatus === "Disposed" ? actionRemarks : undefined
      });
      setActionModalOpen(false);
      setActionRemarks("");
      fetchDetails();
    } catch (err: any) {
      setActionError(err.message || "Failed to update status.");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !transferReason.trim()) return;

    setTransferSubmitting(true);
    try {
      await api.createTransfer({
        complaintId: complaint.id,
        toBureauId: transferBureau,
        transferReason: transferReason
      });
      setTransferModalOpen(false);
      setTransferReason("");
      fetchDetails();
    } catch (err: any) {
      alert(err.message || "Transfer failed.");
    } finally {
      setTransferSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-500">Loading complaint details...</div>;
  }

  if (!complaint) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <h2 className="text-base font-bold text-slate-800">Case Record Not Found</h2>
        <Link to="/cases" className="mt-3 inline-block text-xs text-blue-600 hover:underline">
          &larr; Return to Case Register
        </Link>
      </div>
    );
  }

  const canModify = ["Administrator", "Regulation Bureau Officer", "PGRC Officer", "Regional Officer"].includes(
    user?.role || ""
  );

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link to="/cases" className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800">
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Case Register</span>
        </Link>
      </div>

      {/* Main Top Case Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-bold text-aicte-navy-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">
                {complaint.complaintId}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                  complaint.status === "Pending"
                    ? "bg-amber-100 text-amber-800"
                    : complaint.status === "Under Process"
                    ? "bg-blue-100 text-blue-800"
                    : complaint.status === "Disposed"
                    ? "bg-emerald-100 text-emerald-800"
                    : complaint.status === "Transferred"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {complaint.status}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-semibold ${
                  complaint.priority === "Critical"
                    ? "bg-red-600 text-white"
                    : complaint.priority === "High"
                    ? "bg-amber-500 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {complaint.priority} Priority
              </span>
              {complaint.hasOverlapAlert && (
                <Link
                  to="/overlaps"
                  className="inline-flex items-center space-x-1 bg-amber-500/10 text-amber-800 border border-amber-300 px-2 py-0.5 rounded text-xs font-bold hover:bg-amber-100"
                >
                  <GitMerge className="w-3.5 h-3.5 text-amber-600" />
                  <span>Overlap Flagged</span>
                </Link>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{complaint.title}</h1>
            <div className="text-xs text-slate-500">
              Institution:{" "}
              <Link
                to={`/institutions/${complaint.institutionId}`}
                className="font-bold text-blue-700 hover:underline"
              >
                {complaint.institutionName} ({complaint.aictePermanentId})
              </Link>
            </div>
          </div>

          {/* Action buttons */}
          {canModify && (
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <button
                onClick={() => {
                  setNewStatus(complaint.status === "Pending" ? "Under Process" : "Disposed");
                  setActionModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-aicte-navy-900 text-white rounded text-xs font-semibold hover:bg-aicte-navy-800 shadow-xs"
              >
                Update Status / Dispose
              </button>
              <button
                onClick={() => setTransferModalOpen(true)}
                className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 rounded text-xs font-medium hover:bg-slate-50 shadow-xs flex items-center space-x-1"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
                <span>Transfer Case</span>
              </button>
              {complaint.status !== "Escalated" && (
                <button
                  onClick={() => {
                    setNewStatus("Escalated");
                    setActionModalOpen(true);
                  }}
                  className="px-3 py-1.5 border border-red-300 bg-red-50 text-red-700 rounded text-xs font-medium hover:bg-red-100 shadow-xs flex items-center space-x-1"
                >
                  <Flame className="w-3.5 h-3.5 text-red-600" />
                  <span>Escalate</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Metadata info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Receiving Bureau</span>
            <span className="font-semibold text-slate-800">{complaint.receivingBureauId}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Current Bureau Handling</span>
            <span className="font-semibold text-blue-700">{complaint.currentBureauId}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Assigned Officer</span>
            <span className="font-semibold text-slate-800">
              {complaint.assignedOfficerName || "Unassigned"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Expected SLA Disposal</span>
            <span className="font-semibold text-slate-800">{complaint.expectedDisposalDate}</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content: Description & Overlaps left, Timeline right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Grievance Statement */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <FileText className="w-4 h-4 text-aicte-navy-800" />
              <span>Full Grievance Description</span>
            </h3>
            <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-md border border-slate-200/80 whitespace-pre-wrap">
              {complaint.description}
            </div>
            {complaint.disposalRemarks && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs">
                <span className="font-bold text-emerald-900 block">Disposal Resolution Record:</span>
                <span className="text-emerald-800 mt-1 block">{complaint.disposalRemarks}</span>
              </div>
            )}
          </div>

          {/* Cross-Bureau Overlap Alerts for this case */}
          {overlapAlerts.length > 0 && (
            <div className="bg-white border border-amber-200 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <GitMerge className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Cross-Bureau Overlap Alerts ({overlapAlerts.length})
                  </h3>
                </div>
                <Link to="/overlaps" className="text-xs text-blue-600 font-semibold hover:underline">
                  Compare in Overlap Center &rarr;
                </Link>
              </div>

              <div className="space-y-3">
                {overlapAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-900">{alert.alertId}</span>
                      <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold text-[10px]">
                        Match: {alert.ruleMatchScore}%
                      </span>
                    </div>

                    <div className="font-semibold text-slate-800">
                      Companion Case:{" "}
                      <span className="text-blue-700 font-mono">
                        {alert.complaintIdA === complaint.id ? alert.complaintRefB : alert.complaintRefA}
                      </span>{" "}
                      under {alert.complaintIdA === complaint.id ? alert.bureauB : alert.bureauA}
                    </div>

                    <div className="text-slate-600 text-[11px]">
                      <strong>Reasons:</strong> {alert.matchReasons.join("; ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked Related Cases */}
          {relatedCases.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Confirmed Related Cases
              </h3>
              <div className="divide-y divide-slate-100">
                {relatedCases.map(rel => (
                  <div key={rel.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-semibold text-blue-700">
                        {rel.complaintIdA === complaint.id ? rel.complaintRefB : rel.complaintRefA}
                      </span>
                      <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {rel.relationshipType}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5">{rel.notes}</div>
                    </div>
                    <span className="text-[10px] text-slate-400">Linked by {rel.linkedByName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Case History & Audit Timeline */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <History className="w-4 h-4 text-aicte-navy-800" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Chronological Audit Timeline
            </h3>
          </div>

          <div className="relative pl-4 space-y-4 before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {history.map((hist, i) => (
              <div key={hist.id || i} className="relative text-xs">
                <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-aicte-navy-700 border-2 border-white ring-2 ring-slate-100" />
                <div className="font-semibold text-slate-800 flex items-center justify-between">
                  <span>{hist.actionType}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {new Date(hist.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {hist.toStatus && (
                  <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                    Status: {hist.toStatus}
                  </span>
                )}
                <p className="text-slate-600 text-[11px] mt-1 leading-normal">{hist.remarks}</p>
                <div className="text-[10px] text-slate-400 mt-0.5">By {hist.performedByName}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* UPDATE STATUS MODAL */}
      {actionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Update Complaint Status</h3>
              <button onClick={() => setActionModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              {actionError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs"
                >
                  <option value="Under Process">Under Process (Inspection / Inquiry Initiated)</option>
                  <option value="Disposed">Disposed (Resolution Completed & Closed)</option>
                  <option value="Escalated">Escalated (Referred to Member Secretary)</option>
                  <option value="Pending">Pending Further Scrutiny</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Action Remarks / Findings <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={actionRemarks}
                  onChange={e => setActionRemarks(e.target.value)}
                  placeholder="Record verification notes, notice dispatched dates, institution reply findings..."
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-4 py-1.5 bg-aicte-navy-900 text-white rounded text-xs font-semibold hover:bg-aicte-navy-800 disabled:opacity-50"
                >
                  {actionSubmitting ? "Saving..." : "Confirm & Commit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER MODAL */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Transfer Case Jurisdiction</h3>
              <button onClick={() => setTransferModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Bureau / Cell
                </label>
                <select
                  value={transferBureau}
                  onChange={e => setTransferBureau(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs"
                >
                  <option value="RB">Regulation Bureau (RB)</option>
                  <option value="PGRC">Public Grievance Redressal Cell (PGRC)</option>
                  <option value="RO">Regional Offices (RO)</option>
                  <option value="AB">Approval Bureau (AB)</option>
                  <option value="PB">Policy & Academic Bureau (PB)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transfer Justification & Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  placeholder="Explain why this complaint requires cross-bureau reassignment..."
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  className="px-4 py-1.5 bg-purple-700 text-white rounded text-xs font-semibold hover:bg-purple-800 disabled:opacity-50"
                >
                  {transferSubmitting ? "Transferring..." : "Confirm Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
