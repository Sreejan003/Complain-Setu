import { LanguageSelector } from "../components/common/LanguageSelector.js";
import { tr, localizeLabel, localizeError, useLocaleRender } from "../i18n/index.js";
import { formatDate, formatNumber } from "../i18n/localeUtils.js";
import { canVisit, dashboardPath } from "../services/access.js";
import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { Shield, Lock, Mail, AlertCircle, ArrowRight, UserCheck } from "lucide-react";

export const LoginPage: React.FC = () => {
  useLocaleRender();
  const location = useLocation();
  const { login, demoAccounts, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || "/";

  // If already authenticated, redirect
  if (user) return <Navigate to={canVisit(user.role,from)?from:dashboardPath(user.role)} replace/>;

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
      <div className="flex justify-end px-4 pt-2"><LanguageSelector/></div>

      {/* Top Department Header */}
      <div className="bg-white border-b border-[#e5eaf0] py-3 px-6 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-aicte-navy-900 text-white flex items-center justify-center font-bold text-xs border border-[#e5eaf0] shadow-xs">{tr("common:goi")}</div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-aicte-navy-700">{tr("common:ministryOfEducationGovernmentOfIndia")}</div>
              <div className="text-sm font-bold text-aicte-navy-900 tracking-tight">{tr("common:allIndiaCouncilForTechnicalEducationAicte")}</div>
            </div>
          </div>
          <div className="hidden sm:block text-end">
            <span className="text-xs font-bold text-aicte-navy-700 bg-[#f1f5f9] border border-[#e5eaf0] px-2.5 py-1 rounded-lg uppercase tracking-wider">{tr("common:nationalAdministrativePortal")}</span>
          </div>
        </div>
      </div>

      {/* Main Login Box */}
      <div className="flex-1 flex flex-col justify-center py-8 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white border border-[#e5eaf0] rounded-lg shadow-none p-6 sm:p-8">
            <div className="text-center pb-5 mb-5 border-b border-[#e2e8f0]">
              <h2 className="text-base font-bold text-aicte-navy-900 tracking-tight uppercase">{tr("common:officerAuthentication")}</h2>
              <p className="text-xs text-slate-500 mt-1">{tr("common:aicteComplaintMonitoringSystemSih2026")}</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{localizeError(error)}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">{tr("common:officialEmailAddress_d6dba")}</label>
                <div className="relative rounded-lg shadow-none">
                  <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  <input
                    aria-label={tr("common:officialEmailAddress")}
                  type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="officer@aicte.gov.in"
                    className="block w-full ps-8 pe-3 py-1.5 border border-[#e5eaf0] rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#003366] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">{tr("common:securityPassphrasePassword")}</label>
                <div className="relative rounded-lg shadow-none">
                  <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                  <input
                    aria-label={tr("common:password")}
                  type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="block w-full ps-8 pe-3 py-1.5 border border-[#e5eaf0] rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#003366] transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2 px-4 rounded-lg text-xs font-semibold text-white bg-aicte-navy-700 hover:bg-aicte-navy-900 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>{tr("common:verifyAuthenticate")}</span>
                    <ArrowRight className="ms-1.5 w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Development / Demo Quick Select */}
            {demoAccounts && demoAccounts.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[#e2e8f0]">
                <div className="flex items-center space-x-1.5 mb-2.5 text-xs font-bold text-aicte-navy-700 uppercase tracking-wider">
                  <UserCheck className="w-3.5 h-3.5 text-aicte-navy-700" />
                  <span>{tr("common:authorizedTestPersonasDemonstration")}</span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pe-1">
                  {demoAccounts.map((acc: any) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => selectDemoUser(acc.email)}
                      className="w-full text-start p-2 rounded-lg border border-[#e5eaf0] hover:border-[#003366] hover:bg-[#f1f5f9] text-xs transition flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 group-hover:text-aicte-navy-700">
                          <bdi dir="auto" className="original-content">{acc.fullName}</bdi>
                        </div>
                        <div className="text-xs text-slate-500">
                          {localizeLabel(acc.role)} &bull; {acc.bureau || acc.region || tr("common:central")}
                        </div>
                      </div>
                      <span className="text-xs bg-slate-100 group-hover:bg-aicte-navy-700 group-hover:text-white text-slate-600 px-2 py-0.5 rounded-lg font-mono font-medium border border-slate-200">{tr("common:select")}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500 italic text-center">{tr("common:prePopulatesDemonstrationCredentialsForRapidRoleSwitching")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Official Security Disclaimer Footer */}
      <footer className="bg-white border-t border-[#e5eaf0] py-3 px-4 text-center text-xs text-slate-500">
        <p className="max-w-3xl mx-auto leading-normal">
          <strong>{tr("common:officialGovernmentOfIndiaPortal")}</strong>{tr("common:authorizedAdministrativeAccessOnlyUnauthorizedIntrusionOrTamperingIs")}</p>
      </footer>
    </div>
  );
};
