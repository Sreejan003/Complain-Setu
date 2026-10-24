import React, { useState, useEffect } from "react";
import {
  Download,
  BarChart3,
  Filter,
  FileSpreadsheet,
  PieChart as PieIcon,
  HelpCircle,
  TrendingUp,
  ShieldCheck,
  Building,
  RefreshCw
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
  const [loading, setLoading] = useState(true);
  const [selectedBureau, setSelectedBureau] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboardAnalytics();
      setData(res);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExportCsv = () => {
    const filters: Record<string, string> = {};
    if (selectedBureau) filters.bureau = selectedBureau;
    if (selectedStatus) filters.status = selectedStatus;
    const url = api.getExportCsvUrl(filters);
    window.open(url, "_blank");
  };

  const kpi = data?.kpi;
  const COLORS = ["#0f2942", "#2563eb", "#0d9488", "#f59e0b", "#8b5cf6", "#ec4899"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-aicte-navy-900 tracking-tight">
            Statutory Reports & Regulatory Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Institutional grievance disposal trends, regional distribution, and cross-bureau overlap performance metrics.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-semibold shadow-xs transition self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Official Ledger (CSV)</span>
        </button>
      </div>

      {/* Metric Definitions & Formulas Accordion / Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-2">
        <div className="flex items-center space-x-1.5 font-bold text-slate-800">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span>Regulatory Metric Definitions & SLA Mathematical Formulations</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-600 pt-1">
          <div className="bg-white p-2.5 rounded border border-slate-200/80">
            <strong className="text-slate-800 block">Disposal Resolution Rate:</strong>
            <code className="text-[11px] text-blue-700 font-mono">
              (Disposed Complaints ÷ Total Grievances) × 100
            </code>
            <span className="block text-[10px] text-slate-500 mt-0.5">Currently at {kpi?.disposalRatePercentage || 0}% across all divisions.</span>
          </div>
          <div className="bg-white p-2.5 rounded border border-slate-200/80">
            <strong className="text-slate-800 block">SLA Overdue Calculation:</strong>
            <code className="text-[11px] text-red-700 font-mono">
              Today &gt; Expected Disposal Date & Status ∈ {'{Pending, Under Process}'}
            </code>
            <span className="block text-[10px] text-slate-500 mt-0.5">Critical (7d), High (15d), Medium (30d), Low (45d).</span>
          </div>
          <div className="bg-white p-2.5 rounded border border-slate-200/80">
            <strong className="text-slate-800 block">Cross-Bureau Overlap Index:</strong>
            <code className="text-[11px] text-amber-700 font-mono">
              (0.6 × Rule Score) + (0.4 × Semantic Cosine Score)
            </code>
            <span className="block text-[10px] text-slate-500 mt-0.5">Threshold: 50% Rule or 65% Semantic embeddings.</span>
          </div>
        </div>
      </div>

      {/* Row 1: Region-wise Distribution & Ageing Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Region Distribution */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Regional Jurisdiction Breakdown</h3>
              <p className="text-xs text-slate-500">Distribution across 8 AICTE Regional Offices</p>
            </div>
            <Building className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.regionDistribution || []}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="region" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip />
                <Bar dataKey="count" name="Total Cases" fill="#0f2942" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Case Ageing */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Active Case Ageing Timeline</h3>
              <p className="text-xs text-slate-500">Pending duration tracking against statutory standards</p>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.caseAgeing || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Active Cases" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {(data?.caseAgeing || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Bureau Workload & Monthly Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bureau Workload Detailed Table */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Bureau & Cell Performance Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Bureau</th>
                  <th className="py-2.5 px-3 text-center">Total</th>
                  <th className="py-2.5 px-3 text-center">Active</th>
                  <th className="py-2.5 px-3 text-center">Disposed</th>
                  <th className="py-2.5 px-3 text-right">Clearance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.bureauWorkload.map(b => {
                  const rate = b.total > 0 ? Math.round((b.disposed / b.total) * 100) : 0;
                  return (
                    <tr key={b.bureau} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-aicte-navy-900">{b.bureau}</td>
                      <td className="py-2.5 px-3 text-center text-slate-700">{b.total}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-amber-700">{b.active}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-emerald-700">{b.disposed}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Trend Area Chart */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3">6-Month Influx vs Resolution Velocity</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlyTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line type="monotone" dataKey="filed" name="New Grievances" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="disposed" name="Disposed Cases" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
