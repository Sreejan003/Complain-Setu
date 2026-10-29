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
  X
} from "lucide-react";
import { api } from "../services/api.js";
import { Institution } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

export const InstitutionDirectory: React.FC = () => {
  useLocaleRender();
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
      <div className="bg-white border border-[#e5eaf0] rounded-lg p-4 shadow-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700">{tr("complaints:governmentOfIndiaAicteInstitutionalDirectory")}</div>
          <h1 className="text-base sm:text-lg font-bold text-aicte-navy-900 tracking-tight">{tr("complaints:aicteApprovedInstitutionsMasterDirectory")}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{tr("complaints:centralRepositoryOfTechnicalInstitutionsAictePermanentIdsAnd")}</p>
        </div>

        {["BUREAU_HEAD", "COMPETENT_AUTHORITY"].includes(user?.role || "") && (
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-aicte-navy-700 hover:bg-aicte-navy-900 text-white rounded-lg text-xs font-semibold shadow-none self-start sm:self-auto transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{tr("complaints:registerNewInstitution")}</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg p-3 shadow-none flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between text-xs">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute start-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={tr("complaints:searchByInstitutionNamePermanentIdEG1")}
            className="w-full bg-white border border-[#e5eaf0] rounded-lg ps-8 pe-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#003366]"
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
            className="bg-white border border-[#e5eaf0] rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#003366]"
          >
            <option value="">{tr("complaints:allAicteRegionalJurisdictions")}</option>
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
              className="text-xs text-aicte-navy-700 hover:underline px-2 cursor-pointer font-medium"
            >{tr("complaints:resetFilters")}</button>
          )}
        </div>
      </div>

      {/* Institutions Table */}
      <div className="bg-white border border-[#e5eaf0] rounded-lg shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gov-table w-full text-start text-xs">
            <thead>
              <tr>
                <th>{tr("complaints:aictePermanentId")}</th>
                <th>{tr("complaints:institutionName")}</th>
                <th>{tr("complaints:type_3deb7")}</th>
                <th>{tr("complaints:stateRegion")}</th>
                <th className="text-center">{tr("complaints:totalCases")}</th>
                <th className="text-center">{tr("dashboard:activeCases")}</th>
                <th className="text-center">{tr("complaints:overlaps")}</th>
                <th>{tr("complaints:latestGrievance")}</th>
                <th className="text-end">{tr("complaints:actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">{tr("complaints:loadingInstitutionsDirectory")}</td>
                </tr>
              ) : institutions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">{tr("complaints:noInstitutionsMatchedYourSearchFilter")}</td>
                </tr>
              ) : (
                institutions.map(inst => (
                  <tr key={inst.id}>
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
                      <div className="text-xs text-slate-500">{inst.city}</div>
                    </td>
                    <td>
                      <span className="bg-[#f1f5f9] text-slate-700 border border-[#e5eaf0] px-1.5 py-0.2 rounded-lg text-xs font-medium">
                        {localizeLabel(inst.institutionType)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="font-medium text-slate-800">{inst.state}</div>
                      <div className="text-xs text-slate-500">{inst.region.split("(")[0]}</div>
                    </td>
                    <td className="text-center font-bold text-slate-800 font-mono">
                      {inst.totalComplaintsCount}
                    </td>
                    <td className="text-center font-mono">
                      <span
                        className={`font-semibold px-1.5 py-0.2 rounded-lg text-xs border ${
                          inst.activeComplaintsCount > 0
                            ? "bg-[#fffbeb] text-[#92400e] border-[#fde68a]"
                            : "bg-[#f8fafc] text-slate-600 border-[#e5eaf0]"
                        }`}
                      >
                        {inst.activeComplaintsCount}
                      </span>
                    </td>
                    <td className="text-center font-mono">
                      {inst.overlapCount > 0 ? (
                        <span className="inline-flex items-center space-x-1 bg-[#fffbeb] text-[#92400e] border border-[#fde68a] font-bold px-1.5 py-0.2 rounded-lg text-xs">
                          <GitMerge className="w-3 h-3 text-[#b45309]" />
                          <span>{inst.overlapCount}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-slate-500 text-xs font-mono whitespace-nowrap">
                      {inst.latestComplaintDate || tr("administration:none")}
                    </td>
                    <td className="text-end whitespace-nowrap space-x-2">
                      <Link
                        to={`/institutions/${inst.id}`}
                        className="inline-flex items-center text-xs text-aicte-navy-700 font-semibold hover:underline"
                      >
                        <span>{tr("complaints:singleWindow")}</span>
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
