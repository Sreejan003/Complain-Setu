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
  return <OverviewDashboard />;
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
                <ProtectedRoute allowedRoles={["Administrator","Senior Management","Regulation Bureau Officer","PGRC Officer","Regional Officer"]}>
                  <OverlapCenter />
                </ProtectedRoute>
              }
            />
            <Route
              path="transfers"
              element={
                <ProtectedRoute allowedRoles={["Administrator","Regulation Bureau Officer","PGRC Officer","Regional Officer"]}>
                  <WorkflowTransfers />
                </ProtectedRoute>
              }
            />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route
              path="analytics"
              element={
                <ProtectedRoute allowedRoles={["Administrator","Senior Management","Regulation Bureau Officer","PGRC Officer","Regional Officer"]}>
                  <ReportsAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={["Administrator"]}>
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
