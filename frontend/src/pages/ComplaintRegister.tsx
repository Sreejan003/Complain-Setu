import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  FilePlus2,
  Building2,
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>("");
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null);

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

  useEffect(() => {
    async function fetchInstitutionsList() {
      try {
        const res = await api.getInstitutions({ limit: 100 });
        setInstitutions(res.data);

        // Pre-select if given in URL query params
        const paramInstId = searchParams.get("instId");
        if (paramInstId) {
          const match = res.data.find(i => i.id === paramInstId);
          if (match) {
            setSelectedInstId(match.id);
            setSelectedInst(match);
          }
        }
      } catch (err) {
        console.error("Failed to load institutions list:", err);
      }
    }
    fetchInstitutionsList();
  }, [searchParams]);

  // Recalculate SLA expected disposal date when priority changes
  useEffect(() => {
    const slaDays = priority === "Critical" ? 7 : priority === "High" ? 15 : priority === "Medium" ? 30 : 45;
    const target = new Date(Date.now() + slaDays * 86400000);
    setExpectedDisposalDate(target.toISOString().split("T")[0]);
  }, [priority]);

  const handleInstitutionChange = (id: string) => {
    setSelectedInstId(id);
    const found = institutions.find(i => i.id === id) || null;
    setSelectedInst(found);
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
      <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 font-medium">
        <Link to="/" className="hover:text-[#003366] hover:underline">Home</Link>
        <span>&rsaquo;</span>
        <Link to="/cases" className="hover:text-[#003366] hover:underline">Complaint Register</Link>
        <span>&rsaquo;</span>
        <span className="text-slate-700 font-semibold">New Grievance Registration</span>
      </div>

      {/* 2. Official Header */}
      <div className="bg-white border border-slate-300 rounded-xs p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-[#003366] tracking-tight">
            Register Technical Education Institution Grievance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Statutory complaint intake form with AICTE institution resolution and real-time inter-bureau overlap verification.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            to="/cases"
            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xs text-xs font-semibold transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Cancel & Return</span>
          </Link>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs rounded-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* 3. Form Grid */}
      <form onSubmit={handleFormSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-start">
          {/* Main Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-3.5">
            {/* Section 1: Target Institution */}
            <div className="bg-white border border-slate-300 rounded-xs p-4 space-y-3">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
                <Building2 className="w-4 h-4 text-[#003366]" />
                <span>1. Target AICTE Approved Institution</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Approved Institution <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={selectedInstId}
                  onChange={e => handleInstitutionChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
                >
                  <option value="">-- Select Technical Institution from AICTE Directory --</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.city}, {inst.state}) - [{inst.aictePermanentId}]
                    </option>
                  ))}
                </select>
              </div>

              {selectedInst && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xs text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{selectedInst.name}</span>
                    <span className="font-mono text-[11px] font-bold text-[#003366] bg-slate-200/80 px-1.5 py-0.2 rounded-xs border border-slate-300">
                      ID: {selectedInst.aictePermanentId}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-600 pt-0.5">
                    <span><strong>Location:</strong> {selectedInst.city}, {selectedInst.state}</span>
                    <span><strong>Type:</strong> {selectedInst.institutionType}</span>
                    <span><strong>Region:</strong> {selectedInst.region.split("(")[0]}</span>
                    <span><strong>Accreditation:</strong> {selectedInst.accreditationStatus}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Grievance Particulars */}
            <div className="bg-white border border-slate-300 rounded-xs p-4 space-y-3">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
                <FilePlus2 className="w-4 h-4 text-[#003366]" />
                <span>2. Grievance Particulars & Classification</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Violation Category <span className="text-red-600">*</span>
                  </label>
                  <select
                    required
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receiving Bureau / Desk <span className="text-red-600">*</span>
                  </label>
                  <select
                    required
                    value={receivingBureau}
                    onChange={e => setReceivingBureau(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
                  >
                    {bureaus.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Grievance Subject / Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Concise summary of alleged irregularity, non-compliance, or infraction..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Grievance Narrative <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={5}
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detail dates, faculty names, departments, affected student cohorts, fee receipts, or relevant approval norms violated..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xs px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366] leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Sidebar Column (1/3 width) */}
          <div className="space-y-3.5">
            {/* Priority & Statutory SLA */}
            <div className="bg-white border border-slate-300 rounded-xs p-3.5 space-y-2.5">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
                <Clock className="w-3.5 h-3.5 text-[#003366]" />
                <span>Priority & Statutory SLA</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Priority Category</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xs px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#003366]"
                >
                  <option value="Critical">Critical (7-Day Statutory SLA)</option>
                  <option value="High">High (15-Day SLA)</option>
                  <option value="Medium">Medium (30-Day SLA)</option>
                  <option value="Low">Low (45-Day SLA)</option>
                </select>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xs text-xs space-y-1">
                <div className="text-[11px] text-slate-500 font-medium">Computed Statutory Window:</div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{priorityDays} Calendar Days</span>
                  <span className="font-mono font-bold text-[#003366]">{expectedDisposalDate}</span>
                </div>
              </div>
            </div>

            {/* Supporting Evidence */}
            <div className="bg-white border border-slate-300 rounded-xs p-3.5 space-y-2.5">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
                <Paperclip className="w-3.5 h-3.5 text-[#003366]" />
                <span>Supporting Annexure</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Document Type</label>
                <select
                  value={documentType}
                  onChange={e => setDocumentType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xs px-2 py-1 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="Complaint Evidence">Complaint Evidence / Affidavit</option>
                  <option value="Fee Receipts">Fee Receipts / Bank Records</option>
                  <option value="Infrastructure Photos">Infrastructure Proof</option>
                  <option value="Inspection Report">Inspection Report</option>
                  <option value="Other">Other Supporting Document</option>
                </select>
              </div>

              <div className="border border-dashed border-slate-300 rounded-xs p-3 text-center bg-slate-50">
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
                    <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                    <span className="text-xs font-semibold text-[#003366] hover:underline block">Attach Supporting File</span>
                    <span className="text-[10px] text-slate-400">PDF, JPG, PNG &lt; 10MB</span>
                  </label>
                ) : (
                  <div className="flex items-center justify-between text-xs text-left bg-white p-2 border border-slate-300 rounded-xs">
                    <div className="truncate max-w-[160px]">
                      <span className="font-semibold text-slate-800 block truncate">{selectedFile.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        const inp = document.getElementById("reg-file-input") as HTMLInputElement;
                        if (inp) inp.value = "";
                      }}
                      className="text-red-700 hover:text-red-900 p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Official Submit Card */}
            <div className="bg-white border border-slate-300 rounded-xs p-3.5 space-y-2">
              <button
                type="submit"
                disabled={checkingOverlap || submitting}
                className="w-full py-2 bg-[#003366] hover:bg-[#002855] text-white rounded-xs text-xs font-semibold transition border border-[#002147] shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {checkingOverlap ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Overlaps...</span>
                  </>
                ) : submitting ? (
                  <span>Registering Case...</span>
                ) : (
                  <>
                    <span>Submit & Run Overlap Check</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate("/cases")}
                className="w-full py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xs text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>

              <div className="text-[10px] text-slate-500 text-center pt-1 border-t border-slate-100 flex items-center justify-center space-x-1">
                <Info className="w-3 h-3 text-[#003366]" />
                <span>Pre-submission duplicate screening is enforced</span>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Restrained Overlap Detection Alert Modal */}
      {overlapModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-lg max-w-2xl w-full border border-amber-400 overflow-hidden">
            <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider">Potential Complaint Overlap Detected</h3>
                  <p className="text-[10px] text-amber-100">
                    {detectedOverlaps.length} companion complaint(s) found active for this institution.
                  </p>
                </div>
              </div>
              <button onClick={() => setOverlapModalOpen(false)} className="text-white hover:text-amber-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2.5 max-h-[55vh] overflow-y-auto text-xs">
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xs text-amber-900 text-[11px] leading-relaxed">
                <strong>Attention Officer:</strong> Multiple active complaints are already registered against{" "}
                <strong>{selectedInst?.name}</strong>. Please review to avoid duplicate departmental proceedings.
              </div>

              <div className="space-y-2">
                {detectedOverlaps.map((cand, idx) => (
                  <div key={idx} className="p-2.5 border border-slate-300 rounded-xs bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 font-mono">
                        <span className="font-bold text-[#003366]">{cand.existingComplaint.complaintId}</span>
                        <span className="text-[10px] bg-slate-200 px-1 py-0.2 rounded-xs">Bureau: {cand.existingComplaint.currentBureauId}</span>
                        <span className="text-[10px] bg-slate-200 px-1 py-0.2 rounded-xs">Status: {cand.existingComplaint.status}</span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-xs">
                        {cand.combinedScore}% Similarity
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800 text-[11px]">{cand.existingComplaint.title}</div>
                    <div className="text-[11px] text-slate-600 line-clamp-2">{cand.existingComplaint.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setOverlapModalOpen(false)}
                className="px-3 py-1 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xs hover:bg-slate-50 cursor-pointer"
              >
                Review Intake Form
              </button>
              <button
                type="button"
                onClick={() => finalizeRegistration()}
                disabled={submitting}
                className="px-3 py-1 bg-[#003366] hover:bg-[#002855] text-white font-semibold rounded-xs border border-[#002147] cursor-pointer"
              >
                {submitting ? "Registering..." : "Confirm & Register Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
