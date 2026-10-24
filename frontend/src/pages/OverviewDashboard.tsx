import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Flame,
  GitMerge,
  TrendingUp,
  Building,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ArrowUpRight
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
import { DashboardAnalytics } from "../services/types.js";

export const OverviewDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboardAnalytics();
      setData(res);
    } catch (err) {
      console.error("Dashboard load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-8 h-8 text-aicte-navy-700 animate-spin" />
          <span className="text-sm font-medium text-slate-600">Loading Centralized AICTE Dashboard...</span>
        </div>
      </div>
    );
  }

  const kpi = data?.kpi;

  const statCards = [
    {
      title: "Total Complaints",
      value: kpi?.totalComplaints || 0,
      icon: FileText,
      color: "text-slate-800",
      bg: "bg-white",
      border: "border-slate-200",
      link: "/cases"
    },
    {
      title: "Pending Cases",
      value: kpi?.pendingComplaints || 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-white",
      border: "border-amber-200",
      link: "/cases?status=Pending"
    },
    {
      title: "Under Process",
      value: kpi?.underProcessComplaints || 0,
      icon: RefreshCw,
      color: "text-blue-600",
      bg: "bg-white",
      border: "border-blue-200",
      link: "/cases?status=Under Process"
    },
    {
      title: "Disposed / Resolved",
      value: kpi?.disposedComplaints || 0,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-white",
      border: "border-emerald-200",
      link: "/cases?status=Disposed",
      sub: `${kpi?.disposalRatePercentage || 0}% resolution rate`
    },
    {
      title: "Transferred Cases",
      value: kpi?.transferredComplaints || 0,
      icon: ArrowRightLeft,
      color: "text-purple-600",
      bg: "bg-white",
      border: "border-purple-200",
      link: "/cases?status=Transferred"
    },
    {
      title: "Escalated Cases",
      value: kpi?.escalatedComplaints || 0,
      icon: Flame,
      color: "text-rose-600",
      bg: "bg-white",
      border: "border-rose-200",
      link: "/cases?status=Escalated"
    },
    {
      title: "Overdue Complaints",
      value: kpi?.overdueComplaints || 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50/40",
      border: "border-red-300",
      link: "/cases?isOverdue=true",
      sub: "SLA Deadline Breached"
    },
    {
      title: "Unresolved Overlaps",
      value: kpi?.unresolvedOverlapAlerts || 0,
      icon: GitMerge,
      color: "text-amber-600",
      bg: "bg-amber-50/40",
      border: "border-amber-300",
      link: "/overlaps?alertStatus=Pending Review",
      sub: "Immediate Review Required"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-aicte-navy-900 tracking-tight">
            Centralized Grievance & Institution Status Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time cross-Bureau case tracking, statutory oversight, and AI-assisted duplicate & overlap detection.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchDashboardData}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium transition shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Metrics</span>
          </button>
          <Link
            to="/complaints/register"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-aicte-navy-900 hover:bg-aicte-navy-800 text-white rounded-md text-xs font-medium transition shadow-xs"
          >
            <span>+ Register Complaint</span>
          </Link>
        </div>
      </div>

      {/* 8 Clickable KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={() => navigate(card.link)}
              className={`${card.bg} border ${card.border} rounded-lg p-3.5 sm:p-4 hover:shadow-md cursor-pointer transition flex flex-col justify-between group`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 group-hover:text-aicte-navy-900 transition">
                  {card.title}
                </span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="mt-2.5">
                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                {card.sub ? (
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">{card.sub}</div>
                ) : (
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-0.5 group-hover:text-blue-600">
                    <span>View Cases</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 1 Charts: Bureau Workload & Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bureau-wise Workload (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bureau & Cell Case Distribution</h3>
              <p className="text-xs text-slate-500">Active vs Disposed complaints across regulatory divisions</p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded">
              5 Divisions
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.bureauWorkload || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="bureau" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "6px", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Bar dataKey="active" name="Active Cases" fill="#0f2942" radius={[4, 4, 0, 0]} />
                <Bar dataKey="disposed" name="Disposed Cases" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Complaint Status Distribution (1 col) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Status Breakdown</h3>
            <p className="text-xs text-slate-500">Proportion of grievances across lifecycle</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.statusDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="count"
                >
                  {(data?.statusDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "6px", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
            {data?.statusDistribution.map((s, i) => (
              <div key={i} className="flex items-center space-x-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-slate-600 truncate">{s.name}:</span>
                <span className="font-semibold text-slate-800">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Monthly Trends & Case Ageing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Area/Line Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Registration vs Disposal Rate</h3>
              <p className="text-xs text-slate-500">Intake velocity compared to resolution turnaround (Last 6 Months)</p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span className="inline-block w-2.5 h-0.5 bg-blue-600"></span>
              <span>Filed</span>
              <span className="inline-block w-2.5 h-0.5 bg-emerald-600"></span>
              <span>Disposed</span>
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlyTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: "6px", fontSize: "12px" }} />
                <Line type="monotone" dataKey="filed" name="Complaints Filed" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="disposed" name="Complaints Disposed" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Case Ageing distribution */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Case Ageing Analysis</h3>
            <p className="text-xs text-slate-500">Days active complaints have been pending resolution</p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.caseAgeing || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: "6px", fontSize: "12px" }} />
                <Bar dataKey="count" name="Cases" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  {(data?.caseAgeing || []).map((entry, index) => (
                    <Cell key={`age-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Critical Overlap Alerts Panel & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Overlap Alerts */}
        <div className="bg-white border border-amber-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-amber-100 text-amber-700 rounded">
                <GitMerge className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Critical Cross-Bureau Overlaps</h3>
                <p className="text-xs text-slate-500">High-confidence potential duplicates flagged across divisions</p>
              </div>
            </div>
            <Link to="/overlaps" className="text-xs text-blue-600 font-semibold hover:underline">
              View All ({data?.criticalAlerts.length}) &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {data?.criticalAlerts && data.criticalAlerts.length > 0 ? (
              data.criticalAlerts.map(alert => (
                <div
                  key={alert.id}
                  onClick={() => navigate(`/overlaps`)}
                  className="p-3.5 bg-amber-50/50 border border-amber-200/80 rounded-md hover:bg-amber-100/50 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-amber-900">{alert.alertId}</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                      Match: {alert.ruleMatchScore}%
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-1 truncate">
                    {alert.institutionName}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    <span className="font-medium text-blue-800">{alert.bureauA}</span> ({alert.complaintRefA}) ⚡{" "}
                    <span className="font-medium text-purple-800">{alert.bureauB}</span> ({alert.complaintRefB})
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 italic line-clamp-1">
                    "{alert.recommendedAction}"
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">No pending critical overlap alerts</div>
            )}
          </div>
        </div>

        {/* Recent Case Activity Audit Feed */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Recent Regulatory Actions</h3>
            <Link to="/cases" className="text-xs text-blue-600 font-semibold hover:underline">
              All Activity &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {data?.recentActivity.map((act, i) => (
              <div key={i} className="py-2.5 flex items-start space-x-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-aicte-navy-700 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{act.actionType}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(act.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-slate-600 text-[11px] mt-0.5">{act.remarks}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Officer: <span className="font-medium text-slate-600">{act.performedByName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
