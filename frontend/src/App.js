import React, { useState, useMemo, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router/router';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { createMedicalTheme } from './themes/medicalTheme';
import { getClinicalContext, applyDepartmentTheme, applyShiftTheme } from './themes/clinicalThemeUtils';
import PageTransitionProvider from './components/transitions/PageTransitionProvider';

import ErrorBoundary from './components/ErrorBoundary';
import { AppProviders } from './providers/AppProviders';

// Import quick login utility for development
import './utils/quickLogin';

// Create a context for medical theme toggling
export const MedicalThemeContext = React.createContext();

// Inner App component that can use routing hooks
function ThemedApp() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('medicalTheme') || 'professional';
  });
  
  const [currentMode, setCurrentMode] = useState(() => {
    return localStorage.getItem('medicalMode') || 'light';
  });
  
  const [department, setDepartment] = useState(() => {
    return localStorage.getItem('medicalDepartment') || 'general';
  });
  
  const [autoDetectContext, setAutoDetectContext] = useState(() => {
    return localStorage.getItem('autoDetectClinicalContext') === 'true';
  });
  
  // Auto-detect clinical context
  const clinicalContext = useMemo(() => {
    if (autoDetectContext) {
      return getClinicalContext(window.location.pathname, new Date().getHours(), department);
    }
    return null;
  }, [autoDetectContext, department]);
  
  // Create theme with clinical context enhancements
  const theme = useMemo(() => {
    let baseTheme = createMedicalTheme(currentTheme, currentMode);
    
    if (clinicalContext && autoDetectContext) {
      // Apply department-specific theme enhancements
      baseTheme = applyDepartmentTheme(baseTheme, clinicalContext.department);
      
      // Apply shift-based theme enhancements
      baseTheme = applyShiftTheme(baseTheme, clinicalContext.shift);
    }
    
    return baseTheme;
  }, [currentTheme, currentMode, clinicalContext, autoDetectContext]);
  
  const handleThemeChange = (themeName) => {
    setCurrentTheme(themeName);
    localStorage.setItem('medicalTheme', themeName);
  };
  
  const handleModeChange = (mode) => {
    setCurrentMode(mode);
    localStorage.setItem('medicalMode', mode);
  };
  
  const handleDepartmentChange = (dept) => {
    setDepartment(dept);
    localStorage.setItem('medicalDepartment', dept);
  };
  
  const handleAutoDetectChange = (enabled) => {
    setAutoDetectContext(enabled);
    localStorage.setItem('autoDetectClinicalContext', enabled.toString());
  };
  
  return (
    <MedicalThemeContext.Provider value={{ 
      currentTheme, 
      currentMode,
      department,
      clinicalContext,
      autoDetectContext,
      onThemeChange: handleThemeChange, 
      onModeChange: handleModeChange,
      onDepartmentChange: handleDepartmentChange,
      onAutoDetectChange: handleAutoDetectChange
    }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <AppProviders>
            <RouterProvider router={router} />
          </AppProviders>
        </LocalizationProvider>
      </ThemeProvider>
    </MedicalThemeContext.Provider>
  );
}

// Main App component wrapper
function App() {
  return (
    <ErrorBoundary>
      <ThemedApp />
    </ErrorBoundary>
  );
}

export default App;
