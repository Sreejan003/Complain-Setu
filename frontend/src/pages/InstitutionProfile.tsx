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
  ArrowRight
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { api } from "../services/api.js";
import { Institution, Complaint, OverlapAlert } from "../services/types.js";

export const InstitutionProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [overlapAlerts, setOverlapAlerts] = useState<OverlapAlert[]>([]);
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
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/institutions"
          className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Institution Directory</span>
        </Link>
      </div>

      {/* Top Banner / Institution Metadata Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-lg bg-aicte-navy-900 text-white flex items-center justify-center shrink-0 border border-aicte-navy-700">
              <Building2 className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold bg-slate-100 text-aicte-navy-900 px-2 py-0.5 rounded border border-slate-200">
                  {institution.aictePermanentId}
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                  {institution.accreditationStatus}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 mt-1 tracking-tight">
                {institution.name}
              </h1>
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 mt-2">
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
                  <span>Est. {institution.yearEstablished}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <Link
              to={`/complaints/register?instId=${institution.id}`}
              className="px-3.5 py-2 bg-aicte-navy-900 hover:bg-aicte-navy-800 text-white rounded text-xs font-medium shadow-xs"
            >
              + File Complaint for this Institute
            </Link>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded border border-slate-200/80">
            <span className="text-[11px] text-slate-500 font-medium">Total Complaints</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{complaints.length}</div>
          </div>
          <div className="bg-amber-50/50 p-3 rounded border border-amber-200/80">
            <span className="text-[11px] text-amber-800 font-medium">Pending Review</span>
            <div className="text-xl font-bold text-amber-700 mt-0.5">{pendingCount}</div>
          </div>
          <div className="bg-blue-50/50 p-3 rounded border border-blue-200/80">
            <span className="text-[11px] text-blue-800 font-medium">Active Grievances</span>
            <div className="text-xl font-bold text-blue-700 mt-0.5">{activeCount}</div>
          </div>
          <div className="bg-amber-50/80 p-3 rounded border border-amber-300">
            <span className="text-[11px] text-amber-900 font-semibold flex items-center space-x-1">
              <GitMerge className="w-3 h-3 text-amber-600" />
              <span>Cross-Bureau Overlaps</span>
            </span>
            <div className="text-xl font-bold text-amber-800 mt-0.5">{overlapAlerts.length}</div>
          </div>
        </div>
      </div>

      {/* Profile 5-Tabs Navigation */}
      <div className="border-b border-slate-200 bg-white rounded-t-lg px-4 flex space-x-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab("complaints")}
          className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === "complaints"
              ? "border-aicte-navy-800 text-aicte-navy-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>All Complaints ({complaints.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("overlaps")}
          className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === "overlaps"
              ? "border-aicte-navy-800 text-aicte-navy-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <GitMerge className="w-4 h-4 text-amber-500" />
          <span>Related Cases & Overlaps ({overlapAlerts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === "history"
              ? "border-aicte-navy-800 text-aicte-navy-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Action History</span>
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === "documents"
              ? "border-aicte-navy-800 text-aicte-navy-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Approvals & Documents</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === "analytics"
              ? "border-aicte-navy-800 text-aicte-navy-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Institution Analytics</span>
        </button>
      </div>

      {/* Tab 1: All Complaints */}
      {activeTab === "complaints" && (
        <div className="bg-white border border-slate-200 rounded-b-lg shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Complaint ID</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Receiving Bureau</th>
                  <th className="py-3 px-4">Current Bureau</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Received Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      No complaints currently filed for this institution.
                    </td>
                  </tr>
                ) : (
                  complaints.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-aicte-navy-900 whitespace-nowrap">
                        {c.complaintId}
                        {c.hasOverlapAlert && (
                          <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-sans font-semibold">
                            Overlap
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{c.category}</td>
                      <td className="py-3 px-4 max-w-xs truncate font-medium text-slate-800">{c.title}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{c.receivingBureauId}</td>
                      <td className="py-3 px-4 font-semibold text-blue-700">{c.currentBureauId}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            c.status === "Pending"
                              ? "bg-amber-100 text-amber-800"
                              : c.status === "Under Process"
                              ? "bg-blue-100 text-blue-800"
                              : c.status === "Disposed"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.status === "Transferred"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold text-[11px] ${
                            c.priority === "Critical"
                              ? "text-red-700 font-bold"
                              : c.priority === "High"
                              ? "text-amber-700"
                              : "text-slate-600"
                          }`}
                        >
                          {c.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{c.receivedDate}</td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/cases/${c.id}`}
                          className="text-blue-600 hover:underline font-semibold"
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
        <div className="bg-white border border-slate-200 rounded-b-lg p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Potential & Confirmed Cross-Bureau Overlaps</h3>
            <p className="text-xs text-slate-500">
              Complaints concerning this institution being handled simultaneously by different Bureaus/Cells.
            </p>
          </div>

          {overlapAlerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No cross-bureau overlap alerts recorded for this institution.
            </div>
          ) : (
            <div className="space-y-3">
              {overlapAlerts.map(alert => (
                <div
                  key={alert.id}
                  className="p-4 border border-amber-200 bg-amber-50/40 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-amber-900">{alert.alertId}</span>
                      <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">
                        Match Score: {alert.ruleMatchScore}%
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded">
                        Status: {alert.alertStatus}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-800">
                      Cross-Bureau Conflict:{" "}
                      <span className="text-blue-800">{alert.bureauA}</span> ({alert.complaintRefA}) ⚡{" "}
                      <span className="text-purple-800">{alert.bureauB}</span> ({alert.complaintRefB})
                    </div>

                    <div className="text-[11px] text-slate-600">
                      <strong>Reasons:</strong> {alert.matchReasons.slice(0, 2).join("; ")}
                    </div>
                  </div>

                  <Link
                    to="/overlaps"
                    className="px-3.5 py-1.5 bg-aicte-navy-900 text-white rounded text-xs font-semibold hover:bg-aicte-navy-800 self-start md:self-auto shrink-0 shadow-xs"
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
        <div className="bg-white border border-slate-200 rounded-b-lg p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Regulatory Audit Trail</h3>
          <div className="space-y-3">
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
              <div key={i} className="flex items-start space-x-3 text-xs border-b border-slate-100 pb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{event.action}</span>
                    <span className="text-[10px] text-slate-400">{event.date}</span>
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
        <div className="bg-white border border-slate-200 rounded-b-lg p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Regulatory Approval Documents</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
              <span className="font-semibold text-slate-800 block">AICTE Extension of Approval (EOA) 2025-26</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Sanctioned Intake: 480 Seats</span>
              <span className="text-[10px] text-emerald-700 font-bold mt-2 inline-block">✓ Active & Valid</span>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
              <span className="font-semibold text-slate-800 block">NBA Accreditation Certificate</span>
              <span className="text-[11px] text-slate-500 mt-1 block">CSE & ECE Accredited Tier-II</span>
              <span className="text-[10px] text-emerald-700 font-bold mt-2 inline-block">✓ Valid till June 2027</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Analytics */}
      {activeTab === "analytics" && (
        <div className="bg-white border border-slate-200 rounded-b-lg p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Grievance Nature & Category Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Complaints" fill="#0f2942" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
