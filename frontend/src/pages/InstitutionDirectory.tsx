import { tr, localizeLabel, localizeError, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
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
  ArrowUpDown,
  RotateCcw,
  X
} from "lucide-react";
import { api } from "../services/api.js";
import { Institution } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

const REGIONS_LIST = [
  "Northern Region (Kanpur)",
  "North-Western Region (Chandigarh)",
  "Eastern Region (Kolkata)",
  "Western Region (Mumbai)",
  "Central Region (Bhopal)",
  "Southern Region (Chennai)",
  "South-Western Region (Bangalore)",
  "South-Central Region (Hyderabad)"
];

const DEFAULT_STATE_REGION_PAIRS = [
  { state: "Karnataka", region: "South-Western Region (Bangalore)" },
  { state: "Kerala", region: "South-Western Region (Bangalore)" },
  { state: "Uttar Pradesh", region: "Northern Region (Kanpur)" },
  { state: "Uttarakhand", region: "Northern Region (Kanpur)" },
  { state: "Punjab", region: "North-Western Region (Chandigarh)" },
  { state: "Haryana", region: "North-Western Region (Chandigarh)" },
  { state: "Himachal Pradesh", region: "North-Western Region (Chandigarh)" },
  { state: "Jammu and Kashmir", region: "North-Western Region (Chandigarh)" },
  { state: "Rajasthan", region: "North-Western Region (Chandigarh)" },
  { state: "Delhi", region: "North-Western Region (Chandigarh)" },
  { state: "Chandigarh", region: "North-Western Region (Chandigarh)" },
  { state: "Madhya Pradesh", region: "Central Region (Bhopal)" },
  { state: "Chhattisgarh", region: "Central Region (Bhopal)" },
  { state: "Gujarat", region: "Central Region (Bhopal)" },
  { state: "Bihar", region: "Eastern Region (Kolkata)" },
  { state: "Jharkhand", region: "Eastern Region (Kolkata)" },
  { state: "West Bengal", region: "Eastern Region (Kolkata)" },
  { state: "Orissa", region: "Eastern Region (Kolkata)" },
  { state: "Assam", region: "Eastern Region (Kolkata)" },
  { state: "Sikkim", region: "Eastern Region (Kolkata)" },
  { state: "Tripura", region: "Eastern Region (Kolkata)" },
  { state: "Manipur", region: "Eastern Region (Kolkata)" },
  { state: "Meghalaya", region: "Eastern Region (Kolkata)" },
  { state: "Mizoram", region: "Eastern Region (Kolkata)" },
  { state: "Nagaland", region: "Eastern Region (Kolkata)" },
  { state: "Arunachal Pradesh", region: "Eastern Region (Kolkata)" },
  { state: "Andaman and Nicobar Islands", region: "Eastern Region (Kolkata)" },
  { state: "Andhra Pradesh", region: "South-Central Region (Hyderabad)" },
  { state: "Telangana", region: "South-Central Region (Hyderabad)" },
  { state: "Tamil Nadu", region: "Southern Region (Chennai)" },
  { state: "Puducherry", region: "Southern Region (Chennai)" },
  { state: "Maharashtra", region: "Western Region (Mumbai)" },
  { state: "Goa", region: "Western Region (Mumbai)" },
  { state: "Dadra and Nagar Haveli", region: "Western Region (Mumbai)" },
  { state: "Daman and Diu", region: "Western Region (Mumbai)" }
];

