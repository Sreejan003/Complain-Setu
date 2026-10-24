import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  X
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
        return; // Pause for user review modal
      }

      // No overlap detected, proceed directly
      await finalizeRegistration();
    } catch (err: any) {
      console.error("Overlap check error:", err);
      // Fallback: proceed to finalize if check service errored
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

      setOverlapModalOpen(false);
      navigate(`/cases/${res.complaint.id}`);
    } catch (err: any) {
      setFormError(err.message || "Failed to register complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-aicte-navy-900 tracking-tight">
          Register Technical Education Institution Grievance
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Submit complaints with automated institution resolution, SLA computation, and real-time cross-Bureau overlap checking.
        </p>
      </div>

      {formError && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
        <form onSubmit={handleFormSubmit} className="space-y-5">
          {/* Section 1: Institution Selection */}
          <div className="border-b border-slate-100 pb-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Building2 className="w-4 h-4 text-aicte-navy-800" />
              <span>1. Target Institution Identification</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Approved Institution <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedInstId}
                  onChange={e => handleInstitutionChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
                >
                  <option value="">-- Choose Institution from Directory --</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.city}, {inst.state})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verified AICTE Permanent ID
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedInst?.aictePermanentId || "Auto-populated upon institution selection"}
                  className="w-full bg-slate-100 border border-slate-200 text-slate-600 rounded-md px-3 py-2 text-xs font-mono font-medium"
                />
              </div>
            </div>

            {selectedInst && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs flex flex-wrap gap-4 text-slate-600">
                <span>
                  <strong>Type:</strong> {selectedInst.institutionType}
                </span>
                <span>
                  <strong>Region:</strong> {selectedInst.region.split("(")[0]}
                </span>
                <span>
                  <strong>Accreditation:</strong> {selectedInst.accreditationStatus}
                </span>
                <span>
                  <strong>Existing Complaints:</strong> {selectedInst.totalComplaintsCount}
                </span>
              </div>
            )}
          </div>

          {/* Section 2: Grievance Details */}
          <div className="border-b border-slate-100 pb-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <FilePlus2 className="w-4 h-4 text-aicte-navy-800" />
              <span>2. Complaint Classification & Particulars</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Violation Category <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receiving Bureau / Cell <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={receivingBureau}
                  onChange={e => setReceivingBureau(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
                >
                  {bureaus.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Grievance Subject / Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Brief summary of the alleged irregularity or deficiency..."
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed Grievance Description <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={5}
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Include specific dates, departments, faculty names, or fee amounts involved. This text will be processed by the Sentence Transformer semantic similarity engine."
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700 leading-relaxed"
              />
            </div>
          </div>

          {/* Section 3: SLA & Assignment */}
          <div className="pb-2 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-aicte-navy-800" />
              <span>3. Priority & Statutory SLA Deadlines</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Priority Level <span className="text-red-500">*</span>
                </label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
                >
                  <option value="Critical">Critical (7-Day Statutory SLA)</option>
                  <option value="High">High (15-Day SLA)</option>
                  <option value="Medium">Medium (30-Day SLA)</option>
                  <option value="Low">Low (45-Day SLA)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expected Disposal SLA Date
                </label>
                <input
                  type="date"
                  value={expectedDisposalDate}
                  onChange={e => setExpectedDisposalDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-aicte-navy-700"
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 flex items-center space-x-1">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>AICTE Overlap Engine will scrutinize against active cases before final save.</span>
            </span>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => navigate("/cases")}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={checkingOverlap || submitting}
                className="px-5 py-2 bg-aicte-navy-900 hover:bg-aicte-navy-800 text-white rounded-md text-xs font-semibold transition shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
              >
                {checkingOverlap ? (
                  <span>Checking Overlaps...</span>
                ) : submitting ? (
                  <span>Saving Complaint...</span>
                ) : (
                  <>
                    <span>Submit & Run Overlap Engine</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* OVERLAP DETECTION ALERT MODAL / PRE-SUBMISSION WARNING */}
      {overlapModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-amber-300 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-amber-500 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-base font-bold">Potential Complaint Overlap Detected</h3>
                  <p className="text-xs text-amber-100">
                    AICTE Intelligent Overlap Engine identified {detectedOverlaps.length} potentially related active case(s).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOverlapModalOpen(false)}
                className="text-white hover:text-amber-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                <strong>Attention Official:</strong> Potentially related active cases were found for{" "}
                <strong>{selectedInst?.name}</strong> across AICTE divisions. Please review existing cases
                to avoid duplicate investigations and ensure cross-Bureau coordination.
              </div>

              <div className="space-y-3">
                {detectedOverlaps.map((cand, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-2 hover:border-amber-400 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-aicte-navy-900">
                          {cand.existingComplaint.complaintId}
                        </span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded">
                          Bureau: {cand.existingComplaint.currentBureauId}
                        </span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 font-medium px-2 py-0.5 rounded">
                          Status: {cand.existingComplaint.status}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {cand.combinedScore}% Match
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-800">
                      {cand.existingComplaint.title}
                    </div>

                    <div className="text-[11px] text-slate-600 line-clamp-2">
                      {cand.existingComplaint.description}
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                      <strong>Reasons:</strong> {cand.reasons.slice(0, 3).join("; ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer / User Decision */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setOverlapModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-100"
              >
                Cancel & Review Form
              </button>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => finalizeRegistration()}
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-2 bg-aicte-navy-900 hover:bg-aicte-navy-800 text-white text-xs font-semibold rounded-md shadow-xs transition"
                >
                  {submitting ? "Registering..." : "Confirm & Proceed to Register Case"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
