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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const isSupervisor = user?.role === "Administrator" || user?.role === "Senior Management";
  const isInstitutional = user?.role === "Institutional User";
  const isDeskOfficer = !isSupervisor && !isInstitutional;

  // View-all override strictly for supervisors; by default everyone views their own cases
  const viewAllParam = searchParams.get("viewAll") === "true";
  const isMyCasesMode = !isInstitutional && (!isSupervisor || !viewAllParam);
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
      <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 font-medium">
        <Link to="/" className="hover:text-[#003366] hover:underline">Home</Link>
        <span>&rsaquo;</span>
        <span>Grievance Management</span>
        <span>&rsaquo;</span>
        <span className="text-slate-700 font-semibold">Complaint Register</span>
      </div>

      {/* 2. Compact Page Header & Actions */}
      <div className="bg-white border border-slate-300 rounded-xs p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-bold text-[#003366] tracking-tight">
              {isInstitutional ? "Institution Grievance Register" : isMyCasesMode ? "My Assigned Cases" : "Comprehensive Grievance Register"}
            </h1>
            <span className="bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold px-1.5 py-0.2 rounded-xs">
              {totalCount} {totalCount === 1 ? "RECORD" : "RECORDS"}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>Officer Context: <strong className="text-slate-700">{user?.fullName || "Official"}</strong></span>
            <span>&bull;</span>
            <span>Role: <strong className="text-slate-700">{user?.role}</strong></span>
            {user?.bureauId && (
              <>
                <span>&bull;</span>
                <span>Bureau: <strong className="text-slate-700">{user.bureauId}</strong></span>
              </>
            )}
            <span>&bull;</span>
            <span>Scope: <strong className="text-emerald-700 font-semibold">{isMyCasesMode ? "Desk-Assigned" : "All Bureaus"}</strong></span>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
          {/* Supervisor Scope Switch */}
          {isSupervisor && (
            <div className="inline-flex rounded-xs border border-slate-300 bg-slate-100 p-0.5 text-xs">
              <button
                onClick={() => updateFilterParams({ viewAll: undefined, page: 1 })}
                className={`px-2.5 py-1 text-xs font-semibold rounded-xs transition cursor-pointer ${
                  isMyCasesMode ? "bg-white text-[#003366] shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                My Cases
              </button>
              <button
                onClick={() => updateFilterParams({ viewAll: "true", page: 1 })}
                className={`px-2.5 py-1 text-xs font-semibold rounded-xs transition cursor-pointer ${
                  !isMyCasesMode ? "bg-white text-[#003366] shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Bureaus
              </button>
            </div>
          )}

          {/* Primary Action Button */}
          <Link
            to="/complaints/register"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#003366] hover:bg-[#002855] text-white text-xs font-semibold rounded-xs border border-[#002147] transition shadow-xs cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>Register Complaint</span>
          </Link>
        </div>
      </div>

      {/* 3. Compact Status Tabs Bar */}
      <div className="bg-white border border-slate-300 rounded-xs px-2 pt-2 flex items-center justify-between border-b-2 border-b-[#003366]">
        <div className="flex items-center space-x-1 overflow-x-auto text-xs">
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
                className={`px-3 py-1.5 font-semibold text-xs border-b-2 -mb-0.5 transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-b-2 border-[#003366] text-[#003366] bg-slate-50"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Single-Field Search & Collapsible Advanced Filter Panel */}
      <div className="bg-white border border-slate-300 rounded-xs p-2.5 space-y-2">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Primary Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by Complaint ID (AICTE/RB/...), Institution Name, City, or Category..."
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xs pl-8 pr-7 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(""); updateFilterParams({ search: undefined, page: 1 }); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5 w-full sm:w-auto shrink-0 justify-end">
            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-xs border transition cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? "bg-slate-100 border-[#003366] text-[#003366]"
                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Advanced Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 bg-[#003366] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              {showAdvancedFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Clear All Filters Button */}
            {(activeFiltersCount > 0 || searchParam || statusParam) && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center space-x-1 px-2 py-1.5 text-xs text-slate-600 hover:text-red-700 border border-slate-300 rounded-xs hover:bg-slate-50 transition cursor-pointer"
                title="Reset All Filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters Section */}
        {showAdvancedFilters && (
          <div className="pt-2.5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Assigned Bureau</label>
              <select
                value={bureauParam}
                onChange={e => updateFilterParams({ bureau: e.target.value, page: 1 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xs px-2 py-1 text-slate-700 text-xs focus:outline-none"
              >
                <option value="">All Bureaus</option>
                {bureaus.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Priority Level</label>
              <select
                value={priorityParam}
                onChange={e => updateFilterParams({ priority: e.target.value, page: 1 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xs px-2 py-1 text-slate-700 text-xs focus:outline-none"
              >
                <option value="">All Priorities</option>
                {priorities.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Violation Category</label>
              <select
                value={categoryParam}
                onChange={e => updateFilterParams({ category: e.target.value, page: 1 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xs px-2 py-1 text-slate-700 text-xs focus:outline-none truncate"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Sort Criteria</label>
              <select
                value={`${sortByParam}:${sortOrderParam}`}
                onChange={e => {
                  const [sb, so] = e.target.value.split(":");
                  updateFilterParams({ sortBy: sb, sortOrder: so, page: 1 });
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xs px-2 py-1 text-slate-700 text-xs focus:outline-none"
              >
                <option value="receivedDate:desc">Received Date (Newest first)</option>
                <option value="receivedDate:asc">Received Date (Oldest first)</option>
                <option value="expectedDisposalDate:asc">SLA Deadline (Urgent first)</option>
                <option value="priority:desc">Priority (Critical first)</option>
                <option value="updatedAt:desc">Last Action Date</option>
              </select>
            </div>

            {/* Date Range & Specific Toggles */}
            <div className="sm:col-span-2 md:col-span-4 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center space-x-2 text-slate-700">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-medium">Received Between:</span>
                <input
                  type="date"
                  value={receivedFromParam}
                  onChange={e => updateFilterParams({ receivedFrom: e.target.value, page: 1 })}
                  className="bg-slate-50 border border-slate-300 rounded-xs px-2 py-0.5 text-xs text-slate-700"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={receivedToParam}
                  onChange={e => updateFilterParams({ receivedTo: e.target.value, page: 1 })}
                  className="bg-slate-50 border border-slate-300 rounded-xs px-2 py-0.5 text-xs text-slate-700"
                />
              </div>

              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-1.5 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={isOverdueParam}
                    onChange={e => updateFilterParams({ isOverdue: e.target.checked, page: 1 })}
                    className="rounded-xs text-red-600 focus:ring-0"
                  />
                  <span className="font-semibold text-red-700">Overdue SLA Cases Only</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={hasOverlapParam}
                    onChange={e => updateFilterParams({ hasOverlap: e.target.checked, page: 1 })}
                    className="rounded-xs text-amber-600 focus:ring-0"
                  />
                  <span className="font-semibold text-amber-800">Overlap Alerts Only</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Information-Dense Government Data Table (10 Standard Columns) */}
      <div className="bg-white border border-slate-300 rounded-xs overflow-hidden">
        {fetchError && (
          <div className="p-3 bg-red-50 border-b border-red-200 text-xs text-red-800 flex items-center justify-between">
            <span>{fetchError}</span>
            <button
              onClick={fetchComplaints}
              className="px-2 py-0.5 bg-red-700 text-white text-[11px] font-semibold rounded-xs hover:bg-red-800"
            >
              Retry
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 gov-table">
            <thead>
              <tr>
                <th className="py-2.5 px-3">Complaint / Ref ID</th>
                <th className="py-2.5 px-3">Institution Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-2 text-center">Bureau</th>
                <th className="py-2.5 px-2.5 text-center">Current Status</th>
                <th className="py-2.5 px-2.5 text-center">Priority</th>
                <th className="py-2.5 px-2 text-center">Overlap</th>
                <th className="py-2.5 px-3">Received Date</th>
                <th className="py-2.5 px-3">Disposal SLA</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <div className="inline-flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-[#003366] border-t-transparent rounded-full animate-spin" />
                      <span>Retrieving official complaint records...</span>
                    </div>
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500">
                    <div className="max-w-sm mx-auto space-y-1.5">
                      <div className="font-bold text-slate-800 text-sm">No Grievance Records Found</div>
                      <p className="text-xs text-slate-500">
                        {isMyCasesMode
                          ? "No cases currently assigned to your desk match the specified filter criteria."
                          : "No records match the specified search and filter parameters."}
                      </p>
                      {(activeFiltersCount > 0 || searchParam || statusParam) && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xs text-xs font-semibold cursor-pointer border border-slate-300"
                        >
                          Clear All Filters
                        </button>
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
                      <td className="py-2.5 px-3 font-mono font-bold text-[#003366] whitespace-nowrap">
                        <Link to={`/cases/${c.id}`} className="hover:underline">
                          {c.complaintId}
                        </Link>
                      </td>

                      {/* 2. Institution Name */}
                      <td className="py-2.5 px-3 max-w-[220px]">
                        <Link
                          to={`/institutions/${c.institutionId}`}
                          className="font-medium text-slate-800 hover:text-[#003366] hover:underline block truncate"
                          title={c.institutionName}
                        >
                          {c.institutionName}
                        </Link>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {c.aictePermanentId}
                        </div>
                      </td>

                      {/* 3. Category */}
                      <td className="py-2.5 px-3 max-w-[180px] text-slate-600 truncate text-[11px]" title={c.category}>
                        {c.category}
                      </td>

                      {/* 4. Assigned Bureau */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-slate-100 text-slate-700 border border-slate-200">
                          {c.currentBureauId}
                        </span>
                      </td>

                      {/* 5. Current Status */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-xs text-[10px] font-semibold border ${
                            c.status === "Pending"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : c.status === "Under Process"
                              ? "bg-blue-50 text-blue-800 border-blue-300"
                              : c.status === "Disposed"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : c.status === "Transferred"
                              ? "bg-purple-50 text-purple-800 border-purple-300"
                              : "bg-red-50 text-red-800 border-red-300"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      {/* 6. Priority */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`font-semibold text-[10px] px-1.5 py-0.2 rounded-xs ${
                            c.priority === "Critical"
                              ? "text-red-700 font-bold bg-red-50 border border-red-200"
                              : c.priority === "High"
                              ? "text-amber-700 bg-amber-50 border border-amber-200"
                              : "text-slate-600 bg-slate-100"
                          }`}
                        >
                          {c.priority}
                        </span>
                      </td>

                      {/* 7. Overlap Indicator */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {c.hasOverlapAlert ? (
                          <Link
                            to="/overlaps"
                            title="Potential duplicate/overlap alert active"
                            className="inline-flex items-center space-x-0.5 bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-semibold px-1 py-0.2 rounded-xs"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Alert</span>
                          </Link>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>

                      {/* 8. Received Date */}
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap font-mono">
                        {c.receivedDate}
                      </td>

                      {/* 9. Expected Disposal Date / SLA */}
                      <td className="py-2.5 px-3 text-[11px] whitespace-nowrap font-mono">
                        {isBreached ? (
                          <span className="text-red-700 font-bold inline-flex items-center space-x-1" title="Statutory SLA Breached">
                            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>{c.expectedDisposalDate}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">{c.expectedDisposalDate}</span>
                        )}
                      </td>

                      {/* 10. Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <Link
                          to={`/cases/${c.id}`}
                          className="px-2 py-1 bg-slate-100 hover:bg-[#003366] hover:text-white text-slate-700 rounded-xs text-[11px] font-semibold border border-slate-300 hover:border-[#003366] transition inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
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
          <div>
            Showing <strong className="text-slate-900">{complaints.length}</strong> of{" "}
            <strong className="text-slate-900">{totalCount}</strong> records
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={pageParam <= 1 || loading}
              onClick={() => updateFilterParams({ page: pageParam - 1 })}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded-xs text-xs hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >
              &larr; Prev
            </button>
            <span className="font-medium text-slate-700">
              Page {pageParam} of {totalPages || 1}
            </span>
            <button
              disabled={pageParam >= totalPages || loading}
              onClick={() => updateFilterParams({ page: pageParam + 1 })}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded-xs text-xs hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
