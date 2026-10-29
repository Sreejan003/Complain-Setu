import { tr, localizeLabel, useLocaleRender } from "../../i18n/index.js";
import { formatDate, formatNumber } from "../../i18n/localeUtils.js";
import { canVisit } from "../../services/access.js";
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { ShieldAlert, LogIn } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  useLocaleRender();
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-600 font-medium">{tr("common:verifyingAuthorization")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role === "SYSTEM_ADMIN" && !["/", "/admin", "/admin/dashboard", "/notifications", "/institution-dashboard", "/institutions"].includes(location.pathname) && !location.pathname.startsWith("/institutions/")) return <Navigate to="/admin/dashboard" replace />;
  if (!canVisit(user.role,location.pathname) || (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role))) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-200 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">{tr("common:403AccessDenied")}</h2>
          <p className="text-sm text-slate-600">{tr("common:yourCurrentRole")}<span className="font-semibold text-slate-800">{localizeLabel(user.role)}</span>{tr("common:doesNotHavePermissionToViewOrManageThis")}</p>
          <div className="pt-2">
            <a
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition"
            >{tr("common:returnToOverviewDashboard")}</a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