export const InstitutionDirectory: React.FC = () => {
  useLocaleRender();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [search, setSearch] = useState("");
  const [mergedStateRegion, setMergedStateRegion] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filter options loaded from database
  const [statesList, setStatesList] = useState<string[]>([]);
  const [districtsList, setDistrictsList] = useState<string[]>([]);
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [regionsList, setRegionsList] = useState<string[]>(REGIONS_LIST);
  const [stateRegionPairs, setStateRegionPairs] = useState<{ state: string; region: string }[]>(DEFAULT_STATE_REGION_PAIRS);

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

  // Load filter lists from backend
  useEffect(() => {
    async function loadFilters() {
      try {
        const filters = await api.getInstitutionFilters({
          state: stateFilter || undefined,
          district: districtFilter || undefined
        });
        if (!stateFilter) {
          setStatesList(filters.states || []);
        }
        if (filters.regions && filters.regions.length > 0) {
          setRegionsList(filters.regions);
        }
        if (filters.stateRegionPairs && filters.stateRegionPairs.length > 0) {
          setStateRegionPairs(filters.stateRegionPairs);
        }
        setDistrictsList(filters.districts || []);
        setCitiesList(filters.cities || []);
      } catch (err) {
        console.error("Failed to load institution filter lists:", err);
      }
    }
    loadFilters();
  }, [stateFilter, districtFilter]);

  const fetchInstitutions = async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await api.getInstitutions({
        search: search.trim() || undefined,
        region: regionFilter || undefined,
        state: stateFilter || undefined,
        district: districtFilter || undefined,
        city: cityFilter || undefined,
        sortBy,
        sortOrder,
        page,
        limit: 15
      });
      setInstitutions(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalRecords(res.pagination.total);
    } catch (err: any) {
      console.error("Error fetching institutions:", err);
      setFetchError(err.message || "Failed to load institutions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInstitutions();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, regionFilter, stateFilter, districtFilter, cityFilter, sortBy, sortOrder, page]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const resetAllFilters = () => {
    setSearch("");
    setMergedStateRegion("");
    setRegionFilter("");
    setStateFilter("");
    setDistrictFilter("");
    setCityFilter("");
    setSortBy("name");
    setSortOrder("asc");
    setPage(1);
  };

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

  return (
    <div className="space-y-4">
      {/* Official Header */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg p-4 shadow-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700">
            {tr("complaints:governmentOfIndiaAicteInstitutionalDirectory")}
          </div>
          <h1 className="text-base sm:text-lg font-bold text-aicte-navy-900 tracking-tight">
            {tr("complaints:aicteApprovedInstitutionsMasterDirectory")}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Canonical Directory of AICTE Institutions · {formatNumber(totalRecords)} records indexed from Institute_List.pdf
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="bg-slate-100 text-slate-700 font-mono text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200">
            {formatNumber(totalRecords)} Total Records
          </span>
          {["BUREAU_HEAD", "COMPETENT_AUTHORITY"].includes(user?.role || "") && (
            <button
              onClick={() => setShowRegisterModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg text-xs font-semibold shadow-none transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{tr("complaints:registerNewInstitution")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar with State, District, and City Filters */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg p-3 shadow-none space-y-2.5 text-xs">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search institution among these by Name, Permanent ID (e.g. 1-6648541), or City..."
              className="w-full bg-white border border-[#e5eaf0] rounded-lg ps-8 pe-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#003366]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Merged State & Region Filter */}
            <select
              value={mergedStateRegion}
              onChange={e => {
                const val = e.target.value;
                setMergedStateRegion(val);
                if (val.startsWith("region:")) {
                  setRegionFilter(val.replace("region:", ""));
                  setStateFilter("");
                } else if (val.startsWith("state:")) {
                  setStateFilter(val.replace("state:", ""));
                  setRegionFilter("");
                } else {
                  setRegionFilter("");
                  setStateFilter("");
                }
                setDistrictFilter("");
                setCityFilter("");
                setPage(1);
              }}
              className="bg-white border border-[#e5eaf0] rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#003366] font-medium"
            >
              <option value="">All States & Regions (8 Regions · 34 States)</option>
              {regionsList.map(r => {
                const states = stateRegionPairs.filter(p => p.region === r).map(p => p.state);
                return (
                  <optgroup key={r} label={r}>
                    <option value={`region:${r}`}>All {r}</option>
                    {states.map(st => (
                      <option key={st} value={`state:${st}`}>
                        {st} ({r.split(" ")[0]})
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>

            {/* District Filter */}
            <select
              value={districtFilter}
              onChange={e => {
                setDistrictFilter(e.target.value);
                setCityFilter("");
                setPage(1);
              }}
              disabled={!districtsList.length}
              className="bg-white border border-[#e5eaf0] rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#003366] disabled:opacity-50"
            >
              <option value="">All Districts ({districtsList.length})</option>
              {districtsList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* City Filter */}
            <select
              value={cityFilter}
              onChange={e => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              disabled={!citiesList.length}
              className="bg-white border border-[#e5eaf0] rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#003366] disabled:opacity-50"
            >
              <option value="">All Cities ({citiesList.length})</option>
              {citiesList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {(search || mergedStateRegion || regionFilter || stateFilter || districtFilter || cityFilter) && (
              <button
                onClick={resetAllFilters}
                className="flex items-center space-x-1 text-xs text-aicte-navy-700 hover:underline px-2 cursor-pointer font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{tr("complaints:resetFilters")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {fetchError && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-lg">
          {fetchError}
        </div>
      )}

      {/* Institutions Table (Permanent ID, Name, State, District, City, Cases, Actions) */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gov-table w-full text-start text-xs">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort("aictePermanentId")}
                  className="cursor-pointer hover:bg-slate-100 transition select-none"
                >
                  <div className="flex items-center space-x-1">
                    <span>{tr("complaints:aictePermanentId")}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("name")}
                  className="cursor-pointer hover:bg-slate-100 transition select-none"
                >
                  <div className="flex items-center space-x-1">
                    <span>{tr("complaints:institutionName")}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("state")}
                  className="cursor-pointer hover:bg-slate-100 transition select-none"
                >
                  <div className="flex items-center space-x-1">
                    <span>State & Region</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("district")}
                  className="cursor-pointer hover:bg-slate-100 transition select-none"
                >
                  <div className="flex items-center space-x-1">
                    <span>District</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("city")}
                  className="cursor-pointer hover:bg-slate-100 transition select-none"
                >
                  <div className="flex items-center space-x-1">
                    <span>City</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="text-center">Grievances</th>
                <th className="text-end">{tr("complaints:actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-700">Loading Institutions Directory...</div>
                      <div className="text-xs text-slate-400">Querying persistent AICTE database</div>
                    </div>
                  </td>
                </tr>
              ) : institutions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="max-w-sm mx-auto space-y-1.5">
                      <div className="font-bold text-slate-800 text-sm">{tr("complaints:noInstitutionsMatchedYourSearchFilter")}</div>
                      <p className="text-xs text-slate-500">
                        No institution records found for the applied search and geographic filters.
                      </p>
                      {(search || regionFilter || stateFilter || districtFilter || cityFilter) && (
                        <button
                          onClick={resetAllFilters}
                          className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                institutions.map(inst => (
                  <tr key={inst.id} className="hover:bg-slate-50/70 transition">
                    <td className="font-mono font-bold text-aicte-navy-900 whitespace-nowrap">
                      {inst.aictePermanentId}
                    </td>
                    <td>
                      <Link
                        to={`/institutions/${inst.id}`}
                        className="font-semibold text-aicte-navy-700 hover:underline"
                      >
                        {inst.name}
                      </Link>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {inst.sourceType === "PDF_IMPORT" ? `Source: PDF p.${inst.sourcePage}` : inst.institutionType}
                        {inst.hasSourceConflict && (
                          <span className="ms-2 text-amber-700 font-sans font-semibold bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                            Conflict Flagged
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="font-medium text-slate-800">{inst.state || "—"}</div>
                      <div className="text-[11px] text-slate-500">{inst.region || "—"}</div>
                    </td>
                    <td className="whitespace-nowrap text-slate-700">
                      {inst.district || "—"}
                    </td>
                    <td className="whitespace-nowrap text-slate-700">
                      {inst.city || "—"}
                    </td>
                    <td className="text-center font-mono">
                      {inst.totalComplaintsCount > 0 ? (
                        <span className="font-semibold px-2 py-0.5 rounded-lg text-xs bg-amber-50 text-amber-800 border border-amber-200">
                          {inst.totalComplaintsCount} active
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">0 cases</span>
                      )}
                    </td>
                    <td className="text-end whitespace-nowrap">
                      <Link
                        to={`/institutions/${inst.id}`}
                        className="inline-flex items-center text-xs text-aicte-navy-700 font-semibold hover:underline px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3 h-3 ms-0.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-2.5 bg-[#f8fafc] border-t border-[#e5eaf0] flex items-center justify-between text-xs text-slate-600">
          <div>{tr("complaints:showing")}<span className="font-semibold text-slate-900">{institutions.length}</span> of{" "}
            <span className="font-semibold text-slate-900">{totalRecords}</span>{tr("complaints:institutions")}</div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-2.5 py-1 bg-white border border-[#e5eaf0] rounded-lg text-xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 inline me-1" />{tr("dashboard:previous")}</button>
            <span className="px-2 py-1 font-mono font-medium">{tr("dashboard:page")}{formatNumber(page)} of {formatNumber(totalPages) || 1}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-2.5 py-1 bg-white border border-[#e5eaf0] rounded-lg text-xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
            >{tr("dashboard:next")}<ChevronRight className="w-3.5 h-3.5 inline ms-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Register Institution Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full overflow-hidden border border-[#e5eaf0]">
            <div className="px-4 py-3 bg-[#f8fafc] border-b border-[#e5eaf0] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-aicte-navy-700" />
                <h3 className="text-sm font-bold text-aicte-navy-900">{tr("complaints:registerNewApprovedInstitution")}</h3>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-500 hover:text-slate-700 cursor-pointer" aria-label={tr("common:cancel")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterInstitution} className="p-4 space-y-3.5">
              {regError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  {localizeError(regError)}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:institutionName_ffd17")}<span className="text-red-600">*</span>
                </label>
                <input aria-label={tr("complaints:institutionName_ffd17")}
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={tr("complaints:eGNationalInstituteOfScienceAndTechnology")}
                  className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:aictePermanentId_56e20")}<span className="text-red-600">*</span>
                  </label>
                  <input aria-label={tr("complaints:aictePermanentId_56e20")}
                    type="text"
                    required
                    value={formPermId}
                    onChange={e => setFormPermId(e.target.value)}
                    placeholder="e.g. 1-9988776655"
                    className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs font-mono focus:border-[#003366] focus:outline-none"
                  />
                  <span className="text-xs text-slate-500">{tr("complaints:uniqueAlphanumericAicteIdentifier")}</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:institutionType")}</label>
                  <select aria-label={tr("complaints:institutionType")}
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                  >
                    <option value="Engineering">{tr("complaints:engineering")}</option>
                    <option value="Management">{tr("complaints:management")}</option>
                    <option value="Pharmacy">{tr("complaints:pharmacy")}</option>
                    <option value="Polytechnic">{tr("complaints:polytechnic")}</option>
                    <option value="Architecture">{tr("complaints:architecture")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:city_83212")}<span className="text-red-600">*</span>
                  </label>
                  <input aria-label={tr("complaints:city_83212")}
                    type="text"
                    required
                    value={formCity}
                    onChange={e => setFormCity(e.target.value)}
                    placeholder={tr("complaints:city")}
                    className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:state_41c75")}<span className="text-red-600">*</span>
                  </label>
                  <input aria-label={tr("complaints:state_41c75")}
                    type="text"
                    required
                    value={formState}
                    onChange={e => setFormState(e.target.value)}
                    placeholder={tr("complaints:state")}
                    className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:aicteRegionalJurisdiction")}<span className="text-red-600">*</span>
                </label>
                <select aria-label={tr("complaints:aicteRegionalJurisdiction")}
                  value={formRegion}
                  onChange={e => setFormRegion(e.target.value)}
                  className="w-full bg-white border border-[#e5eaf0] rounded-lg px-3 py-1.5 text-xs focus:border-[#003366] focus:outline-none"
                >
                  {REGIONS_LIST.map(r => (
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
                  className="px-3 py-1.5 border border-[#e5eaf0] rounded-lg text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                >{tr("common:cancel")}</button>
                <button
                  type="submit"
                  disabled={regSubmitting}
                  className="px-3.5 py-1.5 bg-aicte-navy-700 text-white rounded-lg text-xs font-semibold hover:bg-aicte-navy-900 disabled:opacity-50 cursor-pointer"
                >
                  {regSubmitting ? tr("complaints:registering") : tr("complaints:confirmSaveRecord")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
