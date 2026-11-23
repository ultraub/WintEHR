import React, { useState, useMemo, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router/router';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { createMedicalTheme, resolveThemeName } from './themes/medicalTheme';
import { PHASES, modeForPhase, phaseForHour } from './themes/auroraPalette';
import { getClinicalContext, applyDepartmentTheme, applyShiftTheme } from './themes/clinicalThemeUtils';
import ErrorBoundary from './components/ErrorBoundary';
import { AppProviders } from './providers/AppProviders';

// Import quick login utility for development
import './utils/quickLogin';

// Import configuration validation
import { validateConfiguration } from './utils/validateConfig';

// Create a context for medical theme toggling
export const MedicalThemeContext = React.createContext();

// Inner App component that can use routing hooks
function ThemedApp() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    // A previously saved theme that has since been retired resolves to the default.
    return resolveThemeName(localStorage.getItem('medicalTheme'));
  });
  
  // Time of day: 'auto' follows the clock through sunrise, day, sunset and
  // night; any one phase can be pinned instead. An older saved light/dark
  // choice maps to day/night.
  const [phaseSetting, setPhaseSetting] = useState(() => {
    const saved = localStorage.getItem('medicalPhase');
    if (saved === 'auto' || PHASES.includes(saved)) return saved;
    const legacyMode = localStorage.getItem('medicalMode');
    if (legacyMode === 'dark') return 'night';
    if (legacyMode === 'light') return 'day';
    return 'auto';
  });
  const [clockPhase, setClockPhase] = useState(() => phaseForHour(new Date().getHours()));
  useEffect(() => {
    const tick = () => setClockPhase(phaseForHour(new Date().getHours()));
    const timer = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const phase = phaseSetting === 'auto' ? clockPhase : phaseSetting;
  // Daytime is the light phase; the other three are dark.
  const currentMode = modeForPhase(phase);

  // Cross-fade the whole screen whenever the phase changes, whether the
  // user picked it or the clock moved on (see `.theme-switching`).
  const lastPhase = React.useRef(phase);
  React.useLayoutEffect(() => {
    if (lastPhase.current === phase) return undefined;
    lastPhase.current = phase;
    const root = document.documentElement;
    root.classList.add('theme-switching');
    const timer = window.setTimeout(() => root.classList.remove('theme-switching'), 600);
    return () => window.clearTimeout(timer);
  }, [phase]);
  
  const [department, setDepartment] = useState(() => {
    return localStorage.getItem('medicalDepartment') || 'general';
  });
  
  const [autoDetectContext, setAutoDetectContext] = useState(() => {
    return localStorage.getItem('autoDetectClinicalContext') === 'true';
  });

  // Validate configuration on app startup
  useEffect(() => {
    const result = validateConfiguration();
    if (!result.valid) {
      console.warn('[App] Configuration validation failed. Using fallback configuration.');
      console.warn('[App] Missing variables:', result.errors);
    }
  }, []);

  // Auto-detect clinical context
  const clinicalContext = useMemo(() => {
    if (autoDetectContext) {
      return getClinicalContext(window.location.pathname, new Date().getHours(), department);
    }
    return null;
  }, [autoDetectContext, department]);
  
  // Create theme with clinical context enhancements
  const theme = useMemo(() => {
    let baseTheme = createMedicalTheme(currentTheme, currentMode, phase);
    
    if (clinicalContext && autoDetectContext) {
      // Apply department-specific theme enhancements
      baseTheme = applyDepartmentTheme(baseTheme, clinicalContext.department);
      
      // Apply shift-based theme enhancements
      baseTheme = applyShiftTheme(baseTheme, clinicalContext.shift);
    }
    
    return baseTheme;
  }, [currentTheme, currentMode, phase, clinicalContext, autoDetectContext]);
  
  // Stable handlers (they close over nothing but setState, which is stable)
  // + memoized context value: an inline object here re-rendered every
  // MedicalThemeContext consumer on each App render.
  const handleThemeChange = React.useCallback((themeName) => {
    setCurrentTheme(themeName);
    localStorage.setItem('medicalTheme', themeName);
  }, []);

  const handlePhaseSettingChange = React.useCallback((setting) => {
    setPhaseSetting(setting);
    localStorage.setItem('medicalPhase', setting);
  }, []);

  // Kept for callers that still think in light and dark.
  const handleModeChange = React.useCallback((mode) => {
    handlePhaseSettingChange(mode === 'dark' ? 'night' : 'day');
  }, [handlePhaseSettingChange]);

  const handleDepartmentChange = React.useCallback((dept) => {
    setDepartment(dept);
    localStorage.setItem('medicalDepartment', dept);
  }, []);

  const handleAutoDetectChange = React.useCallback((enabled) => {
    setAutoDetectContext(enabled);
    localStorage.setItem('autoDetectClinicalContext', enabled.toString());
  }, []);

  const themeContextValue = useMemo(() => ({
    currentTheme,
    currentMode,
    phase,
    phaseSetting,
    onPhaseSettingChange: handlePhaseSettingChange,
    department,
    clinicalContext,
    autoDetectContext,
    onThemeChange: handleThemeChange,
    onModeChange: handleModeChange,
    onDepartmentChange: handleDepartmentChange,
    onAutoDetectChange: handleAutoDetectChange
  }), [
    currentTheme, currentMode, phase, phaseSetting, handlePhaseSettingChange, department, clinicalContext, autoDetectContext,
    handleThemeChange, handleModeChange, handleDepartmentChange, handleAutoDetectChange
  ]);

  return (
    <MedicalThemeContext.Provider value={themeContextValue}>
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
