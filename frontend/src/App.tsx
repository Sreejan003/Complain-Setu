import { LoadingSkeleton } from "./components/ui/Interface.js";
import { tr } from "./i18n/index.js";
const RoleDashboard = React.lazy(() => import("./pages/RoleDashboard.js").then(module => ({ default: module.RoleDashboard })));
const CrossBureauCoordinationWorkspace = React.lazy(() => import("./components/common/CrossBureauCoordinationWorkspace.js").then(module => ({ default: module.CrossBureauCoordinationWorkspace })));
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { AppLayout } from "./components/layout/AppLayout.js";
import { ProtectedRoute } from "./components/common/ProtectedRoute.js";

// Pages
const LoginPage = React.lazy(() => import("./pages/LoginPage.js").then(module => ({ default: module.LoginPage })));
const OverviewDashboard = React.lazy(() => import("./pages/OverviewDashboard.js").then(module => ({ default: module.OverviewDashboard })));
const InstitutionProfile = React.lazy(() => import("./pages/InstitutionProfile.js").then(module => ({ default: module.InstitutionProfile })));
const ComplaintRegister = React.lazy(() => import("./pages/ComplaintRegister.js").then(module => ({ default: module.ComplaintRegister })));
const CaseList = React.lazy(() => import("./pages/CaseList.js").then(module => ({ default: module.CaseList })));
const ComplaintDetails = React.lazy(() => import("./pages/ComplaintDetails.js").then(module => ({ default: module.ComplaintDetails })));
const OverlapCenter = React.lazy(() => import("./pages/OverlapCenter.js").then(module => ({ default: module.OverlapCenter })));
const WorkflowTransfers = React.lazy(() => import("./pages/WorkflowTransfers.js").then(module => ({ default: module.WorkflowTransfers })));
const NotificationsPage = React.lazy(() => import("./pages/NotificationsPage.js").then(module => ({ default: module.NotificationsPage })));
const ReportsAnalytics = React.lazy(() => import("./pages/ReportsAnalytics.js").then(module => ({ default: module.ReportsAnalytics })));
const AdministrationPage = React.lazy(() => import("./pages/AdministrationPage.js").then(module => ({ default: module.AdministrationPage })));
const InstitutionDashboard = React.lazy(() => import("./pages/InstitutionDashboard.js").then(module => ({ default: module.InstitutionDashboard })));

/** Smart index — Institutional Users land on the Single-Window Portal */
const RoleAwareIndex: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === "Institutional User") {
    return <Navigate to="/institution-dashboard" replace />;
  }
  const route = user?.role === "SYSTEM_ADMIN" ? "/admin/dashboard" : user?.role === "COMPETENT_AUTHORITY" ? "/authority/dashboard" : user?.role === "BUREAU_HEAD" ? "/bureau/dashboard" : "/officer/dashboard";
  return <Navigate to={route} replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <React.Suspense fallback={<div className="p-6"><LoadingSkeleton label={tr("dashboard:loadingAuthorizedRecords")}/></div>}><Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Smart landing — officer → Overview, institution → Single-Window */}
            <Route index element={<RoleAwareIndex />} />
            <Route path="admin/dashboard" element={<ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}><RoleDashboard /></ProtectedRoute>} />
            <Route path="authority/dashboard" element={<ProtectedRoute allowedRoles={["COMPETENT_AUTHORITY"]}><RoleDashboard /></ProtectedRoute>} />
            <Route path="bureau/dashboard" element={<ProtectedRoute allowedRoles={["BUREAU_HEAD"]}><RoleDashboard /></ProtectedRoute>} />
            <Route path="officer/dashboard" element={<ProtectedRoute allowedRoles={["CASE_OFFICER"]}><RoleDashboard /></ProtectedRoute>} />

            {/* Single-Window Portal (merged with Institution Directory) */}
            <Route path="institution-dashboard" element={<InstitutionDashboard />} />

            {/* /institutions now redirects to the merged Single-Window Portal */}
            <Route path="institutions" element={<Navigate to="/institution-dashboard" replace />} />
            <Route path="institutions/:id" element={<InstitutionProfile />} />

            <Route path="complaints/register" element={<ProtectedRoute allowedRoles={["BUREAU_HEAD","COMPETENT_AUTHORITY","Institutional User"]}><ComplaintRegister /></ProtectedRoute>} />
            <Route path="cases" element={<CaseList />} />
            <Route path="cases/:id" element={<ComplaintDetails />} />
            <Route
              path="overlaps"
              element={
                <ProtectedRoute allowedRoles={["BUREAU_HEAD","COMPETENT_AUTHORITY","CASE_OFFICER"]}>
                  <OverlapCenter />
                </ProtectedRoute>
              }
            />
            <Route
              path="transfers"
              element={
                <ProtectedRoute allowedRoles={["BUREAU_HEAD","COMPETENT_AUTHORITY","CASE_OFFICER"]}>
                  <WorkflowTransfers />
                </ProtectedRoute>
              }
            />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="coordination" element={<ProtectedRoute allowedRoles={["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"]}><CrossBureauCoordinationWorkspace/></ProtectedRoute>}/>
            <Route path="coordination/:id" element={<ProtectedRoute allowedRoles={["COMPETENT_AUTHORITY","BUREAU_HEAD","CASE_OFFICER"]}><CrossBureauCoordinationWorkspace/></ProtectedRoute>}/>
            <Route
              path="analytics"
              element={
                <ProtectedRoute allowedRoles={["BUREAU_HEAD","COMPETENT_AUTHORITY","CASE_OFFICER"]}>
                  <ReportsAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}>
                  <AdministrationPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes></React.Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
