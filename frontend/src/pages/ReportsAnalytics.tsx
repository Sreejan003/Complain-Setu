import { tr, localizeLabel, localizeError, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
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
  useLocaleRender();
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

  const handleExportCsv = async () => {
    const filters: Record<string, string> = {};
    if (selectedBureau) filters.bureau = selectedBureau;
    try { await api.downloadCsv(filters); } catch(error:any) { window.alert(localizeError(error.message)); }
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
      <div className="page-header">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700">{tr("reports:governmentOfIndiaAicteGrievanceIntelligence")}</div>
          <h1 className="text-base sm:text-lg font-bold text-aicte-navy-900 tracking-tight">{tr("navigation:reportsAnalytics")}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{tr("reports:interBureauResolutionPerformanceInstitutionalComplianceScoringAndCross")}</p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#e5eaf0] hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-none transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>{tr("reports:printDossierPdf")}</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg text-xs font-semibold shadow-none transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{tr("reports:exportOfficialLedgerCsv")}</span>
          </button>
        </div>
      </div>

      {/* Filter and Period Selection Toolbar */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg p-3 shadow-none flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-semibold">
            <Filter className="w-3.5 h-3.5 text-aicte-navy-700" />
            <span>{tr("reports:statutoryPeriod")}</span>
          </div>
          <div className="flex items-center space-x-1 bg-[#f1f5f9] p-0.5 rounded-lg text-xs border border-[#e5eaf0]">
            {[
              { id: "all", label: "All Records" },
              { id: "30d", label: "Past 30 Days" },
              { id: "90d", label: "Past 90 Days" },
              { id: "q1", label: "Q1 2026" }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  selectedPeriod === p.id
                    ? "bg-aicte-navy-700 text-white font-bold"
                    : "text-slate-700 hover:text-black"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 ps-3 border-l border-[#e5eaf0]">
            <span className="text-xs text-slate-600 font-semibold">{tr("reports:bureauFilter")}</span>
            <select
              aria-label={tr("reports:bureauFilter")} value={selectedBureau}
              onChange={e => setSelectedBureau(e.target.value)}
              className="bg-white border border-[#e5eaf0] rounded-lg px-2.5 py-1 text-xs focus:border-[#003366] focus:outline-none"
            >
              <option value="">{tr("reports:allAicteBureaus")}</option>
              <option value="RB">{tr("complaints:regulationBureauRb")}</option>
              <option value="PGRC">{tr("complaints:publicGrievanceRedressalCellPgrc")}</option>
              <option value="RO">{tr("complaints:regionalOfficesRo")}</option>
              <option value="AB">{tr("complaints:approvalBureauAb")}</option>
              <option value="PB">{tr("complaints:policyAcademicBureauPb")}</option>
            </select>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs text-aicte-navy-700 hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>{tr("reports:synchronizeData")}</span>
        </button>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-white border border-[#e5eaf0] rounded-lg p-3 shadow-none">
          <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">{tr("reports:totalGrievances")}</span>
          <span className="text-xl font-bold text-aicte-navy-900 font-mono mt-1 block">
            {formatNumber(kpi?.totalComplaints) || 0}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">{tr("reports:recordedInScope")}</span>
        </div>

        <div className="bg-white border border-[#bbf7d0] rounded-lg p-3 shadow-none bg-[#f0fdf4]">
          <span className="text-xs font-bold text-[#166534] block uppercase tracking-wider">{tr("reports:disposedResolved")}</span>
          <span className="text-xl font-bold text-[#15803d] font-mono mt-1 block">
            {formatNumber(kpi?.disposedComplaints) || 0}
          </span>
          <span className="text-xs text-[#166534] font-semibold mt-0.5 block">
            {formatNumber(kpi?.disposalRatePercentage) || 0}{tr("reports:clearanceRate")}</span>
        </div>

        <div className="bg-white border border-[#bae6fd] rounded-lg p-3 shadow-none bg-[#f0f9ff]">
          <span className="text-xs font-bold text-[#0369a1] block uppercase tracking-wider">{tr("complaints:status.underProcess")}</span>
          <span className="text-xl font-bold text-[#0284c7] font-mono mt-1 block">
            {formatNumber(kpi?.underProcessComplaints) || 0}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">{tr("reports:activeInquiryStages")}</span>
        </div>

        <div className="bg-white border border-[#fde68a] rounded-lg p-3 shadow-none bg-[#fffbeb]">
          <span className="text-xs font-bold text-[#92400e] block uppercase tracking-wider">{tr("reports:pendingInitialReview")}</span>
          <span className="text-xl font-bold text-[#b45309] font-mono mt-1 block">
            {formatNumber(kpi?.pendingComplaints) || 0}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">{tr("reports:awaitingScrutiny")}</span>
        </div>

        <div className="bg-white border border-[#fecaca] rounded-lg p-3 shadow-none bg-[#fef2f2]">
          <span className="text-xs font-bold text-[#991b1b] block uppercase tracking-wider">{tr("reports:slaOverdue")}</span>
          <span className="text-xl font-bold text-[#b91c1c] font-mono mt-1 block">
            {formatNumber(kpi?.overdueComplaints) || 0}
          </span>
          <span className="text-xs text-[#b91c1c] font-bold mt-0.5 block">{tr("reports:statutoryLimitExceeded")}</span>
        </div>

        <div className="bg-white border border-[#e9d5ff] rounded-lg p-3 shadow-none bg-[#faf5ff]">
          <span className="text-xs font-bold text-[#6b21a8] block uppercase tracking-wider">{tr("dashboard:overlapAlerts")}</span>
          <span className="text-xl font-bold text-[#7e22ce] font-mono mt-1 block">
            {formatNumber(kpi?.unresolvedOverlapAlerts) || 0}
          </span>
          <span className="text-xs text-[#6b21a8] font-semibold mt-0.5 block">{tr("reports:pendingJointReview")}</span>
        </div>
      </div>

      {/* Row 1: Bureau Performance Scorecard Table */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg shadow-none overflow-hidden">
        <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#e5eaf0] flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-aicte-navy-700 uppercase tracking-wider flex items-center space-x-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-aicte-navy-700" />
              <span>{tr("reports:aicteBureauCellPerformanceScorecard")}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{tr("reports:comparativeDisposalEfficiencyAverageDurationToResolveOverdueVolume")}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="gov-table w-full text-start text-xs">
            <thead>
              <tr>
                <th>{tr("reports:bureauCell")}</th>
                <th className="text-center">{tr("reports:totalIntake")}</th>
                <th className="text-center">{tr("dashboard:activeCases")}</th>
                <th className="text-center">{tr("dashboard:disposedCases")}</th>
                <th className="text-center">{tr("reports:slaOverdue")}</th>
                <th className="text-center">{tr("reports:meanDisposalTime")}</th>
                <th className="text-center">{tr("reports:clearanceRate_99f10")}</th>
                <th className="text-end">{tr("complaints:crossBureauOverlaps")}</th>
              </tr>
            </thead>
            <tbody>
              {(report?.bureauPerformance || []).map((b: any) => (
                <tr key={b.bureau}>
                  <td className="font-bold text-aicte-navy-900">
                    {b.bureau === "RB" ? tr("complaints:regulationBureauRb") : b.bureau === "PGRC" ? tr("complaints:publicGrievanceRedressalCellPgrc") : b.bureau === "RO" ? tr("complaints:regionalOfficesRo") : b.bureau === "AB" ? tr("complaints:approvalBureauAb") : tr("complaints:policyAcademicBureauPb")}
                  </td>
                  <td className="text-center font-mono font-medium text-slate-700">{formatNumber(b.total)}</td>
                  <td className="text-center font-mono font-semibold text-aicte-navy-700">{formatNumber(b.active)}</td>
                  <td className="text-center font-mono font-semibold text-[#15803d]">{formatNumber(b.disposed)}</td>
                  <td className="text-center font-mono font-bold text-[#b91c1c]">
                    {b.overdue > 0 ? (
                      <span className="bg-[#fee2e2] text-[#991b1b] border border-[#fecaca] px-1.5 py-0.2 rounded-lg">
                        {formatNumber(b.overdue)}
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="text-center font-mono text-slate-600">
                    {b.avgDisposalDays > 0 ? tr("reports:days", {value1: b.avgDisposalDays}) : "N/A"}
                  </td>
                  <td className="text-center">
                    <span className="font-mono font-bold text-slate-800">{b.disposalRate}%</span>
                  </td>
                  <td className="text-end font-mono font-bold text-[#b45309]">
                    {b.overlapsCount}{tr("reports:cases")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 2: Charts Grid (Intake Velocity, Overlap Statuses) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Trend Line Chart */}
        <div className="bg-white border border-[#e5eaf0] rounded-lg p-4 shadow-none lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
            <div>
              <h2 className="text-xs font-bold text-aicte-navy-700 uppercase tracking-wider">{tr("reports:intakeVsResolutionTrajectory")}</h2>
              <p className="text-xs text-slate-500">{tr("reports:monthlyGrievanceFilingsVersusCompletedDisposals")}</p>
            </div>
            <TrendingUp className="w-4 h-4 text-aicte-navy-700" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlyTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(value:any)=>formatNumber(value)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value:any,name:any)=>[typeof value==="number"?formatNumber(value):value,localizeLabel(name)]} labelFormatter={(label:any)=>localizeLabel(label)} />
                <Legend formatter={(value:any)=>localizeLabel(value)} wrapperStyle={{ fontSize: "11px" }} />
                <Line type="monotone" dataKey="filed" name={tr("reports:complaintsInflux")} stroke="#003366" strokeWidth={2} />
                <Line type="monotone" dataKey="disposed" name={tr("reports:casesDisposed")} stroke="#15803d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Overlap Status Breakdown */}
        <div className="bg-white border border-[#e5eaf0] rounded-lg p-4 shadow-none space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
            <div>
              <h2 className="text-xs font-bold text-aicte-navy-700 uppercase tracking-wider">{tr("reports:overlapReviewStatus")}</h2>
              <p className="text-xs text-slate-500">{tr("reports:aicteIntelligentOverlapResolution")}</p>
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
                <Tooltip formatter={(value:any,name:any)=>[typeof value==="number"?formatNumber(value):value,localizeLabel(name)]} labelFormatter={(label:any)=>localizeLabel(label)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs pt-2 border-t border-[#e2e8f0]">
            {(report?.overlapStatusCounts || []).map((entry: any) => (
              <div key={entry.status} className="flex items-center space-x-1.5 truncate">
                <div
                  className="w-2 h-2 rounded-lg shrink-0"
                  style={{ backgroundColor: OVERLAP_COLORS[entry.status] || "#94a3b8" }}
                />
                <span className="text-slate-600 truncate">{localizeLabel(entry.status)}:</span>
                <span className="font-bold text-slate-800">{formatNumber(entry.count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Regional Compliance Ledger & Top Complained Institutions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Regional Compliance Ledger */}
        <div className="bg-white border border-[#e5eaf0] rounded-lg shadow-none overflow-hidden">
          <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#e5eaf0] flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-aicte-navy-700 uppercase tracking-wider">{tr("reports:regionalComplianceLedger")}</h2>
              <p className="text-xs text-slate-500">{tr("reports:caseVolumeAndClearancePercentageByJurisdiction")}</p>
            </div>
            <Building className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="gov-table w-full text-start text-xs">
              <thead className="sticky top-0">
                <tr>
                  <th>{tr("reports:jurisdiction")}</th>
                  <th className="text-center">{tr("dashboard:total")}</th>
                  <th className="text-center">{tr("administration:active")}</th>
                  <th className="text-center">{tr("complaints:status.disposed")}</th>
                  <th className="text-end">{tr("reports:compliance")}</th>
                </tr>
              </thead>
              <tbody>
                {(report?.regionalCompliance || []).map((r: any) => (
                  <tr key={r.region}>
                    <td className="font-semibold text-slate-800">{r.region}</td>
                    <td className="text-center text-slate-700">{formatNumber(r.total)}</td>
                    <td className="text-center font-semibold text-aicte-navy-700">{formatNumber(r.active)}</td>
                    <td className="text-center font-semibold text-[#15803d]">{formatNumber(r.disposed)}</td>
                    <td className="text-end font-mono font-bold text-slate-900">
                      {r.complianceRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Complained Technical Institutions */}
        <div className="bg-white border border-[#e5eaf0] rounded-lg shadow-none overflow-hidden">
          <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#e5eaf0] flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-aicte-navy-700 uppercase tracking-wider">{tr("reports:highInfluxTechnicalInstitutions")}</h2>
              <p className="text-xs text-slate-500">{tr("reports:institutionsRequiringSupervisoryOversight")}</p>
            </div>
            <AlertTriangle className="w-3.5 h-3.5 text-[#b45309]" />
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="gov-table w-full text-start text-xs">
              <thead className="sticky top-0">
                <tr>
                  <th>{tr("complaints:institutionName")}</th>
                  <th className="text-center">{tr("complaints:totalCases")}</th>
                  <th className="text-center">{tr("dashboard:activeCases")}</th>
                  <th className="text-end">{tr("complaints:overlaps")}</th>
                </tr>
              </thead>
              <tbody>
                {(report?.topInstitutions || []).map((inst: any, idx: number) => (
                  <tr key={idx}>
                    <td className="font-medium text-slate-800 truncate max-w-[200px]">
                      <span className="block truncate font-semibold text-aicte-navy-700">{inst.name}</span>
                      <span className="text-xs font-mono text-slate-500">{inst.permId}</span>
                    </td>
                    <td className="text-center font-bold text-slate-900 font-mono">{formatNumber(inst.total)}</td>
                    <td className="text-center font-semibold text-aicte-navy-700 font-mono">{formatNumber(inst.active)}</td>
                    <td className="text-end font-mono font-bold">
                      {inst.overlapCount > 0 ? (
                        <span className="bg-[#fffbeb] text-[#92400e] border border-[#fde68a] px-1.5 py-0.2 rounded-lg text-xs">
                          {inst.overlapCount}{tr("reports:overlaps")}</span>
                      ) : (
                        <span className="text-slate-500">0</span>
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
