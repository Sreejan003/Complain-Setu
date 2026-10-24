import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.js";
import { AppLayout } from "./components/layout/AppLayout.js";

// Pages
import { OverviewDashboard } from "./pages/OverviewDashboard.js";
import { InstitutionDirectory } from "./pages/InstitutionDirectory.js";
import { InstitutionProfile } from "./pages/InstitutionProfile.js";
import { ComplaintRegister } from "./pages/ComplaintRegister.js";
import { CaseList } from "./pages/CaseList.js";
import { ComplaintDetails } from "./pages/ComplaintDetails.js";
import { OverlapCenter } from "./pages/OverlapCenter.js";
import { WorkflowTransfers } from "./pages/WorkflowTransfers.js";
import { NotificationsPage } from "./pages/NotificationsPage.js";
import { ReportsAnalytics } from "./pages/ReportsAnalytics.js";
import { AdministrationPage } from "./pages/AdministrationPage.js";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<OverviewDashboard />} />
            <Route path="institutions" element={<InstitutionDirectory />} />
            <Route path="institutions/:id" element={<InstitutionProfile />} />
            <Route path="complaints/register" element={<ComplaintRegister />} />
            <Route path="cases" element={<CaseList />} />
            <Route path="cases/:id" element={<ComplaintDetails />} />
            <Route path="overlaps" element={<OverlapCenter />} />
            <Route path="transfers" element={<WorkflowTransfers />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="analytics" element={<ReportsAnalytics />} />
            <Route path="admin" element={<AdministrationPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
