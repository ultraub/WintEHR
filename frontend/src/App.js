import React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PatientList from './pages/PatientList';
import PatientDetail from './pages/PatientDetail';
import PatientViewRefined from './pages/PatientViewRefined';
import Analytics from './pages/Analytics';
import FHIRExplorerEnhanced from './pages/FHIRExplorerEnhanced';
import CDSDemo from './pages/CDSDemo';
import CDSHooksBuilderEnhanced from './pages/CDSHooksBuilderEnhanced';
import UnifiedCQLMeasures from './pages/UnifiedCQLMeasures';
import EncounterList from './pages/EncounterList';
import LabResults from './pages/LabResults';
import Alerts from './pages/Alerts';
import PatientNew from './pages/PatientNew';
import EncounterSchedule from './pages/EncounterSchedule';
import AuditTrailPage from './pages/AuditTrailPage';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import Billing from './pages/Billing';
import Medications from './pages/Medications';
import Messaging from './pages/Messaging';
import Tasks from './pages/Tasks';
import PatientMedications from './pages/PatientMedications';
import PatientProblems from './pages/PatientProblems';
import PatientAllergies from './pages/PatientAllergies';
import PatientEncounters from './pages/PatientEncounters';
import NewEncounter from './pages/NewEncounter';
import Schedule from './pages/Schedule';
import NotFound from './pages/NotFound';
import Imaging from './pages/Imaging';

// Clinical Components
import ClinicalWorkspace from './components/clinical/ClinicalWorkspace';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ClinicalProvider } from './contexts/ClinicalContext';
import { DocumentationProvider } from './contexts/DocumentationContext';
import { OrderProvider } from './contexts/OrderContext';
import { TaskProvider } from './contexts/TaskContext';
import { InboxProvider } from './contexts/InboxContext';
import { AppointmentProvider } from './contexts/AppointmentContext';

// Create a context for theme toggling
export const ThemeToggleContext = React.createContext();

// Add custom CSS for patriotic theme
if (typeof document !== 'undefined') {
  const styleId = 'patriotic-theme-styles';
  let styleTag = document.getElementById(styleId);
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = styleId;
    document.head.appendChild(styleTag);
  }
  styleTag.innerHTML = `
    body.patriotic-theme {
      background-image: 
        linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent),
        linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent);
      background-size: 50px 50px;
    }
  `;
}

// Theme configurations
const createAppTheme = (isPatriotic) => {
  // Add or remove body class
  if (typeof document !== 'undefined') {
    if (isPatriotic) {
      document.body.classList.add('patriotic-theme');
    } else {
      document.body.classList.remove('patriotic-theme');
    }
  }
  
  const baseTheme = {
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            borderRadius: 0,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            '&.MuiAppBar-root': {
              borderRadius: 0,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            fontWeight: 600,
            transition: 'all 0.3s ease',
          },
          ...(isPatriotic && {
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            transition: 'box-shadow 0.3s ease',
            '&:hover': {
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.12)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            fontWeight: 500,
          },
        },
      },
      ...(isPatriotic && {
        MuiTableHead: {
          styleOverrides: {
            root: {
              '& .MuiTableCell-root': {
                backgroundColor: '#1976D2',
                color: '#ffffff',
                fontWeight: 600,
              },
            },
          },
        },
        MuiTableRow: {
          styleOverrides: {
            root: {
              '&:nth-of-type(odd)': {
                backgroundColor: 'rgba(25, 118, 210, 0.04)',
              },
              '&:nth-of-type(even)': {
                backgroundColor: 'rgba(211, 47, 47, 0.02)',
              },
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              '&.Mui-selected': {
                backgroundColor: 'rgba(25, 118, 210, 0.12)',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.16)',
                },
              },
            },
          },
        },
        MuiFab: {
          styleOverrides: {
            primary: {
              background: 'linear-gradient(45deg, #1976D2 30%, #1565C0 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #1565C0 30%, #0D47A1 90%)',
              },
            },
            secondary: {
              background: 'linear-gradient(45deg, #D32F2F 30%, #C62828 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #C62828 30%, #B71C1C 90%)',
              },
            },
          },
        },
      }),
    },
  };

  if (isPatriotic) {
    return createTheme({
      ...baseTheme,
      palette: {
        primary: {
          main: '#1976D2',      // Blue
          light: '#42A5F5',     
          dark: '#0D47A1',      
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#D32F2F',      // Red
          light: '#EF5350',     
          dark: '#B71C1C',      
          contrastText: '#ffffff',
        },
        background: {
          default: '#FAFAFA',   
          paper: '#ffffff',
        },
        action: {
          selected: 'rgba(25, 118, 210, 0.08)',
          hover: 'rgba(211, 47, 47, 0.04)',
        },
        text: {
          primary: '#1A237E',   
          secondary: '#3949AB',
        },
        success: {
          main: '#2E7D32',
        },
        warning: {
          main: '#F57C00',
        },
        error: {
          main: '#C62828',
        },
        info: {
          main: '#1565C0',
        },
      },
    });
  } else {
    return createTheme({
      ...baseTheme,
      palette: {
        primary: {
          main: '#5B9FBC',      
          light: '#7FB4CC',     
          dark: '#4A87A0',      
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#F4A09C',      
          light: '#F7B5B2',     
          dark: '#E88B86',      
          contrastText: '#ffffff',
        },
        background: {
          default: '#FAF9F7',   
          paper: '#ffffff',
        },
        text: {
          primary: '#2C3E50',   
          secondary: '#5D6D7E',
        },
        success: {
          main: '#4caf50',
        },
        warning: {
          main: '#ff9800',
        },
        error: {
          main: '#f44336',
        },
        info: {
          main: '#64B5F6',
        },
      },
    });
  }
};

