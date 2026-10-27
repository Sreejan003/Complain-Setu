import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  Search,
  Filter,
  Plus,
  GitMerge,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X
} from "lucide-react";
import { api } from "../services/api.js";
import { Institution } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

export const InstitutionDirectory: React.FC = () => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Registration modal form state
  const [formName, setFormName] = useState("");
  const [formPermId, setFormPermId] = useState("");
  const [formType, setFormType] = useState<any>("Engineering");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formRegion, setFormRegion] = useState("Northern Region (Kanpur)");
  const [formAddress, setFormAddress] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [regError, setRegError] = useState("");
  const [regSubmitting, setRegSubmitting] = useState(false);

  const fetchInstitutions = async () => {
    setLoading(true);
    try {
      const res = await api.getInstitutions({
        search,
        region: regionFilter,
        page,
        limit: 10
      });
      setInstitutions(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalRecords(res.pagination.total);
    } catch (err) {
      console.error("Error fetching institutions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, [search, regionFilter, page]);

  const handleRegisterInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSubmitting(true);

    try {
      await api.registerInstitution({
        name: formName,
        aictePermanentId: formPermId,
        institutionType: formType,
        city: formCity,
        state: formState,
        region: formRegion,
        address: formAddress || `${formCity}, ${formState}`,
        contactEmail: formEmail || `registrar@${formName.toLowerCase().replace(/[^a-z]/g, "")}.edu.in`,
        contactPhone: formPhone || "+91 11 20000000",
        yearEstablished: 2012,
        accreditationStatus: "AICTE Approved"
      });

      setShowRegisterModal(false);
      // Reset form
      setFormName("");
      setFormPermId("");
      setFormCity("");
      setFormState("");
      fetchInstitutions();
    } catch (err: any) {
      setRegError(err.message || "Failed to register institution.");
    } finally {
      setRegSubmitting(false);
    }
  };

  const regionsList = [
    "Northern Region (Kanpur)",
    "North-Western Region (Chandigarh)",
    "Southern Region (Chennai)",
    "South-Western Region (Bangalore)",
    "Western Region (Mumbai)",
    "Central Region (Bhopal)",
    "Eastern Region (Kolkata)",
    "South-Central Region (Hyderabad)"
  ];

  return (
    <div className="space-y-4">
      {/* Official Header */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#003366]">Government of India &bull; AICTE Institutional Directory</div>
          <h1 className="text-base sm:text-lg font-bold text-[#002147] tracking-tight">
            AICTE Approved Institutions Master Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Central repository of technical institutions, AICTE Permanent IDs, and multi-bureau grievance histories.
          </p>
        </div>

        {["Administrator", "Regulation Bureau Officer", "PGRC Officer"].includes(user?.role || "") && (
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs text-xs font-semibold shadow-none self-start sm:self-auto transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register New Institution</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-3 shadow-none flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between text-xs">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Institution Name, Permanent ID (e.g. 1-3324510001), or City..."
            className="w-full bg-white border border-[#cbd5e1] rounded-xs pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#003366]"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={regionFilter}
            onChange={e => {
              setRegionFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-[#cbd5e1] rounded-xs px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#003366]"
          >
            <option value="">All AICTE Regional Jurisdictions</option>
            {regionsList.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {(search || regionFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setRegionFilter("");
                setPage(1);
              }}
              className="text-xs text-[#003366] hover:underline px-2 cursor-pointer font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Institutions Table */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gov-table w-full text-left text-xs">
            <thead>
              <tr>
                <th>AICTE Permanent ID</th>
                <th>Institution Name</th>
                <th>Type</th>
                <th>State & Region</th>
                <th className="text-center">Total Cases</th>
                <th className="text-center">Active Cases</th>
                <th className="text-center">Overlaps</th>
                <th>Latest Grievance</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Loading institutions directory...
                  </td>
                </tr>
              ) : institutions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No institutions matched your search filter.
                  </td>
                </tr>
              ) : (
                institutions.map(inst => (
                  <tr key={inst.id}>
                    <td className="font-mono font-bold text-[#002147] whitespace-nowrap">
                      {inst.aictePermanentId}
                    </td>
                    <td>
                      <Link
                        to={`/institutions/${inst.id}`}
                        className="font-semibold text-[#003366] hover:underline"
                      >
                        {inst.name}
                      </Link>
                      <div className="text-[11px] text-slate-500">{inst.city}</div>
                    </td>
                    <td>
                      <span className="bg-[#f1f5f9] text-slate-700 border border-[#cbd5e1] px-1.5 py-0.2 rounded-xs text-[10px] font-medium">
                        {inst.institutionType}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="font-medium text-slate-800">{inst.state}</div>
                      <div className="text-[10px] text-slate-500">{inst.region.split("(")[0]}</div>
                    </td>
                    <td className="text-center font-bold text-slate-800 font-mono">
                      {inst.totalComplaintsCount}
                    </td>
                    <td className="text-center font-mono">
                      <span
                        className={`font-semibold px-1.5 py-0.2 rounded-xs text-[10px] border ${
                          inst.activeComplaintsCount > 0
                            ? "bg-[#fffbeb] text-[#92400e] border-[#fde68a]"
                            : "bg-[#f8fafc] text-slate-600 border-[#cbd5e1]"
                        }`}
                      >
                        {inst.activeComplaintsCount}
                      </span>
                    </td>
                    <td className="text-center font-mono">
                      {inst.overlapCount > 0 ? (
                        <span className="inline-flex items-center space-x-1 bg-[#fffbeb] text-[#92400e] border border-[#fde68a] font-bold px-1.5 py-0.2 rounded-xs text-[10px]">
                          <GitMerge className="w-3 h-3 text-[#b45309]" />
                          <span>{inst.overlapCount}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="text-slate-500 text-[11px] font-mono whitespace-nowrap">
                      {inst.latestComplaintDate || "None"}
                    </td>
                    <td className="text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/institutions/${inst.id}`}
                        className="inline-flex items-center text-xs text-[#003366] font-semibold hover:underline"
                      >
                        <span>Single Window</span>
                        <ChevronRight className="w-3 h-3 ml-0.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-2.5 bg-[#f8fafc] border-t border-[#cbd5e1] flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-900">{institutions.length}</span> of{" "}
            <span className="font-semibold text-slate-900">{totalRecords}</span> institutions
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-2.5 py-1 bg-white border border-[#cbd5e1] rounded-xs text-xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
              Previous
            </button>
            <span className="px-2 py-1 font-mono font-medium">
              Page {page} of {totalPages || 1}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-2.5 py-1 bg-white border border-[#cbd5e1] rounded-xs text-xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Register Institution Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-lg max-w-lg w-full overflow-hidden border border-[#cbd5e1]">
            <div className="px-4 py-3 bg-[#f8fafc] border-b border-[#cbd5e1] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-[#003366]" />
                <h3 className="text-sm font-bold text-[#002147]">Register New Approved Institution</h3>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterInstitution} className="p-4 space-y-3.5">
              {regError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs">
                  {regError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institution Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. National Institute of Science and Technology"
                  className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    AICTE Permanent ID <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPermId}
                    onChange={e => setFormPermId(e.target.value)}
                    placeholder="e.g. 1-9988776655"
                    className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs font-mono focus:border-[#003366] focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">Unique alphanumeric AICTE identifier</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Institution Type
                  </label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Management">Management</option>
                    <option value="Pharmacy">Pharmacy</option>
                    <option value="Polytechnic">Polytechnic</option>
                    <option value="Architecture">Architecture</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={e => setFormCity(e.target.value)}
                    placeholder="City"
                    className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formState}
                    onChange={e => setFormState(e.target.value)}
                    placeholder="State"
                    className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  AICTE Regional Jurisdiction <span className="text-red-600">*</span>
                </label>
                <select
                  value={formRegion}
                  onChange={e => setFormRegion(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xs px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                >
                  {regionsList.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-[#e2e8f0] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-3 py-1.5 border border-[#cbd5e1] rounded-xs text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regSubmitting}
                  className="px-3.5 py-1.5 bg-[#003366] text-white rounded-xs text-xs font-semibold hover:bg-[#002147] disabled:opacity-50 cursor-pointer"
                >
                  {regSubmitting ? "Registering..." : "Confirm & Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
