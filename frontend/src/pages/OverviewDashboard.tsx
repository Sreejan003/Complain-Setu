import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  GitMerge,
  Building,
  RefreshCw,
  ExternalLink,
  Shield,
  ArrowRight,
  AlertCircle
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
import { DashboardAnalytics, Complaint } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

export const OverviewDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [recentComplaints, setRecentComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [res, compRes] = await Promise.all([
        api.getDashboardAnalytics(),
        api.getComplaints({ limit: 6, sortBy: "receivedDate", sortOrder: "desc" })
      ]);
      setData(res);
      setRecentComplaints(compRes.data || []);
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
        <div className="flex flex-col items-center space-y-2">
          <RefreshCw className="w-6 h-6 text-[#003366] animate-spin" />
          <span className="text-xs font-semibold text-slate-600">Loading Centralized Dashboard Data...</span>
        </div>
      </div>
    );
  }

  const kpi = data?.kpi;

  const statCards = [
    {
      title: "Total Grievances",
      value: kpi?.totalComplaints || 0,
      sub: "Cumulative across all bureaus",
      icon: FileText,
      color: "text-slate-900",
      accent: "border-l-4 border-l-[#003366]",
      link: "/cases"
    },
    {
      title: "Pending Intake",
      value: kpi?.pendingComplaints || 0,
      sub: "Awaiting initial bureau allocation",
      icon: Clock,
      color: "text-amber-700",
      accent: "border-l-4 border-l-amber-500",
      link: "/cases?status=Pending"
    },
    {
      title: "Under Process",
      value: kpi?.underProcessComplaints || 0,
      sub: "Active bureau investigations",
      icon: RefreshCw,
      color: "text-blue-700",
      accent: "border-l-4 border-l-blue-600",
      link: "/cases?status=Under%20Process"
    },
    {
      title: "Disposed / Resolved",
      value: kpi?.disposedComplaints || 0,
      sub: "Disposal orders issued",
      icon: CheckCircle2,
      color: "text-emerald-700",
      accent: "border-l-4 border-l-emerald-600",
      link: "/cases?status=Disposed"
    },
    {
      title: "Overdue Statutory SLA",
      value: kpi?.overdueComplaints || 0,
      sub: "Statutory deadline exceeded",
      icon: AlertCircle,
      color: "text-red-700 font-bold",
      accent: "border-l-4 border-l-red-600 bg-red-50/30",
      link: "/cases?isOverdue=true"
    },
    {
      title: "Cross-Bureau Overlaps",
      value: kpi?.unresolvedOverlapAlerts || 0,
      sub: "Coordination alerts active",
      icon: GitMerge,
      color: "text-amber-800",
      accent: "border-l-4 border-l-amber-600 bg-amber-50/30",
      link: "/overlaps?alertStatus=Pending Review"
    }
  ];

  return (
    <div className="space-y-4">
      {/* 1. Official Breadcrumb & Context */}
      <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 font-medium">
        <span>Home</span>
        <span>&rsaquo;</span>
        <span>Executive Overview</span>
        <span>&rsaquo;</span>
        <span className="text-slate-700 font-semibold">Centralized Monitoring Dashboard</span>
      </div>

      {/* 2. Official Page Heading & Action Toolbar */}
      <div className="bg-white border border-slate-300 rounded-xs p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-[#003366] tracking-tight">
            Centralized Grievance & Statutory Compliance Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time tracking of AICTE technical institution grievances, inter-bureau coordination, and statutory SLA enforcement.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xs text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <Link
            to="/complaints/register"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#003366] hover:bg-[#002855] text-white text-xs font-semibold rounded-xs border border-[#002147] transition shadow-xs cursor-pointer"
          >
            <span>+ Register Complaint</span>
          </Link>
        </div>
      </div>

      {/* 3. Restrained Coordination Alert (When Overlaps Exist) */}
      {(kpi?.unresolvedOverlapAlerts || 0) > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xs p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider text-[11px] text-amber-800">
                Inter-Bureau Coordination Notice:
              </span>{" "}
              <span>
                <strong>{kpi?.unresolvedOverlapAlerts} potential duplicate / companion case(s)</strong> are currently under investigation across multiple AICTE divisions (RB, PGRC, RO). Please review in Overlap Center to coordinate disposal orders.
              </span>
            </div>
          </div>
          <Link
            to="/overlaps?alertStatus=Pending Review"
            className="inline-flex items-center space-x-1 px-3 py-1 bg-white border border-amber-400 hover:bg-amber-100/70 text-amber-900 text-xs font-bold rounded-xs shrink-0 self-start sm:self-auto"
          >
            <span>Review Overlaps</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* 4. Compact 6-Metric Government Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={() => navigate(card.link)}
              className={`bg-white border border-slate-300 rounded-xs p-3 cursor-pointer hover:bg-slate-50 transition ${card.accent} flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  {card.title}
                </span>
                <Icon className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="mt-2">
                <div className={`text-xl font-bold font-mono ${card.color}`}>
                  {card.value}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate font-medium">
                  {card.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Bureau Distribution & Status Ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Bureau-wise Workload */}
        <div className="lg:col-span-2 bg-white border border-slate-300 rounded-xs p-3.5">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Bureau & Division Workload Distribution
              </h2>
              <p className="text-[11px] text-slate-500">Active vs Disposed grievances across regulatory divisions</p>
            </div>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-xs border border-slate-200">
              5 DIVISIONS
            </span>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.bureauWorkload || []} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="bureau" tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "2px", fontSize: "11px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                <Bar dataKey="active" name="Active Cases" fill="#003366" radius={[2, 2, 0, 0]} />
                <Bar dataKey="disposed" name="Disposed Cases" fill="#15803d" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white border border-slate-300 rounded-xs p-3.5">
          <div className="pb-2 mb-3 border-b border-slate-200">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Grievance Status Ratio
            </h2>
            <p className="text-[11px] text-slate-500">Breakdown by current resolution lifecycle state</p>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.statusDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="count"
                >
                  {(data?.statusDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "2px", fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 text-[11px]">
            {data?.statusDistribution.map((s, i) => (
              <div key={i} className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-slate-600 truncate">{s.name}:</span>
                <span className="font-semibold text-slate-800 font-mono">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Monthly Filing & Resolution Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <div className="lg:col-span-2 bg-white border border-slate-300 rounded-xs p-3.5">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Monthly Intake vs Disposal Velocity
              </h2>
              <p className="text-[11px] text-slate-500">6-Month historical intake velocity compared to resolution turnaround</p>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlyTrends || []} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
                <Tooltip contentStyle={{ borderRadius: "2px", fontSize: "11px" }} />
                <Line type="monotone" dataKey="filed" name="Complaints Filed" stroke="#003366" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="disposed" name="Complaints Disposed" stroke="#15803d" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-xs p-3.5">
          <div className="pb-2 mb-3 border-b border-slate-200">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Pending Case Ageing
            </h2>
            <p className="text-[11px] text-slate-500">Days active complaints have been pending</p>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.caseAgeing || []} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
                <Tooltip contentStyle={{ borderRadius: "2px", fontSize: "11px" }} />
                <Bar dataKey="count" name="Cases" fill="#b45309" radius={[2, 2, 0, 0]}>
                  {(data?.caseAgeing || []).map((entry, index) => (
                    <Cell key={`age-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 7. Recent Grievances Log */}
      <div className="bg-white border border-slate-300 rounded-xs overflow-hidden">
        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Recent Grievance Intake & Regulatory Log
          </h2>
          <Link to="/cases" className="text-xs text-[#003366] font-semibold hover:underline">
            View Complete Register &rarr;
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 gov-table">
            <thead>
              <tr>
                <th className="py-2 px-3">Complaint ID</th>
                <th className="py-2 px-3">Institution Name</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-2 text-center">Bureau</th>
                <th className="py-2 px-2.5 text-center">Status</th>
                <th className="py-2 px-2.5 text-center">Priority</th>
                <th className="py-2 px-3">Received Date</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {recentComplaints.slice(0, 6).map((c: Complaint) => (
                <tr key={c.id} className="hover:bg-slate-50 transition">
                  <td className="py-2 px-3 font-mono font-bold text-[#003366] whitespace-nowrap">
                    <Link to={`/cases/${c.id}`} className="hover:underline">
                      {c.complaintId}
                    </Link>
                  </td>
                  <td className="py-2 px-3 max-w-[200px] truncate font-medium text-slate-800">
                    {c.institutionName}
                  </td>
                  <td className="py-2 px-3 max-w-[180px] truncate text-slate-600 text-[11px]">
                    {c.category}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-slate-100 text-slate-700 border border-slate-200">
                      {c.currentBureauId}
                    </span>
                  </td>
                  <td className="py-2 px-2.5 text-center">
                    <span
                      className={`px-1.5 py-0.2 rounded-xs text-[10px] font-semibold border ${
                        c.status === "Pending"
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : c.status === "Under Process"
                          ? "bg-blue-50 text-blue-800 border-blue-300"
                          : "bg-emerald-50 text-emerald-800 border-emerald-300"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 px-2.5 text-center">
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-xs ${
                        c.priority === "Critical"
                          ? "text-red-700 bg-red-50 border border-red-200 font-bold"
                          : "text-slate-600 bg-slate-100"
                      }`}
                    >
                      {c.priority}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {c.receivedDate}
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <Link
                      to={`/cases/${c.id}`}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-[#003366] hover:text-white text-slate-700 rounded-xs text-[11px] font-semibold border border-slate-300 transition"
                    >
                      Inspect
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
