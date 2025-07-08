import React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { createMedicalTheme } from './themes/medicalTheme';

import Layout from './components/Layout';
import LayoutV3 from './components/LayoutV3';
import ErrorBoundary from './components/ErrorBoundary';
import ClinicalLayout from './components/ClinicalLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PatientList from './pages/PatientList';
import Analytics from './pages/Analytics';
import FHIRExplorerRedesigned from './pages/FHIRExplorerRedesigned';
import Settings from './pages/Settings';
import Schedule from './pages/Schedule';
import NotFound from './pages/NotFound';
import MedicationReconciliationPage from './pages/MedicationReconciliationPage';
import VitalSignsPage from './pages/VitalSignsPage';
import TrainingCenterPage from './pages/TrainingCenterPage';
import CDSHooksPage from './pages/CDSHooksPage';
import CDSHooksStudio from './pages/CDSHooksStudio';
import EncountersPage from './pages/EncountersPage';
import LabResultsPage from './pages/LabResultsPage';
import MedicationsPage from './pages/MedicationsPage';
import QualityMeasuresPage from './pages/QualityMeasuresPage';
import CareGapsPage from './pages/CareGapsPage';
import AuditTrailPage from './pages/AuditTrailPage';
import PharmacyPage from './pages/PharmacyPage';
import TestPage from './pages/TestPage';

// Clinical Components
import ClinicalWorkspaceV3 from './components/clinical/ClinicalWorkspaceV3';
import PatientDashboardV2Page from './pages/PatientDashboardV2Page';
import { AppProviders } from './providers/AppProviders';

// Create a context for medical theme toggling
export const MedicalThemeContext = React.createContext();



function App() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('medicalTheme') || 'professional';
  });
  
  const [currentMode, setCurrentMode] = useState(() => {
    return localStorage.getItem('medicalMode') || 'light';
  });
  
  const theme = useMemo(() => createMedicalTheme(currentTheme, currentMode), [currentTheme, currentMode]);
  
  const handleThemeChange = (themeName) => {
    setCurrentTheme(themeName);
    localStorage.setItem('medicalTheme', themeName);
  };
  
  const handleModeChange = (mode) => {
    setCurrentMode(mode);
    localStorage.setItem('medicalMode', mode);
  };
  
  return (
    <MedicalThemeContext.Provider value={{ 
      currentTheme, 
      currentMode, 
      onThemeChange: handleThemeChange, 
      onModeChange: handleModeChange 
    }}>
      <ErrorBoundary>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <AppProviders>
              <Router>
                      <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={<Navigate to="/patients" replace />} />
                        
                        {/* Patient Registry */}
                        <Route path="/patients" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <PatientList />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        
                        {/* Patient Chart - New FHIR-native dashboard as default */}
                        <Route path="/patients/:id" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <PatientDashboardV2Page />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        
                        {/* Clinical Workspace */}
                        <Route path="/patients/:id/clinical" element={
                          <ProtectedRoute>
                            <ClinicalLayout>
                              <ClinicalWorkspaceV3 />
                            </ClinicalLayout>
                          </ProtectedRoute>
                        } />
                        
                        {/* Specific Clinical Workflows */}
                        <Route path="/patients/:id/medication-reconciliation" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <MedicationReconciliationPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        <Route path="/patients/:id/encounters/:encounterId/medication-reconciliation" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <MedicationReconciliationPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        <Route path="/patients/:id/vital-signs" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <VitalSignsPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        
                        {/* Clinical Workflows */}
                        <Route path="/dashboard" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <Dashboard />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        {/* Redirect old clinical route to dashboard */}
                        <Route path="/clinical" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/encounters" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <EncountersPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        <Route path="/lab-results" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <LabResultsPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        <Route path="/medications" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <MedicationsPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        <Route path="/pharmacy" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <PharmacyPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />

                        {/* Population Health */}
                        <Route path="/analytics" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <Analytics />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        <Route path="/quality" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <QualityMeasuresPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        <Route path="/care-gaps" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <CareGapsPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />

                        {/* Developer Tools */}
                        <Route path="/fhir-explorer" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <FHIRExplorerRedesigned />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        <Route path="/cds-hooks" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <CDSHooksPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        <Route path="/cds-studio" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <CDSHooksStudio />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />

                        {/* Provider Workspace */}
                        <Route path="/schedule" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <Schedule />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        
                        {/* Administration */}
                        <Route path="/audit-trail" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <AuditTrailPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        <Route path="/settings" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <Settings />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        
                        {/* Training Center */}
                        <Route path="/training" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <TrainingCenterPage />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                        <Route path="*" element={
                          <ProtectedRoute>
                            <LayoutV3>
                              <NotFound />
                            </LayoutV3>
                          </ProtectedRoute>
                        } />
                      </Routes>
              </Router>
            </AppProviders>
        </LocalizationProvider>
      </ThemeProvider>
      </ErrorBoundary>
    </MedicalThemeContext.Provider>
  );
}

export default App;