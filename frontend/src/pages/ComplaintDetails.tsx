import { ModalFrame, EmptyState, ErrorState, LoadingSkeleton } from "../components/ui/Interface.js";
import { tr, localizeLabel, localizeError, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
import { WorkflowRequests } from "../components/common/WorkflowRequests.js";
import {CoordinationCaseLink} from "../components/common/CrossBureauCoordinationWorkspace.js";
import { CaseMetadata } from "../components/common/CaseMetadata.js";
import { CaseSecurityPanel } from "../components/common/CaseSecurityPanel.js";
import { ComplaintLanguagePanel } from "../components/common/ComplaintLanguagePanel.js";
import { CaseOverlapPanel } from "../components/common/CaseOverlapPanel.js";
import { CaseFamilyLink } from "../components/common/CaseFamilyPanel.js";
import{CaseSlaPanel}from"../components/common/CaseSlaPanel.js";
import{slaDaysRemaining}from"../services/sla.js";
import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
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
  useLocaleRender();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [detailTab, setDetailTab] = useState(() => ["#requests", "#coordination"].includes(window.location.hash) ? "coordination" : "overview");
  useEffect(() => { if (["#requests", "#coordination"].includes(location.hash)) setDetailTab("coordination"); }, [location.hash]);
  const { user } = useAuth();

  const [allowedActions,setAllowedActions]=useState<any>({});
  const [officerSearch,setOfficerSearch]=useState("");
  const [permittedStatuses,setPermittedStatuses]=useState<string[]>([]);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [history, setHistory] = useState<CaseHistory[]>([]);
  const [relatedCases, setRelatedCases] = useState<RelatedCase[]>([]);
  const [overlapAlerts, setOverlapAlerts] = useState<OverlapAlert[]>([]);
  const [documents, setDocuments] = useState<ComplaintDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Document Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState("Investigation Report");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState("");

  // Status Action Modal State
  const [requestType,setRequestType]=useState("Coordination");
  const [requestRemarks,setRequestRemarks]=useState("");
  const [requestBusy,setRequestBusy]=useState(false);
  const [requestMessage,setRequestMessage]=useState("");
  const [nextAction,setNextAction]=useState("");
  const [nextActionDate,setNextActionDate]=useState("");
  const [assignee,setAssignee]=useState("");
  const [officers,setOfficers]=useState<any[]>([]);
  useEffect(()=>{if(!allowedActions.assign || !id)return;const timer=setTimeout(()=>api.request(`complaints/${id}/eligible-officers?search=${encodeURIComponent(officerSearch)}`).then(setOfficers).catch(()=>setOfficers([])),200);return()=>clearTimeout(timer);},[allowedActions.assign,id,officerSearch]);
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

  // Incoming Pending Transfer State & Adjudication
  const [pendingTransfer, setPendingTransfer] = useState<any>(null);
  const [adjudicateModalOpen, setAdjudicateModalOpen] = useState(false);
  const [adjudicateAction, setAdjudicateAction] = useState<"Accepted" | "Rejected">("Accepted");
  const [adjudicateRemarks, setAdjudicateRemarks] = useState("");
  const [adjudicateSubmitting, setAdjudicateSubmitting] = useState(false);

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.getComplaintDetails(id);
      setComplaint(res.complaint);
      setLoadError("");
      setAllowedActions(res.allowedActions || {});
      if(window.location.hash==="#assignment" && res.allowedActions?.assign) setActionModalOpen(true);
      setPermittedStatuses(res.permittedStatuses || []);
      setNewStatus(res.complaint.status);
      setNextAction(res.complaint.nextAction || "");
      setNextActionDate(res.complaint.nextActionDate || "");
      setHistory(res.history);
      setRelatedCases(res.relatedCases);
      setOverlapAlerts(res.overlapAlerts);

      const docs = await api.getComplaintDocuments(res.complaint.id);
      setDocuments(docs || []);

      // Check active transfers for this complaint
      try {
        const trfs = await api.getTransfers();
        const active = (trfs || []).find(
          (t: any) =>
            (t.complaintId === id || t.complaintRefId === res.complaint?.complaintId) &&
            t.acceptanceStatus === "Pending"
        );
        setPendingTransfer(active || null);
      } catch {
        // non-blocking
      }
    } catch (err) {
      setLoadError(localizeError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTransferAdjudicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTransfer || !adjudicateRemarks.trim()) return;
    setAdjudicateSubmitting(true);
    try {
      await api.respondToTransfer(pendingTransfer.id, {
        action: adjudicateAction,
        remarks: adjudicateRemarks.trim()
      });
      setAdjudicateModalOpen(false);
      fetchDetails();
    } catch (err: any) {
      alert(localizeError(err.message || tr("complaints:failedToProcessTransferAdjudication")));
    } finally {
      setAdjudicateSubmitting(false);
    }
  };

  // Real-time live update subscription (Feature 3)
  useEffect(() => {
    const unsub = api.subscribeLiveEvents((event) => {
      if (
        (event.type === "CASE_UPDATED" ||
          event.type === "CASE_TRANSFERRED" ||
          event.type === "TRANSFER_ACCEPTED" ||
          event.type === "TRANSFER_REJECTED") &&
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
    if (!complaint || !confirm(tr("complaints:areYouSureYouWantToRemoveThisSupporting"))) return;
    try {
      await api.deleteComplaintDocument(complaint.id, docId);
      const docs = await api.getComplaintDocuments(complaint.id);
      setDocuments(docs || []);
      const updated = await api.getComplaintDetails(complaint.id);
      setHistory(updated.history);
    } catch (err: any) {
      alert(localizeError(err.message || tr("complaints:failedToDeleteDocument")));
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
        nextAction, nextActionDate, ...(assignee?{assignedOfficerId:assignee}:{}),
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
      alert(localizeError(err.message || tr("complaints:transferFailed")));
    } finally {
      setTransferSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton label={tr("complaints:loadingComplaintDetails")}/>;
  }

  if (!complaint) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        {loadError ? <ErrorState message={loadError} onRetry={fetchDetails}/> : <h2 className="text-base font-bold text-slate-800">{tr("complaints:caseRecordNotFound")}</h2>}
        <Link to="/cases" className="mt-3 inline-block text-xs text-blue-600 hover:underline">{tr("complaints:returnToCaseRegister")}</Link>
      </div>
    );
  }

  const userCanMutate = !!allowedActions.update || !!allowedActions.reopen;
  const canModify = userCanMutate;
  const isBureauAuthorized = () => userCanMutate;
  const canAdjudicatePendingTransfer = () => !!pendingTransfer?.canDecide;

  const lastAction = history && history.length > 0 ? history[0] : null;

  const getNextAction = () => complaint.nextAction || "No next action recorded";

  const daysDiff=slaDaysRemaining(complaint.expectedDisposalDate,complaint.sla?.policy.timezone);
  const isOverdue = daysDiff<0 && complaint.status !== "Disposed";

  const slaStatusText =
    complaint.status === "Disposed"
      ? "Disposed (Closed)"
      : isOverdue
      ? `Overdue (${Math.abs(daysDiff)} days elapsed)`
      : daysDiff <= (allowedActions.approachingDeadlineDays || 3)
      ? `Approaching SLA (${daysDiff} days left)`
      : `Within SLA Standard (${daysDiff} days left)`;

  return (
    <div className="space-y-4">

      {loadError && <ErrorState message={loadError} onRetry={fetchDetails}/>}
      {/* Back button */}
      <div>
        <Link to="/cases" className="inline-flex items-center space-x-1.5 text-xs font-semibold text-aicte-navy-700 hover:underline">
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>{tr("complaints:returnToComplaintRegister")}</span>
        </Link>
      </div>

      {!!allowedActions.request&&<CoordinationCaseLink complaintId={complaint.id}/>}
      {/* Potential Overlapping Cases - Official Coordination Notice */}
      {overlapAlerts.length > 0 && (
        <div className="bg-[#fffbeb] border border-[#f59e0b] rounded-lg p-3.5 text-[#78350f] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="p-1.5 bg-[#fef3c7] border border-[#fde68a] rounded-lg shrink-0 mt-0.5 text-[#b45309]">
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs uppercase tracking-wider text-[#92400e]">{tr("complaints:administrativeAlertCrossBureauCaseOverlapDetected")}</span>
                <span className="bg-[#b45309] text-white font-bold text-xs px-1.5 py-0.2 rounded-lg">
                  {overlapAlerts.length}{tr("complaints:alert_0eb8b")}{overlapAlerts.length > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-[#78350f] mt-0.5 leading-normal">{tr("complaints:companionComplaintsHaveBeenRegisteredSimultaneouslyAcrossAicteBureaus")}</p>
            </div>
          </div>
          <Link
            to="/overlaps"
            className="px-3 py-1.5 bg-[#b45309] text-white hover:bg-[#92400e] font-semibold text-xs rounded-lg shrink-0 self-start sm:self-auto flex items-center space-x-1"
          >
            <span>{tr("complaints:openOverlapCenter")}</span>
          </Link>
        </div>
      )}

      {/* Incoming Transfer Notice & Adjudication */}
      {pendingTransfer && (
        <div className="bg-[#eff6ff] border border-[#93c5fd] rounded-lg p-3.5 text-[#1e40af] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="p-1.5 bg-[#dbeafe] border border-[#bfdbfe] rounded-lg shrink-0 mt-0.5 text-[#1d4ed8]">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs uppercase tracking-wider text-[#1e3a8a]">{tr("complaints:incomingCaseTransferPendingAcceptance")}</span>
                <span className="bg-[#2563eb] text-white font-bold text-xs px-1.5 py-0.2 rounded-lg">{tr("complaints:route")}<bdi dir="ltr" className="canonical-value">{pendingTransfer.fromBureauId}</bdi> &rarr; <bdi dir="ltr" className="canonical-value">{pendingTransfer.toBureauId}</bdi>
                </span>
              </div>
              <p className="text-xs text-[#1e40af] mt-0.5 leading-normal">
                <strong>{tr("complaints:grounds")}</strong> <bdi dir="auto" className="original-content">{pendingTransfer.transferReason}</bdi>{tr("complaints:initiatedBy")}{pendingTransfer.transferredByName} on {formatDate(pendingTransfer.transferredAt, true)}
              </p>
            </div>
          </div>
          {canAdjudicatePendingTransfer() && (
            <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setAdjudicateAction("Accepted");
                  setAdjudicateRemarks(`Jurisdiction transfer accepted by ${pendingTransfer.toBureauId}. Case taken under active investigation.`);
                  setAdjudicateModalOpen(true);
                }}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >{tr("complaints:acceptTransfer")}</button>
              <button
                type="button"
                onClick={() => {
                  setAdjudicateAction("Rejected");
                  setAdjudicateRemarks(`Transfer declined by ${pendingTransfer.toBureauId}. Case retained under originating bureau jurisdiction.`);
                  setAdjudicateModalOpen(true);
                }}
                className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >{tr("complaints:declineTransfer")}</button>
            </div>
          )}
        </div>
      )}

      {/* Jurisdictional Read-Only Scope Notice */}
      {canModify && !userCanMutate && (
        <div className="bg-[#f8fafc] border border-[#e5eaf0] rounded-lg p-3 text-xs text-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-aicte-navy-700 shrink-0" />
            <span>
              <strong>{tr("complaints:crossBureauJurisdictionalScope")}</strong>{tr("complaints:thisCaseIsCurrentlyUnderActiveHandlingBy")}<strong><bdi dir="ltr" className="canonical-value">{complaint.currentBureauId}</bdi></strong>. As a <strong>{localizeLabel(user?.role)}</strong>{tr("complaints:youHaveFullCrossBureauReviewVisibilityToUpdate")}</span>
          </div>
        </div>
      )}

      {/* Main Top Case Header */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg p-4 shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-aicte-navy-700 bg-[#f1f5f9] px-2 py-0.5 rounded-lg border border-[#e5eaf0]">
                <bdi dir="ltr" className="canonical-value">{complaint.complaintId}</bdi>
              </span>
              <span
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${
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
                {localizeLabel(complaint.status)}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-lg font-semibold border ${
                  complaint.priority === "Critical"
                    ? "bg-[#fee2e2] text-[#991b1b] border-[#f87171]"
                    : complaint.priority === "High"
                    ? "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]"
                    : "bg-[#f8fafc] text-slate-700 border-[#e5eaf0]"
                }`}
              >{tr("complaints:priority_7e91b")}{localizeLabel(complaint.priority)}
              </span>
              <span className="bg-[#f1f5f9] text-aicte-navy-700 border border-[#e5eaf0] px-2 py-0.5 rounded-lg text-xs font-semibold">{tr("complaints:category_56899")}{complaint.category}
              </span>
              {complaint.hasOverlapAlert && (
                <Link
                  to="/overlaps"
                  className="inline-flex items-center space-x-1 bg-[#fffbeb] text-[#92400e] border border-[#fcd34d] px-2 py-0.5 rounded-lg text-xs font-bold hover:bg-[#fef3c7]"
                >
                  <GitMerge className="w-3.5 h-3.5 text-[#b45309]" />
                  <span>{tr("complaints:overlapFlagged")}</span>
                </Link>
              )}
            </div>
            <h1 className="text-base sm:text-lg font-bold text-aicte-navy-900 tracking-tight"><bdi dir="auto" className="original-content">{complaint.title}</bdi></h1>
            <div className="text-xs text-slate-600">{tr("complaints:institution")}{" "}
              <Link
                to={`/institutions/${complaint.institutionId}`}
                className="font-bold text-aicte-navy-700 hover:underline"
              >
                <bdi dir="auto" className="original-content">{complaint.institutionName}</bdi> ({complaint.aictePermanentId})
              </Link>
            </div>
          </div>

          {/* Action buttons */}
          {canModify && (
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              {userCanMutate && (
                <button
                  onClick={() => {
                    const permitted = complaint.status;
                    setNewStatus(permitted);
                    setActionModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-aicte-navy-700 text-white rounded-lg text-xs font-semibold hover:bg-aicte-navy-900 transition cursor-pointer"
                >{tr("complaints:updateCaseProgress")}</button>
              )}
              {allowedActions.transfer && <button
                onClick={() => setTransferModalOpen(true)}
                className="px-3 py-1.5 border border-[#e5eaf0] bg-white text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 flex items-center space-x-1 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
                <span>{tr("complaints:transferCase")}</span>
              </button>}
              {permittedStatuses.includes("Escalated") && (
                <button
                  onClick={() => {
                    setNewStatus("Escalated");
                    setActionModalOpen(true);
                  }}
                  className="px-3 py-1.5 border border-red-300 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 flex items-center space-x-1 cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 text-red-600" />
                  <span>{tr("complaints:escalate")}</span>
                </button>
              )}
              {allowedActions.overrideSla && (
                <button
                  onClick={() => {
                    setNewSlaDeadline(complaint.expectedDisposalDate);
                    setSlaModalOpen(true);
                  }}
                  className="px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg text-xs font-semibold hover:bg-amber-100 flex items-center space-x-1 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>{tr("complaints:adjustSlaDeadline")}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Complete AICTE PS 13-Field Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 pt-3.5 text-xs">
          <div>
            <span className="text-slate-500 block text-xs font-bold uppercase tracking-wider">{tr("complaints:receivingBureau")}</span>
            <span className="font-semibold text-slate-800">{complaint.receivingBureauId}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs font-bold uppercase tracking-wider">{tr("complaints:handlingBureau")}</span>
            <span className="font-semibold text-aicte-navy-700"><bdi dir="ltr" className="canonical-value">{complaint.currentBureauId}</bdi></span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs font-bold uppercase tracking-wider">{tr("dashboard:assignedOfficer")}</span>
            <span className="font-semibold text-slate-800">
              {complaint.assignedOfficerName || tr("dashboard:unassigned")}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs font-bold uppercase tracking-wider">{tr("complaints:dateReceived")}</span>
            <span className="font-semibold text-slate-800 font-mono">
              {formatDate(complaint.receivedDate, false)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs font-bold uppercase tracking-wider">{tr("complaints:expectedDisposal")}</span>
            <span className="font-semibold text-slate-800 font-mono">{formatDate(complaint.expectedDisposalDate)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs font-bold uppercase tracking-wider">{tr("complaints:slaStatus")}</span>
            <span
              className={`font-semibold font-mono text-xs ${
                isOverdue ? "text-red-700 font-bold" : "text-emerald-700 font-bold"
              }`}
            >
              {localizeLabel(slaStatusText)}
            </span>
          </div>
        </div>

        {/* Next Action & Last Action Status Strip */}
        <div className="mt-3 pt-3 border-t border-[#e2e8f0] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-[#f8fafc] p-2.5 rounded-lg border">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">{tr("complaints:lastAction")}</span>
            <span className="text-slate-800 font-medium truncate">
              {lastAction ? tr("complaints:by", {value1: lastAction.actionType, value2: lastAction.performedByName, value3: new Date(lastAction.createdAt).toLocaleDateString()}) : tr("complaints:registrationRecorded")}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700 shrink-0">{tr("complaints:nextActionRequired")}</span>
            <span className="text-aicte-navy-900 font-semibold truncate">
              {getNextAction()}{tr("complaints:nextActionDate")}{formatDate(complaint.nextActionDate) || tr("dashboard:notSet")}
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content: Description & Overlaps left, Timeline right */}
      <nav className="tab-bar" aria-label={tr("navigation:ui.pageContext")}>{["overview", "timeline", "documents", "coordination", "related"].map(tab => <button className="tab-button" type="button" aria-pressed={detailTab === tab} onClick={() => setDetailTab(tab)} key={tab}>{tr("navigation:ui.caseTabs." + tab)}{tab === "documents" ? ` (${formatNumber(documents.length)})` : tab === "related" ? ` (${formatNumber(relatedCases.length + overlapAlerts.length)})` : ""}</button>)}</nav>
      <div className="space-y-5">
        <div className="space-y-5" hidden={["timeline", "coordination"].includes(detailTab)}>
          {detailTab === "overview" && <CaseMetadata complaint={complaint}/>}
          {detailTab === "overview" && <CaseSecurityPanel caseId={complaint.id} onChanged={() => window.location.reload()}/>}
          {detailTab === "overview" && <ComplaintLanguagePanel caseId={complaint.id}/>}
          {detailTab === "overview" && user?.role !== "Institutional User" && <CaseOverlapPanel caseId={complaint.id}/>}
          {detailTab === "overview" && user?.role !== "Institutional User" && <CaseFamilyLink caseId={complaint.id}/>}
          {detailTab === "overview" && user?.role !== "Institutional User" && <CaseSlaPanel caseId={complaint.id}/>}
          {/* Grievance Statement */}
          <div hidden={detailTab !== "overview"} className="bg-white border border-[#e5eaf0] rounded-lg shadow-none overflow-hidden">
            <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#e5eaf0] flex items-center justify-between">
              <h2 className="text-xs font-bold text-aicte-navy-700 uppercase tracking-wider flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-aicte-navy-700" />
                <span>{tr("complaints:fullGrievanceStatementAllegation")}</span>
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-slate-700 leading-relaxed bg-[#f8fafc] p-3.5 rounded-lg border border-[#e2e8f0] whitespace-pre-wrap font-sans">
                <bdi dir="auto" className="original-content">{complaint.description}</bdi>
              </div>
              {complaint.disposalRemarks && (
                <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg text-xs">
                  <span className="font-bold text-[#166534] block">{tr("complaints:officialDisposalResolutionRecord")}</span>
                  <span className="text-[#15803d] mt-1 block">{complaint.disposalRemarks}</span>
                </div>
              )}
            </div>
          </div>

          {/* Supporting Documents & Evidence Card */}
          <div hidden={detailTab !== "documents"} className="bg-white border border-[#e5eaf0] rounded-lg shadow-none overflow-hidden">
            <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#e5eaf0] flex items-center justify-between">
              <h2 className="text-xs font-bold text-aicte-navy-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Paperclip className="w-3.5 h-3.5 text-aicte-navy-700" />
                <span>{tr("complaints:supportingAnnexuresDocuments")}{documents.length})</span>
              </h2>
            </div>

            <div className="p-4 space-y-3">
              {/* Document List */}
              {documents.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 text-center bg-[#f8fafc] rounded-lg border border-dashed border-[#e5eaf0]">{tr("complaints:noSupportingDocumentsUploadedYetForThisComplaintRecord")}</div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div
                      key={doc.id}
                      className="p-2.5 bg-[#f8fafc] hover:bg-slate-100 border border-[#e2e8f0] rounded-lg flex items-center justify-between text-xs transition"
                    >
                      <div className="flex items-center space-x-2.5 overflow-hidden">
                        <div className="p-1.5 bg-white rounded-lg border border-[#e5eaf0] shrink-0 text-aicte-navy-700">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-slate-800 truncate flex items-center space-x-2">
                            <span className="truncate">{doc.originalName}</span>
                            <span className="text-xs bg-[#e0f2fe] text-[#0369a1] px-1.5 py-0.2 rounded-lg font-semibold shrink-0">
                              {localizeLabel(doc.documentType)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {Math.round(doc.fileSize / 1024)}{tr("complaints:kbUploadedBy")}{doc.uploadedByName} on {formatDate(doc.uploadedAt, false)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 ms-3">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.downloadComplaintDocument(complaint.id, doc.id, doc.originalName);
                            } catch (err: any) {
                              alert(localizeError(err.message || tr("complaints:failedToDownloadDocument")));
                            }
                          }}
                          className="px-2.5 py-1 bg-white border border-[#e5eaf0] text-slate-700 hover:text-aicte-navy-700 rounded-lg text-xs font-medium flex items-center space-x-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{tr("complaints:download")}</span>
                        </button>
                        {allowedActions.update && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1 text-slate-500 hover:text-red-600 rounded-lg"
                            title={tr("complaints:removeFile")}
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
              {allowedActions.upload && (
                <form onSubmit={handleUploadDocument} className="pt-3 border-t border-[#e2e8f0] space-y-2.5">
                  <span className="text-xs font-semibold text-slate-700 block">{tr("complaints:attachOfficialAnnexureEvidence")}</span>
                  {docError && (
                    <div className="text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">
                      {localizeError(docError)}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      aria-label={tr("complaints:documentType")} value={uploadDocType}
                      onChange={e => setUploadDocType(e.target.value)}
                      className="text-xs bg-white border border-[#e5eaf0] rounded-lg px-2.5 py-1.5 focus:border-[#003366] focus:outline-none"
                    >
                      <option value="Investigation Report">{tr("complaints:investigationReport")}</option>
                      <option value="Institution Reply">{tr("complaints:institutionReplyDefense")}</option>
                      <option value="Hearing Notice">{tr("complaints:hearingNoticeSummon")}</option>
                      <option value="Complaint Evidence">{tr("complaints:complaintEvidence")}</option>
                      <option value="Other">{tr("complaints:otherSupportingFile")}</option>
                    </select>
                    <input
                      type="file"
                      id="detail-doc-upload" aria-label={tr("complaints:attachOfficialAnnexureEvidence")}
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          setUploadFile(e.target.files[0]);
                        }
                      }}
                      className="text-xs text-slate-500 file:me-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 hover:file:bg-slate-300 cursor-pointer"
                    />
                    <button
                      type="submit"
                      disabled={!uploadFile || uploadingDoc}
                      className="px-3 py-1.5 bg-aicte-navy-700 text-white rounded-lg text-xs font-semibold hover:bg-aicte-navy-900 disabled:opacity-40 flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingDoc ? tr("complaints:uploading") : tr("complaints:uploadAnnexure")}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Cross-Bureau Overlap Alerts for this case */}
          {overlapAlerts.length > 0 && (
            <div hidden={detailTab !== "related"} className="bg-white border border-[#f59e0b] rounded-lg shadow-none overflow-hidden">
              <div className="bg-[#fffbeb] px-4 py-2.5 border-b border-[#fde68a] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <GitMerge className="w-4 h-4 text-[#b45309]" />
                  <h2 className="text-xs font-bold text-[#92400e] uppercase tracking-wider">{tr("complaints:crossBureauOverlapAlerts")}{overlapAlerts.length})
                  </h2>
                </div>
                <Link to="/overlaps" className="text-xs text-aicte-navy-700 font-semibold hover:underline">{tr("complaints:compareInOverlapCenter")}</Link>
              </div>

              <div className="p-4 space-y-2.5">
                {overlapAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className="p-3 bg-[#fffbeb]/50 border border-[#fde68a] rounded-lg space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#92400e]">{alert.alertId}</span>
                      <span className="bg-[#fef3c7] text-[#92400e] border border-[#fde68a] px-1.5 py-0.2 rounded-lg font-bold text-xs">{tr("complaints:matchConfidence")}{alert.ruleMatchScore}%
                      </span>
                    </div>

                    <div className="font-semibold text-slate-800">{tr("complaints:companionCase")}{" "}
                      <span className="text-aicte-navy-700 font-mono">
                        {alert.complaintIdA === complaint.id ? alert.complaintRefB : alert.complaintRefA}
                      </span>{" "}{tr("complaints:under")}{alert.complaintIdA === complaint.id ? alert.bureauB : alert.bureauA}
                    </div>

                    <div className="text-slate-600 text-xs">
                      <strong>{tr("complaints:ruleTrigger")}</strong> {alert.matchReasons.join("; ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked Related Cases */}
          {relatedCases.length > 0 && (
            <div hidden={detailTab !== "related"} className="bg-white border border-[#e5eaf0] rounded-lg shadow-none overflow-hidden">
              <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#e5eaf0]">
                <h2 className="text-xs font-bold text-aicte-navy-700 uppercase tracking-wider">{tr("complaints:confirmedRelatedCases")}</h2>
              </div>
              <div className="divide-y divide-[#e2e8f0] p-4">
                {relatedCases.map(rel => (
                  <div key={rel.id} className="py-2.5 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                    <div>
                      <span className="font-mono font-semibold text-aicte-navy-700">
                        {rel.complaintIdA === complaint.id ? rel.complaintRefB : rel.complaintRefA}
                      </span>
                      <span className="ms-2 text-xs bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-lg font-medium border border-slate-200">
                        {rel.relationshipType}
                      </span>
                      <div className="text-xs text-slate-600 mt-0.5">{rel.notes}</div>
                    </div>
                    <span className="text-xs text-slate-500">{tr("complaints:linkedBy")}{rel.linkedByName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Case History & Audit Timeline */}
        <div hidden={detailTab !== "timeline"} className="bg-white border border-[#e5eaf0] rounded-lg shadow-none overflow-hidden h-fit">
          <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#e5eaf0] flex items-center space-x-2">
            <History className="w-3.5 h-3.5 text-aicte-navy-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700">{tr("complaints:chronologicalAuditTrail")}</h2>
          </div>

          <div className="p-4">
            <div className="relative ps-4 space-y-4 before:content-[''] before:absolute before:start-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#cbd5e1]">
              {history.map((hist, i) => (
                <div key={hist.id || i} className="relative text-xs">
                  <div className="absolute -start-4 top-1 w-2.5 h-2.5 rounded-full bg-aicte-navy-700 border-2 border-white ring-1 ring-[#cbd5e1]" />
                  <div className="font-semibold text-slate-800 flex items-center justify-between">
                    <span>{hist.actionType}</span>
                    <span className="text-xs text-slate-500 font-mono">
                      {formatDate(hist.createdAt, false)}
                    </span>
                  </div>
                  {hist.toStatus && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded-lg text-xs bg-[#f1f5f9] text-aicte-navy-700 font-medium border border-[#e5eaf0]">{tr("complaints:statusLabel")}{localizeLabel(hist.toStatus)}
                    </span>
                  )}
                  <p className="text-slate-600 text-xs mt-1 leading-normal"><bdi dir="auto" className="original-content">{hist.remarks}</bdi></p>
                  <div className="text-xs text-slate-500 mt-0.5">By {hist.performedByName}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {detailTab === "related" && !overlapAlerts.length && !relatedCases.length && <div className="surface"><EmptyState title={tr("complaints:noRecordsMatchTheSpecifiedSearchAndFilterParameters")}/></div>}
      {/* UPDATE STATUS MODAL */}
      <div hidden={detailTab !== "coordination"} className="space-y-4">
      {!!allowedActions.request&&<section className="border border-slate-200 bg-white p-4" id="coordination"><CoordinationCaseLink complaintId={complaint.id}/></section>}
      <WorkflowRequests complaint={complaint} canSubmit={!!allowedActions.request} onChange={fetchDetails}/>
      </div>
      {actionModalOpen && (
        <ModalFrame className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClose={() => setActionModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full border border-[#e5eaf0] overflow-hidden">
            <div className="bg-[#f8fafc] px-4 py-3 border-b border-[#e5eaf0] flex items-center justify-between">
              <h3 className="text-sm font-bold text-aicte-navy-900">{tr("complaints:updateComplaintStatus")}</h3>
              <button onClick={() => setActionModalOpen(false)} className="text-slate-500 hover:text-slate-700 cursor-pointer" aria-label={tr("common:cancel")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="p-4 space-y-3.5">
              {actionError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {localizeError(actionError)}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:newStatusPermittedTransitionsFrom")}{localizeLabel(complaint.status)})
                </label>
                <select
                  aria-label={tr("complaints:newCaseStatus")}
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                >
                  <option value={complaint.status}>{localizeLabel(complaint.status)}{tr("complaints:recordAction")}</option>
                  {permittedStatuses.map(status=><option key={status} value={status}>{localizeLabel(status)}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:officialActionRemarksFindings")}<span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  aria-label={tr("complaints:officialActionRemarks")}
                  value={actionRemarks}
                  onChange={e => setActionRemarks(e.target.value)}
                  placeholder={tr("complaints:recordVerificationNotesNoticeDispatchedDatesInstitutionReplyFindings")}
                  className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                />
              </div>

              <label className="block text-xs">{tr("complaints:nextAction")}<input className="block w-full border p-2" value={nextAction} onChange={e=>setNextAction(e.target.value)}/></label>
              <label className="block text-xs">{tr("complaints:nextActionDate_aea40")}<input type="date" className="block border p-2" value={nextActionDate} onChange={e=>setNextActionDate(e.target.value)}/></label>
              {allowedActions.assign&&<fieldset id="assignment" className="block text-sm"><legend>{tr("navigation:officerAssignment")}</legend><label>{tr("complaints:searchEligibleOfficers")}<input className="block border p-2" value={officerSearch} onChange={e=>setOfficerSearch(e.target.value)}/></label><label>{tr("complaints:assignOfficer")}<select className="block border p-2" value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">{tr("complaints:keepCurrentAssignment")}</option>{officers.map(o=><option key={o.id} value={o.id}>{o.fullName} ({formatNumber(o.activeCases)}{tr("complaints:activeCases")}</option>)}</select></label></fieldset>}
              <div className="flex justify-end space-x-2 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setActionModalOpen(false)}
                  className="px-3 py-1.5 border border-[#e5eaf0] rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >{tr("common:cancel")}</button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-3.5 py-1.5 bg-aicte-navy-700 text-white rounded-lg text-xs font-semibold hover:bg-aicte-navy-900 disabled:opacity-50 cursor-pointer"
                >
                  {actionSubmitting ? tr("complaints:saving") : tr("complaints:confirmCommit")}
                </button>
              </div>
            </form>
          </div>
        </ModalFrame>
      )}

      {/* SLA OVERRIDE MODAL (Feature 4) */}
      {slaModalOpen && (
        <ModalFrame className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClose={() => setSlaModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full border border-[#e5eaf0] overflow-hidden">
            <div className="bg-[#f8fafc] px-4 py-3 border-b border-[#e5eaf0] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-aicte-navy-900">{tr("complaints:authorizedSlaTargetOverride")}</h3>
                <p className="text-xs text-slate-500">{tr("complaints:recordAnOfficialSlaDeadlineExtensionWithFullAudit")}</p>
              </div>
              <button onClick={() => setSlaModalOpen(false)} className="text-slate-500 hover:text-slate-700 cursor-pointer" aria-label={tr("common:cancel")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleOverrideSla} className="p-4 space-y-3.5">
              {slaError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {localizeError(slaError)}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:currentTargetDeadline")}</label>
                <input aria-label={tr("complaints:currentTargetDeadline")}
                  type="text"
                  readOnly
                  value={complaint.expectedDisposalDate}
                  className="w-full bg-[#f1f5f9] border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs font-mono text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:newAdjustedDisposalDeadline")}<span className="text-red-600">*</span>
                </label>
                <input aria-label={tr("complaints:newAdjustedDisposalDeadline")}
                  type="date"
                  required
                  value={newSlaDeadline}
                  onChange={e => setNewSlaDeadline(e.target.value)}
                  className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:administrativeOverrideReasonJustification")}<span className="text-red-600">*</span>
                </label>
                <textarea aria-label={tr("complaints:administrativeOverrideReasonJustification")}
                  rows={4}
                  required
                  value={slaOverrideReason}
                  onChange={e => setSlaOverrideReason(e.target.value)}
                  placeholder={tr("complaints:mandatoryAdministrativeJustificationEGCourtStayOrderExpert")}
                  className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setSlaModalOpen(false)}
                  className="px-3 py-1.5 border border-[#e5eaf0] rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >{tr("common:cancel")}</button>
                <button
                  type="submit"
                  disabled={slaSubmitting}
                  className="px-3.5 py-1.5 bg-[#b45309] text-white rounded-lg text-xs font-semibold hover:bg-[#92400e] disabled:opacity-50 cursor-pointer"
                >
                  {slaSubmitting ? tr("complaints:committing") : tr("complaints:applySlaOverride")}
                </button>
              </div>
            </form>
          </div>
        </ModalFrame>
      )}

      {/* TRANSFER MODAL */}
      {transferModalOpen && (
        <ModalFrame className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClose={() => setTransferModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full border border-[#e5eaf0] overflow-hidden">
            <div className="bg-[#f8fafc] px-4 py-3 border-b border-[#e5eaf0] flex items-center justify-between">
              <h3 className="text-sm font-bold text-aicte-navy-900">{tr("complaints:transferCaseJurisdiction")}</h3>
              <button onClick={() => setTransferModalOpen(false)} className="text-slate-500 hover:text-slate-700 cursor-pointer" aria-label={tr("common:cancel")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:destinationBureauCell")}</label>
                <select aria-label={tr("complaints:destinationBureauCell")}
                  value={transferBureau}
                  onChange={e => setTransferBureau(e.target.value)}
                  className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                >
                  <option value="RB">{tr("complaints:regulationBureauRb")}</option>
                  <option value="PGRC">{tr("complaints:publicGrievanceRedressalCellPgrc")}</option>
                  <option value="RO">{tr("complaints:regionalOfficesRo")}</option>
                  <option value="AB">{tr("complaints:approvalBureauAb")}</option>
                  <option value="PB">{tr("complaints:policyAcademicBureauPb")}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:transferJustificationReason")}<span className="text-red-600">*</span>
                </label>
                <textarea aria-label={tr("complaints:transferJustificationReason")}
                  rows={4}
                  required
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  placeholder={tr("complaints:explainWhyThisComplaintRequiresCrossBureauReassignment")}
                  className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-3 py-1.5 border border-[#e5eaf0] rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >{tr("common:cancel")}</button>
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  className="px-3.5 py-1.5 bg-aicte-navy-700 text-white rounded-lg text-xs font-semibold hover:bg-aicte-navy-900 disabled:opacity-50 cursor-pointer"
                >
                  {transferSubmitting ? tr("complaints:transferring") : tr("complaints:confirmTransfer")}
                </button>
              </div>
            </form>
          </div>
        </ModalFrame>
      )}

      {/* TRANSFER ADJUDICATION MODAL */}
      {adjudicateModalOpen && pendingTransfer && (
        <ModalFrame className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClose={() => setAdjudicateModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full border border-[#e5eaf0] overflow-hidden">
            <div className={`px-4 py-3 text-white flex items-center justify-between ${
              adjudicateAction === "Accepted" ? "bg-emerald-800" : "bg-rose-800"
            }`}>
              <h3 className="text-sm font-bold text-white">
                {adjudicateAction === "Accepted" ? tr("complaints:acceptJurisdictionTransfer") : tr("complaints:declineCaseTransfer")}
              </h3>
              <button onClick={() => setAdjudicateModalOpen(false)} className="text-slate-200 hover:text-white cursor-pointer" aria-label={tr("common:cancel")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmTransferAdjudicate} className="p-4 space-y-3.5">
              <div className="p-2.5 bg-[#f8fafc] border border-slate-200 rounded-lg space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">{tr("complaints:route_61ab9")}</span>
                  <span className="font-mono font-bold text-aicte-navy-700"><bdi dir="ltr" className="canonical-value">{pendingTransfer.fromBureauId}</bdi> &rarr; <bdi dir="ltr" className="canonical-value">{pendingTransfer.toBureauId}</bdi></span>
                </div>
                <div className="text-xs text-slate-600 mt-1 pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">{tr("complaints:originatingReason")}</span> <bdi dir="auto" className="original-content">{pendingTransfer.transferReason}</bdi>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:officialAdjudicationRemarksJustification")}<span className="text-red-600">*</span>
                </label>
                <textarea aria-label={tr("complaints:officialAdjudicationRemarksJustification")}
                  rows={3}
                  required
                  value={adjudicateRemarks}
                  onChange={e => setAdjudicateRemarks(e.target.value)}
                  placeholder={tr("complaints:stateTheRegulatoryGroundsForAcceptingOrDecliningThis")}
                  className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setAdjudicateModalOpen(false)}
                  className="px-3 py-1.5 border border-[#e5eaf0] rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >{tr("common:cancel")}</button>
                <button
                  type="submit"
                  disabled={adjudicateSubmitting}
                  className={`px-3.5 py-1.5 text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer ${
                    adjudicateAction === "Accepted"
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : "bg-rose-700 hover:bg-rose-800"
                  }`}
                >
                  {adjudicateSubmitting ? tr("complaints:submitting") : adjudicateAction === "Accepted" ? tr("complaints:confirmAccept") : tr("complaints:confirmDecline")}
                </button>
              </div>
            </form>
          </div>
        </ModalFrame>
      )}
    </div>
  );
};