function App() {
  const [isPatriotic, setIsPatriotic] = useState(() => {
    return localStorage.getItem('theme') === 'patriotic';
  });
  
  const theme = useMemo(() => createAppTheme(isPatriotic), [isPatriotic]);
  
  const toggleTheme = () => {
    setIsPatriotic(prev => {
      const newValue = !prev;
      localStorage.setItem('theme', newValue ? 'patriotic' : 'original');
      return newValue;
    });
  };
  
  return (
    <ThemeToggleContext.Provider value={{ isPatriotic, toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <AuthProvider>
            <WebSocketProvider>
              <ClinicalProvider>
                <DocumentationProvider>
                  <OrderProvider>
                    <TaskProvider>
                      <InboxProvider>
                        <AppointmentProvider>
                        <Router>
                      <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={<Navigate to="/patients" replace />} />
                        <Route path="/dashboard" element={
                          <ProtectedRoute>
                            <Layout>
                              <Dashboard />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/patients" element={
                          <ProtectedRoute>
                            <Layout>
                              <PatientList />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/patients/:id" element={
                          <ProtectedRoute>
                            <Layout>
                              <PatientViewRefined />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/patients/:id/detail" element={
                          <ProtectedRoute>
                            <Layout>
                              <PatientDetail />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/clinical-workspace/:patientId" element={
                          <ProtectedRoute>
                            <Layout>
                              <ClinicalWorkspace />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/analytics" element={
                          <ProtectedRoute>
                            <Layout>
                              <Analytics />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/fhir" element={
                          <ProtectedRoute>
                            <Layout>
                              <FHIRExplorerEnhanced />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/cds-demo" element={
                          <ProtectedRoute>
                            <Layout>
                              <CDSDemo />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/cds-hooks" element={
                          <ProtectedRoute>
                            <Layout>
                              <CDSHooksBuilderEnhanced />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/quality" element={
                          <ProtectedRoute>
                            <Layout>
                              <UnifiedCQLMeasures />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/encounters" element={
                          <ProtectedRoute>
                            <Layout>
                              <EncounterList />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/encounters/schedule" element={
                          <ProtectedRoute>
                            <Layout>
                              <EncounterSchedule />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/lab-results" element={
                          <ProtectedRoute>
                            <Layout>
                              <LabResults />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/alerts" element={
                          <ProtectedRoute>
                            <Layout>
                              <Alerts />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/patients/new" element={
                          <ProtectedRoute>
                            <Layout>
                              <PatientNew />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/audit-trail" element={
                          <ProtectedRoute>
                            <Layout>
                              <AuditTrailPage />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/audit-trail/patient/:patientId" element={
                          <ProtectedRoute>
                            <Layout>
                              <AuditTrailPage />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/audit-trail/:resourceType/:resourceId" element={
                          <ProtectedRoute>
                            <Layout>
                              <AuditTrailPage />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/settings" element={
                          <ProtectedRoute>
                            <Layout>
                              <Settings />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/notifications" element={
                          <ProtectedRoute>
                            <Layout>
                              <Notifications />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/reports" element={
                          <ProtectedRoute>
                            <Layout>
                              <Reports />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/billing" element={
                          <ProtectedRoute>
                            <Layout>
                              <Billing />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/medications" element={
                          <ProtectedRoute>
                            <Layout>
                              <Medications />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/messaging" element={
                          <ProtectedRoute>
                            <Layout>
                              <Messaging />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/tasks" element={
                          <ProtectedRoute>
                            <Layout>
                              <Tasks />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/patients/:id/medications" element={
                          <ProtectedRoute>
                            <Layout>
                              <PatientMedications />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/patients/:id/problems" element={
                          <ProtectedRoute>
                            <Layout>
                              <PatientProblems />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/patients/:id/allergies" element={
                          <ProtectedRoute>
                            <Layout>
                              <PatientAllergies />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/patients/:id/encounters" element={
                          <ProtectedRoute>
                            <Layout>
                              <PatientEncounters />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/patients/:id/encounters/new" element={
                          <ProtectedRoute>
                            <Layout>
                              <NewEncounter />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/schedule" element={
                          <ProtectedRoute>
                            <Layout>
                              <Schedule />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="/imaging" element={
                          <ProtectedRoute>
                            <Layout>
                              <Imaging />
                            </Layout>
                          </ProtectedRoute>
                        } />
                        <Route path="*" element={
                          <ProtectedRoute>
                            <Layout>
                              <NotFound />
                            </Layout>
                          </ProtectedRoute>
                        } />
                      </Routes>
                    </Router>
                        </AppointmentProvider>
                      </InboxProvider>
                    </TaskProvider>
                  </OrderProvider>
                </DocumentationProvider>
              </ClinicalProvider>
            </WebSocketProvider>
          </AuthProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </ThemeToggleContext.Provider>
  );
}

export default App;