import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Printer,
  BarChart3,
  Filter,
  FileSpreadsheet,
  PieChart as PieIcon,
  HelpCircle,
  TrendingUp,
  ShieldCheck,
  Building,
  RefreshCw,
  Clock,
  GitMerge,
  AlertTriangle,
  CheckCircle2,
  Calendar
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { api } from "../services/api.js";
import { DashboardAnalytics } from "../services/types.js";

export const ReportsAnalytics: React.FC = () => {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [selectedBureau, setSelectedBureau] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dash, rep] = await Promise.all([
        api.getDashboardAnalytics(),
        api.getPerformanceReport({ period: selectedPeriod, bureau: selectedBureau })
      ]);
      setData(dash);
      setReport(rep);
    } catch (err) {
      console.error("Failed to load reports and analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod, selectedBureau]);

  const handleExportCsv = () => {
    const filters: Record<string, string> = {};
    if (selectedBureau) filters.bureau = selectedBureau;
    const url = api.getExportCsvUrl(filters);
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  const kpi = report?.kpi || data?.kpi;
  const COLORS = ["#0f2942", "#2563eb", "#0d9488", "#f59e0b", "#8b5cf6", "#ec4899"];
  const OVERLAP_COLORS: Record<string, string> = {
    "Pending Review": "#f59e0b",
    "Confirmed Related": "#2563eb",
    "Confirmed Duplicate": "#7c3aed",
    "Marked Unrelated": "#94a3b8",
    "Resolved": "#10b981"
  };

  return (
    <div className="space-y-4 print:space-y-4">
      {/* Official Header */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#003366]">Government of India &bull; AICTE Grievance Intelligence</div>
          <h1 className="text-base sm:text-lg font-bold text-[#002147] tracking-tight">
            Statutory Reports & Regulatory Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Inter-Bureau resolution performance, institutional compliance scoring, and cross-bureau overlap audit ledger.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#cbd5e1] hover:bg-slate-50 text-slate-700 rounded-xs text-xs font-semibold shadow-none transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Dossier (PDF)</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs text-xs font-semibold shadow-none transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Official Ledger (CSV)</span>
          </button>
        </div>
      </div>

      {/* Filter and Period Selection Toolbar */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-3 shadow-none flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-semibold">
            <Filter className="w-3.5 h-3.5 text-[#003366]" />
            <span>Statutory Period:</span>
          </div>
          <div className="flex items-center space-x-1 bg-[#f1f5f9] p-0.5 rounded-xs text-xs border border-[#cbd5e1]">
            {[
              { id: "all", label: "All Records" },
              { id: "30d", label: "Past 30 Days" },
              { id: "90d", label: "Past 90 Days" },
              { id: "q1", label: "Q1 2026" }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-2.5 py-1 rounded-xs font-medium transition cursor-pointer ${
                  selectedPeriod === p.id
                    ? "bg-[#003366] text-white font-bold"
                    : "text-slate-700 hover:text-black"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 pl-3 border-l border-[#cbd5e1]">
            <span className="text-xs text-slate-600 font-semibold">Bureau Filter:</span>
            <select
              value={selectedBureau}
              onChange={e => setSelectedBureau(e.target.value)}
              className="bg-white border border-[#cbd5e1] rounded-xs px-2.5 py-1 text-xs focus:border-[#003366] focus:outline-none"
            >
              <option value="">All AICTE Bureaus</option>
              <option value="RB">Regulation Bureau (RB)</option>
              <option value="PGRC">Public Grievance Redressal Cell (PGRC)</option>
              <option value="RO">Regional Offices (RO)</option>
              <option value="AB">Approval Bureau (AB)</option>
              <option value="PB">Policy & Academic Bureau (PB)</option>
            </select>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs text-[#003366] hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Synchronize Data</span>
        </button>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-white border border-[#cbd5e1] rounded-xs p-3 shadow-none">
          <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Total Grievances</span>
          <span className="text-xl font-bold text-[#002147] font-mono mt-1 block">
            {kpi?.totalComplaints || 0}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Recorded in scope</span>
        </div>

        <div className="bg-white border border-[#bbf7d0] rounded-xs p-3 shadow-none bg-[#f0fdf4]">
          <span className="text-[10px] font-bold text-[#166534] block uppercase tracking-wider">Disposed / Resolved</span>
          <span className="text-xl font-bold text-[#15803d] font-mono mt-1 block">
            {kpi?.disposedComplaints || 0}
          </span>
          <span className="text-[10px] text-[#166534] font-semibold mt-0.5 block">
            {kpi?.disposalRatePercentage || 0}% Clearance Rate
          </span>
        </div>

        <div className="bg-white border border-[#bae6fd] rounded-xs p-3 shadow-none bg-[#f0f9ff]">
          <span className="text-[10px] font-bold text-[#0369a1] block uppercase tracking-wider">Under Process</span>
          <span className="text-xl font-bold text-[#0284c7] font-mono mt-1 block">
            {kpi?.underProcessComplaints || 0}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Active inquiry stages</span>
        </div>

        <div className="bg-white border border-[#fde68a] rounded-xs p-3 shadow-none bg-[#fffbeb]">
          <span className="text-[10px] font-bold text-[#92400e] block uppercase tracking-wider">Pending Initial Review</span>
          <span className="text-xl font-bold text-[#b45309] font-mono mt-1 block">
            {kpi?.pendingComplaints || 0}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Awaiting scrutiny</span>
        </div>

        <div className="bg-white border border-[#fecaca] rounded-xs p-3 shadow-none bg-[#fef2f2]">
          <span className="text-[10px] font-bold text-[#991b1b] block uppercase tracking-wider">SLA Overdue</span>
          <span className="text-xl font-bold text-[#b91c1c] font-mono mt-1 block">
            {kpi?.overdueComplaints || 0}
          </span>
          <span className="text-[10px] text-[#b91c1c] font-bold mt-0.5 block">Statutory limit exceeded</span>
        </div>

        <div className="bg-white border border-[#e9d5ff] rounded-xs p-3 shadow-none bg-[#faf5ff]">
          <span className="text-[10px] font-bold text-[#6b21a8] block uppercase tracking-wider">Overlap Alerts</span>
          <span className="text-xl font-bold text-[#7e22ce] font-mono mt-1 block">
            {kpi?.unresolvedOverlapAlerts || 0}
          </span>
          <span className="text-[10px] text-[#6b21a8] font-semibold mt-0.5 block">Pending Joint Review</span>
        </div>
      </div>

      {/* Row 1: Bureau Performance Scorecard Table */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none overflow-hidden">
        <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#cbd5e1] flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider flex items-center space-x-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[#003366]" />
              <span>AICTE Bureau & Cell Performance Scorecard</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Comparative disposal efficiency, average duration to resolve, overdue volume, and cross-bureau overlap exposure.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="gov-table w-full text-left text-xs">
            <thead>
              <tr>
                <th>Bureau / Cell</th>
                <th className="text-center">Total Intake</th>
                <th className="text-center">Active Cases</th>
                <th className="text-center">Disposed Cases</th>
                <th className="text-center">SLA Overdue</th>
                <th className="text-center">Mean Disposal Time</th>
                <th className="text-center">Clearance Rate</th>
                <th className="text-right">Cross-Bureau Overlaps</th>
              </tr>
            </thead>
            <tbody>
              {(report?.bureauPerformance || []).map((b: any) => (
                <tr key={b.bureau}>
                  <td className="font-bold text-[#002147]">
                    {b.bureau === "RB"
                      ? "Regulation Bureau (RB)"
                      : b.bureau === "PGRC"
                      ? "Public Grievance Redressal Cell (PGRC)"
                      : b.bureau === "RO"
                      ? "Regional Offices (RO)"
                      : b.bureau === "AB"
                      ? "Approval Bureau (AB)"
                      : "Policy & Academic Bureau (PB)"}
                  </td>
                  <td className="text-center font-mono font-medium text-slate-700">{b.total}</td>
                  <td className="text-center font-mono font-semibold text-[#003366]">{b.active}</td>
                  <td className="text-center font-mono font-semibold text-[#15803d]">{b.disposed}</td>
                  <td className="text-center font-mono font-bold text-[#b91c1c]">
                    {b.overdue > 0 ? (
                      <span className="bg-[#fee2e2] text-[#991b1b] border border-[#fecaca] px-1.5 py-0.2 rounded-xs">
                        {b.overdue}
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="text-center font-mono text-slate-600">
                    {b.avgDisposalDays > 0 ? `${b.avgDisposalDays} Days` : "N/A"}
                  </td>
                  <td className="text-center">
                    <span className="font-mono font-bold text-slate-800">{b.disposalRate}%</span>
                  </td>
                  <td className="text-right font-mono font-bold text-[#b45309]">
                    {b.overlapsCount} Cases
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 2: Charts Grid (Intake Velocity, Overlap Statuses) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Trend Line Chart */}
        <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
            <div>
              <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider">Intake vs Resolution Trajectory</h3>
              <p className="text-[11px] text-slate-500">Monthly grievance filings versus completed disposals</p>
            </div>
            <TrendingUp className="w-4 h-4 text-[#003366]" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlyTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line type="monotone" dataKey="filed" name="Complaints Influx" stroke="#003366" strokeWidth={2} />
                <Line type="monotone" dataKey="disposed" name="Cases Disposed" stroke="#15803d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Overlap Status Breakdown */}
        <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
            <div>
              <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider">Overlap Review Status</h3>
              <p className="text-[11px] text-slate-500">AICTE Intelligent Overlap Resolution</p>
            </div>
            <GitMerge className="w-4 h-4 text-[#b45309]" />
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={report?.overlapStatusCounts || []}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  innerRadius={30}
                  paddingAngle={2}
                >
                  {(report?.overlapStatusCounts || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={OVERLAP_COLORS[entry.status] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px] pt-2 border-t border-[#e2e8f0]">
            {(report?.overlapStatusCounts || []).map((entry: any) => (
              <div key={entry.status} className="flex items-center space-x-1.5 truncate">
                <div
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: OVERLAP_COLORS[entry.status] || "#94a3b8" }}
                />
                <span className="text-slate-600 truncate">{entry.status}:</span>
                <span className="font-bold text-slate-800">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Regional Compliance Ledger & Top Complained Institutions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Regional Compliance Ledger */}
        <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none overflow-hidden">
          <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#cbd5e1] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider">Regional Compliance Ledger</h3>
              <p className="text-[11px] text-slate-500">Case volume and clearance percentage by jurisdiction</p>
            </div>
            <Building className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="gov-table w-full text-left text-xs">
              <thead className="sticky top-0">
                <tr>
                  <th>Jurisdiction</th>
                  <th className="text-center">Total</th>
                  <th className="text-center">Active</th>
                  <th className="text-center">Disposed</th>
                  <th className="text-right">Compliance %</th>
                </tr>
              </thead>
              <tbody>
                {(report?.regionalCompliance || []).map((r: any) => (
                  <tr key={r.region}>
                    <td className="font-semibold text-slate-800">{r.region}</td>
                    <td className="text-center text-slate-700">{r.total}</td>
                    <td className="text-center font-semibold text-[#003366]">{r.active}</td>
                    <td className="text-center font-semibold text-[#15803d]">{r.disposed}</td>
                    <td className="text-right font-mono font-bold text-slate-900">
                      {r.complianceRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Complained Technical Institutions */}
        <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none overflow-hidden">
          <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#cbd5e1] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider">High Influx Technical Institutions</h3>
              <p className="text-[11px] text-slate-500">Institutions requiring supervisory oversight</p>
            </div>
            <AlertTriangle className="w-3.5 h-3.5 text-[#b45309]" />
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="gov-table w-full text-left text-xs">
              <thead className="sticky top-0">
                <tr>
                  <th>Institution Name</th>
                  <th className="text-center">Total Cases</th>
                  <th className="text-center">Active Cases</th>
                  <th className="text-right">Overlaps</th>
                </tr>
              </thead>
              <tbody>
                {(report?.topInstitutions || []).map((inst: any, idx: number) => (
                  <tr key={idx}>
                    <td className="font-medium text-slate-800 truncate max-w-[200px]">
                      <span className="block truncate font-semibold text-[#003366]">{inst.name}</span>
                      <span className="text-[10px] font-mono text-slate-500">{inst.permId}</span>
                    </td>
                    <td className="text-center font-bold text-slate-900 font-mono">{inst.total}</td>
                    <td className="text-center font-semibold text-[#003366] font-mono">{inst.active}</td>
                    <td className="text-right font-mono font-bold">
                      {inst.overlapCount > 0 ? (
                        <span className="bg-[#fffbeb] text-[#92400e] border border-[#fde68a] px-1.5 py-0.2 rounded-xs text-[10px]">
                          {inst.overlapCount} Overlaps
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
