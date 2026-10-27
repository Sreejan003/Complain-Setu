import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { Shield, Lock, Mail, AlertCircle, ArrowRight, UserCheck } from "lucide-react";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, demoAccounts, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || "/";

  // If already authenticated, redirect
  if (user) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please provide both email address and password.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const selectDemoUser = (accountEmail: string) => {
    setEmail(accountEmail);
    setPassword("Aicte@2026");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col justify-between">
      {/* Official Government Tricolor Top Bar */}
      <div className="gov-tricolor-bar w-full" />

      {/* Top Department Header */}
      <div className="bg-white border-b border-[#cbd5e1] py-3 px-6 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xs bg-[#002147] text-white flex items-center justify-center font-bold text-xs border border-[#cbd5e1] shadow-xs">
              GOI
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#003366]">
                Ministry of Education &bull; Government of India
              </div>
              <div className="text-sm font-bold text-[#002147] tracking-tight">
                All India Council for Technical Education (AICTE)
              </div>
            </div>
          </div>
          <div className="hidden sm:block text-right">
            <span className="text-[11px] font-bold text-[#003366] bg-[#f1f5f9] border border-[#cbd5e1] px-2.5 py-1 rounded-xs uppercase tracking-wider">
              National Administrative Portal
            </span>
          </div>
        </div>
      </div>

      {/* Main Login Box */}
      <div className="flex-1 flex flex-col justify-center py-8 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white border border-[#cbd5e1] rounded-xs shadow-none p-6 sm:p-8">
            <div className="text-center pb-5 mb-5 border-b border-[#e2e8f0]">
              <h2 className="text-base font-bold text-[#002147] tracking-tight uppercase">
                Officer Authentication
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                AICTE Complaint Monitoring System &bull; SIH 2026
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Official Email Address
                </label>
                <div className="relative rounded-xs shadow-none">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="officer@aicte.gov.in"
                    className="block w-full pl-8 pr-3 py-1.5 border border-[#cbd5e1] rounded-xs text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#003366] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Security Passphrase / Password
                </label>
                <div className="relative rounded-xs shadow-none">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="block w-full pl-8 pr-3 py-1.5 border border-[#cbd5e1] rounded-xs text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#003366] transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2 px-4 rounded-xs text-xs font-semibold text-white bg-[#003366] hover:bg-[#002147] disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Verify & Authenticate</span>
                    <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Development / Demo Quick Select */}
            {demoAccounts && demoAccounts.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[#e2e8f0]">
                <div className="flex items-center space-x-1.5 mb-2.5 text-[11px] font-bold text-[#003366] uppercase tracking-wider">
                  <UserCheck className="w-3.5 h-3.5 text-[#003366]" />
                  <span>Authorized Test Personas (Demonstration)</span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {demoAccounts.map((acc: any) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => selectDemoUser(acc.email)}
                      className="w-full text-left p-2 rounded-xs border border-[#cbd5e1] hover:border-[#003366] hover:bg-[#f1f5f9] text-xs transition flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 group-hover:text-[#003366]">
                          {acc.fullName}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {acc.role} &bull; {acc.bureau || acc.region || "Central"}
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-100 group-hover:bg-[#003366] group-hover:text-white text-slate-600 px-2 py-0.5 rounded-xs font-mono font-medium border border-slate-200">
                        Select
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-400 italic text-center">
                  Pre-populates demonstration credentials for rapid role switching.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Official Security Disclaimer Footer */}
      <footer className="bg-white border-t border-[#cbd5e1] py-3 px-4 text-center text-[11px] text-slate-500">
        <p className="max-w-3xl mx-auto leading-normal">
          <strong>Official Government of India Portal:</strong> Authorized administrative access only.
          Unauthorized intrusion or tampering is punishable under the Information Technology Act, 2000. All activities are monitored and cryptographically audited.
        </p>
      </footer>
    </div>
  );
};
