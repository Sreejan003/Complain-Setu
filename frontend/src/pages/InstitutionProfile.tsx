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
      <div className="py-12 text-center text-sm text-slate-500">
        Loading consolidated institution profile...
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <h2 className="text-base font-bold text-slate-800">Institution Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">No institution matching ID "{id}" was located.</p>
        <Link to="/institutions" className="mt-4 inline-block text-xs text-blue-600 hover:underline">
          &larr; Return to Institution Directory
        </Link>
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
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#003366] hover:underline"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Return to Institution Directory</span>
        </Link>
      </div>

      {/* Cross-Bureau Overlap Alert - Official Coordination Notice */}
      {overlapAlerts.length > 0 && (
        <div className="bg-[#fffbeb] border border-[#f59e0b] rounded-xs p-3.5 text-[#78350f] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="p-1.5 bg-[#fef3c7] border border-[#fde68a] rounded-xs shrink-0 mt-0.5 text-[#b45309]">
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs uppercase tracking-wider text-[#92400e]">Administrative Alert: Multi-Bureau Overlap Detected</span>
                <span className="bg-[#b45309] text-white font-bold text-[10px] px-1.5 py-0.2 rounded-xs">
                  {overlapAlerts.length} Cross-Bureau Alert{overlapAlerts.length > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-[#78350f] mt-0.5 leading-normal">
                Complaints for this institution are currently under active scrutiny in multiple AICTE Bureaus.
                Consolidated review recommended before final regulatory disposal or institutional sanctions.
              </p>
            </div>
          </div>
          <Link
            to="/overlaps"
            className="px-3 py-1.5 bg-[#b45309] text-white hover:bg-[#92400e] font-semibold text-xs rounded-xs shrink-0 self-start sm:self-auto flex items-center space-x-1"
          >
            <span>Inspect in Overlap Center &rarr;</span>
          </Link>
        </div>
      )}

      {/* Top Banner / Institution Metadata Card */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-11 h-11 rounded-xs bg-[#002147] text-white flex items-center justify-center shrink-0 border border-[#cbd5e1]">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold bg-[#f1f5f9] text-[#003366] px-2 py-0.5 rounded-xs border border-[#cbd5e1]">
                  AICTE Permanent ID: {institution.aictePermanentId}
                </span>
                <span className="text-[11px] bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] font-semibold px-2 py-0.5 rounded-xs">
                  {institution.accreditationStatus}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-[#002147] mt-1 tracking-tight">
                {institution.name}
              </h1>
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600 mt-1">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{institution.city}, {institution.state} ({institution.region.split("(")[0]})</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{institution.contactEmail}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Established: {institution.yearEstablished}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <Link
              to={`/complaints/register?instId=${institution.id}`}
              className="px-3 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs text-xs font-semibold shadow-none cursor-pointer"
            >
              + File Complaint for this Institute
            </Link>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-[#e2e8f0]">
          <div className="bg-[#f8fafc] p-2.5 rounded-xs border border-[#cbd5e1]">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Complaints</span>
            <div className="text-lg font-bold text-[#002147] font-mono mt-0.5">{complaints.length}</div>
          </div>
          <div className="bg-[#fffbeb] p-2.5 rounded-xs border border-[#fde68a]">
            <span className="text-[10px] text-[#92400e] font-bold uppercase tracking-wider block">Pending Review</span>
            <div className="text-lg font-bold text-[#b45309] font-mono mt-0.5">{pendingCount}</div>
          </div>
          <div className="bg-[#f0f9ff] p-2.5 rounded-xs border border-[#bae6fd]">
            <span className="text-[10px] text-[#0369a1] font-bold uppercase tracking-wider block">Active Grievances</span>
            <div className="text-lg font-bold text-[#0284c7] font-mono mt-0.5">{activeCount}</div>
          </div>
          <div className="bg-[#fffbeb] p-2.5 rounded-xs border border-[#f59e0b]">
            <span className="text-[10px] text-[#92400e] font-bold uppercase tracking-wider flex items-center space-x-1">
              <GitMerge className="w-3 h-3 text-[#b45309]" />
              <span>Cross-Bureau Overlaps</span>
            </span>
            <div className="text-lg font-bold text-[#92400e] font-mono mt-0.5">{overlapAlerts.length}</div>
          </div>
        </div>
      </div>

      {/* Profile 5-Tabs Navigation */}
      <div className="border border-[#cbd5e1] bg-white rounded-xs px-2 flex flex-wrap gap-1 text-xs font-medium">
        <button
          onClick={() => setActiveTab("complaints")}
          className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "complaints"
              ? "border-[#003366] text-[#003366] font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-[#003366]"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>All Complaints ({complaints.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("overlaps")}
          className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "overlaps"
              ? "border-[#003366] text-[#003366] font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-[#003366]"
          }`}
        >
          <GitMerge className="w-3.5 h-3.5 text-[#b45309]" />
          <span>Related Cases & Overlaps ({overlapAlerts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "history"
              ? "border-[#003366] text-[#003366] font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-[#003366]"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Action History</span>
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "documents"
              ? "border-[#003366] text-[#003366] font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-[#003366]"
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Approvals & Documents</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "analytics"
              ? "border-[#003366] text-[#003366] font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-[#003366]"
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Institution Analytics</span>
        </button>
      </div>

      {/* Tab 1: All Complaints */}
      {activeTab === "complaints" && (
        <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="gov-table w-full text-left text-xs">
              <thead>
                <tr>
                  <th>Complaint ID</th>
                  <th>Category</th>
                  <th>Grievance Subject</th>
                  <th>Receiving Bureau</th>
                  <th>Current Bureau</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Received Date</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      No complaints currently filed for this institution.
                    </td>
                  </tr>
                ) : (
                  complaints.map(c => (
                    <tr key={c.id}>
                      <td className="font-mono font-bold text-[#002147] whitespace-nowrap">
                        {c.complaintId}
                        {c.hasOverlapAlert && (
                          <span className="ml-1.5 text-[10px] bg-[#fffbeb] text-[#92400e] border border-[#fde68a] px-1 py-0.2 rounded-xs font-sans font-semibold">
                            Overlap
                          </span>
                        )}
                      </td>
                      <td className="text-slate-600">{c.category}</td>
                      <td className="max-w-xs truncate font-medium text-slate-800">{c.title}</td>
                      <td className="font-semibold text-slate-700">{c.receivingBureauId}</td>
                      <td className="font-semibold text-[#003366]">{c.currentBureauId}</td>
                      <td>
                        <span
                          className={`px-1.5 py-0.2 rounded-xs text-[10px] font-semibold border ${
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
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`font-semibold text-[10px] px-1.5 py-0.2 rounded-xs border ${
                            c.priority === "Critical"
                              ? "bg-[#fef2f2] text-[#991b1b] border-[#fecaca] font-bold"
                              : c.priority === "High"
                              ? "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]"
                              : "bg-[#f8fafc] text-slate-700 border-[#cbd5e1]"
                          }`}
                        >
                          {c.priority}
                        </span>
                      </td>
                      <td className="text-slate-500 font-mono text-[11px] whitespace-nowrap">{c.receivedDate}</td>
                      <td className="text-right whitespace-nowrap">
                        <Link
                          to={`/cases/${c.id}`}
                          className="text-[#003366] hover:underline font-semibold"
                        >
                          View Case &rarr;
                        </Link>
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
        <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none space-y-3">
          <div className="border-b border-[#e2e8f0] pb-2.5">
            <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider">Potential & Confirmed Cross-Bureau Overlaps</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Complaints concerning this institution being handled simultaneously by different Bureaus/Cells.
            </p>
          </div>

          {overlapAlerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No cross-bureau overlap alerts recorded for this institution.
            </div>
          ) : (
            <div className="space-y-2.5">
              {overlapAlerts.map(alert => (
                <div
                  key={alert.id}
                  className="p-3.5 border border-[#fde68a] bg-[#fffbeb]/40 rounded-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1 flex-1 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-[#92400e]">{alert.alertId}</span>
                      <span className="text-[10px] bg-[#fef3c7] text-[#92400e] border border-[#fde68a] font-bold px-1.5 py-0.2 rounded-xs">
                        Match Score: {alert.ruleMatchScore}%
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-700 font-medium px-1.5 py-0.2 rounded-xs border border-slate-200">
                        Status: {alert.alertStatus}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-800">
                      Cross-Bureau Conflict:{" "}
                      <span className="text-[#003366]">{alert.bureauA}</span> ({alert.complaintRefA}) ⚡{" "}
                      <span className="text-[#6b21a8]">{alert.bureauB}</span> ({alert.complaintRefB})
                    </div>

                    <div className="text-[11px] text-slate-600">
                      <strong>Reasons:</strong> {alert.matchReasons.slice(0, 2).join("; ")}
                    </div>
                  </div>

                  <Link
                    to="/overlaps"
                    className="px-3 py-1.5 bg-[#003366] text-white rounded-xs text-xs font-semibold hover:bg-[#002147] self-start md:self-auto shrink-0 shadow-none cursor-pointer"
                  >
                    Open in Overlap Center &rarr;
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Action History */}
      {activeTab === "history" && (
        <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366] mb-3 pb-2 border-b border-[#e2e8f0]">Regulatory Audit Trail</h3>
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
                <div className="w-2 h-2 rounded-xs bg-[#003366] mt-1 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{event.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{event.date}</span>
                  </div>
                  <div className="text-slate-600 text-[11px] mt-0.5">{event.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Documents & Approvals */}
      {activeTab === "documents" && (
        <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366] mb-2.5 flex items-center space-x-1.5">
              <Paperclip className="w-3.5 h-3.5 text-[#003366]" />
              <span>Grievance & Case Investigation Files ({documents.length})</span>
            </h3>

            {documents.length === 0 ? (
              <div className="text-xs text-slate-500 py-3 text-center bg-[#f8fafc] rounded-xs border border-dashed border-[#cbd5e1]">
                No complaint evidence or investigation documents uploaded yet for this institution.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="p-3 border border-[#cbd5e1] rounded-xs bg-[#f8fafc] hover:bg-slate-100 flex items-center justify-between transition"
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <div className="p-1.5 bg-white rounded-xs border border-[#cbd5e1] text-[#003366] shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-slate-800 block truncate">{doc.originalName}</span>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[10px] bg-[#f1f5f9] text-[#003366] border border-[#cbd5e1] px-1 py-0.2 rounded-xs font-medium">
                            {doc.documentType}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {Math.round(doc.fileSize / 1024)} KB &bull; {new Date(doc.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-3 px-2 py-1 bg-white border border-[#cbd5e1] text-slate-700 hover:text-[#003366] rounded-xs text-[11px] font-medium flex items-center space-x-1 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>View</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#e2e8f0]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366] mb-2.5 flex items-center space-x-1.5">
              <FileCheck className="w-3.5 h-3.5 text-[#15803d]" />
              <span>Statutory AICTE Approvals & Accreditation Registry</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 border border-[#cbd5e1] rounded-xs bg-[#f8fafc]">
                <span className="font-semibold text-slate-800 block">AICTE Extension of Approval (EOA) 2025-26</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Sanctioned Intake: 480 Seats</span>
                <span className="text-[10px] text-[#166534] font-bold mt-1.5 inline-block">✓ Active & Valid</span>
              </div>
              <div className="p-3.5 border border-[#cbd5e1] rounded-xs bg-[#f8fafc]">
                <span className="font-semibold text-slate-800 block">NBA Accreditation Certificate</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">CSE & ECE Accredited Tier-II</span>
                <span className="text-[10px] text-[#166534] font-bold mt-1.5 inline-block">✓ Valid till June 2027</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Analytics */}
      {activeTab === "analytics" && (
        <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366] mb-3 pb-2 border-b border-[#e2e8f0]">
            Grievance Nature & Category Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Complaints" fill="#003366" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
