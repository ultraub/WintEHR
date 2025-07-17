/**
 * FHIR Explorer v4 - Next-Generation Healthcare Data Discovery Platform
 * 
 * A complete reimagining of FHIR data exploration with:
 * - Modern, intuitive interface
 * - AI-powered query building
 * - Visual relationship mapping
 * - Progressive learning system
 * - Real-time collaboration
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme,
  useMediaQuery,
  GlobalStyles,
  Fade,
  LinearProgress
} from '@mui/material';
import { alpha } from '@mui/material/styles';

// Core components
import { UnifiedLayout } from './UnifiedLayout';
import { DashboardHome } from './DashboardHome';

// Feature components
import { ResourceCatalog } from '../discovery/ResourceCatalog';
import { SchemaExplorer } from '../discovery/SchemaExplorer';
import { RelationshipMapper } from '../discovery/RelationshipMapper';
import { VisualQueryBuilder } from '../query-building/VisualQueryBuilder';
import { NaturalLanguageInterface } from '../query-building/NaturalLanguageInterface';
import { AIQueryAssistant } from '../query-building/AIQueryAssistant';
import { QueryPlayground } from '../query-building/QueryPlayground';

// Visualization components
import { DataCharts } from '../visualization/DataCharts';
import { PatientTimeline } from '../visualization/PatientTimeline';
import { NetworkDiagram } from '../visualization/NetworkDiagram';
import { PopulationAnalytics } from '../visualization/PopulationAnalytics';

// Workspace components
import { QueryWorkspace } from '../workspace/QueryWorkspace';
import { CollaborationTools } from '../workspace/CollaborationTools';
import { ExportManager } from '../workspace/ExportManager';

// Learning components
import { GuidedTutorials } from '../learning/GuidedTutorials';
import { ClinicalScenarios } from '../learning/ClinicalScenarios';
import { HelpSystem } from '../learning/HelpSystem';

// Hooks and services
import { useFHIRExplorerTheme } from '../hooks/useFHIRExplorerTheme';
import { useFHIRData } from '../hooks/useFHIRData';
import { useQueryHistory } from '../hooks/useQueryHistory';
import { useUserPreferences } from '../hooks/useUserPreferences';

// Application modes and views
const APP_MODES = {
  DASHBOARD: 'dashboard',
  DISCOVERY: 'discovery',
  QUERY_BUILDING: 'query-building',
  VISUALIZATION: 'visualization',
  WORKSPACE: 'workspace',
  LEARNING: 'learning'
};

const DISCOVERY_VIEWS = {
  CATALOG: 'catalog',
  SCHEMA: 'schema',
  RELATIONSHIPS: 'relationships'
};

const QUERY_VIEWS = {
  VISUAL: 'visual',
  NATURAL_LANGUAGE: 'natural-language',
  AI_ASSISTANT: 'ai-assistant',
  PLAYGROUND: 'playground'
};

const VISUALIZATION_VIEWS = {
  CHARTS: 'charts',
  TIMELINE: 'timeline',
  NETWORK: 'network',
  ANALYTICS: 'analytics'
};

/**
 * Custom Material-UI theme with healthcare-focused design
 */
