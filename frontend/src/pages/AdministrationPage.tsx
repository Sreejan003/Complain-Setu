import React, { useState, useEffect } from "react";
import {
  Shield,
  Users,
  Settings,
  Database,
  RotateCcw,
  History,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Server
} from "lucide-react";
import { api } from "../services/api.js";
import { UserProfile, AuditLog } from "../services/types.js";
import { useAuth } from "../context/AuthContext.js";

export const AdministrationPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "sla" | "audit" | "system">("users");
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [slaConfig, setSlaConfig] = useState<any>({
    approachingDeadlineDays: 3,
    autoEscalateOverdueDays: 5,
    reminderIntervalHours: 24,
    seniorManagementNotifyDays: 7
  });
  const [slaRunResult, setSlaRunResult] = useState<any>(null);
  const [runningSla, setRunningSla] = useState(false);
  const [savingSla, setSavingSla] = useState(false);
  const [slaSaveMsg, setSlaSaveMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // Reset demo data state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState("");

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [u, a, s, sla] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getAuditLogs().catch(() => []),
        api.getSystemStatus().catch(() => null),
        api.getSlaConfig().catch(() => null)
      ]);
      setUsersList(u);
      setAuditLogs(a);
      if (s) setSystemStatus(s);
      if (sla) setSlaConfig(sla);
    } catch (err) {
      console.error("Admin data error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSlaNow = async () => {
    setRunningSla(true);
    setSlaRunResult(null);
    try {
      const res = await api.runSlaEvaluation();
      setSlaRunResult(res.result);
      loadAdminData();
    } catch (err: any) {
      alert(err.message || "Failed to run SLA cycle.");
    } finally {
      setRunningSla(false);
    }
  };

  const handleSaveSlaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSla(true);
    setSlaSaveMsg("");
    try {
      const res = await api.updateSlaConfig(slaConfig);
      setSlaSaveMsg(res.message);
      setTimeout(() => setSlaSaveMsg(""), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to update SLA config.");
    } finally {
      setSavingSla(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleResetDemoData = async () => {
    setResetting(true);
    try {
      const res = await api.resetDemoData();
      setResetSuccessMsg(res.message);
      setResetModalOpen(false);
      loadAdminData();
    } catch (err: any) {
      alert(err.message || "Failed to reset demo data.");
    } finally {
      setResetting(false);
    }
  };

  const slaRules = [
    { priority: "Critical", days: 7, desc: "High-impact allegations: Harassment, severe faculty shortage, illegal capitation", escalateAfter: "5 Days" },
    { priority: "High", days: 15, desc: "Certificate retention, unapproved courses, faculty salary withholding", escalateAfter: "10 Days" },
    { priority: "Medium", days: 30, desc: "Standard grievances, laboratory & equipment deficiencies, fee refunds", escalateAfter: "20 Days" },
    { priority: "Low", days: 45, desc: "Procedural queries, documentation delays, minor campus issues", escalateAfter: "35 Days" }
  ];

  return (
    <div className="space-y-4">
      {/* Official Header */}
      <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#003366]">Government of India &bull; Administrative Governance</div>
          <h1 className="text-base sm:text-lg font-bold text-[#002147] tracking-tight">
            System Administration & Security Governance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Role-based authorization policies, regulatory SLA parameters, security audit records, and demo sandbox management.
          </p>
        </div>

        {user?.role === "Administrator" && (
          <button
            onClick={() => setResetModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#b91c1c] hover:bg-[#991b1b] text-white rounded-xs text-xs font-semibold shadow-none self-start sm:self-auto transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Dataset</span>
          </button>
        )}
      </div>

      {resetSuccessMsg && (
        <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534] text-xs rounded-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#15803d]" />
            <span>{resetSuccessMsg}</span>
          </div>
          <button onClick={() => setResetSuccessMsg("")} className="text-[#166534] font-bold text-xs cursor-pointer hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border border-[#cbd5e1] bg-white rounded-xs px-2 flex flex-wrap gap-1 text-xs font-medium">
        <button
          onClick={() => setActiveTab("users")}
          className={`py-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "users"
              ? "border-[#003366] text-[#003366] font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-[#003366]"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User Directory & RBAC ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("sla")}
          className={`py-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "sla"
              ? "border-[#003366] text-[#003366] font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-[#003366]"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Configurable SLA Rules</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`py-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "audit"
              ? "border-[#003366] text-[#003366] font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-[#003366]"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Security Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("system")}
          className={`py-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
            activeTab === "system"
              ? "border-[#003366] text-[#003366] font-bold bg-[#f1f5f9]"
              : "border-transparent text-slate-600 hover:text-[#003366]"
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>AI Engine & Integration Health</span>
        </button>
      </div>

      {/* Tab 1: Users & RBAC */}
      {activeTab === "users" && (
        <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none overflow-hidden">
          <div className="p-3 bg-[#f8fafc] border-b border-[#cbd5e1] flex items-center justify-between text-xs">
            <span className="font-bold text-[#003366] uppercase tracking-wider">Official User Directory & Jurisdiction Mapping</span>
            <span className="text-slate-500 text-[11px]">BCrypt cryptographic hash authentication active</span>
          </div>

          <div className="overflow-x-auto">
            <table className="gov-table w-full text-left text-xs">
              <thead>
                <tr>
                  <th>Official Name</th>
                  <th>Official Email ID</th>
                  <th>System Role</th>
                  <th>Designation</th>
                  <th>Bureau / Region</th>
                  <th className="text-center">Account Status</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => (
                  <tr key={u.id}>
                    <td className="font-bold text-[#002147]">{u.fullName}</td>
                    <td className="font-mono text-slate-600">{u.email}</td>
                    <td>
                      <span className="bg-[#f1f5f9] text-[#003366] border border-[#cbd5e1] px-2 py-0.5 rounded-xs text-[10px] font-semibold">
                        {u.role}
                      </span>
                    </td>
                    <td className="text-slate-600">{u.designation || "N/A"}</td>
                    <td className="text-slate-600 font-medium">
                      {u.bureauId ? `Bureau: ${u.bureauId}` : u.region || "AICTE HQ"}
                    </td>
                    <td className="text-center">
                      <span className="bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] text-[10px] font-bold px-1.5 py-0.2 rounded-xs">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Configurable SLA Rules */}
      {activeTab === "sla" && (
        <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#e2e8f0] pb-3">
            <div>
              <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-[#003366]" />
                <span>Statutory AICTE Citizen Charter SLA & Escalation Engine</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automated continuous monitoring: Detects approaching deadlines, flags overdue cases, and auto-escalates to Senior Management.
              </p>
            </div>
            <button
              onClick={handleRunSlaNow}
              disabled={runningSla}
              className="px-3 py-1.5 bg-[#003366] text-white rounded-xs text-xs font-semibold hover:bg-[#002147] disabled:opacity-50 flex items-center space-x-1.5 shrink-0 self-start sm:self-auto shadow-none transition cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${runningSla ? "animate-spin" : ""}`} />
              <span>{runningSla ? "Evaluating..." : "Run SLA Engine Cycle Now"}</span>
            </button>
          </div>

          {slaRunResult && (
            <div className="p-3 bg-[#f0f9ff] border border-[#bae6fd] rounded-xs text-xs space-y-1.5 text-[#0369a1]">
              <span className="font-bold block text-xs text-[#0c4a6e]">✓ SLA Monitoring Evaluation Cycle Completed</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                <div>Scanned Cases: <strong>{slaRunResult.scannedComplaints}</strong></div>
                <div>Overdue Detected: <strong className="text-[#b91c1c]">{slaRunResult.overdueCount}</strong></div>
                <div>Auto-Escalated: <strong className="text-[#7e22ce]">{slaRunResult.autoEscalatedCount}</strong></div>
                <div>Alerts Dispatched: <strong>{slaRunResult.notificationsCreated}</strong></div>
              </div>
            </div>
          )}

          {slaSaveMsg && (
            <div className="p-2.5 bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534] text-xs rounded-xs font-medium">
              ✓ {slaSaveMsg}
            </div>
          )}

          {/* Configurable Parameters Form */}
          <form onSubmit={handleSaveSlaConfig} className="p-3.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#003366]">
              Live Automated Escalation Thresholds
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                  Approaching Warning Window
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={slaConfig.approachingDeadlineDays}
                    onChange={e => setSlaConfig({ ...slaConfig, approachingDeadlineDays: Number(e.target.value) })}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xs px-2.5 py-1 text-xs font-mono font-bold focus:border-[#003366] focus:outline-none"
                  />
                  <span className="text-slate-500 text-[11px]">Days</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                  Auto-Escalate Overdue Window
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={slaConfig.autoEscalateOverdueDays}
                    onChange={e => setSlaConfig({ ...slaConfig, autoEscalateOverdueDays: Number(e.target.value) })}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xs px-2.5 py-1 text-xs font-mono font-bold focus:border-[#003366] focus:outline-none"
                  />
                  <span className="text-slate-500 text-[11px]">Days</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                  Re-Notification Interval
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min={6}
                    max={72}
                    value={slaConfig.reminderIntervalHours}
                    onChange={e => setSlaConfig({ ...slaConfig, reminderIntervalHours: Number(e.target.value) })}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xs px-2.5 py-1 text-xs font-mono font-bold focus:border-[#003366] focus:outline-none"
                  />
                  <span className="text-slate-500 text-[11px]">Hours</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                  Senior Mgmt Alert Window
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={slaConfig.seniorManagementNotifyDays}
                    onChange={e => setSlaConfig({ ...slaConfig, seniorManagementNotifyDays: Number(e.target.value) })}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xs px-2.5 py-1 text-xs font-mono font-bold focus:border-[#003366] focus:outline-none"
                  />
                  <span className="text-slate-500 text-[11px]">Days</span>
                </div>
              </div>
            </div>

            {user?.role === "Administrator" && (
              <div className="flex justify-end pt-2 border-t border-[#e2e8f0]">
                <button
                  type="submit"
                  disabled={savingSla}
                  className="px-3.5 py-1.5 bg-[#003366] hover:bg-[#002147] text-white rounded-xs text-xs font-semibold shadow-none transition cursor-pointer"
                >
                  {savingSla ? "Saving..." : "Update Escalation Parameters"}
                </button>
              </div>
            )}
          </form>

          {/* SLA Priority Cards */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#003366]">
              Statutory Disposal Targets by Category Priority
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {slaRules.map((rule, idx) => (
                <div key={idx} className="p-3.5 border border-[#cbd5e1] rounded-xs bg-white space-y-1.5 shadow-none">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#002147]">{rule.priority} Priority Target</span>
                    <span className="text-xs font-mono font-bold bg-[#f1f5f9] text-[#003366] border border-[#cbd5e1] px-2 py-0.5 rounded-xs">
                      {rule.days} Days SLA
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-normal">{rule.desc}</p>
                  <div className="pt-2 border-t border-[#e2e8f0] text-[11px] text-slate-500 flex justify-between">
                    <span>Auto-Escalation Window:</span>
                    <span className="font-bold text-[#b91c1c]">{rule.escalateAfter}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security Audit Records */}
      {activeTab === "audit" && (
        <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none overflow-hidden">
          <div className="p-3 bg-[#f8fafc] border-b border-[#cbd5e1] text-xs font-bold text-[#003366] uppercase tracking-wider">
            Immutable Administrative Audit Ledger
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="gov-table w-full text-left text-xs">
              <thead className="sticky top-0">
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>User</th>
                  <th>Audit Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id}>
                      <td className="text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="font-bold text-[#003366]">{log.action}</td>
                      <td className="font-mono text-slate-700">
                        {log.entityType} ({log.entityId})
                      </td>
                      <td className="font-medium text-slate-900">{log.userName || "System"}</td>
                      <td className="text-slate-600 text-[11px] truncate max-w-xs font-mono">
                        {log.details ? JSON.stringify(log.details) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: System Integration & AI Engine Health */}
      {activeTab === "system" && (
        <div className="bg-white border border-[#cbd5e1] rounded-xs p-4 shadow-none space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366]">Architecture & Connected Services Status</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Database status card */}
            <div className="p-3.5 border border-[#cbd5e1] rounded-xs bg-[#f8fafc] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#002147]">Database Layer</span>
                <span className="bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] text-[10px] font-bold px-1.5 py-0.2 rounded-xs">
                  Connected
                </span>
              </div>
              <div className="text-slate-600">
                Mode: <strong className="text-slate-800">{systemStatus?.database?.mode || "Local Persistent JSON (ACID)"}</strong>
              </div>
              <div className="text-[11px] text-slate-500">
                PostgreSQL/Supabase ready migrations available at <code className="bg-slate-200 px-1 rounded-xs">/database/01_schema.sql</code>
              </div>
            </div>

            {/* AI Similarity Service status card */}
            <div className="p-3.5 border border-[#cbd5e1] rounded-xs bg-[#f8fafc] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#002147]">AI Semantic Similarity Engine</span>
                <span className="bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd] text-[10px] font-bold px-1.5 py-0.2 rounded-xs">
                  Active
                </span>
              </div>
              <div className="text-slate-600">
                Active Engine:{" "}
                <strong className="text-[#003366]">{systemStatus?.aiService?.status || "Fallback (In-Process Cosine)"}</strong>
              </div>
              <div className="text-[11px] text-slate-500">
                Model: <code>{systemStatus?.aiService?.model || "all-MiniLM-L6-v2"}</code> with instant in-process TF-IDF fallback.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Demo Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-lg max-w-md w-full border border-red-300 overflow-hidden">
            <div className="bg-[#fef2f2] px-4 py-3 border-b border-[#fecaca] flex items-center space-x-2 text-[#991b1b]">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Confirm Dataset Reset</h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-700 leading-relaxed">
                This will restore the database to its baseline demonstration state (30 institutions, 100 complaints, and 10 cross-bureau overlap scenarios). All custom created cases will be restored.
              </p>
              <div className="flex justify-end space-x-2 pt-2 border-t border-[#e2e8f0]">
                <button
                  onClick={() => setResetModalOpen(false)}
                  className="px-3 py-1.5 border border-[#cbd5e1] rounded-xs text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetDemoData}
                  disabled={resetting}
                  className="px-3.5 py-1.5 bg-[#b91c1c] text-white rounded-xs text-xs font-semibold hover:bg-[#991b1b] disabled:opacity-50 cursor-pointer"
                >
                  {resetting ? "Resetting..." : "Confirm & Reset Dataset"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
