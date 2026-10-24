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
  const [loading, setLoading] = useState(true);

  // Reset demo data state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState("");

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [u, a, s] = await Promise.all([
        api.getUsers(),
        api.getAuditLogs(),
        api.getSystemStatus()
      ]);
      setUsersList(u);
      setAuditLogs(a);
      setSystemStatus(s);
    } catch (err) {
      console.error("Admin data error:", err);
    } finally {
      setLoading(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-aicte-navy-900 tracking-tight">
            System Administration & Security Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Role-based authorization policies, regulatory SLA parameters, security audit records, and demo sandbox management.
          </p>
        </div>

        {user?.role === "Administrator" && (
          <button
            onClick={() => setResetModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-md text-xs font-semibold shadow-xs self-start sm:self-auto transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Dataset</span>
          </button>
        )}
      </div>

      {resetSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{resetSuccessMsg}</span>
          </div>
          <button onClick={() => setResetSuccessMsg("")} className="text-emerald-700 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-lg px-4 flex space-x-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab("users")}
          className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === "users"
              ? "border-aicte-navy-800 text-aicte-navy-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory & RBAC Roles ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("sla")}
          className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === "sla"
              ? "border-aicte-navy-800 text-aicte-navy-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Configurable SLA Rules</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === "audit"
              ? "border-aicte-navy-800 text-aicte-navy-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Security Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("system")}
          className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === "system"
              ? "border-aicte-navy-800 text-aicte-navy-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Integration & AI Engine Health</span>
        </button>
      </div>

      {/* Tab 1: Users & RBAC */}
      {activeTab === "users" && (
        <div className="bg-white border border-slate-200 rounded-b-lg shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Official Profiles & Jurisdiction Mapping</span>
            <span className="text-slate-500">Passwords stored using salted BCrypt hashes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Official Name</th>
                  <th className="py-3 px-4">Email ID</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Bureau / Region</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="bg-aicte-navy-900 text-white px-2 py-0.5 rounded text-[10px] font-semibold">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.designation || "N/A"}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {u.bureauId ? `Bureau: ${u.bureauId}` : u.region || "AICTE HQ"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
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
        <div className="bg-white border border-slate-200 rounded-b-lg p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">AICTE Citizen Charter Resolution Timelines (SLA)</h3>
            <p className="text-xs text-slate-500">Statutory resolution deadlines configured according to regulatory severity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slaRules.map((rule, idx) => (
              <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{rule.priority} Priority</span>
                  <span className="text-xs font-mono font-bold bg-aicte-navy-900 text-white px-2 py-0.5 rounded">
                    {rule.days} Days SLA
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-normal">{rule.desc}</p>
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between">
                  <span>Auto-Escalation Window:</span>
                  <span className="font-bold text-red-700">{rule.escalateAfter}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Security Audit Records */}
      {activeTab === "audit" && (
        <div className="bg-white border border-slate-200 rounded-b-lg shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
            Immutable Administrative Audit Trail
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Entity</th>
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-4">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-blue-800">{log.action}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        {log.entityType} ({log.entityId})
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{log.userName || "System"}</td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px] truncate max-w-xs">
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
        <div className="bg-white border border-slate-200 rounded-b-lg p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Architecture & Connected Services Status</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Database status card */}
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Database Layer</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  Connected
                </span>
              </div>
              <div className="text-slate-600">
                Mode: <strong className="text-slate-800">{systemStatus?.database?.mode || "Local Persistent JSON (ACID)"}</strong>
              </div>
              <div className="text-[11px] text-slate-500">
                PostgreSQL/Supabase ready migrations available at <code className="bg-slate-200 px-1 rounded">/database/01_schema.sql</code>
              </div>
            </div>

            {/* AI Similarity Service status card */}
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">AI Semantic Similarity Engine</span>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  Active
                </span>
              </div>
              <div className="text-slate-600">
                Active Engine:{" "}
                <strong className="text-blue-900">{systemStatus?.aiService?.status || "Fallback (In-Process Cosine)"}</strong>
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 border border-red-200">
            <div className="flex items-center space-x-2 text-red-600 mb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Reset Demo Dataset</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              This will restore the database to its pristine baseline synthetic demo state (30 institutions, 100 complaints, and 10 intentional overlap scenarios). All custom created cases will be reset.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setResetModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDemoData}
                disabled={resetting}
                className="px-4 py-1.5 bg-red-700 text-white rounded text-xs font-semibold hover:bg-red-800 disabled:opacity-50"
              >
                {resetting ? "Resetting..." : "Confirm & Reset Dataset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