const createFHIRTheme = (mode = 'light') => {
  const isDark = mode === 'dark';
  
  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#4fc3f7' : '#1976d2',
        light: isDark ? '#8bf5ff' : '#63a4ff',
        dark: isDark ? '#0093c4' : '#004ba0',
        contrastText: '#ffffff'
      },
      secondary: {
        main: isDark ? '#f48fb1' : '#dc004e',
        light: isDark ? '#ffc1e3' : '#ff5983',
        dark: isDark ? '#bf5f82' : '#9a0036'
      },
      background: {
        default: isDark ? '#0a0e1a' : '#f8fafc',
        paper: isDark ? '#1a1d29' : '#ffffff',
        surface: isDark ? '#252835' : '#f1f5f9'
      },
      success: {
        main: isDark ? '#66bb6a' : '#2e7d32',
        light: isDark ? '#98ee99' : '#60ad5e',
        dark: isDark ? '#338a3e' : '#1b5e20'
      },
      warning: {
        main: isDark ? '#ffa726' : '#ed6c02',
        light: isDark ? '#ffd95b' : '#ff9800',
        dark: isDark ? '#c77800' : '#e65100'
      },
      error: {
        main: isDark ? '#f44336' : '#d32f2f',
        light: isDark ? '#ff7961' : '#ef5350',
        dark: isDark ? '#ba000d' : '#c62828'
      },
      info: {
        main: isDark ? '#29b6f6' : '#0288d1',
        light: isDark ? '#73e8ff' : '#03a9f4',
        dark: isDark ? '#0086c3' : '#01579b'
      },
      // Healthcare-specific color palette
      fhir: {
        patient: '#2196f3',
        observation: '#4caf50',
        condition: '#f44336',
        medication: '#ff9800',
        encounter: '#9c27b0',
        practitioner: '#607d8b',
        organization: '#795548',
        diagnosticReport: '#3f51b5'
      }
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontWeight: 700,
        fontSize: '2.5rem',
        lineHeight: 1.2
      },
      h2: {
        fontWeight: 600,
        fontSize: '2rem',
        lineHeight: 1.3
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.75rem',
        lineHeight: 1.4
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.5rem',
        lineHeight: 1.4
      },
      h5: {
        fontWeight: 500,
        fontSize: '1.25rem',
        lineHeight: 1.5
      },
      h6: {
        fontWeight: 500,
        fontSize: '1.1rem',
        lineHeight: 1.5
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.6
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.6
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.4
      }
    },
    shape: {
      borderRadius: 12
    },
    shadows: isDark ? [
      'none',
      '0px 2px 4px rgba(0,0,0,0.3)',
      '0px 3px 6px rgba(0,0,0,0.3)',
      '0px 4px 8px rgba(0,0,0,0.3)',
      '0px 6px 12px rgba(0,0,0,0.3)',
      '0px 8px 16px rgba(0,0,0,0.3)',
      '0px 12px 24px rgba(0,0,0,0.3)',
      '0px 16px 32px rgba(0,0,0,0.3)',
      ...Array(17).fill('0px 24px 48px rgba(0,0,0,0.4)')
    ] : undefined,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': {
            scrollbarWidth: 'thin',
            scrollbarColor: isDark ? '#404040 #2b2b2b' : '#c1c1c1 #f1f1f1'
          },
          '*::-webkit-scrollbar': {
            width: '8px',
            height: '8px'
          },
          '*::-webkit-scrollbar-track': {
            background: isDark ? '#2b2b2b' : '#f1f1f1',
            borderRadius: '4px'
          },
          '*::-webkit-scrollbar-thumb': {
            background: isDark ? '#404040' : '#c1c1c1',
            borderRadius: '4px',
            '&:hover': {
              background: isDark ? '#505050' : '#a1a1a1'
            }
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: isDark 
              ? '0px 4px 20px rgba(0,0,0,0.3)' 
              : '0px 2px 12px rgba(0,0,0,0.08)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: isDark 
                ? '0px 8px 28px rgba(0,0,0,0.4)' 
                : '0px 4px 20px rgba(0,0,0,0.12)'
            }
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            textTransform: 'none',
            fontWeight: 500,
            paddingX: 24,
            paddingY: 10
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0px 4px 12px rgba(0,0,0,0.15)'
            }
          }
        }
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12
            }
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12
          }
        }
      }
    }
  });
};

/**
 * Global styles for the application
 */
const globalStyles = (
  <GlobalStyles
    styles={(theme) => ({
      body: {
        margin: 0,
        padding: 0,
        fontFamily: theme.typography.fontFamily,
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary
      },
      '#root': {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      },
      '.fhir-explorer-loading': {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999
      },
      '.fhir-explorer-content': {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      },
      // Custom scrollbar for specific content areas
      '.fhir-content-scroll': {
        scrollbarWidth: 'thin',
        scrollbarColor: `${alpha(theme.palette.primary.main, 0.3)} transparent`,
        '&::-webkit-scrollbar': {
          width: '6px'
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent'
        },
        '&::-webkit-scrollbar-thumb': {
          background: alpha(theme.palette.primary.main, 0.3),
          borderRadius: '3px',
          '&:hover': {
            background: alpha(theme.palette.primary.main, 0.5)
          }
        }
      }
    })}
  />
);

/**
 * Main FHIR Explorer Application Component
 */
