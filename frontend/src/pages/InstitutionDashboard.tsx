import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Building2,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  FileText,
  CheckCircle2,
  ArrowRight,
  Plus,
  RefreshCw,
  Calendar,
  Paperclip,
  ShieldAlert,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  User,
  Shield,
  Layers,
  Flame,
  GitMerge,
  ArrowRightLeft,
  FolderKanban
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.js";
import {
  Institution,
  Complaint,
  InstitutionDashboardMetrics,
  CaseHistory,
  RelatedCase,
  OverlapAlert,
  ComplaintDocument
} from "../services/types.js";

const STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b",
  "Under Process": "#3b82f6",
  Escalated: "#ef4444",
  Transferred: "#8b5cf6",
  Disposed: "#10b981"
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#dc2626",
  High: "#f97316",
  Medium: "#3b82f6",
  Low: "#64748b"
};

const CHART_PALETTE = ["#0f2942", "#2563eb", "#0d9488", "#f59e0b", "#8b5cf6", "#ec4899"];

export const InstitutionDashboard: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Institution Selection Context
  const [institutionsList, setInstitutionsList] = useState<Institution[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>(
    searchParams.get("institutionId") || user?.institutionId || "inst-1"
  );
  const [metrics, setMetrics] = useState<InstitutionDashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(true);

  // Complaints Table State
  const [tableComplaints, setTableComplaints] = useState<Complaint[]>([]);
  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filters
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [globalSearch, setGlobalSearch] = useState<string>("");  // top-level search bar
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterOfficer, setFilterOfficer] = useState<string>("");
  const [filterSlaCondition, setFilterSlaCondition] = useState<string>("");
  const [filterReceivedFrom, setFilterReceivedFrom] = useState<string>("");
  const [filterReceivedTo, setFilterReceivedTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("receivedDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Single-Window Modal Views
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetailLoading, setCaseDetailLoading] = useState<boolean>(false);
  const [caseDetail, setCaseDetail] = useState<{
    complaint: Complaint;
    history: CaseHistory[];
    relatedCases: RelatedCase[];
    overlapAlerts: OverlapAlert[];
    documents?: ComplaintDocument[];
  } | null>(null);

  // Quick Action: Register Modal
  const [registerModalOpen, setRegisterModalOpen] = useState<boolean>(false);
  const [regTitle, setRegTitle] = useState<string>("");
  const [regDescription, setRegDescription] = useState<string>("");
  const [regCategory, setRegCategory] = useState<string>("Faculty Shortage / Irregularities");
  const [regBureau, setRegBureau] = useState<string>("RB");
  const [regPriority, setRegPriority] = useState<"Low" | "Medium" | "High" | "Critical">("High");
  const [regSubmitting, setRegSubmitting] = useState<boolean>(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // SLA Override Modal
  const [overrideModalOpen, setOverrideModalOpen] = useState<boolean>(false);
  const [overrideDeadline, setOverrideDeadline] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [overrideSubmitting, setOverrideSubmitting] = useState<boolean>(false);

  // Load available institutions based on user authorization
  useEffect(() => {
    async function loadInstitutions() {
      try {
        const res = await api.getInstitutions({ limit: 100 });
        setInstitutionsList(res.data);
        if (user?.role === "Institutional User" && user.institutionId) {
          setSelectedInstId(user.institutionId);
        } else if (!selectedInstId && res.data.length > 0) {
          setSelectedInstId(res.data[0].id);
        }
      } catch (err) {
        console.error("Failed to load institutions selector:", err);
      }
    }
    loadInstitutions();
  }, [user]);

  // Load Single-Window Dashboard Metrics
  const loadDashboard = async () => {
    if (!selectedInstId) return;
    setLoadingMetrics(true);
    try {
      const data = await api.getInstitutionDashboardMetrics(selectedInstId);
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load institution dashboard metrics:", err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [selectedInstId]);

  // Load Searchable Table Complaints
  const loadTableComplaints = async () => {
    if (!selectedInstId) return;
    setTableLoading(true);
    try {
      const params: Record<string, any> = {
        institutionId: selectedInstId,
        page,
        limit: 10,
        sortBy,
        sortOrder
      };

      if (filterSearch.trim()) params.search = filterSearch.trim();
      if (filterCategory) params.category = filterCategory;
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      if (filterOfficer) params.assignedOfficerId = filterOfficer;
      if (filterReceivedFrom) params.receivedFrom = filterReceivedFrom;
      if (filterReceivedTo) params.receivedTo = filterReceivedTo;

      if (filterSlaCondition === "overdue") {
        params.isOverdue = "true";
      } else if (filterSlaCondition === "dueSoon") {
        params.isDueSoon = "true";
      }

      const res = await api.getComplaints(params);
      setTableComplaints(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err) {
      console.error("Failed to load complaints table:", err);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadTableComplaints();
  }, [
    selectedInstId,
    page,
    filterCategory,
    filterStatus,
    filterPriority,
    filterOfficer,
    filterSlaCondition,
    filterReceivedFrom,
    filterReceivedTo,
    sortBy,
    sortOrder
  ]);

  // Debounced search for table
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      loadTableComplaints();
    }, 350);
    return () => clearTimeout(handler);
  }, [filterSearch]);

  // Real-time Event Stream Listener
  useEffect(() => {
    const unsubscribe = api.subscribeLiveEvents((event) => {
      if (!selectedInstId) return;
      if (event.institutionId === selectedInstId || !event.institutionId) {
        loadDashboard();
        loadTableComplaints();
        if (selectedCaseId && event.complaintId === selectedCaseId) {
          openCaseDetail(selectedCaseId);
        }
      }
    });
    return () => unsubscribe();
  }, [selectedInstId, selectedCaseId]);

  // Ctrl+K → focus global search bar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("swp-global-search")?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Open Case Detail Drawer/Modal
  const openCaseDetail = async (complaintId: string) => {
    setSelectedCaseId(complaintId);
    setCaseDetailLoading(true);
    try {
      const [details, docs] = await Promise.all([
        api.getComplaintDetails(complaintId),
        api.getComplaintDocuments(complaintId).catch(() => [])
      ]);
      setCaseDetail({ ...details, documents: docs });
    } catch (err: any) {
      alert(err.message || "Failed to load case details.");
      setSelectedCaseId(null);
    } finally {
      setCaseDetailLoading(false);
    }
  };

  // Handle Quick Register Complaint
  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regTitle.trim() || !regDescription.trim()) {
      setRegError("Please provide both title and description.");
      return;
    }

    setRegSubmitting(true);
    setRegError(null);
    setRegSuccess(null);

    try {
      const res = await api.registerComplaint({
        institutionId: selectedInstId,
        category: regCategory,
        title: regTitle.trim(),
        description: regDescription.trim(),
        receivingBureauId: regBureau,
        priority: regPriority
      });

      setRegSuccess(`Complaint ${res.complaint.complaintId} registered successfully!`);
      setRegTitle("");
      setRegDescription("");
      loadDashboard();
      loadTableComplaints();
      setTimeout(() => {
        setRegisterModalOpen(false);
        setRegSuccess(null);
      }, 1500);
    } catch (err: any) {
      setRegError(err.message || "Failed to register complaint.");
    } finally {
      setRegSubmitting(false);
    }
  };

  // Handle SLA Override
  const handleOverrideSla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !overrideDeadline || !overrideReason.trim()) return;

    setOverrideSubmitting(true);
    try {
      await api.overrideSlaDeadline(selectedCaseId, overrideDeadline, overrideReason.trim());
      alert("SLA deadline successfully overridden.");
      setOverrideModalOpen(false);
      setOverrideReason("");
      setOverrideDeadline("");
      openCaseDetail(selectedCaseId);
      loadDashboard();
      loadTableComplaints();
    } catch (err: any) {
      alert(err.message || "Failed to override SLA deadline.");
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleResetFilters = () => {
    setFilterSearch("");
    setGlobalSearch("");
    setFilterCategory("");
    setFilterStatus("");
    setFilterPriority("");
    setFilterOfficer("");
    setFilterSlaCondition("");
    setFilterReceivedFrom("");
    setFilterReceivedTo("");
    setPage(1);
  };

  // Derive institution list filtered by the global search bar (for officers)
  const filteredInstitutionsList = globalSearch.trim()
    ? institutionsList.filter(
        (i) =>
          i.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
          i.aictePermanentId.toLowerCase().includes(globalSearch.toLowerCase()) ||
          i.city?.toLowerCase().includes(globalSearch.toLowerCase()) ||
          i.state?.toLowerCase().includes(globalSearch.toLowerCase())
      )
    : institutionsList;

  const kpis = metrics?.kpis;
  const inst = metrics?.institution;

  const categories = [
    "Faculty Shortage / Irregularities",
    "Capitation Fee / Overcharging",
    "Infrastructure & Lab Deficiencies",
    "Withholding of Certificates & Documents",
    "Non-payment of Faculty Salaries",
    "Admission Guideline Violations",
    "Harassment & Grievance Redressal Failure",
    "Unauthorized Course Operation",
    "Approval Norms Violation"
  ];

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* Role-Context Banner                                                        */}
      {/* ========================================================================= */}
      {user?.role === "Institutional User" ? (
        <div className="flex items-center gap-3 bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-xl px-5 py-3 shadow-sm border border-blue-700/60">
          <div className="p-2 bg-blue-700/50 rounded-lg">
            <Shield className="w-5 h-5 text-blue-200" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Institution Portal — Authorized Access</div>
            <div className="text-sm font-bold text-white truncate mt-0.5">{user.institutionName || "Your Institution"}</div>
          </div>
          <div className="shrink-0 text-right hidden sm:block">
            <div className="text-[11px] text-blue-300">Logged in as</div>
            <div className="text-xs font-semibold text-white">{user.fullName}</div>
            <div className="text-[11px] text-blue-300">{user.designation}</div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl px-5 py-3 shadow-sm border border-slate-700/60">
          <div className="p-2 bg-slate-700/50 rounded-lg">
            <User className="w-5 h-5 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Officer View — Full Directory Access</div>
            <div className="text-sm font-bold text-white mt-0.5">{user?.role}</div>
          </div>
          <div className="shrink-0 text-right hidden sm:block">
            <div className="text-[11px] text-slate-400">Signed in as</div>
            <div className="text-xs font-semibold text-white">{user?.fullName}</div>
            {user?.bureauId && (
              <div className="text-[11px] mt-0.5 text-amber-300 font-mono">Bureau: {user.bureauId}</div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Global Search Bar                                                          */}
      {/* ========================================================================= */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-3">
        <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-xs px-3 py-1.5 focus-within:border-[#003366] focus-within:bg-white transition">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            id="swp-global-search"
            type="text"
            value={globalSearch}
            onChange={(e) => {
              const val = e.target.value;
              setGlobalSearch(val);
              setFilterSearch(val);
              setPage(1);
            }}
            placeholder={user?.role === "Institutional User"
              ? "Search grievances by reference ID, category, title, status…"
              : "Search institutions by name, AICTE Permanent ID, city, state — or filter complaints below…"}
            className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none min-w-0"
            autoComplete="off"
          />

          {/* Active search chips */}
          {globalSearch && (
            <div className="flex items-center gap-2 shrink-0">
              {user?.role !== "Institutional User" && filteredInstitutionsList.length > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold bg-[#e8eef5] text-[#003366] border border-[#cbd5e1] px-2 py-0.5 rounded-xs">
                  <Building2 className="w-3 h-3" />
                  {filteredInstitutionsList.length} institution{filteredInstitutionsList.length !== 1 ? "s" : ""}
                </span>
              )}
              <button
                onClick={() => {
                  setGlobalSearch("");
                  setFilterSearch("");
                  setPage(1);
                  document.getElementById("swp-global-search")?.focus();
                }}
                className="p-0.5 text-slate-400 hover:text-slate-800"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Keyboard shortcut hint */}
          {!globalSearch && (
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              <kbd className="text-[10px] text-slate-500 bg-white border border-slate-300 rounded-xs px-1.5 py-0.5 font-mono">Ctrl</kbd>
              <kbd className="text-[10px] text-slate-500 bg-white border border-slate-300 rounded-xs px-1.5 py-0.5 font-mono">K</kbd>
            </div>
          )}
        </div>

        {/* Live result count bar when searching */}
        {globalSearch && (
          <div className="mt-1.5 px-1 flex items-center justify-between text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <FolderKanban className="w-3.5 h-3.5 text-[#003366]" />
              Showing records matching: <strong className="text-slate-900 font-semibold">"{globalSearch}"</strong>
            </span>
            <button
              onClick={() => { setGlobalSearch(""); setFilterSearch(""); setPage(1); }}
              className="text-[#003366] hover:underline font-semibold"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. Header & Institution Selector                                         */}
      {/* ========================================================================= */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-[#f1f5f9] text-[#003366] border border-[#cbd5e1] rounded-xs mt-0.5 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#003366] bg-[#e8eef5] border border-[#b8c9dc] px-2 py-0.5 rounded-xs">
                Single-Window Institution Portal
              </span>
              {inst && (
                <span className="text-xs text-slate-600 font-mono font-medium">
                  PID: {inst.aictePermanentId}
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              {inst?.name || "Institution Command Center"}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {inst ? `${inst.city}, ${inst.state} • Region: ${inst.region} • Accreditation: ${inst.accreditationStatus}` : "Consolidated grievance and statutory compliance monitoring window"}
            </p>
          </div>
        </div>

        {/* Institution Context Switcher / Quick Action */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {user?.role !== "Institutional User" ? (
            <div className="flex items-center space-x-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xs px-2.5 py-1 text-xs">
              <span className="text-slate-600 font-medium shrink-0">Institution:</span>
              <select
                value={selectedInstId}
                onChange={(e) => {
                  setSelectedInstId(e.target.value);
                  setPage(1);
                  setSearchParams({ institutionId: e.target.value });
                }}
                className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer max-w-[240px] truncate"
              >
                {filteredInstitutionsList.length === 0 ? (
                  <option value="">No institutions match search</option>
                ) : (
                  filteredInstitutionsList.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.aictePermanentId})
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : (
            <div className="px-2.5 py-1 bg-slate-100 text-slate-700 font-medium text-xs rounded-xs border border-slate-300">
              Authorized Institution Context Locked
            </div>
          )}

          <button
            onClick={() => {
              loadDashboard();
              loadTableComplaints();
            }}
            title="Refresh Dashboard"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 rounded-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setRegisterModalOpen(true)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs text-xs font-semibold border border-[#002147] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Grievance</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Key Performance Metric Cards                                           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-[#cbd5e1] rounded-xs p-3.5">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Cases</span>
            <FileText className="w-4 h-4 text-[#003366]" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1.5">{kpis?.totalComplaints || 0}</p>
          <span className="text-[10px] text-slate-500">All recorded grievances</span>
        </div>

        <div className="bg-white border border-[#cbd5e1] rounded-xs p-3.5">
          <div className="flex items-center justify-between text-[#b45309]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-[#b45309] mt-1.5">{kpis?.pendingCount || 0}</p>
          <span className="text-[10px] text-slate-500">Awaiting bureau action</span>
        </div>

        <div className="bg-white border border-[#cbd5e1] rounded-xs p-3.5">
          <div className="flex items-center justify-between text-[#003366]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Under Process</span>
            <RefreshCw className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-[#003366] mt-1.5">{kpis?.underProcessCount || 0}</p>
          <span className="text-[10px] text-slate-500">Active investigation</span>
        </div>

        <div className="bg-white border border-[#cbd5e1] rounded-xs p-3.5">
          <div className="flex items-center justify-between text-[#15803d]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-[#15803d] mt-1.5">{kpis?.resolvedCount || 0}</p>
          <span className="text-[10px] text-slate-500">Disposed & verified</span>
        </div>

        <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xs p-3.5">
          <div className="flex items-center justify-between text-[#b91c1c]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Overdue SLA</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-[#b91c1c] mt-1.5">{kpis?.overdueCount || 0}</p>
          <span className="text-[10px] text-[#991b1b] font-medium">Statutory deadline breach</span>
        </div>

        <div className="bg-white border border-[#cbd5e1] rounded-xs p-3.5">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">High Priority</span>
            <Flame className="w-4 h-4 text-[#ea580c]" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1.5">{kpis?.highPriorityCount || 0}</p>
          <span className="text-[10px] text-slate-500">Critical / High severity</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Visual Breakdown & Distribution Charts                                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Distribution */}
        <div className="bg-white border border-[#cbd5e1] rounded-xs">
          <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#cbd5e1] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#003366]">Status Distribution</span>
            <Layers className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="p-3 h-52">
            {metrics?.distribution?.byStatus && metrics.distribution.byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.distribution.byStatus}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={2}
                  >
                    {metrics.distribution.byStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || CHART_PALETTE[index % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                No case distribution available.
              </div>
            )}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="bg-white border border-[#cbd5e1] rounded-xs">
          <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#cbd5e1] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#003366]">Severity & Priority Breakdown</span>
            <Flame className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="p-3 h-52">
            {metrics?.distribution?.byPriority && metrics.distribution.byPriority.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.distribution.byPriority}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {metrics.distribution.byPriority.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={PRIORITY_COLORS[entry.name] || "#003366"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                No priority records found.
              </div>
            )}
          </div>
        </div>

        {/* Grievance Categories */}
        <div className="bg-white border border-[#cbd5e1] rounded-xs">
          <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#cbd5e1] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#003366]">Regulatory Categories</span>
            <FileText className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="p-3 space-y-1.5 max-h-52 overflow-y-auto">
            {metrics?.distribution?.byCategory && metrics.distribution.byCategory.length > 0 ? (
              metrics.distribution.byCategory.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-[#f8fafc] border border-slate-200 rounded-xs">
                  <span className="text-slate-800 truncate pr-2 max-w-[210px]">{cat.name}</span>
                  <span className="font-bold text-[#003366] bg-white border border-slate-300 px-2 py-0.5 rounded-xs text-[11px]">
                    {cat.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No categories logged.</p>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. Actionable Alerts & Urgent Grievances                                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overdue Grievances */}
        <div className="bg-white border border-[#fecaca] rounded-xs">
          <div className="px-3.5 py-2 bg-[#fef2f2] border-b border-[#fecaca] flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#b91c1c] flex items-center space-x-1.5 uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5 text-[#b91c1c]" />
              <span>Overdue Statutory Grievances</span>
            </h3>
            <span className="text-[10px] font-bold bg-[#fee2e2] text-[#991b1b] px-1.5 py-0.5 rounded-xs border border-[#fca5a5]">
              {metrics?.urgent?.overdueComplaints?.length || 0}
            </span>
          </div>
          <div className="p-3 space-y-2">
            {metrics?.urgent?.overdueComplaints && metrics.urgent.overdueComplaints.length > 0 ? (
              metrics.urgent.overdueComplaints.map((c) => (
                <div
                  key={c.id}
                  onClick={() => openCaseDetail(c.id)}
                  className="p-2 bg-[#fff5f5] hover:bg-[#fee2e2] border border-[#fecaca] rounded-xs cursor-pointer transition text-xs"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-[#b91c1c]">{c.complaintId}</span>
                    <span className="text-[10px] font-semibold text-[#991b1b] bg-white px-1.5 py-0.5 rounded-xs border border-[#fecaca]">
                      Due: {c.expectedDisposalDate}
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium truncate mt-1">{c.title}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">No overdue complaints for this institution.</p>
            )}
          </div>
        </div>

        {/* Approaching SLA Deadlines */}
        <div className="bg-white border border-[#fed7aa] rounded-xs">
          <div className="px-3.5 py-2 bg-[#fffbeb] border-b border-[#fed7aa] flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#b45309] flex items-center space-x-1.5 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-[#b45309]" />
              <span>Upcoming SLA Deadlines</span>
            </h3>
            <span className="text-[10px] font-bold bg-[#fef3c7] text-[#92400e] px-1.5 py-0.5 rounded-xs border border-[#fcd34d]">
              {metrics?.urgent?.upcomingDeadlines?.length || 0}
            </span>
          </div>
          <div className="p-3 space-y-2">
            {metrics?.urgent?.upcomingDeadlines && metrics.urgent.upcomingDeadlines.length > 0 ? (
              metrics.urgent.upcomingDeadlines.map((c) => (
                <div
                  key={c.id}
                  onClick={() => openCaseDetail(c.id)}
                  className="p-2 bg-[#fffdf5] hover:bg-[#fef3c7] border border-[#fed7aa] rounded-xs cursor-pointer transition text-xs"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-[#92400e]">{c.complaintId}</span>
                    <span className="text-[10px] font-semibold text-[#92400e] bg-white px-1.5 py-0.5 rounded-xs border border-[#fcd34d]">
                      Due: {c.expectedDisposalDate}
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium truncate mt-1">{c.title}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">No immediate deadlines approaching.</p>
            )}
          </div>
        </div>

        {/* Recently Updated */}
        <div className="bg-white border border-[#cbd5e1] rounded-xs">
          <div className="px-3.5 py-2 bg-[#f8fafc] border-b border-[#cbd5e1] flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#003366] flex items-center space-x-1.5 uppercase tracking-wider">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Recently Updated Grievances</span>
            </h3>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-xs border border-slate-300">
              {metrics?.urgent?.recentlyUpdated?.length || 0}
            </span>
          </div>
          <div className="p-3 space-y-2">
            {metrics?.urgent?.recentlyUpdated && metrics.urgent.recentlyUpdated.length > 0 ? (
              metrics.urgent.recentlyUpdated.map((c) => (
                <div
                  key={c.id}
                  onClick={() => openCaseDetail(c.id)}
                  className="p-2 bg-[#f8fafc] hover:bg-slate-100 border border-slate-200 rounded-xs cursor-pointer transition text-xs"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-slate-900">{c.complaintId}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-xs border border-slate-300 bg-white text-slate-700">
                      {c.status}
                    </span>
                  </div>
                  <p className="text-slate-700 truncate mt-1">{c.title}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">No recent updates.</p>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. Searchable, Sortable, Paginated Complaint Table                         */}
      {/* ========================================================================= */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs overflow-hidden">
        <div className="p-3 bg-[#f8fafc] border-b border-[#cbd5e1] space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#003366]">Institution Complaints Register</h2>
              <p className="text-[11px] text-slate-500">Record ledger for {inst?.name || "Selected Institution"}</p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-600 font-medium">Total: <strong>{totalCount}</strong> cases</span>
              <button
                onClick={handleResetFilters}
                className="text-xs text-[#003366] hover:underline font-semibold"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 text-xs">
            <div className="md:col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Filter reference, title..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xs text-xs focus:outline-none focus:border-[#003366]"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-300 rounded-xs px-2 py-1.5 text-slate-800"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Process">Under Process</option>
              <option value="Disposed">Disposed</option>
              <option value="Transferred">Transferred</option>
              <option value="Escalated">Escalated</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-300 rounded-xs px-2 py-1.5 text-slate-800"
            >
              <option value="">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-300 rounded-xs px-2 py-1.5 text-slate-800 truncate"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={filterSlaCondition}
              onChange={(e) => {
                setFilterSlaCondition(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-300 rounded-xs px-2 py-1.5 text-slate-800"
            >
              <option value="">Any SLA State</option>
              <option value="overdue">Overdue Cases</option>
              <option value="dueSoon">Due Soon (≤5 Days)</option>
            </select>
          </div>
        </div>

        {/* Complaints Table */}
        <div className="overflow-x-auto">
          <table className="gov-table w-full text-left text-xs">
            <thead>
              <tr>
                <th className="px-3 py-2">Complaint ID</th>
                <th className="px-3 py-2">Category & Grievance</th>
                <th className="px-3 py-2 text-center">Priority</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2">Bureau / Officer</th>
                <th className="px-3 py-2">SLA Target</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {tableLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-[#003366]" />
                    Loading complaint records...
                  </td>
                </tr>
              ) : tableComplaints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No matching grievances found for this institution.
                  </td>
                </tr>
              ) : (
                tableComplaints.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-mono font-bold text-[#003366] whitespace-nowrap">
                      {c.complaintId}
                      {c.hasOverlapAlert && (
                        <span className="ml-1.5 inline-block text-[9px] text-[#b45309] font-bold bg-[#fef3c7] border border-[#fcd34d] px-1 py-0.2 rounded-xs uppercase">
                          Overlap
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <p className="font-semibold text-slate-900 truncate">{c.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{c.category}</p>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded-xs text-[10px] font-bold border ${
                        c.priority === "Critical"
                          ? "bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]"
                          : c.priority === "High"
                          ? "bg-[#ffedd5] text-[#9a3412] border-[#fdba74]"
                          : c.priority === "Medium"
                          ? "bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                      }`}>
                        {c.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded-xs text-[10px] font-semibold border ${
                        c.status === "Pending"
                          ? "bg-[#fef3c7] text-[#92400e] border-[#fcd34d]"
                          : c.status === "Under Process"
                          ? "bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]"
                          : c.status === "Disposed"
                          ? "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]"
                          : c.status === "Transferred"
                          ? "bg-[#f5f3ff] text-[#5b21b6] border-[#ddd6fe]"
                          : "bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-slate-900 font-semibold text-[11px]">{c.currentBureauId}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                        {c.assignedOfficerName || "Unassigned"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700 font-mono text-[11px] whitespace-nowrap">
                      {c.expectedDisposalDate}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => openCaseDetail(c.id)}
                        className="px-2 py-0.5 text-xs text-[#003366] hover:text-[#002147] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-xs font-semibold transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-2.5 border-t border-[#cbd5e1] bg-[#f8fafc] flex items-center justify-between text-xs text-slate-600">
          <span>
            Page <strong>{page}</strong> of <strong>{totalPages || 1}</strong> ({totalCount} total cases)
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-0.5 rounded-xs border border-slate-300 bg-white text-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-0.5 rounded-xs border border-slate-300 bg-white text-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. Single-Window Complaint Detail View (Interactive Drawer / Modal)        */}
      {/* ========================================================================= */}
      {selectedCaseId && (
        <div className="fixed inset-0 bg-slate-900/60 flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl h-full shadow-xl flex flex-col overflow-hidden border-l border-slate-300">
            {/* Drawer Header */}
            <div className="px-4 py-3 bg-[#003366] text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-[#ff9933]">
                  {caseDetail?.complaint.complaintId || selectedCaseId}
                </span>
                {caseDetail?.complaint.status && (
                  <span className="text-[10px] font-semibold bg-white/20 text-white px-2 py-0.5 rounded-xs">
                    {caseDetail.complaint.status}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedCaseId(null)}
                className="p-1 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {caseDetailLoading || !caseDetail ? (
                <div className="py-20 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#003366]" />
                  Loading consolidated case record...
                </div>
              ) : (
                <>
                  {/* Case Info Summary */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {caseDetail.complaint.title}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#f8fafc] p-2.5 rounded-xs border border-[#cbd5e1] text-slate-700">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">Category</span>
                        <p className="font-semibold text-slate-900">{caseDetail.complaint.category}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">Bureau</span>
                        <p className="font-semibold text-slate-900">{caseDetail.complaint.currentBureauId}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">Assigned Officer</span>
                        <p className="font-semibold text-slate-900">{caseDetail.complaint.assignedOfficerName || "Unassigned"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">Received Date</span>
                        <p className="font-semibold text-slate-900">{caseDetail.complaint.receivedDate}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">SLA Target</span>
                        <p className="font-semibold text-slate-900">{caseDetail.complaint.expectedDisposalDate}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">Priority</span>
                        <p className="font-bold text-[#b91c1c]">{caseDetail.complaint.priority}</p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className="font-bold text-[#003366] uppercase text-[11px] mb-1">Grievance Substance</h4>
                    <div className="p-2.5 bg-[#f8fafc] border border-slate-200 rounded-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {caseDetail.complaint.description}
                    </div>
                  </div>

                  {/* Chronological Timeline */}
                  <div>
                    <h4 className="font-bold text-[#003366] uppercase text-[11px] mb-2 flex items-center justify-between">
                      <span>Case Timeline & History</span>
                      <span className="text-[10px] text-slate-500 normal-case font-normal">
                        {caseDetail.history.length} logged events
                      </span>
                    </h4>
                    <div className="space-y-2.5 pl-2 border-l-2 border-[#003366]">
                      {caseDetail.history.map((h) => (
                        <div key={h.id} className="relative pl-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-slate-900">{h.actionType}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(h.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-700 mt-0.5">{h.remarks}</p>
                          <span className="text-[10px] text-slate-500">Officer: {h.performedByName}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Attachments / Supporting Documents */}
                  <div>
                    <h4 className="font-bold text-[#003366] uppercase text-[11px] mb-2 flex items-center space-x-1.5">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Supporting Evidence Documents ({caseDetail.documents?.length || 0})</span>
                    </h4>
                    {caseDetail.documents && caseDetail.documents.length > 0 ? (
                      <div className="space-y-1">
                        {caseDetail.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2 bg-[#f8fafc] border border-slate-200 rounded-xs"
                          >
                            <div className="truncate pr-2">
                              <p className="font-semibold text-slate-900 truncate">{doc.originalName}</p>
                              <p className="text-[10px] text-slate-500">{Math.round(doc.fileSize / 1024)} KB • {doc.documentType}</p>
                            </div>
                            <button
                              onClick={() => api.downloadComplaintDocument(caseDetail.complaint.id, doc.id, doc.originalName)}
                              className="px-2 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-xs text-[#003366] text-[11px] font-semibold shrink-0"
                            >
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-xs italic">No supporting documents uploaded for this case.</p>
                    )}
                  </div>

                  {/* Overlap & Related Cases */}
                  {caseDetail.overlapAlerts.length > 0 && (
                    <div className="p-3 bg-[#fffbeb] border border-[#f59e0b] rounded-xs">
                      <h4 className="font-bold text-[#92400e] mb-1 flex items-center space-x-1.5 uppercase text-[11px]">
                        <GitMerge className="w-3.5 h-3.5 text-[#b45309]" />
                        <span>Potential Overlap Alerts ({caseDetail.overlapAlerts.length})</span>
                      </h4>
                      <p className="text-[11px] text-[#92400e] mb-2">
                        Automated overlap detection flagged matching grievance signals.
                      </p>
                      <div className="space-y-1">
                        {caseDetail.overlapAlerts.map((ovl) => (
                          <div key={ovl.id} className="p-2 bg-white rounded-xs border border-[#fed7aa] flex justify-between items-center">
                            <div>
                              <span className="font-mono font-bold text-slate-900">{ovl.alertId}</span>
                              <span className="ml-2 text-slate-600 text-[11px]">Score: {ovl.ruleMatchScore}%</span>
                            </div>
                            <Link
                              to="/overlaps"
                              className="text-[#003366] hover:underline font-bold text-xs"
                            >
                              Review &rarr;
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Authorized SLA Override Action */}
                  {(user?.role === "SYSTEM_ADMIN" || user?.role === "COMPETENT_AUTHORITY") && (
                    <div className="pt-2 border-t border-slate-200">
                      <button
                        onClick={() => {
                          setOverrideDeadline(caseDetail.complaint.expectedDisposalDate);
                          setOverrideModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs text-xs font-semibold border border-[#002147]"
                      >
                        Override Statutory SLA Deadline
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. Quick Register Complaint Modal                                         */}
      {/* ========================================================================= */}
      {registerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xs max-w-lg w-full shadow-xl border border-slate-300 overflow-hidden">
            <div className="px-4 py-2.5 bg-[#003366] text-white flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Register Grievance</h3>
                <p className="text-[10px] text-slate-300">{inst?.name}</p>
              </div>
              <button
                onClick={() => setRegisterModalOpen(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickRegister} className="p-4 space-y-3 text-xs">
              {regError && (
                <div className="p-2 bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5] rounded-xs">
                  {regError}
                </div>
              )}
              {regSuccess && (
                <div className="p-2 bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] rounded-xs font-semibold">
                  {regSuccess}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Grievance Subject / Title *</label>
                <input
                  type="text"
                  required
                  value={regTitle}
                  onChange={(e) => setRegTitle(e.target.value)}
                  placeholder="Concise summary of the grievance..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xs focus:outline-none focus:border-[#003366]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Category *</label>
                  <select
                    value={regCategory}
                    onChange={(e) => setRegCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xs"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Initial Bureau *</label>
                  <select
                    value={regBureau}
                    onChange={(e) => setRegBureau(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xs"
                  >
                    <option value="RB">Regulation Bureau (RB)</option>
                    <option value="PGRC">Public Grievance Redressal Cell (PGRC)</option>
                    <option value="RO">Regional Offices (RO)</option>
                    <option value="AB">Approval Bureau (AB)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Severity / Priority</label>
                <select
                  value={regPriority}
                  onChange={(e) => setRegPriority(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xs"
                >
                  <option value="Low">Low (General Inquiry - 30 days)</option>
                  <option value="Medium">Medium (Administrative - 21 days)</option>
                  <option value="High">High (Faculty / Fee Irregularity - 14 days)</option>
                  <option value="Critical">Critical (Safety / Legal Threat - 7 days)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Detailed Substance *</label>
                <textarea
                  rows={4}
                  required
                  value={regDescription}
                  onChange={(e) => setRegDescription(e.target.value)}
                  placeholder="Detailed description of facts, statutory provisions violated..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xs focus:outline-none focus:border-[#003366]"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xs text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regSubmitting}
                  className="px-4 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs font-semibold disabled:opacity-50"
                >
                  {regSubmitting ? "Submitting..." : "Submit to Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. SLA Deadline Override Modal                                            */}
      {/* ========================================================================= */}
      {overrideModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xs max-w-md w-full shadow-xl border border-slate-300 overflow-hidden">
            <div className="px-4 py-2.5 bg-[#003366] text-white flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Statutory SLA Override</h3>
              <button onClick={() => setOverrideModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleOverrideSla} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">New Target Disposal Date *</label>
                <input
                  type="date"
                  required
                  value={overrideDeadline}
                  onChange={(e) => setOverrideDeadline(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Official Administrative Grounds *</label>
                <textarea
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Record justification under AICTE Regulations..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xs"
                />
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xs text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="px-4 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs font-semibold disabled:opacity-50"
                >
                  {overrideSubmitting ? "Recording..." : "Confirm Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
