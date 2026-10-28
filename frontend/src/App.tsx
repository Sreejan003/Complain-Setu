import { RoleDashboard } from "./pages/RoleDashboard.js";
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { AppLayout } from "./components/layout/AppLayout.js";
import { ProtectedRoute } from "./components/common/ProtectedRoute.js";

// Pages
import { LoginPage } from "./pages/LoginPage.js";
import { OverviewDashboard } from "./pages/OverviewDashboard.js";
import { InstitutionProfile } from "./pages/InstitutionProfile.js";
import { ComplaintRegister } from "./pages/ComplaintRegister.js";
import { CaseList } from "./pages/CaseList.js";
import { ComplaintDetails } from "./pages/ComplaintDetails.js";
import { OverlapCenter } from "./pages/OverlapCenter.js";
import { WorkflowTransfers } from "./pages/WorkflowTransfers.js";
import { NotificationsPage } from "./pages/NotificationsPage.js";
import { ReportsAnalytics } from "./pages/ReportsAnalytics.js";
import { AdministrationPage } from "./pages/AdministrationPage.js";
import { InstitutionDashboard } from "./pages/InstitutionDashboard.js";

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
        <Routes>
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

            <Route path="complaints/register" element={<ComplaintRegister />} />
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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
