import { tr, localizeLabel, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  GitMerge,
  RefreshCw,
  ExternalLink,
  Shield,
  ArrowRight,
  AlertCircle,
  ArrowRightLeft,
  UserCheck,
  Calendar,
  Building2,
  ChevronRight,
  Filter,
  Check,
  X
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from "recharts";
import { api } from "../services/api.js";
import { DashboardAnalytics, Complaint, OverlapAlert, CaseTransfer } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

type MyWorkTab = "assigned" | "overdue" | "due_soon" | "overlaps" | "transfers";

export const OverviewDashboard: React.FC = () => {
  useLocaleRender();
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [recentComplaints, setRecentComplaints] = useState<Complaint[]>([]);
  const [assignedCases, setAssignedCases] = useState<Complaint[]>([]);
  const [overdueCases, setOverdueCases] = useState<Complaint[]>([]);
  const [dueSoonCases, setDueSoonCases] = useState<Complaint[]>([]);
  const [pendingOverlaps, setPendingOverlaps] = useState<OverlapAlert[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<CaseTransfer[]>([]);
  const [activeTab, setActiveTab] = useState<MyWorkTab>("assigned");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      const [res, compRes, overdueRes, dueSoonRes, overlapsRes, transfersRes] = await Promise.all([
        api.getDashboardAnalytics(),
        api.getComplaints({ limit: 8, sortBy: "receivedDate", sortOrder: "desc" }),
        api.getComplaints({ isOverdue: true, limit: 10 }),
        api.getComplaints({ isDueSoon: true, limit: 10 }),
        api.getOverlapAlerts({ alertStatus: "Pending Review", limit: 10 }),
        api.getTransfers().catch(() => [])
      ]);

      setData(res);
      setRecentComplaints(compRes.data || []);
      setOverdueCases(overdueRes.data || []);
      setDueSoonCases(dueSoonRes.data || []);
      setPendingOverlaps(overlapsRes.data || []);
      setPendingTransfers(transfersRes || []);
      setLastUpdated(timeStr);

      // Fetch officer-assigned cases
      if (user?.id) {
        const myCasesRes = await api.getComplaints({
          assignedOfficerId: user.id,
          limit: 10,
          sortBy: "updatedAt",
          sortOrder: "desc"
        }).catch(() => ({ data: [] }));
        setAssignedCases(myCasesRes.data || []);
      }
    } catch (err) {
      console.error("Dashboard load failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  // Set default tab based on role and workload
  useEffect(() => {
    if (user?.role === "COMPETENT_AUTHORITY") {
      setActiveTab(overdueCases.length > 0 ? "overdue" : "overlaps");
    } else if (assignedCases.length > 0) {
      setActiveTab("assigned");
    } else if (overdueCases.length > 0) {
      setActiveTab("overdue");
    } else if (pendingOverlaps.length > 0) {
      setActiveTab("overlaps");
    }
  }, [assignedCases.length, overdueCases.length, pendingOverlaps.length, user?.role]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="flex flex-col items-center space-y-3 bg-white border border-slate-200 p-8 rounded-lg shadow-xs">
          <RefreshCw className="w-7 h-7 text-[#17365D] animate-spin" />
          <span className="text-xs font-semibold text-slate-700">{tr("dashboard:loadingCentralizedDashboardData")}</span>
          <span className="text-xs text-slate-500 font-mono">{tr("dashboard:synchronizingAicteBureauRecordsSlaMonitors")}</span>
        </div>
      </div>
    );
  }

  const kpi = data?.kpi;
  const canRegister = user?.role !== "COMPETENT_AUTHORITY";

  // Calculate calendar days difference for deadline badge
  const getDaysDiff = (dateStr: string) => {
    if (!dateStr) return 0;
    const due = new Date(dateStr.split("T")[0]).getTime();
    const today = new Date(new Date().toISOString().split("T")[0]).getTime();
    return Math.round((today - due) / (1000 * 60 * 60 * 24));
  };

  // Section B: 6 Primary Metric Cards
  const statCards = [
    {
      title: "Total Complaints",
      value: kpi?.totalComplaints || 0,
      sub: "Across all bureaus",
      icon: FileText,
      color: "text-[#0F172A]",
      accent: "border-s-4 border-s-[#17365D]",
      link: "/cases"
    },
    {
      title: "Pending Cases",
      value: kpi?.pendingComplaints || 0,
      sub: "Awaiting initial intake",
      icon: Clock,
      color: "text-amber-800",
      accent: "border-s-4 border-l-amber-500",
      link: "/cases?status=Pending"
    },
    {
      title: "Under Process",
      value: kpi?.underProcessComplaints || 0,
      sub: "Active investigations",
      icon: RefreshCw,
      color: "text-blue-800",
      accent: "border-s-4 border-l-blue-600",
      link: "/cases?status=Under%20Process"
    },
    {
      title: "Disposed Cases",
      value: kpi?.disposedComplaints || 0,
      sub: "Disposal orders issued",
      icon: CheckCircle2,
      color: "text-emerald-800",
      accent: "border-s-4 border-l-emerald-600",
      link: "/cases?status=Disposed"
    },
    {
      title: "Overdue Cases",
      value: kpi?.overdueComplaints || 0,
      sub: "Statutory SLA exceeded",
      icon: AlertCircle,
      color: "text-rose-700 font-bold",
      accent: "border-s-4 border-l-rose-600 bg-rose-50/20",
      link: "/cases?isOverdue=true"
    },
    {
      title: "Overlap Alerts",
      value: kpi?.unresolvedOverlapAlerts || 0,
      sub: "Coordination required",
      icon: GitMerge,
      color: "text-purple-900 font-bold",
      accent: "border-s-4 border-l-purple-600 bg-purple-50/20",
      link: "/overlaps?alertStatus=Pending Review"
    }
  ];

  return (
    <div className="space-y-4">
      {/* SECTION A — Simple, Clean Executive Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">{tr("navigation:dashboard")}</h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              {localizeLabel(user?.role) || tr("complaints:official")}
            </span>
            {user?.bureauId && (
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-lg bg-[#17365D] text-white">
                <bdi dir="ltr" className="canonical-value">{user.bureauId}</bdi>
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">{tr("dashboard:monitorComplaintsAndCoordinateActionsAcrossAicteBureaus")}</p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto shrink-0 text-xs">
          {lastUpdated && (
            <span className="text-xs text-[#64748B] hidden md:inline font-mono">{tr("dashboard:lastUpdated")}{lastUpdated}
            </span>
          )}

          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 rounded-lg font-semibold transition cursor-pointer disabled:opacity-50"
            title={tr("dashboard:refreshDashboardData")}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#17365D]" : ""}`} />
            <span>{refreshing ? tr("dashboard:refreshing_5b7bd") : tr("common:refresh")}</span>
          </button>


        </div>
      </div>

      {/* SECTION B — 6 Primary Role-Aware KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={() => navigate(card.link)}
              className={`bg-white border border-[#E2E8F0] rounded-lg p-3 cursor-pointer hover:border-slate-400 hover:bg-slate-50/80 transition-all ${card.accent} flex flex-col justify-between shadow-xs`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  {localizeLabel(card.title)}
                </span>
                <Icon className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-2.5">
                <div className={`text-2xl font-bold font-mono tracking-tight ${card.color}`}>
                  {formatNumber(card.value)}
                </div>
                <div className="text-xs text-[#64748B] mt-0.5 truncate font-medium">
                  {localizeLabel(card.sub)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SECTION D — RECENT COMPLAINTS REGISTER TABLE */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/80 border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">{tr("dashboard:recentComplaints")}</h2>
            <p className="text-xs text-[#64748B]">{tr("dashboard:latestGrievanceIntakeRecordsAcrossAicteDivisions")}</p>
          </div>
          <Link to="/cases" className="text-xs text-[#17365D] font-bold hover:underline flex items-center space-x-1">
            <span>{tr("dashboard:viewCompleteRegister")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-slate-700 gov-table">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3">{tr("complaints:complaintId")}</th>
                <th className="py-2.5 px-3">{tr("complaints:institutionName")}</th>
                <th className="py-2.5 px-2 text-center">{tr("dashboard:bureau")}</th>
                <th className="py-2.5 px-3">{tr("dashboard:assignedOfficer")}</th>
                <th className="py-2.5 px-2 text-center">{tr("complaints:status_bae7d")}</th>
                <th className="py-2.5 px-2 text-center">{tr("complaints:priority")}</th>
                <th className="py-2.5 px-3">{tr("dashboard:dueDate")}</th>
                <th className="py-2.5 px-3 text-end">{tr("dashboard:action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] bg-white">
              {recentComplaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-700 text-xs">No complaints recorded yet.</div>
                      <div className="text-xs text-slate-400">Grievance intake records will be displayed here in real time as complaints are filed.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                recentComplaints.slice(0, 6).map((c: Complaint) => {
                  const daysDiff = getDaysDiff(c.expectedDisposalDate);
                  const isOverdue = ["Pending", "Under Process", "Escalated"].includes(c.status) && daysDiff > 0;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/cases/${c.id}`)}
                      className="hover:bg-slate-50 transition cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-[#17365D] whitespace-nowrap">
                        <bdi dir="ltr" className="canonical-value">{c.complaintId}</bdi>
                      </td>
                      <td className="py-2.5 px-3 max-w-[220px] truncate font-medium text-slate-900">
                        <bdi dir="auto" className="original-content">{c.institutionName}</bdi>
                      </td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                          <bdi dir="ltr" className="canonical-value">{c.currentBureauId}</bdi>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[160px] truncate text-slate-600 text-xs">
                        {c.assignedOfficerName || tr("dashboard:unassigned")}
                      </td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${
                            c.status === "Pending"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : c.status === "Under Process"
                              ? "bg-blue-50 text-blue-800 border-blue-300"
                              : c.status === "Disposed"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : c.status === "Escalated"
                              ? "bg-rose-50 text-rose-800 border-rose-300"
                              : "bg-purple-50 text-purple-800 border-purple-300"
                          }`}
                        >
                          {localizeLabel(c.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold px-1.5 py-0.5 rounded-lg ${
                            c.priority === "Critical"
                              ? "text-rose-800 bg-rose-50 border border-rose-200 font-bold"
                              : c.priority === "High"
                              ? "text-amber-800 bg-amber-50 border border-amber-200 font-semibold"
                              : "text-slate-600 bg-slate-100"
                          }`}
                        >
                          {localizeLabel(c.priority)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs whitespace-nowrap">
                        {isOverdue ? (
                          <span className="text-rose-700 font-bold">
                            {formatDate(c.expectedDisposalDate)}{tr("dashboard:overdue")}</span>
                        ) : (
                          <span className="text-slate-600">{formatDate(c.expectedDisposalDate)}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-end whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <Link
                          to={`/cases/${c.id}`}
                          className="px-2.5 py-1 bg-white hover:bg-[#17365D] hover:text-white text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
                        >{tr("complaints:inspect")}</Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION E — BUREAU WORKLOAD & STATUS ANALYTICS (All Charts Preserved with Empty States) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Chart 1: Bureau Workload Distribution */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
            <div>
              <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">{tr("dashboard:bureauDivisionWorkloadDistribution")}</h2>
              <p className="text-xs text-[#64748B]">{tr("dashboard:activeVsDisposedComplaintsAcrossRegulatoryDivisions")}</p>
            </div>
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">
              {data?.bureauWorkload?.length || 5}{tr("dashboard:bureaus")}</span>
          </div>
          {(!data?.kpi?.totalComplaints) ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500 bg-slate-50/50 rounded border border-dashed border-slate-200">
              No complaints recorded yet. Workload distribution will populate as cases are logged across bureaus.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.bureauWorkload || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="bureau" tick={{ fontSize: 11, fill: "#475569" }} />
                  <YAxis tickFormatter={(value:any)=>formatNumber(value)} tick={{ fontSize: 11, fill: "#475569" }} />
                  <Tooltip formatter={(value:any,name:any)=>[typeof value==="number"?formatNumber(value):value,localizeLabel(name)]} labelFormatter={(label:any)=>localizeLabel(label)}
                    contentStyle={{ backgroundColor: "#ffffff", borderColor: "#CBD5E1", borderRadius: "2px", fontSize: "11px" }}
                  />
                  <Legend formatter={(value:any)=>localizeLabel(value)} wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                  <Bar dataKey="active" name={tr("dashboard:activeCases")} fill="#17365D" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="disposed" name={tr("dashboard:disposedCases")} fill="#16A34A" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Status Distribution Ratio */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-xs">
          <div className="pb-2 mb-3 border-b border-slate-200">
            <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">{tr("dashboard:complaintStatusRatio")}</h2>
            <p className="text-xs text-[#64748B]">{tr("dashboard:breakdownByResolutionLifecycleStage")}</p>
          </div>
          {(!data?.kpi?.totalComplaints) ? (
            <div className="h-44 flex items-center justify-center text-xs text-slate-500 bg-slate-50/50 rounded border border-dashed border-slate-200">
              No complaints recorded yet.
            </div>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.statusDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={68}
                      paddingAngle={2}
                      dataKey="count"
                    >
                      {(data?.statusDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value:any,name:any)=>[typeof value==="number"?formatNumber(value):value,localizeLabel(name)]} labelFormatter={(label:any)=>localizeLabel(label)} contentStyle={{ borderRadius: "2px", fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 text-xs">
                {data?.statusDistribution.map((s, i) => (
                  <div key={i} className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-lg shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-slate-600 truncate">{localizeLabel(s.name)}:</span>
                    <span className="font-semibold text-slate-800 font-mono">{formatNumber(s.count)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart 3 & 4: Monthly Trends & Ageing Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Monthly Trend */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
            <div>
              <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">{tr("dashboard:monthlyIntakeVsDisposalVelocity")}</h2>
              <p className="text-xs text-[#64748B]">{tr("dashboard:6MonthHistoricalIntakeVelocityComparedToResolutionTurnaround")}</p>
            </div>
          </div>
          {(!data?.kpi?.totalComplaints) ? (
            <div className="h-52 flex items-center justify-center text-xs text-slate-500 bg-slate-50/50 rounded border border-dashed border-slate-200">
              No complaint intake records yet for historical trend analysis.
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.monthlyTrends || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#475569" }} />
                  <YAxis tickFormatter={(value:any)=>formatNumber(value)} tick={{ fontSize: 11, fill: "#475569" }} />
                  <Tooltip formatter={(value:any,name:any)=>[typeof value==="number"?formatNumber(value):value,localizeLabel(name)]} labelFormatter={(label:any)=>localizeLabel(label)} contentStyle={{ borderRadius: "2px", fontSize: "11px" }} />
                  <Legend formatter={(value:any)=>localizeLabel(value)} wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} />
                  <Line type="monotone" dataKey="filed" name={tr("dashboard:complaintsFiled")} stroke="#17365D" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="disposed" name={tr("dashboard:complaintsDisposed")} stroke="#16A34A" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Case Ageing */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-xs">
          <div className="pb-2 mb-3 border-b border-slate-200">
            <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">{tr("dashboard:pendingCaseAgeing")}</h2>
            <p className="text-xs text-[#64748B]">{tr("dashboard:daysActiveComplaintsHaveBeenPending")}</p>
          </div>
          {(!data?.kpi?.totalComplaints) ? (
            <div className="h-52 flex items-center justify-center text-xs text-slate-500 bg-slate-50/50 rounded border border-dashed border-slate-200">
              No active cases awaiting disposal.
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.caseAgeing || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#475569" }} />
                  <YAxis tickFormatter={(value:any)=>formatNumber(value)} tick={{ fontSize: 10, fill: "#475569" }} />
                  <Tooltip formatter={(value:any,name:any)=>[typeof value==="number"?formatNumber(value):value,localizeLabel(name)]} labelFormatter={(label:any)=>localizeLabel(label)} contentStyle={{ borderRadius: "2px", fontSize: "11px" }} />
                  <Bar dataKey="count" name={tr("dashboard:cases")} fill="#b45309" radius={[2, 2, 0, 0]}>
                    {(data?.caseAgeing || []).map((entry, index) => (
                      <Cell key={`age-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverviewDashboard;
