import { ModalFrame, PageHeader } from "../components/ui/Interface.js";
import {InstitutionSearch,InstitutionInvolvement} from "../components/common/InstitutionOverview.js";
import { tr, localizeLabel, localizeError, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
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
  useLocaleRender();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Institution Selection Context
  const [institutionsList, setInstitutionsList] = useState<Institution[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>(
    searchParams.get("institutionId") || user?.institutionId || ""
  );
  const [dashboardError,setDashboardError]=useState("");
  const dashboardRequest=useRef(0);
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
    const version=++dashboardRequest.current;
    setLoadingMetrics(true);
    setMetrics(null);
    try {
      const data = await api.getInstitutionDashboardMetrics(selectedInstId);
      if(version!==dashboardRequest.current)return;
      setMetrics(data);
      setDashboardError("");
    } catch (err) {
      if(version===dashboardRequest.current)setDashboardError(localizeError(err instanceof Error?err.message:""));
    } finally {
      if(version===dashboardRequest.current)setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [selectedInstId]);
  useEffect(()=>{const poll=setInterval(()=>{loadDashboard();loadTableComplaints();},30000);return()=>clearInterval(poll);},[selectedInstId,page,filterSearch,filterStatus]);

  // Load Searchable Table Complaints
  const loadTableComplaints = async () => {
    if (!selectedInstId) return;
    if(user?.role==="SYSTEM_ADMIN"){setTableComplaints([]);setTotalCount(0);setTableLoading(false);return;}
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
      alert(localizeError(err.message || tr("complaints:failedToLoadCaseDetails")));
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
      alert(tr("complaints:slaDeadlineSuccessfullyOverridden"));
      setOverrideModalOpen(false);
      setOverrideReason("");
      setOverrideDeadline("");
      openCaseDetail(selectedCaseId);
      loadDashboard();
      loadTableComplaints();
    } catch (err: any) {
      alert(localizeError(err.message || tr("complaints:failedToOverrideSlaDeadline")));
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
      <PageHeader title={tr("navigation:ui.institutionTitle")} subtitle={tr("complaints:institutionOverview.scope")}/>
      {user?.role!=="Institutional User"&&<InstitutionSearch onSelect={id=>{setSelectedInstId(id);setPage(1);setSearchParams({institutionId:id});}}/>}
      {dashboardError&&<p role="alert">{dashboardError}</p>}
      {/* ========================================================================= */}
      {/* Role-Context Banner                                                        */}
      {/* ========================================================================= */}
      {(user?.role === "Institutional User") && ((
        <div className="flex items-center gap-3 bg-aicte-navy-800 text-white rounded-xl px-5 py-3 shadow-sm border border-blue-700/60">
          <div className="p-2 bg-blue-700/50 rounded-lg">
            <Shield className="w-5 h-5 text-blue-200" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider">{tr("complaints:institutionPortalAuthorizedAccess")}</div>
            <div className="text-sm font-bold text-white truncate mt-0.5">{user.institutionName || tr("complaints:yourInstitution")}</div>
          </div>
          <div className="shrink-0 text-end hidden sm:block">
            <div className="text-xs text-blue-300">{tr("complaints:loggedInAs")}</div>
            <div className="text-xs font-semibold text-white"><bdi dir="auto" className="original-content">{user.fullName}</bdi></div>
            <div className="text-xs text-blue-300">{user.designation}</div>
          </div>
        </div>
      ))}

      {/* ========================================================================= */}
      {/* Global Search Bar                                                          */}
      {/* ========================================================================= */}
      {user?.role==="Institutional User"&&<>
      <div className="bg-white border border-[#e5eaf0] rounded-lg p-3">
        <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#e5eaf0] rounded-lg px-3 py-1.5 focus-within:border-[#003366] focus-within:bg-white transition">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            id="swp-global-search"
            type="text"
            value={globalSearch}
            onChange={(e) => {
              const val = e.target.value;
              setGlobalSearch(val);
              if(user?.role==="Institutional User")setFilterSearch(val);
              setPage(1);
            }}
            placeholder={user?.role === "Institutional User" ? tr("complaints:searchGrievancesByReferenceIdCategoryTitleStatus") : tr("complaints:searchInstitutionsByNameAictePermanentIdCityState")}
            className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none min-w-0"
            autoComplete="off"
          />

          {/* Active search chips */}
          {globalSearch && (
            <div className="flex items-center gap-2 shrink-0">
              {user?.role !== "Institutional User" && filteredInstitutionsList.length > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold bg-[#e8eef5] text-aicte-navy-700 border border-[#e5eaf0] px-2 py-0.5 rounded-lg">
                  <Building2 className="w-3 h-3" />
                  {filteredInstitutionsList.length}{tr("complaints:institution_567af")}{filteredInstitutionsList.length !== 1 ? "s" : ""}
                </span>
              )}
              <button
                onClick={() => {
                  setGlobalSearch("");
                  setFilterSearch("");
                  setPage(1);
                  document.getElementById("swp-global-search")?.focus();
                }}
                className="p-0.5 text-slate-500 hover:text-slate-800"
                title={tr("complaints:clearSearch")} aria-label={tr("common:cancel")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Keyboard shortcut hint */}
          {!globalSearch && (
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              <kbd className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 font-mono">{tr("complaints:ctrl")}</kbd>
              <kbd className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 font-mono">K</kbd>
            </div>
          )}
        </div>

        {/* Live result count bar when searching */}
        {globalSearch && (
          <div className="mt-1.5 px-1 flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <FolderKanban className="w-3.5 h-3.5 text-aicte-navy-700" />{tr("complaints:showingRecordsMatching")}<strong className="text-slate-900 font-semibold">"{globalSearch}"</strong>
            </span>
            <button
              onClick={() => { setGlobalSearch(""); setFilterSearch(""); setPage(1); }}
              className="text-aicte-navy-700 hover:underline font-semibold"
            >{tr("complaints:clearSearch_87e32")}</button>
          </div>
        )}
      </div>

      </>}
      {/* ========================================================================= */}
      {/* 1. Header & Institution Selector                                         */}
      {/* ========================================================================= */}
      <div className="page-header">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-[#f1f5f9] text-aicte-navy-700 border border-[#e5eaf0] rounded-lg mt-0.5 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider font-bold text-aicte-navy-700 bg-[#e8eef5] border border-[#b8c9dc] px-2 py-0.5 rounded-lg">{tr("complaints:singleWindowInstitutionPortal")}</span>
              {inst && (
                <span className="text-xs text-slate-600 font-mono font-medium">{tr("complaints:pid")}{inst.aictePermanentId}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              {inst?.name || tr("complaints:institutionCommandCenter")}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {inst ? tr("complaints:regionAccreditation", {value1: inst.city, value2: inst.state, value3: inst.region, value4: inst.accreditationStatus}) : tr("complaints:consolidatedGrievanceAndStatutoryComplianceMonitoringWindow")}
            </p>
          </div>
        </div>

        {/* Institution Context Switcher / Quick Action */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {user?.role !== "Institutional User" ? (
            <div className="flex items-center space-x-1.5 bg-[#f8fafc] border border-[#e5eaf0] rounded-lg px-2.5 py-1 text-xs">
              <span className="text-slate-600 font-medium shrink-0">{tr("complaints:institution")}</span>
              <select
                value={selectedInstId}
                onChange={(e) => {
                  setSelectedInstId(e.target.value);
                  setPage(1);
                  setSearchParams({ institutionId: e.target.value });
                }}
                className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer max-w-[240px] truncate" aria-label={tr("complaints:institution")}
              >
                {filteredInstitutionsList.length === 0 ? (
                  <option value="">{tr("complaints:noInstitutionsMatchSearch")}</option>
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
            <div className="px-2.5 py-1 bg-slate-100 text-slate-700 font-medium text-xs rounded-lg border border-slate-200">{tr("complaints:authorizedInstitutionContextLocked")}</div>
          )}

          <button
            onClick={() => {
              loadDashboard();
              loadTableComplaints();
            }}
            title={tr("complaints:refreshDashboard")}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? "animate-spin" : ""}`} />
          </button>

          {["BUREAU_HEAD","COMPETENT_AUTHORITY","Institutional User"].includes(user?.role||"")&&<button
            onClick={() => setRegisterModalOpen(true)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg text-xs font-semibold border border-[#002147] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{tr("complaints:registerGrievance")}</span>
          </button>}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Key Performance Metric Cards                                           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-[#e5eaf0] rounded-lg p-3.5">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">{tr("complaints:totalCases")}</span>
            <FileText className="w-4 h-4 text-aicte-navy-700" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1.5">{kpis?.totalComplaints || 0}</p>
          <span className="text-xs text-slate-500">{tr("complaints:allRecordedGrievances")}</span>
        </div>

        <div className="bg-white border border-[#e5eaf0] rounded-lg p-3.5">
          <div className="flex items-center justify-between text-[#b45309]">
            <span className="text-xs font-bold uppercase tracking-wider">{tr("overlaps:pendingReview")}</span>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-[#b45309] mt-1.5">{kpis?.pendingCount || 0}</p>
          <span className="text-xs text-slate-500">{tr("complaints:awaitingBureauAction")}</span>
        </div>

        <div className="bg-white border border-[#e5eaf0] rounded-lg p-3.5">
          <div className="flex items-center justify-between text-aicte-navy-700">
            <span className="text-xs font-bold uppercase tracking-wider">{tr("complaints:status.underProcess")}</span>
            <RefreshCw className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-aicte-navy-700 mt-1.5">{kpis?.underProcessCount || 0}</p>
          <span className="text-xs text-slate-500">{tr("complaints:activeInvestigation")}</span>
        </div>

        <div className="bg-white border border-[#e5eaf0] rounded-lg p-3.5">
          <div className="flex items-center justify-between text-[#15803d]">
            <span className="text-xs font-bold uppercase tracking-wider">{tr("overlaps:resolved")}</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-[#15803d] mt-1.5">{kpis?.resolvedCount || 0}</p>
          <span className="text-xs text-slate-500">{tr("complaints:disposedVerified")}</span>
        </div>

        <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-3.5">
          <div className="flex items-center justify-between text-[#b91c1c]">
            <span className="text-xs font-bold uppercase tracking-wider">{localizeLabel("Escalated")}</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-xl font-bold text-[#b91c1c] mt-1.5">{kpis?.escalatedCount || 0}</p>
          <span className="text-xs text-[#991b1b] font-medium">{tr("complaints:institutionOverview.scope")}</span>
        </div>

        <div className="bg-white border border-[#e5eaf0] rounded-lg p-3.5">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider">{localizeLabel("Overlap Alerts")}</span>
            <Flame className="w-4 h-4 text-[#ea580c]" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1.5">{kpis?.activeOverlapCount || 0}</p>
          <span className="text-xs text-slate-500">{tr("complaints:institutionOverview.coordination")}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      <InstitutionInvolvement metrics={metrics}/>
      {/* 3. Visual Breakdown & Distribution Charts                                 */}
      {/* ========================================================================= */}
      {user?.role!=="SYSTEM_ADMIN"&&<>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Distribution */}
        <div className="bg-white border border-[#e5eaf0] rounded-lg">
          <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#e5eaf0] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700">{tr("complaints:statusDistribution")}</span>
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
                  <Tooltip formatter={(value:any,name:any)=>[typeof value==="number"?formatNumber(value):value,localizeLabel(name)]} labelFormatter={(label:any)=>localizeLabel(label)} />
                  <Legend formatter={(value:any)=>localizeLabel(value)} wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-500">{tr("complaints:noCaseDistributionAvailable")}</div>
            )}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="bg-white border border-[#e5eaf0] rounded-lg">
          <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#e5eaf0] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700">{tr("complaints:severityPriorityBreakdown")}</span>
            <Flame className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="p-3 h-52">
            {metrics?.distribution?.byPriority && metrics.distribution.byPriority.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.distribution.byPriority}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(value:any)=>formatNumber(value)} allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value:any,name:any)=>[typeof value==="number"?formatNumber(value):value,localizeLabel(name)]} labelFormatter={(label:any)=>localizeLabel(label)} />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {metrics.distribution.byPriority.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={PRIORITY_COLORS[entry.name] || "#003366"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-500">{tr("complaints:noPriorityRecordsFound")}</div>
            )}
          </div>
        </div>

        {/* Grievance Categories */}
        <div className="bg-white border border-[#e5eaf0] rounded-lg">
          <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#e5eaf0] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700">{tr("complaints:regulatoryCategories")}</span>
            <FileText className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="p-3 space-y-1.5 max-h-52 overflow-y-auto">
            {metrics?.distribution?.byCategory && metrics.distribution.byCategory.length > 0 ? (
              metrics.distribution.byCategory.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-[#f8fafc] border border-slate-200 rounded-lg">
                  <span className="text-slate-800 truncate pe-2 max-w-[210px]">{cat.name}</span>
                  <span className="font-bold text-aicte-navy-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-xs">
                    {formatNumber(cat.count)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-8">{tr("complaints:noCategoriesLogged")}</p>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. Actionable Alerts & Urgent Grievances                                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overdue Grievances */}
        <div className="bg-white border border-[#fecaca] rounded-lg">
          <div className="px-3.5 py-2 bg-[#fef2f2] border-b border-[#fecaca] flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#b91c1c] flex items-center space-x-1.5 uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5 text-[#b91c1c]" />
              <span>{tr("complaints:overdueStatutoryGrievances")}</span>
            </h3>
            <span className="text-xs font-bold bg-[#fee2e2] text-[#991b1b] px-1.5 py-0.5 rounded-lg border border-[#fca5a5]">
              {metrics?.urgent?.overdueComplaints?.length || 0}
            </span>
          </div>
          <div className="p-3 space-y-2">
            {metrics?.urgent?.overdueComplaints && metrics.urgent.overdueComplaints.length > 0 ? (
              metrics.urgent.overdueComplaints.map((c) => (
                <div
                  key={c.id}
                  onClick={() => openCaseDetail(c.id)}
                  className="p-2 bg-[#fff5f5] hover:bg-[#fee2e2] border border-[#fecaca] rounded-lg cursor-pointer transition text-xs"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-[#b91c1c]"><bdi dir="ltr" className="canonical-value">{c.complaintId}</bdi></span>
                    <span className="text-xs font-semibold text-[#991b1b] bg-white px-1.5 py-0.5 rounded-lg border border-[#fecaca]">{tr("complaints:due")}{formatDate(c.expectedDisposalDate)}
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium truncate mt-1"><bdi dir="auto" className="original-content">{c.title}</bdi></p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">{tr("complaints:noOverdueComplaintsForThisInstitution")}</p>
            )}
          </div>
        </div>

        {/* Approaching SLA Deadlines */}
        <div className="bg-white border border-[#fed7aa] rounded-lg">
          <div className="px-3.5 py-2 bg-[#fffbeb] border-b border-[#fed7aa] flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#b45309] flex items-center space-x-1.5 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-[#b45309]" />
              <span>{tr("complaints:upcomingSlaDeadlines")}</span>
            </h3>
            <span className="text-xs font-bold bg-[#fef3c7] text-[#92400e] px-1.5 py-0.5 rounded-lg border border-[#fcd34d]">
              {metrics?.urgent?.upcomingDeadlines?.length || 0}
            </span>
          </div>
          <div className="p-3 space-y-2">
            {metrics?.urgent?.upcomingDeadlines && metrics.urgent.upcomingDeadlines.length > 0 ? (
              metrics.urgent.upcomingDeadlines.map((c) => (
                <div
                  key={c.id}
                  onClick={() => openCaseDetail(c.id)}
                  className="p-2 bg-[#fffdf5] hover:bg-[#fef3c7] border border-[#fed7aa] rounded-lg cursor-pointer transition text-xs"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-[#92400e]"><bdi dir="ltr" className="canonical-value">{c.complaintId}</bdi></span>
                    <span className="text-xs font-semibold text-[#92400e] bg-white px-1.5 py-0.5 rounded-lg border border-[#fcd34d]">{tr("complaints:due")}{formatDate(c.expectedDisposalDate)}
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium truncate mt-1"><bdi dir="auto" className="original-content">{c.title}</bdi></p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">{tr("complaints:noImmediateDeadlinesApproaching")}</p>
            )}
          </div>
        </div>

        {/* Recently Updated */}
        <div className="bg-white border border-[#e5eaf0] rounded-lg">
          <div className="px-3.5 py-2 bg-[#f8fafc] border-b border-[#e5eaf0] flex items-center justify-between">
            <h3 className="text-xs font-bold text-aicte-navy-700 flex items-center space-x-1.5 uppercase tracking-wider">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>{tr("complaints:recentlyUpdatedGrievances")}</span>
            </h3>
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-lg border border-slate-200">
              {metrics?.urgent?.recentlyUpdated?.length || 0}
            </span>
          </div>
          <div className="p-3 space-y-2">
            {metrics?.urgent?.recentlyUpdated && metrics.urgent.recentlyUpdated.length > 0 ? (
              metrics.urgent.recentlyUpdated.map((c) => (
                <div
                  key={c.id}
                  onClick={() => openCaseDetail(c.id)}
                  className="p-2 bg-[#f8fafc] hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition text-xs"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-slate-900"><bdi dir="ltr" className="canonical-value">{c.complaintId}</bdi></span>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-700">
                      {localizeLabel(c.status)}
                    </span>
                  </div>
                  <p className="text-slate-700 truncate mt-1"><bdi dir="auto" className="original-content">{c.title}</bdi></p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">{tr("complaints:noRecentUpdates")}</p>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. Searchable, Sortable, Paginated Complaint Table                         */}
      {/* ========================================================================= */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg overflow-hidden">
        <div className="p-3 bg-[#f8fafc] border-b border-[#e5eaf0] space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700">{tr("complaints:institutionComplaintsRegister")}</h2>
              <p className="text-xs text-slate-500">{tr("complaints:recordLedgerFor")}{inst?.name || tr("complaints:selectedInstitution")}</p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-600 font-medium">{tr("complaints:total")}<strong>{formatNumber(totalCount)}</strong>{tr("complaints:cases")}</span>
              <button
                onClick={handleResetFilters}
                className="text-xs text-aicte-navy-700 hover:underline font-semibold"
              >{tr("complaints:resetFilters")}</button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 text-xs">
            <div className="md:col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute start-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder={tr("complaints:filterReferenceTitle")}
                className="w-full ps-8 pe-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#003366]" aria-label={tr("complaints:filterReferenceTitle")}
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800" aria-label={tr("complaints:currentStatus")}
            >
              <option value="">{tr("complaints:allStatuses")}</option>
              <option value="Pending">{tr("complaints:status.pending")}</option>
              <option value="Under Process">{tr("complaints:status.underProcess")}</option>
              <option value="Disposed">{tr("complaints:status.disposed")}</option>
              <option value="Transferred">{tr("complaints:status.transferred")}</option>
              <option value="Escalated">{tr("complaints:status.escalated")}</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800" aria-label={tr("complaints:priority")}
            >
              <option value="">{tr("complaints:allPriorities")}</option>
              <option value="Critical">{tr("complaints:critical")}</option>
              <option value="High">{tr("complaints:high")}</option>
              <option value="Medium">{tr("complaints:medium")}</option>
              <option value="Low">{tr("complaints:low")}</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 truncate" aria-label={tr("complaints:category")}
            >
              <option value="">{tr("complaints:allCategories")}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {localizeLabel(c)}
                </option>
              ))}
            </select>

            <select
              value={filterSlaCondition}
              onChange={(e) => {
                setFilterSlaCondition(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800" aria-label={tr("complaints:disposalSla")}
            >
              <option value="">{tr("complaints:anySlaState")}</option>
              <option value="overdue">{tr("dashboard:overdueCases")}</option>
              <option value="dueSoon">{tr("complaints:dueSoon5Days")}</option>
            </select>
          </div>
        </div>

        {/* Complaints Table */}
        <div className="overflow-x-auto">
          <table className="gov-table w-full text-start text-xs">
            <thead>
              <tr>
                <th className="px-3 py-2">{tr("complaints:complaintId")}</th>
                <th className="px-3 py-2">{tr("complaints:categoryGrievance")}</th>
                <th className="px-3 py-2 text-center">{tr("complaints:priority")}</th>
                <th className="px-3 py-2 text-center">{tr("complaints:status_bae7d")}</th>
                <th className="px-3 py-2">{tr("complaints:bureauOfficer")}</th>
                <th className="px-3 py-2">{tr("complaints:slaTarget")}</th>
                <th className="px-3 py-2 text-end">{tr("dashboard:action")}</th>
              </tr>
            </thead>
            <tbody>
              {tableLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-aicte-navy-700" />{tr("complaints:loadingComplaintRecords")}</td>
                </tr>
              ) : tableComplaints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">{tr("complaints:noMatchingGrievancesFoundForThisInstitution")}</td>
                </tr>
              ) : (
                tableComplaints.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-mono font-bold text-aicte-navy-700 whitespace-nowrap">
                      <bdi dir="ltr" className="canonical-value">{c.complaintId}</bdi>
                      {c.hasOverlapAlert && (
                        <span className="ms-1.5 inline-block text-[9px] text-[#b45309] font-bold bg-[#fef3c7] border border-[#fcd34d] px-1 py-0.2 rounded-lg uppercase">{tr("complaints:overlap")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <p className="font-semibold text-slate-900 truncate"><bdi dir="auto" className="original-content">{c.title}</bdi></p>
                      <p className="text-xs text-slate-500 truncate">{c.category}</p>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded-lg text-xs font-bold border ${
                        c.priority === "Critical"
                          ? "bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]"
                          : c.priority === "High"
                          ? "bg-[#ffedd5] text-[#9a3412] border-[#fdba74]"
                          : c.priority === "Medium"
                          ? "bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}>
                        {localizeLabel(c.priority)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded-lg text-xs font-semibold border ${
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
                        {localizeLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-slate-900 font-semibold text-xs"><bdi dir="ltr" className="canonical-value">{c.currentBureauId}</bdi></div>
                      <div className="text-xs text-slate-500 truncate max-w-[120px]">
                        {c.assignedOfficerName || tr("dashboard:unassigned")}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700 font-mono text-xs whitespace-nowrap">
                      {formatDate(c.expectedDisposalDate)}
                      {c.nextActionDate&&<div>{localizeLabel("Next action date")}: {formatDate(c.nextActionDate)}</div>}
                    </td>
                    <td className="px-3 py-2 text-end whitespace-nowrap">
                      <button
                        onClick={() => openCaseDetail(c.id)}
                        className="px-2 py-0.5 text-xs text-aicte-navy-700 hover:text-aicte-navy-900 bg-white border border-[#e5eaf0] hover:bg-[#f1f5f9] rounded-lg font-semibold transition"
                      >{tr("complaints:inspect")}</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-2.5 border-t border-[#e5eaf0] bg-[#f8fafc] flex items-center justify-between text-xs text-slate-600">
          <span>{tr("dashboard:page")}<strong>{formatNumber(page)}</strong> of <strong>{formatNumber(totalPages) || 1}</strong> ({formatNumber(totalCount)}{tr("complaints:totalCases_1e7cb")}</span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
            >{tr("dashboard:previous")}</button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
            >{tr("dashboard:next")}</button>
          </div>
        </div>
      </div>

      </>}
      {/* ========================================================================= */}
      {/* 6. Single-Window Complaint Detail View (Interactive Drawer / Modal)        */}
      {/* ========================================================================= */}
      {selectedCaseId && (
        <ModalFrame className="fixed inset-0 bg-slate-900/60 flex justify-end z-50" onClose={() => setSelectedCaseId(null)}>
          <div className="bg-white w-full max-w-2xl h-full shadow-xl flex flex-col overflow-hidden border-l border-slate-200">
            {/* Drawer Header */}
            <div className="px-4 py-3 bg-aicte-navy-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-[#ff9933]">
                  {caseDetail?.complaint.complaintId || selectedCaseId}
                </span>
                {caseDetail?.complaint.status && (
                  <span className="text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded-lg">
                    {localizeLabel(caseDetail.complaint.status)}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedCaseId(null)}
                className="p-1 text-slate-300 hover:text-white" aria-label={tr("common:cancel")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {caseDetailLoading || !caseDetail ? (
                <div className="py-20 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-aicte-navy-700" />{tr("complaints:loadingConsolidatedCaseRecord")}</div>
              ) : (
                <>
                  {/* Case Info Summary */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      <bdi dir="auto" className="original-content">{caseDetail.complaint.title}</bdi>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#f8fafc] p-2.5 rounded-lg border border-[#e5eaf0] text-slate-700">
                      <div>
                        <span className="text-xs uppercase font-bold text-slate-500">{tr("complaints:category")}</span>
                        <p className="font-semibold text-slate-900">{caseDetail.complaint.category}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase font-bold text-slate-500">{tr("dashboard:bureau")}</span>
                        <p className="font-semibold text-slate-900"><bdi dir="ltr" className="canonical-value">{caseDetail.complaint.currentBureauId}</bdi></p>
                      </div>
                      <div>
                        <span className="text-xs uppercase font-bold text-slate-500">{tr("dashboard:assignedOfficer")}</span>
                        <p className="font-semibold text-slate-900">{caseDetail.complaint.assignedOfficerName || tr("dashboard:unassigned")}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase font-bold text-slate-500">{tr("complaints:receivedDate")}</span>
                        <p className="font-semibold text-slate-900">{formatDate(caseDetail.complaint.receivedDate)}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase font-bold text-slate-500">{tr("complaints:slaTarget")}</span>
                        <p className="font-semibold text-slate-900">{formatDate(caseDetail.complaint.expectedDisposalDate)}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase font-bold text-slate-500">{tr("complaints:priority")}</span>
                        <p className="font-bold text-[#b91c1c]">{localizeLabel(caseDetail.complaint.priority)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className="font-bold text-aicte-navy-700 uppercase text-xs mb-1">{tr("complaints:grievanceSubstance")}</h4>
                    <div className="p-2.5 bg-[#f8fafc] border border-slate-200 rounded-lg text-slate-800 whitespace-pre-wrap leading-relaxed">
                      <bdi dir="auto" className="original-content">{caseDetail.complaint.description}</bdi>
                    </div>
                  </div>

                  {/* Chronological Timeline */}
                  <div>
                    <h4 className="font-bold text-aicte-navy-700 uppercase text-xs mb-2 flex items-center justify-between">
                      <span>{tr("complaints:caseTimelineHistory")}</span>
                      <span className="text-xs text-slate-500 normal-case font-normal">
                        {caseDetail.history.length}{tr("complaints:loggedEvents")}</span>
                    </h4>
                    <div className="space-y-2.5 ps-2 border-s-2 border-[#003366]">
                      {caseDetail.history.map((h) => (
                        <div key={h.id} className="relative ps-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-slate-900">{h.actionType}</span>
                            <span className="text-xs text-slate-500 font-mono">
                              {formatDate(h.createdAt, true)}
                            </span>
                          </div>
                          <p className="text-slate-700 mt-0.5"><bdi dir="auto" className="original-content">{h.remarks}</bdi></p>
                          <span className="text-xs text-slate-500">{tr("dashboard:officer")}{h.performedByName}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Attachments / Supporting Documents */}
                  <div>
                    <h4 className="font-bold text-aicte-navy-700 uppercase text-xs mb-2 flex items-center space-x-1.5">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{tr("complaints:supportingEvidenceDocuments")}{caseDetail.documents?.length || 0})</span>
                    </h4>
                    {caseDetail.documents && caseDetail.documents.length > 0 ? (
                      <div className="space-y-1">
                        {caseDetail.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2 bg-[#f8fafc] border border-slate-200 rounded-lg"
                          >
                            <div className="truncate pe-2">
                              <p className="font-semibold text-slate-900 truncate">{doc.originalName}</p>
                              <p className="text-xs text-slate-500">{Math.round(doc.fileSize / 1024)} KB • {localizeLabel(doc.documentType)}</p>
                            </div>
                            <button
                              onClick={() => api.downloadComplaintDocument(caseDetail.complaint.id, doc.id, doc.originalName)}
                              className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-aicte-navy-700 text-xs font-semibold shrink-0"
                            >{tr("complaints:download")}</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-xs italic">{tr("complaints:noSupportingDocumentsUploadedForThisCase")}</p>
                    )}
                  </div>

                  {/* Overlap & Related Cases */}
                  {caseDetail.overlapAlerts.length > 0 && (
                    <div className="p-3 bg-[#fffbeb] border border-[#f59e0b] rounded-lg">
                      <h4 className="font-bold text-[#92400e] mb-1 flex items-center space-x-1.5 uppercase text-xs">
                        <GitMerge className="w-3.5 h-3.5 text-[#b45309]" />
                        <span>{tr("complaints:potentialOverlapAlerts")}{caseDetail.overlapAlerts.length})</span>
                      </h4>
                      <p className="text-xs text-[#92400e] mb-2">{tr("complaints:automatedOverlapDetectionFlaggedMatchingGrievanceSignals")}</p>
                      <div className="space-y-1">
                        {caseDetail.overlapAlerts.map((ovl) => (
                          <div key={ovl.id} className="p-2 bg-white rounded-lg border border-[#fed7aa] flex justify-between items-center">
                            <div>
                              <span className="font-mono font-bold text-slate-900">{ovl.alertId}</span>
                              <span className="ms-2 text-slate-600 text-xs">{tr("complaints:score")}{ovl.ruleMatchScore}%</span>
                            </div>
                            <Link
                              to="/overlaps"
                              className="text-aicte-navy-700 hover:underline font-bold text-xs"
                            >{tr("complaints:review")}</Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Authorized SLA Override Action */}
                  {user?.role === "COMPETENT_AUTHORITY" && (
                    <div className="pt-2 border-t border-slate-200">
                      <button
                        onClick={() => {
                          setOverrideDeadline(caseDetail.complaint.expectedDisposalDate);
                          setOverrideModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg text-xs font-semibold border border-[#002147]"
                      >{tr("complaints:overrideStatutorySlaDeadline")}</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </ModalFrame>
      )}

      {/* ========================================================================= */}
      {/* 7. Quick Register Complaint Modal                                         */}
      {/* ========================================================================= */}
      {registerModalOpen && (
        <ModalFrame className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50" onClose={() => setRegisterModalOpen(false)}>
          <div className="bg-white rounded-lg max-w-lg w-full shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-aicte-navy-700 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">{tr("complaints:registerGrievance")}</h3>
                <p className="text-xs text-slate-300">{inst?.name}</p>
              </div>
              <button
                onClick={() => setRegisterModalOpen(false)}
                className="text-slate-300 hover:text-white" aria-label={tr("common:cancel")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickRegister} className="p-4 space-y-3 text-xs">
              {regError && (
                <div className="p-2 bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5] rounded-lg">
                  {localizeError(regError)}
                </div>
              )}
              {regSuccess && (
                <div className="p-2 bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] rounded-lg font-semibold">
                  {regSuccess}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">{tr("complaints:grievanceSubjectTitle_ba79d")}</label>
                <input aria-label={tr("complaints:grievanceSubjectTitle_ba79d")}
                  type="text"
                  required
                  value={regTitle}
                  onChange={(e) => setRegTitle(e.target.value)}
                  placeholder={tr("complaints:conciseSummaryOfTheGrievance")}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#003366]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">{tr("complaints:category_b1e97")}</label>
                  <select aria-label={tr("complaints:category_b1e97")}
                    value={regCategory}
                    onChange={(e) => setRegCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{localizeLabel(c)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">{tr("complaints:initialBureau")}</label>
                  <select aria-label={tr("complaints:initialBureau")}
                    value={regBureau}
                    onChange={(e) => setRegBureau(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="RB">{tr("complaints:regulationBureauRb")}</option>
                    <option value="PGRC">{tr("complaints:publicGrievanceRedressalCellPgrc")}</option>
                    <option value="RO">{tr("complaints:regionalOfficesRo")}</option>
                    <option value="AB">{tr("complaints:approvalBureauAb")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">{tr("complaints:severityPriority")}</label>
                <select aria-label={tr("complaints:severityPriority")}
                  value={regPriority}
                  onChange={(e) => setRegPriority(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                >
                  <option value="Low">{tr("complaints:lowGeneralInquiry30Days")}</option>
                  <option value="Medium">{tr("complaints:mediumAdministrative21Days")}</option>
                  <option value="High">{tr("complaints:highFacultyFeeIrregularity14Days")}</option>
                  <option value="Critical">{tr("complaints:criticalSafetyLegalThreat7Days")}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">{tr("complaints:detailedSubstance")}</label>
                <textarea aria-label={tr("complaints:detailedSubstance")}
                  rows={4}
                  required
                  value={regDescription}
                  onChange={(e) => setRegDescription(e.target.value)}
                  placeholder={tr("complaints:detailedDescriptionOfFactsStatutoryProvisionsViolated")}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#003366]"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
                >{tr("common:cancel")}</button>
                <button
                  type="submit"
                  disabled={regSubmitting}
                  className="px-4 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {regSubmitting ? tr("complaints:submitting") : tr("complaints:submitToLedger")}
                </button>
              </div>
            </form>
          </div>
        </ModalFrame>
      )}

      {/* ========================================================================= */}
      {/* 8. SLA Deadline Override Modal                                            */}
      {/* ========================================================================= */}
      {overrideModalOpen && (
        <ModalFrame className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50" onClose={() => setOverrideModalOpen(false)}>
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-aicte-navy-700 text-white flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">{tr("complaints:statutorySlaOverride")}</h3>
              <button onClick={() => setOverrideModalOpen(false)} className="text-slate-300 hover:text-white" aria-label={tr("common:cancel")}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleOverrideSla} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">{tr("complaints:newTargetDisposalDate")}</label>
                <input aria-label={tr("complaints:newTargetDisposalDate")}
                  type="date"
                  required
                  value={overrideDeadline}
                  onChange={(e) => setOverrideDeadline(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">{tr("complaints:officialAdministrativeGrounds")}</label>
                <textarea aria-label={tr("complaints:officialAdministrativeGrounds")}
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder={tr("complaints:recordJustificationUnderAicteRegulations")}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                />
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
                >{tr("common:cancel")}</button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="px-4 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {overrideSubmitting ? tr("complaints:recording") : tr("complaints:confirmOverride")}
                </button>
              </div>
            </form>
          </div>
        </ModalFrame>
      )}
    </div>
  );
};
