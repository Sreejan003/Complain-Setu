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
  FileCheck,
  Paperclip,
  Upload,
  Trash2,
  ExternalLink,
  Download
} from "lucide-react";
import { api } from "../services/api.js";
import { Complaint, CaseHistory, RelatedCase, OverlapAlert, ComplaintDocument } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

export const ComplaintDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [history, setHistory] = useState<CaseHistory[]>([]);
  const [relatedCases, setRelatedCases] = useState<RelatedCase[]>([]);
  const [overlapAlerts, setOverlapAlerts] = useState<OverlapAlert[]>([]);
  const [documents, setDocuments] = useState<ComplaintDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Document Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState("Investigation Report");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState("");

  // Status Action Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<any>("Under Process");
  const [actionRemarks, setActionRemarks] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  // SLA Override Modal State (Feature 4)
  const [slaModalOpen, setSlaModalOpen] = useState(false);
  const [newSlaDeadline, setNewSlaDeadline] = useState("");
  const [slaOverrideReason, setSlaOverrideReason] = useState("");
  const [slaSubmitting, setSlaSubmitting] = useState(false);
  const [slaError, setSlaError] = useState("");

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

      const docs = await api.getComplaintDocuments(id);
      setDocuments(docs || []);
    } catch (err) {
      console.error("Failed to load complaint details:", err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time live update subscription (Feature 3)
  useEffect(() => {
    const unsub = api.subscribeLiveEvents((event) => {
      if (
        (event.type === "CASE_UPDATED" || event.type === "CASE_TRANSFERRED") &&
        (event.data?.id === id || event.data?.complaintId === complaint?.complaintId)
      ) {
        fetchDetails();
      }
    });
    return unsub;
  }, [id, complaint?.complaintId]);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !uploadFile) return;

    setUploadingDoc(true);
    setDocError("");
    try {
      await api.uploadComplaintDocument(complaint.id, uploadFile, uploadDocType);
      setUploadFile(null);
      const input = document.getElementById("detail-doc-upload") as HTMLInputElement;
      if (input) input.value = "";
      
      // Refresh documents and case history
      const docs = await api.getComplaintDocuments(complaint.id);
      setDocuments(docs || []);
      const updated = await api.getComplaintDetails(complaint.id);
      setHistory(updated.history);
    } catch (err: any) {
      setDocError(err.message || "Failed to upload document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!complaint || !confirm("Are you sure you want to remove this supporting document?")) return;
    try {
      await api.deleteComplaintDocument(complaint.id, docId);
      const docs = await api.getComplaintDocuments(complaint.id);
      setDocuments(docs || []);
      const updated = await api.getComplaintDetails(complaint.id);
      setHistory(updated.history);
    } catch (err: any) {
      alert(err.message || "Failed to delete document.");
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
        disposalRemarks: newStatus === "Disposed" ? actionRemarks : undefined,
        lastKnownUpdatedAt: complaint.updatedAt
      });
      setActionModalOpen(false);
      setActionRemarks("");
      fetchDetails();
    } catch (err: any) {
      if (err.message && err.message.includes("409")) {
        setActionError("Concurrency conflict: This case was modified by another user. Reloading latest records...");
        fetchDetails();
      } else {
        setActionError(err.message || "Failed to update status.");
      }
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleOverrideSla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !newSlaDeadline || !slaOverrideReason.trim()) {
      setSlaError("Both new SLA deadline and an official justification reason are required.");
      return;
    }

    setSlaSubmitting(true);
    setSlaError("");
    try {
      await api.overrideSlaDeadline(complaint.id, {
        newDeadline: newSlaDeadline,
        overrideReason: slaOverrideReason
      });
      setSlaModalOpen(false);
      setSlaOverrideReason("");
      fetchDetails();
    } catch (err: any) {
      setSlaError(err.message || "Failed to override SLA deadline.");
    } finally {
      setSlaSubmitting(false);
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
    <div className="space-y-4">
      {/* Back button */}
      <div>
        <Link to="/cases" className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#003366] hover:underline">
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Return to Complaint Register</span>
        </Link>
      </div>

      {/* Potential Overlapping Cases - Official Coordination Notice */}
      {overlapAlerts.length > 0 && (
        <div className="bg-[#fffbeb] border border-[#f59e0b] rounded-xs p-3.5 text-[#78350f] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="p-1.5 bg-[#fef3c7] border border-[#fde68a] rounded-xs shrink-0 mt-0.5 text-[#b45309]">
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs uppercase tracking-wider text-[#92400e]">Administrative Alert: Cross-Bureau Case Overlap Detected</span>
                <span className="bg-[#b45309] text-white font-bold text-[10px] px-1.5 py-0.2 rounded-xs">
                  {overlapAlerts.length} Alert{overlapAlerts.length > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-[#78350f] mt-0.5 leading-normal">
                Companion complaints have been registered simultaneously across AICTE Bureaus for this institution. Administrative coordination is required prior to formal disposal.
              </p>
            </div>
          </div>
          <Link
            to="/overlaps"
            className="px-3 py-1.5 bg-[#b45309] text-white hover:bg-[#92400e] font-semibold text-xs rounded-xs shrink-0 self-start sm:self-auto flex items-center space-x-1"
          >
            <span>Open Overlap Center &rarr;</span>
          </Link>
        </div>
      )}

      {/* Main Top Case Header */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#003366] bg-[#f1f5f9] px-2 py-0.5 rounded-xs border border-[#cbd5e1]">
                {complaint.complaintId}
              </span>
              <span
                className={`px-2 py-0.5 rounded-xs text-[11px] font-semibold border ${
                  complaint.status === "Pending"
                    ? "bg-[#fef3c7] text-[#92400e] border-[#fde68a]"
                    : complaint.status === "Under Process"
                    ? "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]"
                    : complaint.status === "Disposed"
                    ? "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]"
                    : complaint.status === "Transferred"
                    ? "bg-[#f3e8ff] text-[#7e22ce] border-[#e9d5ff]"
                    : "bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]"
                }`}
              >
                {complaint.status}
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-xs font-semibold border ${
                  complaint.priority === "Critical"
                    ? "bg-[#fee2e2] text-[#991b1b] border-[#f87171]"
                    : complaint.priority === "High"
                    ? "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]"
                    : "bg-[#f8fafc] text-slate-700 border-[#cbd5e1]"
                }`}
              >
                Priority: {complaint.priority}
              </span>
              {complaint.hasOverlapAlert && (
                <Link
                  to="/overlaps"
                  className="inline-flex items-center space-x-1 bg-[#fffbeb] text-[#92400e] border border-[#fcd34d] px-2 py-0.5 rounded-xs text-[11px] font-bold hover:bg-[#fef3c7]"
                >
                  <GitMerge className="w-3.5 h-3.5 text-[#b45309]" />
                  <span>Overlap Flagged</span>
                </Link>
              )}
            </div>
            <h1 className="text-base sm:text-lg font-bold text-[#002147] tracking-tight">{complaint.title}</h1>
            <div className="text-xs text-slate-600">
              Institution:{" "}
              <Link
                to={`/institutions/${complaint.institutionId}`}
                className="font-bold text-[#003366] hover:underline"
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
                  const permitted = complaint.status === "Pending" ? "Under Process" : complaint.status === "Under Process" ? "Disposed" : "Under Process";
                  setNewStatus(permitted);
                  setActionModalOpen(true);
                }}
                className="px-3 py-1.5 bg-[#003366] text-white rounded-xs text-xs font-semibold hover:bg-[#002147] transition cursor-pointer"
              >
                Update Status / Dispose
              </button>
              <button
                onClick={() => setTransferModalOpen(true)}
                className="px-3 py-1.5 border border-[#cbd5e1] bg-white text-slate-700 rounded-xs text-xs font-medium hover:bg-slate-50 flex items-center space-x-1 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
                <span>Transfer Case</span>
              </button>
              {complaint.status !== "Escalated" && (
                <button
                  onClick={() => {
                    setNewStatus("Escalated");
                    setActionModalOpen(true);
                  }}
                  className="px-3 py-1.5 border border-red-300 bg-red-50 text-red-700 rounded-xs text-xs font-medium hover:bg-red-100 flex items-center space-x-1 cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 text-red-600" />
                  <span>Escalate</span>
                </button>
              )}
              {["Administrator", "Senior Management"].includes(user?.role || "") && (
                <button
                  onClick={() => {
                    setNewSlaDeadline(complaint.expectedDisposalDate);
                    setSlaModalOpen(true);
                  }}
                  className="px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-900 rounded-xs text-xs font-semibold hover:bg-amber-100 flex items-center space-x-1 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Adjust SLA Deadline</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Metadata info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px] font-semibold uppercase">Receiving Bureau</span>
            <span className="font-semibold text-slate-800">{complaint.receivingBureauId}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] font-semibold uppercase">Handling Bureau</span>
            <span className="font-semibold text-[#003366]">{complaint.currentBureauId}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] font-semibold uppercase">Assigned Officer</span>
            <span className="font-semibold text-slate-800">
              {complaint.assignedOfficerName || "Unassigned"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] font-semibold uppercase">Expected SLA Disposal</span>
            <span className="font-semibold text-slate-800 font-mono">{complaint.expectedDisposalDate}</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content: Description & Overlaps left, Timeline right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Grievance Statement */}
          <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none overflow-hidden">
            <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#cbd5e1] flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-[#003366]" />
                <span>Full Grievance Statement & Allegation</span>
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-slate-700 leading-relaxed bg-[#f8fafc] p-3.5 rounded-xs border border-[#e2e8f0] whitespace-pre-wrap font-sans">
                {complaint.description}
              </div>
              {complaint.disposalRemarks && (
                <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xs text-xs">
                  <span className="font-bold text-[#166534] block">Official Disposal Resolution Record:</span>
                  <span className="text-[#15803d] mt-1 block">{complaint.disposalRemarks}</span>
                </div>
              )}
            </div>
          </div>

          {/* Supporting Documents & Evidence Card */}
          <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none overflow-hidden">
            <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#cbd5e1] flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider flex items-center space-x-1.5">
                <Paperclip className="w-3.5 h-3.5 text-[#003366]" />
                <span>Supporting Annexures & Documents ({documents.length})</span>
              </h3>
            </div>

            <div className="p-4 space-y-3">
              {/* Document List */}
              {documents.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 text-center bg-[#f8fafc] rounded-xs border border-dashed border-[#cbd5e1]">
                  No supporting documents uploaded yet for this complaint record.
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div
                      key={doc.id}
                      className="p-2.5 bg-[#f8fafc] hover:bg-slate-100 border border-[#e2e8f0] rounded-xs flex items-center justify-between text-xs transition"
                    >
                      <div className="flex items-center space-x-2.5 overflow-hidden">
                        <div className="p-1.5 bg-white rounded-xs border border-[#cbd5e1] shrink-0 text-[#003366]">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-slate-800 truncate flex items-center space-x-2">
                            <span className="truncate">{doc.originalName}</span>
                            <span className="text-[10px] bg-[#e0f2fe] text-[#0369a1] px-1.5 py-0.2 rounded-xs font-semibold shrink-0">
                              {doc.documentType}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {Math.round(doc.fileSize / 1024)} KB &bull; Uploaded by {doc.uploadedByName} on {new Date(doc.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 ml-3">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.downloadComplaintDocument(complaint.id, doc.id, doc.originalName);
                            } catch (err: any) {
                              alert(err.message || "Failed to download document");
                            }
                          }}
                          className="px-2.5 py-1 bg-white border border-[#cbd5e1] text-slate-700 hover:text-[#003366] rounded-xs text-[11px] font-medium flex items-center space-x-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                        {canModify && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-xs"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload New Document Form */}
              {canModify && (
                <form onSubmit={handleUploadDocument} className="pt-3 border-t border-[#e2e8f0] space-y-2.5">
                  <span className="text-xs font-semibold text-slate-700 block">Attach Official Annexure / Evidence</span>
                  {docError && (
                    <div className="text-[11px] text-red-700 bg-red-50 p-2 rounded-xs border border-red-200">
                      {docError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={uploadDocType}
                      onChange={e => setUploadDocType(e.target.value)}
                      className="text-xs bg-white border border-[#cbd5e1] rounded-xs px-2.5 py-1.5 focus:border-[#003366] focus:outline-none"
                    >
                      <option value="Investigation Report">Investigation Report</option>
                      <option value="Institution Reply">Institution Reply / Defense</option>
                      <option value="Hearing Notice">Hearing Notice / Summon</option>
                      <option value="Complaint Evidence">Complaint Evidence</option>
                      <option value="Other">Other Supporting File</option>
                    </select>
                    <input
                      type="file"
                      id="detail-doc-upload"
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          setUploadFile(e.target.files[0]);
                        }
                      }}
                      className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-xs file:border-0 file:text-xs file:font-semibold file:bg-slate-200 hover:file:bg-slate-300 cursor-pointer"
                    />
                    <button
                      type="submit"
                      disabled={!uploadFile || uploadingDoc}
                      className="px-3 py-1.5 bg-[#003366] text-white rounded-xs text-xs font-semibold hover:bg-[#002147] disabled:opacity-40 flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingDoc ? "Uploading..." : "Upload Annexure"}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Cross-Bureau Overlap Alerts for this case */}
          {overlapAlerts.length > 0 && (
            <div className="bg-white border border-[#f59e0b] rounded-xs shadow-none overflow-hidden">
              <div className="bg-[#fffbeb] px-4 py-2.5 border-b border-[#fde68a] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <GitMerge className="w-4 h-4 text-[#b45309]" />
                  <h3 className="text-xs font-bold text-[#92400e] uppercase tracking-wider">
                    Cross-Bureau Overlap Alerts ({overlapAlerts.length})
                  </h3>
                </div>
                <Link to="/overlaps" className="text-xs text-[#003366] font-semibold hover:underline">
                  Compare in Overlap Center &rarr;
                </Link>
              </div>

              <div className="p-4 space-y-2.5">
                {overlapAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className="p-3 bg-[#fffbeb]/50 border border-[#fde68a] rounded-xs space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#92400e]">{alert.alertId}</span>
                      <span className="bg-[#fef3c7] text-[#92400e] border border-[#fde68a] px-1.5 py-0.2 rounded-xs font-bold text-[10px]">
                        Match Confidence: {alert.ruleMatchScore}%
                      </span>
                    </div>

                    <div className="font-semibold text-slate-800">
                      Companion Case:{" "}
                      <span className="text-[#003366] font-mono">
                        {alert.complaintIdA === complaint.id ? alert.complaintRefB : alert.complaintRefA}
                      </span>{" "}
                      under {alert.complaintIdA === complaint.id ? alert.bureauB : alert.bureauA}
                    </div>

                    <div className="text-slate-600 text-[11px]">
                      <strong>Rule Trigger:</strong> {alert.matchReasons.join("; ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked Related Cases */}
          {relatedCases.length > 0 && (
            <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none overflow-hidden">
              <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#cbd5e1]">
                <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider">
                  Confirmed Related Cases
                </h3>
              </div>
              <div className="divide-y divide-[#e2e8f0] p-4">
                {relatedCases.map(rel => (
                  <div key={rel.id} className="py-2.5 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                    <div>
                      <span className="font-mono font-semibold text-[#003366]">
                        {rel.complaintIdA === complaint.id ? rel.complaintRefB : rel.complaintRefA}
                      </span>
                      <span className="ml-2 text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-xs font-medium border border-slate-200">
                        {rel.relationshipType}
                      </span>
                      <div className="text-[11px] text-slate-600 mt-0.5">{rel.notes}</div>
                    </div>
                    <span className="text-[10px] text-slate-500">Linked by {rel.linkedByName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Case History & Audit Timeline */}
        <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none overflow-hidden h-fit">
          <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#cbd5e1] flex items-center space-x-2">
            <History className="w-3.5 h-3.5 text-[#003366]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366]">
              Chronological Audit Trail
            </h3>
          </div>

          <div className="p-4">
            <div className="relative pl-4 space-y-4 before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#cbd5e1]">
              {history.map((hist, i) => (
                <div key={hist.id || i} className="relative text-xs">
                  <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-[#003366] border-2 border-white ring-1 ring-[#cbd5e1]" />
                  <div className="font-semibold text-slate-800 flex items-center justify-between">
                    <span>{hist.actionType}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(hist.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {hist.toStatus && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded-xs text-[10px] bg-[#f1f5f9] text-[#003366] font-medium border border-[#cbd5e1]">
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
      </div>

      {/* UPDATE STATUS MODAL */}
      {actionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-lg max-w-md w-full border border-[#cbd5e1] overflow-hidden">
            <div className="bg-[#f8fafc] px-4 py-3 border-b border-[#cbd5e1] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#002147]">Update Complaint Status</h3>
              <button onClick={() => setActionModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="p-4 space-y-3.5">
              {actionError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xs border border-red-200">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Status (Permitted Transitions from {complaint.status})
                </label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                >
                  {complaint.status === "Pending" && (
                    <>
                      <option value="Under Process">Under Process (Inspection / Inquiry Initiated)</option>
                      <option value="Transferred">Transferred (Jurisdiction Transfer)</option>
                      <option value="Disposed">Disposed (Resolution Completed & Closed)</option>
                    </>
                  )}
                  {complaint.status === "Under Process" && (
                    <>
                      <option value="Disposed">Disposed (Resolution Completed & Closed)</option>
                      <option value="Escalated">Escalated (Referred to Member Secretary)</option>
                      <option value="Transferred">Transferred (Jurisdiction Transfer)</option>
                      <option value="Pending">Pending (Reverted for Scrutiny)</option>
                    </>
                  )}
                  {complaint.status === "Transferred" && (
                    <>
                      <option value="Under Process">Under Process (Inquiry Underway)</option>
                      <option value="Disposed">Disposed (Resolution Completed & Closed)</option>
                    </>
                  )}
                  {complaint.status === "Escalated" && (
                    <>
                      <option value="Under Process">Under Process (Post-Escalation Scrutiny)</option>
                      <option value="Disposed">Disposed (Closed by Executive Authority)</option>
                    </>
                  )}
                  {complaint.status === "Disposed" && (
                    <option value="Under Process">Under Process (Administrator Reopen Case)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Action Remarks / Findings <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={actionRemarks}
                  onChange={e => setActionRemarks(e.target.value)}
                  placeholder="Record verification notes, notice dispatched dates, institution reply findings..."
                  className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setActionModalOpen(false)}
                  className="px-3 py-1.5 border border-[#cbd5e1] rounded-xs text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-3.5 py-1.5 bg-[#003366] text-white rounded-xs text-xs font-semibold hover:bg-[#002147] disabled:opacity-50 cursor-pointer"
                >
                  {actionSubmitting ? "Saving..." : "Confirm & Commit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SLA OVERRIDE MODAL (Feature 4) */}
      {slaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-lg max-w-md w-full border border-[#cbd5e1] overflow-hidden">
            <div className="bg-[#f8fafc] px-4 py-3 border-b border-[#cbd5e1] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#002147]">Authorized SLA Target Override</h3>
                <p className="text-[11px] text-slate-500">Record an official SLA deadline extension with full audit trail.</p>
              </div>
              <button onClick={() => setSlaModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleOverrideSla} className="p-4 space-y-3.5">
              {slaError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xs border border-red-200">
                  {slaError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Target Deadline
                </label>
                <input
                  type="text"
                  readOnly
                  value={complaint.expectedDisposalDate}
                  className="w-full bg-[#f1f5f9] border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs font-mono text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Adjusted Disposal Deadline <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={newSlaDeadline}
                  onChange={e => setNewSlaDeadline(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrative Override Reason & Justification <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={slaOverrideReason}
                  onChange={e => setSlaOverrideReason(e.target.value)}
                  placeholder="Mandatory administrative justification (e.g., Court stay order, expert fact-finding committee report extension)..."
                  className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setSlaModalOpen(false)}
                  className="px-3 py-1.5 border border-[#cbd5e1] rounded-xs text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={slaSubmitting}
                  className="px-3.5 py-1.5 bg-[#b45309] text-white rounded-xs text-xs font-semibold hover:bg-[#92400e] disabled:opacity-50 cursor-pointer"
                >
                  {slaSubmitting ? "Committing..." : "Apply SLA Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER MODAL */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-lg max-w-md w-full border border-[#cbd5e1] overflow-hidden">
            <div className="bg-[#f8fafc] px-4 py-3 border-b border-[#cbd5e1] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#002147]">Transfer Case Jurisdiction</h3>
              <button onClick={() => setTransferModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Bureau / Cell
                </label>
                <select
                  value={transferBureau}
                  onChange={e => setTransferBureau(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
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
                  Transfer Justification & Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  placeholder="Explain why this complaint requires cross-bureau reassignment..."
                  className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-3 py-1.5 border border-[#cbd5e1] rounded-xs text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  className="px-3.5 py-1.5 bg-[#003366] text-white rounded-xs text-xs font-semibold hover:bg-[#002147] disabled:opacity-50 cursor-pointer"
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