function FHIRExplorerApp() {
  // Theme and preferences
  const { themeMode, toggleTheme } = useFHIRExplorerTheme();
  const { preferences, updatePreference } = useUserPreferences();
  const theme = useMemo(() => createFHIRTheme(themeMode), [themeMode]);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Application state
  const [currentMode, setCurrentMode] = useState(APP_MODES.DASHBOARD);
  const [currentView, setCurrentView] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // FHIR data and query management
  const { 
    data: fhirData, 
    loading: dataLoading, 
    error: dataError,
    refreshData,
    searchResources
  } = useFHIRData();
  
  const {
    queryHistory,
    saveQuery,
    loadQuery,
    clearHistory
  } = useQueryHistory();

  // Application initialization
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        
        // Load user preferences
        const savedMode = localStorage.getItem('fhir-explorer-mode');
        if (savedMode && Object.values(APP_MODES).includes(savedMode)) {
          setCurrentMode(savedMode);
        }
        
        // Initialize FHIR data
        await refreshData();
        
        // Simulate initialization delay for smooth loading
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error('Failed to initialize FHIR Explorer:', err);
        setError('Failed to initialize application. Please refresh to try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [refreshData]);

  // Mode change handler
  const handleModeChange = useCallback((newMode, newView = null) => {
    setCurrentMode(newMode);
    setCurrentView(newView);
    localStorage.setItem('fhir-explorer-mode', newMode);
  }, []);

  // Render current view based on mode and view
  const renderCurrentView = () => {
    switch (currentMode) {
      case APP_MODES.DASHBOARD:
        return (
          <DashboardHome
            onNavigate={handleModeChange}
            fhirData={fhirData}
            queryHistory={queryHistory}
            theme={theme}
          />
        );

      case APP_MODES.DISCOVERY:
        switch (currentView) {
          case DISCOVERY_VIEWS.CATALOG:
            return <ResourceCatalog onNavigate={handleModeChange} />;
          case DISCOVERY_VIEWS.SCHEMA:
            return <SchemaExplorer onNavigate={handleModeChange} />;
          case DISCOVERY_VIEWS.RELATIONSHIPS:
            return <RelationshipMapper onNavigate={handleModeChange} />;
          default:
            return <ResourceCatalog onNavigate={handleModeChange} />;
        }

      case APP_MODES.QUERY_BUILDING:
        switch (currentView) {
          case QUERY_VIEWS.VISUAL:
            return <VisualQueryBuilder onNavigate={handleModeChange} />;
          case QUERY_VIEWS.NATURAL_LANGUAGE:
            return <NaturalLanguageInterface onNavigate={handleModeChange} />;
          case QUERY_VIEWS.AI_ASSISTANT:
            return <AIQueryAssistant onNavigate={handleModeChange} />;
          case QUERY_VIEWS.PLAYGROUND:
            return <QueryPlayground onNavigate={handleModeChange} />;
          default:
            return <VisualQueryBuilder onNavigate={handleModeChange} />;
        }

      case APP_MODES.VISUALIZATION:
        switch (currentView) {
          case VISUALIZATION_VIEWS.CHARTS:
            return <DataCharts onNavigate={handleModeChange} />;
          case VISUALIZATION_VIEWS.TIMELINE:
            return <PatientTimeline onNavigate={handleModeChange} />;
          case VISUALIZATION_VIEWS.NETWORK:
            return <NetworkDiagram onNavigate={handleModeChange} />;
          case VISUALIZATION_VIEWS.ANALYTICS:
            return <PopulationAnalytics onNavigate={handleModeChange} />;
          default:
            return <DataCharts onNavigate={handleModeChange} />;
        }

      case APP_MODES.WORKSPACE:
        return (
          <QueryWorkspace
            onNavigate={handleModeChange}
            queryHistory={queryHistory}
            onSaveQuery={saveQuery}
            onLoadQuery={loadQuery}
          />
        );

      case APP_MODES.LEARNING:
        return (
          <GuidedTutorials
            onNavigate={handleModeChange}
            currentLevel={preferences.learningLevel || 'beginner'}
          />
        );

      default:
        return (
          <DashboardHome
            onNavigate={handleModeChange}
            fhirData={fhirData}
            queryHistory={queryHistory}
            theme={theme}
          />
        );
    }
  };

  // Error boundary and loading states
  if (error) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {globalStyles}
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
            p: 3
          }}
        >
          <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
            <Typography variant="h5" color="error" gutterBottom>
              Application Error
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {error}
            </Typography>
            <Button
              variant="contained"
              onClick={() => window.location.reload()}
              startIcon={<RefreshIcon />}
            >
              Reload Application
            </Button>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}
      
      {/* Loading indicator */}
      {isLoading && (
        <Box className="fhir-explorer-loading">
          <LinearProgress />
        </Box>
      )}

      {/* Main application */}
      <Fade in={!isLoading} timeout={500}>
        <Box className="fhir-explorer-content">
          <UnifiedLayout
            currentMode={currentMode}
            currentView={currentView}
            onModeChange={handleModeChange}
            onThemeToggle={toggleTheme}
            themeMode={themeMode}
            isMobile={isMobile}
            fhirData={fhirData}
            dataLoading={dataLoading}
          >
            {renderCurrentView()}
          </UnifiedLayout>
        </Box>
      </Fade>

      {/* Help system - always available */}
      <HelpSystem 
        currentMode={currentMode}
        currentView={currentView}
      />
    </ThemeProvider>
  );
}

// Export constants for use in other components
export {
  APP_MODES,
  DISCOVERY_VIEWS,
  QUERY_VIEWS,
  VISUALIZATION_VIEWS
};

export default FHIRExplorerApp;