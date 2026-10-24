import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  Filter,
  RotateCcw,
  GitMerge,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  FilePlus,
  ArrowRight
} from "lucide-react";
import { api } from "../services/api.js";
import { Complaint } from "../services/types.js";

export const CaseList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [bureau, setBureau] = useState(searchParams.get("bureau") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [priority, setPriority] = useState(searchParams.get("priority") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [isOverdue, setIsOverdue] = useState(searchParams.get("isOverdue") === "true");
  const [hasOverlap, setHasOverlap] = useState(searchParams.get("hasOverlap") === "true");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await api.getComplaints({
        search,
        bureau,
        status,
        priority,
        category,
        isOverdue: isOverdue ? "true" : undefined,
        hasOverlap: hasOverlap ? "true" : undefined,
        page,
        limit: 15
      });
      setComplaints(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err) {
      console.error("Failed to fetch complaints list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [search, bureau, status, priority, category, isOverdue, hasOverlap, page]);

  const handleResetFilters = () => {
    setSearch("");
    setBureau("");
    setStatus("");
    setPriority("");
    setCategory("");
    setIsOverdue(false);
    setHasOverlap(false);
    setPage(1);
    setSearchParams({});
  };

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
  const statuses = ["Pending", "Under Process", "Disposed", "Transferred", "Escalated"];
  const priorities = ["Critical", "High", "Medium", "Low"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-aicte-navy-900 tracking-tight">
            Comprehensive Complaint Register
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Complete database of active, transferred, and disposed technical institution grievances.
          </p>
        </div>

        <Link
          to="/complaints/register"
          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-aicte-navy-900 hover:bg-aicte-navy-800 text-white rounded-md text-xs font-semibold shadow-xs self-start sm:self-auto"
        >
          <FilePlus className="w-4 h-4" />
          <span>Register New Case</span>
        </Link>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Complaint ID (e.g. AICTE/RB/2026/...), Institution Name, or Keyword..."
            className="w-full bg-slate-50 border border-slate-300 rounded-md pl-9 pr-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
          />
        </div>

        {/* Dropdowns & Checkboxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          <select
            value={bureau}
            onChange={e => {
              setBureau(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-700"
          >
            <option value="">All Bureaus</option>
            {bureaus.map(b => (
              <option key={b} value={b}>
                Bureau: {b}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-700"
          >
            <option value="">All Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={e => {
              setPriority(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-700"
          >
            <option value="">All Priorities</option>
            {priorities.map(p => (
              <option key={p} value={p}>
                {p} Priority
              </option>
            ))}
          </select>

          <select
            value={category}
            onChange={e => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="col-span-2 sm:col-span-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-700 truncate"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Quick Toggles */}
          <div className="flex items-center space-x-3 col-span-2 sm:col-span-2">
            <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700 select-none">
              <input
                type="checkbox"
                checked={isOverdue}
                onChange={e => {
                  setIsOverdue(e.target.checked);
                  setPage(1);
                }}
                className="rounded text-red-600 focus:ring-red-500"
              />
              <span className="font-medium text-red-700">Overdue SLA Only</span>
            </label>

            <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700 select-none">
              <input
                type="checkbox"
                checked={hasOverlap}
                onChange={e => {
                  setHasOverlap(e.target.checked);
                  setPage(1);
                }}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span className="font-medium text-amber-800">Overlap Alerts Only</span>
            </label>

            {(search || bureau || status || priority || category || isOverdue || hasOverlap) && (
              <button
                onClick={handleResetFilters}
                className="ml-auto flex items-center space-x-1 text-slate-500 hover:text-slate-800 underline text-xs"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Case Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Complaint ID</th>
                <th className="py-3 px-4">Institution Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-3 text-center">Bureau</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-3 text-center">Priority</th>
                <th className="py-3 px-3 text-center">Overlap</th>
                <th className="py-3 px-4">Received Date</th>
                <th className="py-3 px-4">Expected Disposal</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    Loading complaints register...
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No complaints found matching the active filters.
                  </td>
                </tr>
              ) : (
                complaints.map(c => {
                  const today = new Date().toISOString().split("T")[0];
                  const isBreached = ["Pending", "Under Process"].includes(c.status) && c.expectedDisposalDate < today;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-aicte-navy-900 whitespace-nowrap">
                        <Link to={`/cases/${c.id}`} className="hover:underline text-blue-700">
                          {c.complaintId}
                        </Link>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate">
                        <Link
                          to={`/institutions/${c.institutionId}`}
                          className="font-medium text-slate-800 hover:underline"
                        >
                          {c.institutionName}
                        </Link>
                        <div className="text-[10px] text-slate-400 font-mono">{c.aictePermanentId}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">{c.category}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-semibold px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                          {c.currentBureauId}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                            c.status === "Pending"
                              ? "bg-amber-100 text-amber-800"
                              : c.status === "Under Process"
                              ? "bg-blue-100 text-blue-800"
                              : c.status === "Disposed"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.status === "Transferred"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-semibold text-[11px] ${
                            c.priority === "Critical"
                              ? "text-red-700 font-bold"
                              : c.priority === "High"
                              ? "text-amber-700"
                              : "text-slate-600"
                          }`}
                        >
                          {c.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {c.hasOverlapAlert ? (
                          <Link
                            to="/overlaps"
                            title="Cross-Bureau Overlap Alert Active"
                            className="inline-flex items-center space-x-1 bg-amber-500/10 text-amber-800 border border-amber-300 font-bold px-1.5 py-0.5 rounded text-[10px]"
                          >
                            <GitMerge className="w-3 h-3 text-amber-600" />
                            <span>Alert</span>
                          </Link>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">{c.receivedDate}</td>
                      <td className="py-3 px-4 text-[11px] whitespace-nowrap">
                        <span className={isBreached ? "text-red-700 font-bold flex items-center space-x-1" : "text-slate-500"}>
                          {isBreached && <AlertTriangle className="w-3 h-3 text-red-600" />}
                          <span>{c.expectedDisposalDate}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/cases/${c.id}`}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-aicte-navy-900 hover:text-white text-slate-700 rounded text-xs font-medium transition inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-900">{complaints.length}</span> of{" "}
            <span className="font-semibold text-slate-900">{totalCount}</span> cases
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
              Previous
            </button>
            <span className="px-2 py-1 font-medium">
              Page {page} of {totalPages || 1}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
