import { canVisit } from "../services/access.js";
import { StatusBadge } from "../components/ui/Interface.js";
import { tr, localizeLabel, localizeError, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  Filter,
  RotateCcw,
  GitMerge,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilePlus,
  CalendarDays,
  Clock,
  ArrowUpDown,
  UserCheck,
  CheckCircle2,
  Shield,
  Building2,
  FolderKanban,
  User,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle
} from "lucide-react";
import { api } from "../services/api.js";
import { Complaint } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

export const CaseList: React.FC = () => {
  useLocaleRender();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const isSupervisor = user?.role === "BUREAU_HEAD" || user?.role === "COMPETENT_AUTHORITY";
  const isInstitutional = user?.role === "Institutional User";
  const isDeskOfficer = !isSupervisor && !isInstitutional;

  // View-all override strictly for supervisors; by default everyone views their own cases
  const viewAllParam = searchParams.get("viewAll") === "true";
  const isMyCasesMode = user?.role === "CASE_OFFICER" || (isSupervisor && searchParams.get("scope") === "my_cases");
  const effectiveOfficerId = isMyCasesMode ? user?.id : undefined;

  // URL-driven query states
  const searchParam = searchParams.get("search") || "";
  const bureauParam = searchParams.get("bureau") || "";
  const statusParam = searchParams.get("status") || "";
  const priorityParam = searchParams.get("priority") || "";
  const categoryParam = searchParams.get("category") || "";
  const isOverdueParam = searchParams.get("isOverdue") === "true";
  const isDueSoonParam = searchParams.get("isDueSoon") === "true";
  const hasOverlapParam = searchParams.get("hasOverlap") === "true";
  const assignedOfficerIdParam = searchParams.get("assignedOfficerId") || "";
  const receivedFromParam = searchParams.get("receivedFrom") || "";
  const receivedToParam = searchParams.get("receivedTo") || "";
  const sortByParam = searchParams.get("sortBy") || "receivedDate";
  const sortOrderParam = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);

  // Debounced input search state
  const [searchInput, setSearchInput] = useState(searchParam);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Collapsible advanced filters panel toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Request race condition prevention
  const reqSeqRef = useRef(0);

  // Debounce search input changes into URL params
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchParam) {
        updateFilterParams({ search: searchInput || undefined, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Synchronize search input if URL searchParam changes externally
  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  // Helper to update search params while preserving other filters
  const updateFilterParams = (updates: Record<string, string | number | boolean | undefined>) => {
    const current = Object.fromEntries(searchParams.entries());
    const next: Record<string, string> = { ...current };

    Object.entries(updates).forEach(([key, val]) => {
      if (val === undefined || val === "" || val === false) {
        delete next[key];
      } else {
        next[key] = String(val);
      }
    });

    setSearchParams(next);
  };

  // Fetch complaints from server whenever URL params or user identity change
  const fetchComplaints = async () => {
    setLoading(true);
    setFetchError(null);
    const thisReqSeq = ++reqSeqRef.current;

    try {
      const res = await api.getComplaints({
        search: searchParam || undefined,
        bureau: bureauParam || undefined,
        status: statusParam || undefined,
        priority: priorityParam || undefined,
        category: categoryParam || undefined,
        assignedOfficerId: effectiveOfficerId || assignedOfficerIdParam || undefined,
        institutionId: isInstitutional ? user?.institutionId : undefined,
        isOverdue: isOverdueParam ? "true" : undefined,
        isDueSoon: isDueSoonParam ? "true" : undefined,
        hasOverlap: hasOverlapParam ? "true" : undefined,
        receivedFrom: receivedFromParam || undefined,
        receivedTo: receivedToParam || undefined,
        sortBy: sortByParam,
        sortOrder: sortOrderParam,
        page: pageParam,
        limit: 15
      });

      if (thisReqSeq === reqSeqRef.current) {
        setComplaints(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      if (thisReqSeq === reqSeqRef.current) {
        console.error("Failed to fetch complaints list:", err);
        setFetchError(err.message || "Unable to fetch complaints from backend.");
      }
    } finally {
      if (thisReqSeq === reqSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [
    user?.id,
    effectiveOfficerId,
    viewAllParam,
    searchParam,
    bureauParam,
    statusParam,
    priorityParam,
    categoryParam,
    assignedOfficerIdParam,
    isOverdueParam,
    isDueSoonParam,
    hasOverlapParam,
    receivedFromParam,
    receivedToParam,
    sortByParam,
    sortOrderParam,
    pageParam
  ]);

  const handleResetFilters = () => {
    setSearchInput("");
    if (isSupervisor && viewAllParam) {
      setSearchParams({ viewAll: "true" });
    } else {
      setSearchParams({});
    }
  };

  // Active secondary filters count
  const activeFiltersCount = [
    Boolean(bureauParam),
    Boolean(priorityParam),
    Boolean(categoryParam),
    isOverdueParam,
    isDueSoonParam,
    hasOverlapParam,
    Boolean(receivedFromParam),
    Boolean(receivedToParam)
  ].filter(Boolean).length;

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

  const bureaus = ["RB", "PGRC", "RO", "AB", "PB"];
  const priorities = ["Critical", "High", "Medium", "Low"];

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-3.5">
      {/* 1. Official Breadcrumb */}
      <div className="text-xs text-slate-500 flex items-center space-x-1.5 font-medium">
        <Link to="/" className="hover:text-aicte-navy-700 hover:underline">{tr("complaints:home")}</Link>
        <span>{tr("complaints:rsaquo")}</span>
        <span>{tr("complaints:grievanceManagement")}</span>
        <span>{tr("complaints:rsaquo")}</span>
        <span className="text-slate-700 font-semibold">{tr("navigation:complaintRegister")}</span>
      </div>

      {/* 2. Compact Page Header & Actions */}
      <div className="page-header">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-bold text-aicte-navy-700 tracking-tight">
              {isInstitutional ? tr("complaints:institutionGrievanceRegister") : isMyCasesMode ? tr("navigation:myAssignedCases") : tr("navigation:complaintRegister")}
            </h1>
            <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-1.5 py-0.2 rounded-lg">
              {formatNumber(totalCount)} {totalCount === 1 ? tr("complaints:record") : tr("complaints:records")}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{tr("complaints:officerContext")}<strong className="text-slate-700">{user?.fullName || tr("complaints:official")}</strong></span>
            <span>&bull;</span>
            <span>{tr("complaints:role")}<strong className="text-slate-700">{localizeLabel(user?.role)}</strong></span>
            {user?.bureauId && (
              <>
                <span>&bull;</span>
                <span>{tr("complaints:bureau")}<strong className="text-slate-700"><bdi dir="ltr" className="canonical-value">{user.bureauId}</bdi></strong></span>
              </>
            )}
            <span>&bull;</span>
            <span>{tr("administration:scope")}<strong className="text-emerald-700 font-semibold">{isMyCasesMode ? tr("complaints:deskAssigned") : tr("navigation:ui.authorizedScope")}</strong></span>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
          {/* Supervisor Scope Switch */}
          {isSupervisor && (
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
              <button
                onClick={() => updateFilterParams({ scope: "my_cases", viewAll: undefined, page: 1 })}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  isMyCasesMode ? "bg-white text-aicte-navy-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >{tr("complaints:myCases")}</button>
              <button
                onClick={() => updateFilterParams({ scope: undefined, viewAll: "true", page: 1 })}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  !isMyCasesMode ? "bg-white text-aicte-navy-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >{tr("navigation:ui.allAuthorizedCases")}</button>
            </div>
          )}

          {/* Primary Action Button */}
          {canVisit(user?.role || "", "/complaints/register") && <Link
            to="/complaints/register"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-aicte-navy-700 hover:bg-[#002855] text-white text-xs font-semibold rounded-lg border border-[#002147] transition shadow-xs cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>{tr("navigation:registerComplaint")}</span>
          </Link>}
        </div>
      </div>

      {/* 3. Compact Status Tabs Bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center space-x-1 overflow-x-auto text-xs max-w-full">
          {[
            { id: "", label: "All Statuses" },
            { id: "Pending", label: "Pending" },
            { id: "Under Process", label: "Under Process" },
            { id: "Disposed", label: "Disposed" },
            { id: "Transferred", label: "Transferred" },
            { id: "Escalated", label: "Escalated" }
          ].map(tab => {
            const isActive = (statusParam || "") === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => updateFilterParams({ status: tab.id || undefined, page: 1 })}
                className="tab-button" aria-pressed={isActive}
              >
                {localizeLabel(tab.label)}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Single-Field Search & Collapsible Advanced Filter Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-2">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Primary Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute start-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label={tr("complaints:searchByComplaintIdAicteRbInstitutionNameCity")}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={tr("complaints:searchByComplaintIdAicteRbInstitutionNameCity")}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg ps-8 pe-7 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(""); updateFilterParams({ search: undefined, page: 1 }); }}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                title={tr("complaints:clearSearch")} aria-label={tr("complaints:clearSearch")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5 w-full sm:w-auto shrink-0 justify-end">
            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              aria-expanded={showAdvancedFilters}
              className={`inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? "bg-slate-100 border-[#003366] text-aicte-navy-700"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{tr("complaints:advancedFilters")}</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 bg-aicte-navy-700 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              {showAdvancedFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Clear All Filters Button */}
            {(activeFiltersCount > 0 || searchParam || statusParam) && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center space-x-1 px-2 py-1.5 text-xs text-slate-600 hover:text-red-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                title={tr("complaints:resetAllFilters")}
              >
                <RotateCcw className="w-3 h-3" />
                <span>{tr("complaints:reset")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters Section */}
        {showAdvancedFilters && (
          <div className="pt-2.5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-0.5">{tr("complaints:assignedBureau")}</label>
              <select aria-label={tr("complaints:assignedBureau")}
                value={bureauParam}
                onChange={e => updateFilterParams({ bureau: e.target.value, page: 1 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs focus:outline-none"
              >
                <option value="">{tr("complaints:allBureaus")}</option>
                {bureaus.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-0.5">{tr("complaints:priorityLevel")}</label>
              <select aria-label={tr("complaints:priorityLevel")}
                value={priorityParam}
                onChange={e => updateFilterParams({ priority: e.target.value, page: 1 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs focus:outline-none"
              >
                <option value="">{tr("complaints:allPriorities")}</option>
                {priorities.map(p => (
                  <option key={p} value={p}>{localizeLabel(p)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-0.5">{tr("complaints:violationCategory")}</label>
              <select aria-label={tr("complaints:violationCategory")}
                value={categoryParam}
                onChange={e => updateFilterParams({ category: e.target.value, page: 1 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs focus:outline-none truncate"
              >
                <option value="">{tr("complaints:allCategories")}</option>
                {categories.map(c => (
                  <option key={c} value={c}>{localizeLabel(c)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-0.5">{tr("complaints:sortCriteria")}</label>
              <select aria-label={tr("complaints:sortCriteria")}
                value={`${sortByParam}:${sortOrderParam}`}
                onChange={e => {
                  const [sb, so] = e.target.value.split(":");
                  updateFilterParams({ sortBy: sb, sortOrder: so, page: 1 });
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs focus:outline-none"
              >
                <option value="receivedDate:desc">{tr("complaints:receivedDateNewestFirst")}</option>
                <option value="receivedDate:asc">{tr("complaints:receivedDateOldestFirst")}</option>
                <option value="expectedDisposalDate:asc">{tr("complaints:slaDeadlineUrgentFirst")}</option>
                <option value="priority:desc">{tr("complaints:priorityCriticalFirst")}</option>
                <option value="updatedAt:desc">{tr("complaints:lastActionDate")}</option>
              </select>
            </div>

            {/* Date Range & Specific Toggles */}
            <div className="sm:col-span-2 md:col-span-4 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center space-x-2 text-slate-700">
                <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-medium">{tr("complaints:receivedBetween")}</span>
                <input
                  type="date"
                  value={receivedFromParam}
                  onChange={e => updateFilterParams({ receivedFrom: e.target.value, page: 1 })}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={receivedToParam}
                  onChange={e => updateFilterParams({ receivedTo: e.target.value, page: 1 })}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700"
                />
              </div>

              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-1.5 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={isOverdueParam}
                    onChange={e => updateFilterParams({ isOverdue: e.target.checked, page: 1 })}
                    className="rounded-lg text-red-600 focus:ring-0"
                  />
                  <span className="font-semibold text-red-700">{tr("complaints:overdueSlaCasesOnly")}</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={hasOverlapParam}
                    onChange={e => updateFilterParams({ hasOverlap: e.target.checked, page: 1 })}
                    className="rounded-lg text-amber-600 focus:ring-0"
                  />
                  <span className="font-semibold text-amber-800">{tr("complaints:overlapAlertsOnly")}</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Information-Dense Government Data Table (10 Standard Columns) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {fetchError && (
          <div className="p-3 bg-red-50 border-b border-red-200 text-xs text-red-800 flex items-center justify-between">
            <span>{localizeError(fetchError)}</span>
            <button
              onClick={fetchComplaints}
              className="px-2 py-0.5 bg-red-700 text-white text-xs font-semibold rounded-lg hover:bg-red-800"
            >{tr("complaints:retry")}</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-slate-700 gov-table">
            <thead>
              <tr>
                <th className="py-2.5 px-3">{tr("complaints:complaintRefId")}</th>
                <th className="py-2.5 px-3">{tr("complaints:institutionName")}</th>
                <th className="py-2.5 px-3">{tr("complaints:category")}</th>
                <th className="py-2.5 px-2 text-center">{tr("dashboard:bureau")}</th>
                <th className="py-2.5 px-2.5 text-center">{tr("complaints:currentStatus")}</th>
                <th className="py-2.5 px-2.5 text-center">{tr("complaints:priority")}</th>
                <th className="py-2.5 px-2 text-center">{tr("complaints:overlap")}</th>
                <th className="py-2.5 px-3">{tr("complaints:receivedDate")}</th>
                <th className="py-2.5 px-3">{tr("complaints:disposalSla")}</th>
                <th className="py-2.5 px-3 text-end">{tr("complaints:actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <div className="inline-flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-[#003366] border-t-transparent rounded-full animate-spin" />
                      <span>{tr("complaints:retrievingOfficialComplaintRecords")}</span>
                    </div>
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500">
                    <div className="max-w-sm mx-auto space-y-1.5">
                      <div className="font-bold text-slate-800 text-sm">{tr("complaints:noGrievanceRecordsFound")}</div>
                      <p className="text-xs text-slate-500">
                        {isMyCasesMode ? tr("complaints:noCasesCurrentlyAssignedToYourDeskMatchThe") : tr("complaints:noRecordsMatchTheSpecifiedSearchAndFilterParameters")}
                      </p>
                      {(activeFiltersCount > 0 || searchParam || statusParam) && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
                        >{tr("complaints:clearAllFilters")}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                complaints.map(c => {
                  const isBreached = ["Pending", "Under Process"].includes(c.status) && c.expectedDisposalDate < today;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      {/* 1. Complaint / Ref ID */}
                      <td className="py-2.5 px-3 font-mono font-bold text-aicte-navy-700 whitespace-nowrap">
                        <Link to={`/cases/${c.id}`} className="hover:underline">
                          <bdi dir="ltr" className="canonical-value">{c.complaintId}</bdi>
                        </Link>
                      </td>

                      {/* 2. Institution Name */}
                      <td className="py-2.5 px-3 max-w-[220px]">
                        <Link
                          to={`/institutions/${c.institutionId}`}
                          className="font-medium text-slate-800 hover:text-aicte-navy-700 hover:underline block truncate"
                          title={c.institutionName}
                        >
                          <bdi dir="auto" className="original-content">{c.institutionName}</bdi>
                        </Link>
                        <div className="text-xs text-slate-500 font-mono">
                          ID: {c.aictePermanentId}
                        </div>
                      </td>

                      {/* 3. Category */}
                      <td className="py-2.5 px-3 max-w-[180px] text-slate-600 truncate text-xs" title={c.category}>
                        {c.category}
                      </td>

                      {/* 4. Assigned Bureau */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                          <bdi dir="ltr" className="canonical-value">{c.currentBureauId}</bdi>
                        </span><div className="text-xs text-slate-500 mt-1">{c.assignedOfficerName || tr("dashboard:unassigned")}</div>
                      </td>

                      {/* 5. Current Status */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <StatusBadge value={c.status}/>
                      </td>

                      {/* 6. Priority */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`font-semibold text-xs px-1.5 py-0.2 rounded-lg ${
                            c.priority === "Critical"
                              ? "text-red-700 font-bold bg-red-50 border border-red-200"
                              : c.priority === "High"
                              ? "text-amber-700 bg-amber-50 border border-amber-200"
                              : "text-slate-600 bg-slate-100"
                          }`}
                        >
                          {localizeLabel(c.priority)}
                        </span>
                      </td>

                      {/* 7. Overlap Indicator */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {c.hasOverlapAlert ? (
                          <Link
                            to="/overlaps"
                            title={tr("complaints:potentialDuplicateOverlapAlertActive")}
                            className="inline-flex items-center space-x-0.5 bg-amber-50 text-amber-800 border border-amber-300 text-xs font-semibold px-1 py-0.2 rounded-lg"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>{tr("complaints:alert")}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* 8. Received Date */}
                      <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap font-mono">
                        {formatDate(c.receivedDate)}<span className="block mt-1 text-xs text-slate-500">{tr("navigation:ui.lastUpdated")}: {formatDate(c.updatedAt)}</span>
                      </td>

                      {/* 9. Expected Disposal Date / SLA */}
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap font-mono">
                        {isBreached ? (
                          <span className="text-red-700 font-bold inline-flex items-center space-x-1" title={tr("complaints:statutorySlaBreached")}>
                            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>{formatDate(c.expectedDisposalDate)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">{formatDate(c.expectedDisposalDate)}</span>
                        )}
                      </td>

                      {/* 10. Actions */}
                      <td className="py-2.5 px-3 text-end whitespace-nowrap">
                        <Link
                          to={`/cases/${c.id}`}
                          className="px-2 py-1 bg-slate-100 hover:bg-aicte-navy-700 hover:text-white text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 hover:border-[#003366] transition inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{tr("complaints:inspect")}</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Compact Pagination Bar */}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>{tr("complaints:showing")}<strong className="text-slate-900">{complaints.length}</strong> of{" "}
            <strong className="text-slate-900">{formatNumber(totalCount)}</strong>{tr("complaints:records_c7b99")}</div>
          <div className="flex items-center space-x-2">
            <button
              disabled={pageParam <= 1 || loading}
              onClick={() => updateFilterParams({ page: pageParam - 1 })}
              className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >{tr("complaints:prev")}</button>
            <span className="font-medium text-slate-700">{tr("dashboard:page")}{formatNumber(pageParam)} of {formatNumber(Math.max(1,totalPages))}
            </span>
            <button
              disabled={pageParam >= totalPages || loading}
              onClick={() => updateFilterParams({ page: pageParam + 1 })}
              className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >{tr("complaints:next")}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
