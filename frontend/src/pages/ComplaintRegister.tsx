import { ModalFrame, useUnsavedChanges } from "../components/ui/Interface.js";
import { tr, localizeLabel, localizeError, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  FilePlus2,
  Building2,
  Search,
  AlertTriangle,
  GitMerge,
  CheckCircle2,
  Calendar,
  ShieldAlert,
  ArrowRight,
  Info,
  X,
  Upload,
  Paperclip,
  ChevronLeft,
  Clock,
  Shield
} from "lucide-react";
import { api } from "../services/api.js";
import { Institution } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

export const ComplaintRegister: React.FC = () => {
  useLocaleRender();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>("");
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null);

  // Searchable Institution Selector state
  const [instSearchQuery, setInstSearchQuery] = useState<string>("");
  const [instSearchResults, setInstSearchResults] = useState<Institution[]>([]);
  const [isSearchingInst, setIsSearchingInst] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const [category, setCategory] = useState<string>("Faculty Shortage / Irregularities");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [receivingBureau, setReceivingBureau] = useState<string>("RB");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("High");
  const [expectedDisposalDate, setExpectedDisposalDate] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("Complaint Evidence");

  // Live Overlap Detection State
  const [checkingOverlap, setCheckingOverlap] = useState(false);
  const [overlapModalOpen, setOverlapModalOpen] = useState(false);
  const [detectedOverlaps, setDetectedOverlaps] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  useUnsavedChanges(!submitting && !!(title.trim() || description.trim() || selectedFile));

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

  const bureaus = [
    { id: "RB", name: "Regulation Bureau (RB)" },
    { id: "PGRC", name: "Public Grievance Redressal Cell (PGRC)" },
    { id: "RO", name: "Regional Offices (RO)" },
    { id: "AB", name: "Approval Bureau (AB)" },
    { id: "PB", name: "Policy & Academic Bureau (PB)" }
  ];

  // Pre-selection if given in URL query params
  useEffect(() => {
    async function loadInitialInstitution() {
      const paramInstId = searchParams.get("instId");
      if (paramInstId) {
        try {
          const profile = await api.getInstitutionProfile(paramInstId);
          if (profile && profile.institution) {
            setSelectedInst(profile.institution);
            setSelectedInstId(profile.institution.id);
            setInstSearchQuery(profile.institution.name);
          }
        } catch (e) {
          console.warn("Could not pre-select institution from query param:", e);
        }
      }
    }
    loadInitialInstitution();
  }, [searchParams]);

  // Debounced search across all 10,000+ persistent database records
  useEffect(() => {
    if (!instSearchQuery.trim() || selectedInst?.name === instSearchQuery) {
      setInstSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingInst(true);
      try {
        const matches = await api.searchInstitutions(instSearchQuery, 15);
        setInstSearchResults(matches);
        setShowDropdown(true);
      } catch (err) {
        console.error("Institution search failed:", err);
      } finally {
        setIsSearchingInst(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [instSearchQuery, selectedInst]);

  // Recalculate SLA expected disposal date when priority changes
  useEffect(() => {
    const slaDays = priority === "Critical" ? 7 : priority === "High" ? 15 : priority === "Medium" ? 30 : 45;
    const target = new Date(Date.now() + slaDays * 86400000);
    setExpectedDisposalDate(target.toISOString().split("T")[0]);
  }, [priority]);

  const handleSelectInstitution = (inst: Institution) => {
    setSelectedInst(inst);
    setSelectedInstId(inst.id);
    setInstSearchQuery(inst.name);
    setShowDropdown(false);
  };

  const handleClearInstitution = () => {
    setSelectedInst(null);
    setSelectedInstId("");
    setInstSearchQuery("");
    setShowDropdown(false);
  };

  // Pre-submission Overlap Check trigger
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedInstId) {
      setFormError("Please select an approved AICTE institution.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setFormError("Complaint subject and detailed description are required.");
      return;
    }

    setCheckingOverlap(true);
    try {
      const checkRes = await api.checkPreSubmissionOverlap({
        institutionId: selectedInstId,
        category,
        title,
        description,
        receivingBureauId: receivingBureau
      });

      if (checkRes.hasOverlap && checkRes.candidateAlerts.length > 0) {
        setDetectedOverlaps(checkRes.candidateAlerts);
        setOverlapModalOpen(true);
        setCheckingOverlap(false);
        return;
      }

      await finalizeRegistration();
    } catch (err: any) {
      console.error("Overlap check error:", err);
      await finalizeRegistration();
    } finally {
      setCheckingOverlap(false);
    }
  };

  const finalizeRegistration = async () => {
    setSubmitting(true);
    try {
      const res = await api.registerComplaint({
        institutionId: selectedInstId,
        category,
        title,
        description,
        receivingBureauId: receivingBureau,
        priority,
        expectedDisposalDate
      });

      if (selectedFile) {
        try {
          await api.uploadComplaintDocument(res.complaint.id, selectedFile, documentType);
        } catch (uploadErr) {
          console.error("Document upload failed after complaint creation:", uploadErr);
        }
      }

      setOverlapModalOpen(false);
      navigate(`/cases/${res.complaint.id}`);
    } catch (err: any) {
      setFormError(err.message || "Failed to register complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  const priorityDays = priority === "Critical" ? 7 : priority === "High" ? 15 : priority === "Medium" ? 30 : 45;

  return (
    <div className="space-y-3.5 max-w-5xl mx-auto">
      {/* 1. Official Breadcrumb */}
      <div className="text-xs text-slate-500 flex items-center space-x-1.5 font-medium">
        <Link to="/" className="hover:text-aicte-navy-700 hover:underline">{tr("complaints:home")}</Link>
        <span>{tr("complaints:rsaquo")}</span>
        <Link to="/cases" className="hover:text-aicte-navy-700 hover:underline">{tr("navigation:complaintRegister")}</Link>
        <span>{tr("complaints:rsaquo")}</span>
        <span className="text-slate-700 font-semibold">{tr("complaints:newGrievanceRegistration")}</span>
      </div>

      {/* 2. Official Header */}
      <div className="page-header">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-aicte-navy-700 tracking-tight">{tr("navigation:registerComplaint")}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{tr("complaints:statutoryComplaintIntakeFormWithAicteInstitutionResolutionAnd")}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            to="/cases"
            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{tr("complaints:cancelReturn")}</span>
          </Link>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs rounded-lg flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{localizeError(formError)}</span>
        </div>
      )}

      {/* 3. Form Grid */}
      <form onSubmit={handleFormSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-start">
          {/* Main Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-3.5">
            {/* Section 1: Target Institution */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
                <Building2 className="w-4 h-4 text-aicte-navy-700" />
                <span>{tr("complaints:1TargetAicteApprovedInstitution")}</span>
              </div>

              {!selectedInst ? (
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {tr("complaints:selectApprovedInstitution")}<span className="text-red-600">*</span>
                    <span className="text-slate-500 font-normal ms-2">(Search by Institution Name or AICTE Permanent ID)</span>
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required={!selectedInstId}
                      value={instSearchQuery}
                      onChange={e => {
                        setInstSearchQuery(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => {
                        if (instSearchResults.length > 0) setShowDropdown(true);
                      }}
                      placeholder="Type institution name (e.g. Siddaganga) or Permanent ID (e.g. 1-6648541)..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg ps-8 pe-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
                    />
                    {isSearchingInst && (
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Searching...</span>
                    )}
                  </div>

                  {showDropdown && instSearchResults.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {instSearchResults.map(inst => (
                        <div
                          key={inst.id}
                          onClick={() => handleSelectInstitution(inst)}
                          className="p-2.5 hover:bg-slate-50 cursor-pointer transition flex items-start justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{inst.name}</div>
                            <div className="text-slate-500 text-xs mt-0.5">
                              {inst.city}, {inst.district ? `${inst.district}, ` : ""}{inst.state}
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold bg-slate-100 text-aicte-navy-700 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                            {inst.aictePermanentId}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {showDropdown && !isSearchingInst && instSearchQuery.trim() && instSearchResults.length === 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg p-3 text-center text-xs text-slate-500">
                      No institutions match "{instSearchQuery}". Search across 10,295 AICTE directory records.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{selectedInst.name}</div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {selectedInst.address || `${selectedInst.city}, ${selectedInst.district}, ${selectedInst.state}`}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="font-mono text-xs font-bold text-aicte-navy-700 bg-white px-2 py-1 rounded border border-slate-200">
                        Permanent ID: {selectedInst.aictePermanentId}
                      </span>
                      <button
                        type="button"
                        onClick={handleClearInstitution}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 hover:text-red-700 border border-slate-200 rounded text-xs transition cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-400 block">State</span>
                      <span className="font-medium text-slate-700">{selectedInst.state}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">District</span>
                      <span className="font-medium text-slate-700">{selectedInst.district || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">City</span>
                      <span className="font-medium text-slate-700">{selectedInst.city}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">AICTE Region</span>
                      <span className="font-medium text-slate-700">{selectedInst.region?.split("(")[0]}</span>
                    </div>
                  </div>

                  {selectedInst.sourceType === "PDF_IMPORT" && (
                    <div className="text-xs text-slate-500 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <span>Source: Institute_List.pdf (Historical Directory Snapshot)</span>
                      <span className="bg-slate-200/60 px-1.5 py-0.2 rounded font-mono text-slate-600 text-xs">
                        Page {selectedInst.sourcePage || "N/A"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Grievance Particulars */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
                <FilePlus2 className="w-4 h-4 text-aicte-navy-700" />
                <span>{tr("complaints:2GrievanceParticularsClassification")}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:violationCategory_a56e3")}<span className="text-red-600">*</span>
                  </label>
                  <select aria-label={tr("complaints:violationCategory_a56e3")}
                    required
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{localizeLabel(c)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:receivingBureauDesk")}<span className="text-red-600">*</span>
                  </label>
                  <select aria-label={tr("complaints:receivingBureauDesk")}
                    required
                    value={receivingBureau}
                    onChange={e => setReceivingBureau(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
                  >
                    {bureaus.map(b => (
                      <option key={b.id} value={b.id}>{localizeLabel(b.name)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:grievanceSubjectTitle")}<span className="text-red-600">*</span>
                </label>
                <input aria-label={tr("complaints:grievanceSubjectTitle")}
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={tr("complaints:conciseSummaryOfAllegedIrregularityNonComplianceOrInfraction")}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:detailedGrievanceNarrative")}<span className="text-red-600">*</span>
                </label>
                <textarea aria-label={tr("complaints:detailedGrievanceNarrative")}
                  rows={5}
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={tr("complaints:detailDatesFacultyNamesDepartmentsAffectedStudentCohortsFee")}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366] leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Sidebar Column (1/3 width) */}
          <div className="space-y-3.5">
            {/* Priority & Statutory SLA */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
                <Clock className="w-3.5 h-3.5 text-aicte-navy-700" />
                <span>{tr("complaints:priorityStatutorySla")}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:priorityCategory")}</label>
                <select aria-label={tr("complaints:priorityCategory")}
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#003366]"
                >
                  <option value="Critical">{tr("complaints:critical7DayStatutorySla")}</option>
                  <option value="High">{tr("complaints:high15DaySla")}</option>
                  <option value="Medium">{tr("complaints:medium30DaySla")}</option>
                  <option value="Low">{tr("complaints:low45DaySla")}</option>
                </select>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="text-xs text-slate-500 font-medium">{tr("complaints:computedStatutoryWindow")}</div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{priorityDays}{tr("complaints:calendarDays")}</span>
                  <span className="font-mono font-bold text-aicte-navy-700">{expectedDisposalDate}</span>
                </div>
              </div>
            </div>

            {/* Supporting Evidence */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
                <Paperclip className="w-3.5 h-3.5 text-aicte-navy-700" />
                <span>{tr("complaints:supportingAnnexure")}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{tr("complaints:documentType")}</label>
                <select aria-label={tr("complaints:documentType")}
                  value={documentType}
                  onChange={e => setDocumentType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="Complaint Evidence">{tr("complaints:complaintEvidenceAffidavit")}</option>
                  <option value="Fee Receipts">{tr("complaints:feeReceiptsBankRecords")}</option>
                  <option value="Infrastructure Photos">{tr("complaints:infrastructureProof")}</option>
                  <option value="Inspection Report">{tr("complaints:inspectionReport")}</option>
                  <option value="Other">{tr("complaints:otherSupportingDocument")}</option>
                </select>
              </div>

              <div className="border border-dashed border-slate-200 rounded-lg p-3 text-center bg-slate-50">
                <input
                  type="file"
                  id="reg-file-input"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                {!selectedFile ? (
                  <label htmlFor="reg-file-input" className="cursor-pointer block">
                    <Upload className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                    <span className="text-xs font-semibold text-aicte-navy-700 hover:underline block">{tr("complaints:attachSupportingFile")}</span>
                    <span className="text-xs text-slate-500">{tr("complaints:pdfJpgPng10mb")}</span>
                  </label>
                ) : (
                  <div className="flex items-center justify-between text-xs text-start bg-white p-2 border border-slate-200 rounded-lg">
                    <div className="truncate max-w-[160px]">
                      <span className="font-semibold text-slate-800 block truncate">{selectedFile.name}</span>
                      <span className="text-xs text-slate-500 font-mono">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        const inp = document.getElementById("reg-file-input") as HTMLInputElement;
                        if (inp) inp.value = "";
                      }}
                      className="text-red-700 hover:text-red-900 p-0.5" aria-label={tr("common:cancel")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Official Submit Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2">
              <button
                type="submit"
                disabled={checkingOverlap || submitting}
                className="w-full py-2 bg-aicte-navy-700 hover:bg-[#002855] text-white rounded-lg text-xs font-semibold transition border border-[#002147] shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {checkingOverlap ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{tr("complaints:verifyingOverlaps")}</span>
                  </>
                ) : submitting ? (
                  <span>{tr("complaints:registeringCase")}</span>
                ) : (
                  <>
                    <span>{tr("complaints:submitRunOverlapCheck")}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate("/cases")}
                className="w-full py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition cursor-pointer"
              >{tr("common:cancel")}</button>

              <div className="text-xs text-slate-500 text-center pt-1 border-t border-slate-100 flex items-center justify-center space-x-1">
                <Info className="w-3 h-3 text-aicte-navy-700" />
                <span>{tr("complaints:preSubmissionDuplicateScreeningIsEnforced")}</span>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Restrained Overlap Detection Alert Modal */}
      {overlapModalOpen && (
        <ModalFrame className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClose={() => setOverlapModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full border border-amber-400 overflow-hidden">
            <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider">{tr("complaints:potentialComplaintOverlapDetected")}</h3>
                  <p className="text-xs text-amber-100">
                    {detectedOverlaps.length}{tr("complaints:companionComplaintSFoundActiveForThisInstitution")}</p>
                </div>
              </div>
              <button onClick={() => setOverlapModalOpen(false)} className="text-white hover:text-amber-100 cursor-pointer" aria-label={tr("common:cancel")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2.5 max-h-[55vh] overflow-y-auto text-xs">
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs leading-relaxed">
                <strong>{tr("complaints:attentionOfficer")}</strong>{tr("complaints:multipleActiveComplaintsAreAlreadyRegisteredAgainst")}{" "}
                <strong>{selectedInst?.name}</strong>{tr("complaints:pleaseReviewToAvoidDuplicateDepartmentalProceedings")}</div>

              <div className="space-y-2">
                {detectedOverlaps.map((cand, idx) => (
                  <div key={idx} className="p-2.5 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 font-mono">
                        <span className="font-bold text-aicte-navy-700"><bdi dir="ltr" className="canonical-value">{cand.existingComplaint.complaintId}</bdi></span>
                        <span className="text-xs bg-slate-200 px-1 py-0.2 rounded-lg">{tr("complaints:bureau")}<bdi dir="ltr" className="canonical-value">{cand.existingComplaint.currentBureauId}</bdi></span>
                        <span className="text-xs bg-slate-200 px-1 py-0.2 rounded-lg">{tr("complaints:statusLabel")}{localizeLabel(cand.existingComplaint.status)}</span>
                      </div>
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-lg">
                        {cand.combinedScore}{tr("complaints:similarity")}</span>
                    </div>
                    <div className="font-semibold text-slate-800 text-xs"><bdi dir="auto" className="original-content">{cand.existingComplaint.title}</bdi></div>
                    <div className="text-xs text-slate-600 line-clamp-2"><bdi dir="auto" className="original-content">{cand.existingComplaint.description}</bdi></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setOverlapModalOpen(false)}
                className="px-3 py-1 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >{tr("complaints:reviewIntakeForm")}</button>
              <button
                type="button"
                onClick={() => finalizeRegistration()}
                disabled={submitting}
                className="px-3 py-1 bg-aicte-navy-700 hover:bg-[#002855] text-white font-semibold rounded-lg border border-[#002147] cursor-pointer"
              >
                {submitting ? tr("complaints:registering") : tr("complaints:confirmRegisterRecord")}
              </button>
            </div>
          </div>
        </ModalFrame>
      )}
    </div>
  );
};
