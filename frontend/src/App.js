import React, { useState, useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router/router';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { createMedicalTheme } from './themes/medicalTheme';

import ErrorBoundary from './components/ErrorBoundary';
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
              <RouterProvider router={router} />
            </AppProviders>
        </LocalizationProvider>
      </ThemeProvider>
      </ErrorBoundary>
    </MedicalThemeContext.Provider>
  );
}

export default App;