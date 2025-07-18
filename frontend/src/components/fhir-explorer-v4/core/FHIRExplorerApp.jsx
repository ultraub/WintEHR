/**
 * FHIR Explorer v4 - Next-Generation Healthcare Data Discovery Platform
 * 
 * A complete reimagining of FHIR data exploration with:
 * - Modern, intuitive interface
 * - AI-powered query building
 * - Visual relationship mapping
 * - Progressive learning system
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
  LinearProgress,
  Typography,
  Button,
  Container,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon,
  Search as SearchIcon,
  AccountTree as TreeIcon,
  Psychology as AIIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

// Core components
import UnifiedLayout from './UnifiedLayout';
import DashboardHome from './DashboardHome';

// Feature components
import ResourceCatalog from '../discovery/ResourceCatalog';
import SchemaExplorer from '../discovery/SchemaExplorer';
import RelationshipMapper from '../discovery/RelationshipMapper';
import VisualQueryBuilder from '../query-building/VisualQueryBuilder';
import NaturalLanguageInterface from '../query-building/NaturalLanguageInterface';
import AIQueryAssistant from '../query-building/AIQueryAssistant';
import QueryPlayground from '../query-building/QueryPlayground';
import PatientTimeline from '../visualization/PatientTimeline';
import DataCharts from '../visualization/DataCharts';
import NetworkDiagram from '../visualization/NetworkDiagram';
import PopulationAnalytics from '../visualization/PopulationAnalytics';

// Application constants
import {
  APP_MODES,
  DISCOVERY_VIEWS,
  QUERY_VIEWS,
  VISUALIZATION_VIEWS
} from '../constants/appConstants';

// Hooks
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { useQueryHistory } from '../hooks/useQueryHistory';

// FHIR Services
import fhirServiceCompat from '../../../core/fhir/services/fhirService';

// FHIR Explorer v4 Theme
const createFHIRTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0'
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2'
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20'
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100'
    },
    error: {
      main: '#d32f2f',
      light: '#f44336',
      dark: '#c62828'
    },
    background: {
      default: mode === 'light' ? '#fafafa' : '#121212',
      paper: mode === 'light' ? '#ffffff' : '#1e1e1e'
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 }
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'box-shadow 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
          }
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500
        }
      }
    }
  }
});

function FHIRExplorerApp() {
  const [currentMode, setCurrentMode] = useState(APP_MODES.DASHBOARD);
  const [currentView, setCurrentView] = useState('');
  const [loading, setLoading] = useState(false);
  const [themeMode, setThemeMode] = useState('light');
  
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const isMobile = useMediaQuery('(max-width:768px)');
  
  const theme = useMemo(() => 
    createFHIRTheme(themeMode === 'auto' ? (prefersDarkMode ? 'dark' : 'light') : themeMode),
    [themeMode, prefersDarkMode]
  );

  // Initialize FHIR data and query history hooks
  const fhirContext = useFHIRResource();
  const queryHistoryHook = useQueryHistory();

  // Create a compatible data structure for the components
  const fhirData = useMemo(() => {
    const resourceTypes = ['Patient', 'Observation', 'Condition', 'MedicationRequest', 
                          'Encounter', 'DiagnosticReport', 'Procedure', 'Practitioner',
                          'Organization', 'Location', 'AllergyIntolerance', 'Immunization'];
    
    const resources = {};
    const metadata = {};
    
    resourceTypes.forEach(resourceType => {
      const typeResources = fhirContext.getResourcesByType(resourceType);
      resources[resourceType] = typeResources;
      metadata[resourceType] = {
        total: typeResources.length,
        sample: typeResources.length,
        lastUpdated: new Date().toISOString()
      };
    });

    // Calculate totals
    const totalResources = Object.values(resources).reduce((sum, arr) => sum + arr.length, 0);
    const isLoading = resourceTypes.some(type => fhirContext.isResourceLoading && fhirContext.isResourceLoading(type));

    return {
      resources,
      metadata,
      loading: isLoading,
      hasData: Object.values(resources).some(arr => arr.length > 0),
      totalResources,
      resourceTypes: Object.keys(resources),
      lastUpdated: new Date().toISOString(),
      
      // Add FHIR query functions for Query Playground and Visual Builder
      searchResources: async (resourceType, params) => {
        try {
          const result = await fhirServiceCompat.searchResources(resourceType, params);
          return result.entry ? result.entry.map(e => e.resource) : [];
        } catch (error) {
          console.error('Search error:', error);
          throw error;
        }
      },
      
      executeQuery: async (queryUrl) => {
        try {
          // Parse the query URL to extract resource type and parameters
          const match = queryUrl.match(/^\/([A-Z][a-zA-Z]+)(\?.*)?$/);
          if (!match) {
            throw new Error('Invalid query format');
          }
          
          const resourceType = match[1];
          const params = match[2] ? Object.fromEntries(new URLSearchParams(match[2].substring(1))) : {};
          
          const result = await fhirServiceCompat.searchResources(resourceType, params);
          return {
            data: result,
            total: result.total || (result.entry ? result.entry.length : 0)
          };
        } catch (error) {
          console.error('Execute query error:', error);
          throw error;
        }
      }
    };
  }, [fhirContext]);

  // Navigation handlers
  const handleModeChange = useCallback((mode, view = '') => {
    setLoading(true);
    setCurrentMode(mode);
    setCurrentView(view);
    setTimeout(() => setLoading(false), 300);
  }, []);

  const handleThemeToggle = useCallback(() => {
    setThemeMode(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  // Render current view
  const renderCurrentView = () => {
    if (loading || fhirData.loading) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <LinearProgress sx={{ width: '300px', mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            {fhirData.loading ? 'Loading FHIR data...' : 'Loading...'}
          </Typography>
        </Box>
      );
    }

    switch (currentMode) {
      case APP_MODES.DASHBOARD:
        return <DashboardHome onNavigate={handleModeChange} fhirData={fhirData} queryHistory={queryHistoryHook.queryHistory} />;
        
      case APP_MODES.DISCOVERY:
        switch (currentView) {
          case DISCOVERY_VIEWS.CATALOG:
            return <ResourceCatalog onNavigate={handleModeChange} useFHIRData={() => fhirData} />;
          case DISCOVERY_VIEWS.SCHEMA:
            return <SchemaExplorer onNavigate={handleModeChange} useFHIRData={() => fhirData} />;
          case DISCOVERY_VIEWS.RELATIONSHIPS:
            return <RelationshipMapper onNavigate={handleModeChange} useFHIRData={() => fhirData} />;
          default:
            return <ResourceCatalog onNavigate={handleModeChange} useFHIRData={() => fhirData} />;
        }
        
      case APP_MODES.QUERY_BUILDING:
        switch (currentView) {
          case QUERY_VIEWS.VISUAL:
            return <VisualQueryBuilder onNavigate={handleModeChange} useFHIRData={() => fhirData} useQueryHistory={() => queryHistoryHook} />;
          case QUERY_VIEWS.NATURAL_LANGUAGE:
            return <NaturalLanguageInterface onNavigate={handleModeChange} useFHIRData={() => fhirData} useQueryHistory={() => queryHistoryHook} />;
          case QUERY_VIEWS.AI_ASSISTANT:
            return <AIQueryAssistant onNavigate={handleModeChange} />;
          case QUERY_VIEWS.PLAYGROUND:
            return <QueryPlayground onNavigate={handleModeChange} useFHIRData={() => fhirData} useQueryHistory={() => queryHistoryHook} />;
          default:
            return <VisualQueryBuilder onNavigate={handleModeChange} useFHIRData={() => fhirData} useQueryHistory={() => queryHistoryHook} />;
        }
        
      case APP_MODES.VISUALIZATION:
        switch (currentView) {
          case VISUALIZATION_VIEWS.CHARTS:
            return <DataCharts onNavigate={handleModeChange} fhirData={fhirData} />;
          case VISUALIZATION_VIEWS.TIMELINE:
            return <PatientTimeline fhirData={fhirData} onNavigate={handleModeChange} />;
          case VISUALIZATION_VIEWS.NETWORK:
            return <NetworkDiagram onNavigate={handleModeChange} fhirData={fhirData} />;
          case VISUALIZATION_VIEWS.ANALYTICS:
            return <PopulationAnalytics onNavigate={handleModeChange} fhirData={fhirData} />;
          default:
            return (
              <Container maxWidth="lg" sx={{ py: 4 }}>
                <Typography variant="h4" gutterBottom>Data Visualization</Typography>
                <Typography variant="body1" color="text.secondary">
                  Advanced visualization features coming in Phase 3
                </Typography>
              </Container>
            );
        }
        
      case APP_MODES.LEARNING:
        return (
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>Learning Center</Typography>
            <Typography variant="body1" color="text.secondary">
              Interactive tutorials and learning materials coming in Phase 4
            </Typography>
          </Container>
        );
        
      default:
        return <DashboardHome onNavigate={handleModeChange} fhirData={fhirData} queryHistory={queryHistoryHook.queryHistory} />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          body: {
            margin: 0,
            fontFamily: theme.typography.fontFamily
          },
          '*': {
            boxSizing: 'border-box'
          }
        }}
      />
      
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <UnifiedLayout
          currentMode={currentMode}
          currentView={currentView}
          onModeChange={handleModeChange}
          onThemeToggle={handleThemeToggle}
          themeMode={themeMode}
          isMobile={isMobile}
          fhirData={fhirData}
          dataLoading={fhirData.loading}
        >
          <Fade in={!loading} timeout={300}>
            <Box>
              {renderCurrentView()}
            </Box>
          </Fade>
        </UnifiedLayout>
      </Box>
    </ThemeProvider>
  );
}

// Re-export constants for backward compatibility
export {
  APP_MODES,
  DISCOVERY_VIEWS,
  QUERY_VIEWS,
  VISUALIZATION_VIEWS
} from '../constants/appConstants';

export default FHIRExplorerApp;