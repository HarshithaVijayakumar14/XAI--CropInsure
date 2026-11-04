import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { RoleProvider } from './context/RoleContext';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { NewClaimPage } from './pages/NewClaimPage';
import { ClaimsManagementPage } from './pages/ClaimsManagementPage';
import { ClaimAssessmentPage } from './pages/ClaimAssessmentPage';
import { ExplainabilityPage } from './pages/ExplainabilityPage';
import { DataManagementPage } from './pages/DataManagementPage';
import { ModelPerformancePage } from './pages/ModelPerformancePage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditHistoryPage } from './pages/AuditHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { AgriculturalYieldPage } from './pages/AgriculturalYieldPage';

export const App: React.FC = () => {
  return (
    <RoleProvider>
      <Router>
        <Routes>
        <Route
          path="/"
          element={
            <Layout pageTitle="XAI-CropInsure Dashboard">
              <DashboardPage />
            </Layout>
          }
        />
        <Route
          path="/new-claim"
          element={
            <Layout pageTitle="Submit or Register a Claim">
              <NewClaimPage />
            </Layout>
          }
        />
        <Route
          path="/claims"
          element={
            <Layout pageTitle="Claim Records & Review">
              <ClaimsManagementPage />
            </Layout>
          }
        />
        <Route
          path="/claims/assessment"
          element={
            <Layout pageTitle="AI Claim Assessment & Reasons">
              <ClaimAssessmentPage />
            </Layout>
          }
        />
        <Route
          path="/claims/:id/assess"
          element={
            <Layout pageTitle="AI Claim Assessment & Reasons">
              <ClaimAssessmentPage />
            </Layout>
          }
        />
        <Route
          path="/explainability"
          element={
            <Layout pageTitle="Main Reasons (XAI) & Transparency">
              <ExplainabilityPage />
            </Layout>
          }
        />
        <Route
          path="/data"
          element={
            <Layout pageTitle="Claim Records & Data Management">
              <DataManagementPage />
            </Layout>
          }
        />
        <Route
          path="/models"
          element={
            <Layout pageTitle="How Well the AI Performs">
              <ModelPerformancePage />
            </Layout>
          }
        />
        <Route
          path="/reports"
          element={
            <Layout pageTitle="Claim Assessment Reports & Export">
              <ReportsPage />
            </Layout>
          }
        />
        <Route
          path="/audit"
          element={
            <Layout pageTitle="Audit History & Review Log">
              <AuditHistoryPage />
            </Layout>
          }
        />
        <Route
          path="/crop-yield-prediction"
          element={
            <Layout pageTitle="Agricultural Crop Yield Predictor">
              <AgriculturalYieldPage />
            </Layout>
          }
        />
        <Route
          path="/settings"
          element={
            <Layout pageTitle="Application Settings & Parameters">
              <SettingsPage />
            </Layout>
          }
        />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  </RoleProvider>
  );
};

export default App;

