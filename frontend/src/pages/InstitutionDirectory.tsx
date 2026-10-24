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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-aicte-navy-900 tracking-tight">
            AICTE Approved Institutions Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Central repository of 30+ technical institutions, AICTE Permanent IDs, and cross-bureau complaint tallies.
          </p>
        </div>

        {["Administrator", "Regulation Bureau Officer", "PGRC Officer"].includes(user?.role || "") && (
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-aicte-navy-900 hover:bg-aicte-navy-800 text-white rounded-md text-xs font-medium transition shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register New Institution</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Institution Name, Permanent ID (e.g. 1-3324510001), or City..."
            className="w-full bg-slate-50 border border-slate-300 rounded-md pl-9 pr-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={regionFilter}
            onChange={e => {
              setRegionFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
          >
            <option value="">All AICTE Regions</option>
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
              className="text-xs text-slate-500 hover:text-slate-800 underline px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Institutions Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">AICTE Permanent ID</th>
                <th className="py-3 px-4">Institution Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">State & Region</th>
                <th className="py-3 px-3 text-center">Total Cases</th>
                <th className="py-3 px-3 text-center">Active Cases</th>
                <th className="py-3 px-3 text-center">Overlaps</th>
                <th className="py-3 px-4">Latest Complaint</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                  <tr key={inst.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-aicte-navy-900 whitespace-nowrap">
                      {inst.aictePermanentId}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/institutions/${inst.id}`}
                        className="font-semibold text-blue-700 hover:underline hover:text-blue-900"
                      >
                        {inst.name}
                      </Link>
                      <div className="text-[11px] text-slate-400">{inst.city}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        {inst.institutionType}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{inst.state}</div>
                      <div className="text-[10px] text-slate-400">{inst.region.split("(")[0]}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      {inst.totalComplaintsCount}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                          inst.activeComplaintsCount > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {inst.activeComplaintsCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {inst.overlapCount > 0 ? (
                        <span className="inline-flex items-center space-x-1 bg-amber-500/10 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded text-[11px]">
                          <GitMerge className="w-3 h-3 text-amber-600" />
                          <span>{inst.overlapCount}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {inst.latestComplaintDate || "None"}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/institutions/${inst.id}`}
                        className="inline-flex items-center text-xs text-aicte-navy-700 hover:text-aicte-navy-900 font-medium hover:underline"
                      >
                        <span>Profile</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-900">{institutions.length}</span> of{" "}
            <span className="font-semibold text-slate-900">{totalRecords}</span> institutions
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

      {/* Register Institution Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-aicte-navy-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">Register New Approved Institution</h3>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterInstitution} className="p-5 space-y-4">
              {regError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                  {regError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institution Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Indraprastha Institute of Technology"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    AICTE Permanent ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPermId}
                    onChange={e => setFormPermId(e.target.value)}
                    placeholder="e.g. 1-9988776655"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
                  />
                  <span className="text-[10px] text-slate-400">Must be unique across AICTE database</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Institution Type
                  </label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
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
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={e => setFormCity(e.target.value)}
                    placeholder="City"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formState}
                    onChange={e => setFormState(e.target.value)}
                    placeholder="State"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  AICTE Regional Jurisdiction <span className="text-red-500">*</span>
                </label>
                <select
                  value={formRegion}
                  onChange={e => setFormRegion(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs"
                >
                  {regionsList.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regSubmitting}
                  className="px-4 py-1.5 bg-aicte-navy-900 text-white rounded text-xs font-semibold hover:bg-aicte-navy-800 disabled:opacity-50"
                >
                  {regSubmitting ? "Registering..." : "Confirm & Save Institution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
