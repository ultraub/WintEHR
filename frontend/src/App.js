import React from 'react';
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

// Clinical Components
import ClinicalWorkspace from './components/clinical/ClinicalWorkspace';
import { AuthProvider } from './contexts/AuthContext';
import { ClinicalProvider } from './contexts/ClinicalContext';
import { DocumentationProvider } from './contexts/DocumentationContext';
import { OrderProvider } from './contexts/OrderContext';
import { TaskProvider } from './contexts/TaskContext';

// Create a sophisticated pastel theme with good contrast
const theme = createTheme({
  palette: {
    primary: {
      main: '#5B9FBC',      // Soft ocean blue
      light: '#7FB4CC',     // Light ocean blue
      dark: '#4A87A0',      // Deeper ocean blue
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#F4A09C',      // Soft coral pink
      light: '#F7B5B2',     // Light coral
      dark: '#E88B86',      // Deeper coral
      contrastText: '#ffffff',
    },
    background: {
      default: '#FAF9F7',   // Warm off-white
      paper: '#ffffff',
    },
    text: {
      primary: '#2C3E50',   // Dark blue-gray for better contrast
      secondary: '#5D6D7E', // Medium blue-gray
    },
    success: {
      main: '#81C784',      // Soft green
    },
    warning: {
      main: '#FFB74D',      // Soft orange
    },
    error: {
      main: '#E57373',      // Soft red
    },
    info: {
      main: '#64B5F6',      // Soft blue
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
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      color: '#2C3E50',
    },
    h2: {
      fontWeight: 700,
      color: '#2C3E50',
    },
    h3: {
      fontWeight: 600,
      color: '#2C3E50',
    },
    h4: {
      fontWeight: 600,
      color: '#2C3E50',
    },
    h5: {
      fontWeight: 600,
      color: '#2C3E50',
    },
    h6: {
      fontWeight: 600,
      color: '#2C3E50',
    },
    body1: {
      color: '#2C3E50',
    },
    body2: {
      color: '#5D6D7E',
    },
  },
  shape: {
    borderRadius: 12,  // Moderate rounded corners
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
          boxShadow: '0 2px 8px rgba(91, 159, 188, 0.15)',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 16px rgba(91, 159, 188, 0.2)',
          },
        },
        containedSecondary: {
          boxShadow: '0 2px 8px rgba(244, 160, 156, 0.15)',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(244, 160, 156, 0.2)',
          },
        },
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
        colorPrimary: {
          backgroundColor: '#E3F2FD',
          color: '#5B9FBC',
          fontWeight: 500,
        },
        colorSecondary: {
          backgroundColor: '#FFEBEE',
          color: '#F4A09C',
          fontWeight: 500,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <AuthProvider>
          <ClinicalProvider>
            <DocumentationProvider>
              <OrderProvider>
                <TaskProvider>
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
                    </Routes>
                  </Router>
                </TaskProvider>
              </OrderProvider>
            </DocumentationProvider>
          </ClinicalProvider>
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;