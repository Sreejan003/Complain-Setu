import { tr, localizeLabel, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
  GitMerge,
  FileText,
  AlertTriangle,
  History,
  FileCheck,
  BarChart2,
  ChevronLeft,
  ArrowRight,
  ExternalLink,
  Paperclip
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { api } from "../services/api.js";
import { Institution, Complaint, OverlapAlert, ComplaintDocument } from "../services/types.js";

export const InstitutionProfile: React.FC = () => {
  useLocaleRender();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [overlapAlerts, setOverlapAlerts] = useState<OverlapAlert[]>([]);
  const [documents, setDocuments] = useState<ComplaintDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"complaints" | "overlaps" | "history" | "documents" | "analytics">("complaints");

  useEffect(() => {
    async function loadProfile() {
      if (!id) return;
      setLoading(true);
      try {
        const res = await api.getInstitutionProfile(id);
        setInstitution(res.institution);
        setComplaints(res.complaints);
        setOverlapAlerts(res.overlapAlerts);
        setDocuments(res.documents || []);
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [id]);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">{tr("complaints:loadingConsolidatedInstitutionProfile")}</div>
    );
  }

  if (!institution) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <h2 className="text-base font-bold text-slate-800">{tr("complaints:institutionNotFound")}</h2>
        <p className="text-xs text-slate-500 mt-1">{tr("complaints:noInstitutionMatchingId")}{id}{tr("complaints:wasLocated")}</p>
        <Link to="/institutions" className="mt-4 inline-block text-xs text-blue-600 hover:underline">{tr("complaints:returnToInstitutionDirectory")}</Link>
      </div>
    );
  }

  const pendingCount = complaints.filter(c => c.status === "Pending").length;
  const activeCount = complaints.filter(c => ["Pending", "Under Process", "Escalated"].includes(c.status)).length;
  const disposedCount = complaints.filter(c => c.status === "Disposed").length;

  // Category breakdown for analytics tab
  const categoryMap: Record<string, number> = {};
  complaints.forEach(c => {
    categoryMap[c.category] = (categoryMap[c.category] || 0) + 1;
  });
  const categoryChartData = Object.keys(categoryMap).map(k => ({ name: k, count: categoryMap[k] }));

  const COLORS = ["#0f2942", "#2563eb", "#0d9488", "#f59e0b", "#8b5cf6", "#ec4899"];

  return (
    <div className="space-y-4">
      {/* Back button */}
      <div>
        <Link
          to="/institutions"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-aicte-navy-700 hover:underline"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>{tr("complaints:returnToInstitutionDirectory_0171b")}</span>
        </Link>
      </div>

      {/* Cross-Bureau Overlap Alert - Official Coordination Notice */}
      {overlapAlerts.length > 0 && (
        <div className="bg-[#fffbeb] border border-[#f59e0b] rounded-lg p-3.5 text-[#78350f] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="p-1.5 bg-[#fef3c7] border border-[#fde68a] rounded-lg shrink-0 mt-0.5 text-[#b45309]">
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs uppercase tracking-wider text-[#92400e]">{tr("complaints:administrativeAlertMultiBureauOverlapDetected")}</span>
                <span className="bg-[#b45309] text-white font-bold text-xs px-1.5 py-0.2 rounded-lg">
                  {overlapAlerts.length}{tr("complaints:crossBureauAlert")}{overlapAlerts.length > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-[#78350f] mt-0.5 leading-normal">{tr("complaints:complaintsForThisInstitutionAreCurrentlyUnderActiveScrutiny")}</p>
            </div>
          </div>
          <Link
            to="/overlaps"
            className="px-3 py-1.5 bg-[#b45309] text-white hover:bg-[#92400e] font-semibold text-xs rounded-lg shrink-0 self-start sm:self-auto flex items-center space-x-1"
          >
            <span>{tr("complaints:inspectInOverlapCenter")}</span>
          </Link>
        </div>
      )}

      {/* Top Banner / Institution Metadata Card */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg p-4 shadow-none">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-11 h-11 rounded-lg bg-aicte-navy-900 text-white flex items-center justify-center shrink-0 border border-[#e5eaf0]">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold bg-[#f1f5f9] text-aicte-navy-700 px-2 py-0.5 rounded-lg border border-[#e5eaf0]">{tr("complaints:aictePermanentId_4787d")}{institution.aictePermanentId}
                </span>
                <span className="text-xs bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] font-semibold px-2 py-0.5 rounded-lg">
                  {institution.accreditationStatus}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-aicte-navy-900 mt-1 tracking-tight">
                {institution.name}
              </h1>
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600 mt-1">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{institution.city}, {institution.state} ({institution.region.split("(")[0]})</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>{institution.contactEmail}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{tr("complaints:established")}{institution.yearEstablished}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <Link
              to={`/complaints/register?instId=${institution.id}`}
              className="px-3 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg text-xs font-semibold shadow-none cursor-pointer"
            >{tr("complaints:fileComplaintForThisInstitute")}</Link>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-[#e2e8f0]">
          <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-[#e5eaf0]">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">{tr("dashboard:totalComplaints")}</span>
            <div className="text-lg font-bold text-aicte-navy-900 font-mono mt-0.5">{complaints.length}</div>
          </div>
          <div className="bg-[#fffbeb] p-2.5 rounded-lg border border-[#fde68a]">
            <span className="text-xs text-[#92400e] font-bold uppercase tracking-wider block">{tr("overlaps:pendingReview")}</span>
            <div className="text-lg font-bold text-[#b45309] font-mono mt-0.5">{pendingCount}</div>
          </div>
          <div className="bg-[#f0f9ff] p-2.5 rounded-lg border border-[#bae6fd]">
            <span className="text-xs text-[#0369a1] font-bold uppercase tracking-wider block">{tr("complaints:activeGrievances")}</span>
            <div className="text-lg font-bold text-[#0284c7] font-mono mt-0.5">{activeCount}</div>
          </div>
          <div className="bg-[#fffbeb] p-2.5 rounded-lg border border-[#f59e0b]">
            <span className="text-xs text-[#92400e] font-bold uppercase tracking-wider flex items-center space-x-1">
              <GitMerge className="w-3 h-3 text-[#b45309]" />
              <span>{tr("complaints:crossBureauOverlaps")}</span>
            </span>
            <div className="text-lg font-bold text-[#92400e] font-mono mt-0.5">{overlapAlerts.length}</div>
          </div>
        </div>
      </div>

      {/* Profile 5-Tabs Navigation */}
      <div className="border border-[#e5eaf0] bg-white rounded-lg px-2 flex flex-wrap gap-1 text-xs font-medium">
        <button
          onClick={() => setActiveTab("complaints")}
          className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "complaints"
              ? "border-[#003366] text-aicte-navy-700 font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-aicte-navy-700"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{tr("complaints:allComplaints")}{complaints.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("overlaps")}
          className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "overlaps"
              ? "border-[#003366] text-aicte-navy-700 font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-aicte-navy-700"
          }`}
        >
          <GitMerge className="w-3.5 h-3.5 text-[#b45309]" />
          <span>{tr("complaints:relatedCasesOverlaps")}{overlapAlerts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "history"
              ? "border-[#003366] text-aicte-navy-700 font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-aicte-navy-700"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{tr("complaints:actionHistory")}</span>
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "documents"
              ? "border-[#003366] text-aicte-navy-700 font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-aicte-navy-700"
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>{tr("complaints:approvalsDocuments")}</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "analytics"
              ? "border-[#003366] text-aicte-navy-700 font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-aicte-navy-700"
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>{tr("complaints:institutionAnalytics")}</span>
        </button>
      </div>

      {/* Tab 1: All Complaints */}
      {activeTab === "complaints" && (
        <div className="bg-white border border-[#e5eaf0] rounded-lg shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="gov-table w-full text-start text-xs">
              <thead>
                <tr>
                  <th>{tr("complaints:complaintId")}</th>
                  <th>{tr("complaints:category")}</th>
                  <th>{tr("complaints:grievanceSubject")}</th>
                  <th>{tr("complaints:receivingBureau")}</th>
                  <th>{tr("complaints:currentBureau")}</th>
                  <th>{tr("complaints:status_bae7d")}</th>
                  <th>{tr("complaints:priority")}</th>
                  <th>{tr("complaints:receivedDate")}</th>
                  <th className="text-end">{tr("dashboard:action")}</th>
                </tr>
              </thead>
              <tbody>
                {complaints.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">{tr("complaints:noComplaintsCurrentlyFiledForThisInstitution")}</td>
                  </tr>
                ) : (
                  complaints.map(c => (
                    <tr key={c.id}>
                      <td className="font-mono font-bold text-aicte-navy-900 whitespace-nowrap">
                        <bdi dir="ltr" className="canonical-value">{c.complaintId}</bdi>
                        {c.hasOverlapAlert && (
                          <span className="ms-1.5 text-xs bg-[#fffbeb] text-[#92400e] border border-[#fde68a] px-1 py-0.2 rounded-lg font-sans font-semibold">{tr("complaints:overlap")}</span>
                        )}
                      </td>
                      <td className="text-slate-600">{c.category}</td>
                      <td className="max-w-xs truncate font-medium text-slate-800"><bdi dir="auto" className="original-content">{c.title}</bdi></td>
                      <td className="font-semibold text-slate-700">{c.receivingBureauId}</td>
                      <td className="font-semibold text-aicte-navy-700"><bdi dir="ltr" className="canonical-value">{c.currentBureauId}</bdi></td>
                      <td>
                        <span
                          className={`px-1.5 py-0.2 rounded-lg text-xs font-semibold border ${
                            c.status === "Pending"
                              ? "bg-[#fffbeb] text-[#92400e] border-[#fde68a]"
                              : c.status === "Under Process"
                              ? "bg-[#f0f9ff] text-[#0369a1] border-[#bae6fd]"
                              : c.status === "Disposed"
                              ? "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]"
                              : c.status === "Transferred"
                              ? "bg-[#faf5ff] text-[#6b21a8] border-[#e9d5ff]"
                              : "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]"
                          }`}
                        >
                          {localizeLabel(c.status)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`font-semibold text-xs px-1.5 py-0.2 rounded-lg border ${
                            c.priority === "Critical"
                              ? "bg-[#fef2f2] text-[#991b1b] border-[#fecaca] font-bold"
                              : c.priority === "High"
                              ? "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]"
                              : "bg-[#f8fafc] text-slate-700 border-[#e5eaf0]"
                          }`}
                        >
                          {localizeLabel(c.priority)}
                        </span>
                      </td>
                      <td className="text-slate-500 font-mono text-xs whitespace-nowrap">{formatDate(c.receivedDate)}</td>
                      <td className="text-end whitespace-nowrap">
                        <Link
                          to={`/cases/${c.id}`}
                          className="text-aicte-navy-700 hover:underline font-semibold"
                        >{tr("complaints:viewCase")}</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Related Cases & Overlaps */}
      {activeTab === "overlaps" && (
        <div className="bg-white border border-[#e5eaf0] rounded-lg p-4 shadow-none space-y-3">
          <div className="border-b border-[#e2e8f0] pb-2.5">
            <h3 className="text-xs font-bold text-aicte-navy-700 uppercase tracking-wider">{tr("complaints:potentialConfirmedCrossBureauOverlaps")}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{tr("complaints:complaintsConcerningThisInstitutionBeingHandledSimultaneouslyByDifferent")}</p>
          </div>

          {overlapAlerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">{tr("complaints:noCrossBureauOverlapAlertsRecordedForThisInstitution")}</div>
          ) : (
            <div className="space-y-2.5">
              {overlapAlerts.map(alert => (
                <div
                  key={alert.id}
                  className="p-3.5 border border-[#fde68a] bg-[#fffbeb]/40 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1 flex-1 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-[#92400e]">{alert.alertId}</span>
                      <span className="text-xs bg-[#fef3c7] text-[#92400e] border border-[#fde68a] font-bold px-1.5 py-0.2 rounded-lg">{tr("complaints:matchScore")}{alert.ruleMatchScore}%
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-700 font-medium px-1.5 py-0.2 rounded-lg border border-slate-200">{tr("complaints:statusLabel")}{alert.alertStatus}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-800">{tr("complaints:crossBureauConflict")}{" "}
                      <span className="text-aicte-navy-700">{alert.bureauA}</span> ({alert.complaintRefA}) ⚡{" "}
                      <span className="text-[#6b21a8]">{alert.bureauB}</span> ({alert.complaintRefB})
                    </div>

                    <div className="text-xs text-slate-600">
                      <strong>{tr("complaints:reasons")}</strong> {alert.matchReasons.slice(0, 2).join("; ")}
                    </div>
                  </div>

                  <Link
                    to="/overlaps"
                    className="px-3 py-1.5 bg-aicte-navy-700 text-white rounded-lg text-xs font-semibold hover:bg-aicte-navy-900 self-start md:self-auto shrink-0 shadow-none cursor-pointer"
                  >{tr("complaints:openInOverlapCenter")}</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Action History */}
      {activeTab === "history" && (
        <div className="bg-white border border-[#e5eaf0] rounded-lg p-4 shadow-none">
          <h3 className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700 mb-3 pb-2 border-b border-[#e2e8f0]">{tr("complaints:regulatoryAuditTrail")}</h3>
          <div className="space-y-2.5">
            {complaints.flatMap(c => [
              {
                date: c.receivedDate,
                action: "Complaint Filed",
                desc: `${c.complaintId} registered under ${c.receivingBureauId} (${c.category})`,
                officer: c.createdByName || "System"
              },
              c.disposalDate
                ? {
                    date: c.disposalDate,
                    action: "Complaint Disposed",
                    desc: `${c.complaintId}: ${c.disposalRemarks || "Disposed following compliance check"}`,
                    officer: c.assignedOfficerName || "Official"
                  }
                : null
            ]).filter(Boolean).map((event: any, i) => (
              <div key={i} className="flex items-start space-x-3 text-xs border-b border-[#e2e8f0] pb-2 last:border-b-0">
                <div className="w-2 h-2 rounded-lg bg-aicte-navy-700 mt-1 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{event.action}</span>
                    <span className="text-xs text-slate-500 font-mono">{event.date}</span>
                  </div>
                  <div className="text-slate-600 text-xs mt-0.5">{event.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Documents & Approvals */}
      {activeTab === "documents" && (
        <div className="bg-white border border-[#e5eaf0] rounded-lg p-4 shadow-none space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700 mb-2.5 flex items-center space-x-1.5">
              <Paperclip className="w-3.5 h-3.5 text-aicte-navy-700" />
              <span>{tr("complaints:grievanceCaseInvestigationFiles")}{documents.length})</span>
            </h3>

            {documents.length === 0 ? (
              <div className="text-xs text-slate-500 py-3 text-center bg-[#f8fafc] rounded-lg border border-dashed border-[#e5eaf0]">{tr("complaints:noComplaintEvidenceOrInvestigationDocumentsUploadedYetFor")}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="p-3 border border-[#e5eaf0] rounded-lg bg-[#f8fafc] hover:bg-slate-100 flex items-center justify-between transition"
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <div className="p-1.5 bg-white rounded-lg border border-[#e5eaf0] text-aicte-navy-700 shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-slate-800 block truncate">{doc.originalName}</span>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-xs bg-[#f1f5f9] text-aicte-navy-700 border border-[#e5eaf0] px-1 py-0.2 rounded-lg font-medium">
                            {localizeLabel(doc.documentType)}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {Math.round(doc.fileSize / 1024)} KB &bull; {formatDate(doc.uploadedAt, false)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ms-3 px-2 py-1 bg-white border border-[#e5eaf0] text-slate-700 hover:text-aicte-navy-700 rounded-lg text-xs font-medium flex items-center space-x-1 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{tr("complaints:view")}</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#e2e8f0]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700 mb-2.5 flex items-center space-x-1.5">
              <FileCheck className="w-3.5 h-3.5 text-[#15803d]" />
              <span>{tr("complaints:statutoryAicteApprovalsAccreditationRegistry")}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 border border-[#e5eaf0] rounded-lg bg-[#f8fafc]">
                <span className="font-semibold text-slate-800 block">{tr("complaints:aicteExtensionOfApprovalEoa202526")}</span>
                <span className="text-xs text-slate-500 mt-0.5 block">{tr("complaints:sanctionedIntake480Seats")}</span>
                <span className="text-xs text-[#166534] font-bold mt-1.5 inline-block">{tr("complaints:activeValid")}</span>
              </div>
              <div className="p-3.5 border border-[#e5eaf0] rounded-lg bg-[#f8fafc]">
                <span className="font-semibold text-slate-800 block">{tr("complaints:nbaAccreditationCertificate")}</span>
                <span className="text-xs text-slate-500 mt-0.5 block">{tr("complaints:cseEceAccreditedTierIi")}</span>
                <span className="text-xs text-[#166534] font-bold mt-1.5 inline-block">{tr("complaints:validTillJune2027")}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Analytics */}
      {activeTab === "analytics" && (
        <div className="bg-white border border-[#e5eaf0] rounded-lg p-4 shadow-none">
          <h3 className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700 mb-3 pb-2 border-b border-[#e2e8f0]">{tr("complaints:grievanceNatureCategoryDistribution")}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(value:any)=>formatNumber(value)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value:any,name:any)=>[typeof value==="number"?formatNumber(value):value,localizeLabel(name)]} labelFormatter={(label:any)=>localizeLabel(label)} />
                <Bar dataKey="count" name={tr("complaints:complaints")} fill="#003366" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
