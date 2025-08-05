/**
 * FHIR Explorer v4 - Next-Generation Healthcare Data Discovery Platform
 * 
 * A complete reimagining of FHIR data exploration with:
 * - Modern, intuitive interface
 * - AI-powered query building
 * - Visual relationship mapping
 * - Progressive learning system
 */

import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import {
  Box,
  useMediaQuery,
  useTheme,
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
import FHIRExplorerErrorBoundary from '../components/ErrorBoundary';

// Feature components
import ResourceCatalog from '../discovery/ResourceCatalog';
import SchemaExplorer from '../discovery/SchemaExplorer';
import RelationshipMapper from '../discovery/RelationshipMapper';
import RelationshipMapperErrorBoundary from '../discovery/RelationshipMapperErrorBoundary';
import QueryStudioEnhanced from '../query-building/QueryStudioEnhanced';
import NaturalLanguageInterface from '../query-building/NaturalLanguageInterface';
import PatientTimeline from '../visualization/PatientTimeline';
import DataCharts from '../visualization/DataCharts';
import NetworkDiagram from '../visualization/NetworkDiagram';
import QueryWorkspace from '../workspace/QueryWorkspace';

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

// FHIR Services - using FHIRResourceContext instead of direct fhirClient

function FHIRExplorerApp() {
  const [currentMode, setCurrentMode] = useState(APP_MODES.DASHBOARD);
  const [currentView, setCurrentView] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadedQuery, setLoadedQuery] = useState(null);
  
  // Use the theme from Material-UI ThemeProvider
  const theme = useTheme();
  
  const isMobile = useMediaQuery('(max-width:768px)');

  // Initialize FHIR data and query history hooks
  const fhirContext = useFHIRResource();
  const queryHistoryHook = useQueryHistory();

  // Load initial data when the explorer opens
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Check if we already have data
        const existingPatients = fhirContext.getResourcesByType('Patient');
        
        if (existingPatients.length === 0) {
          
          // Add a small delay to ensure context is ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Load some initial patients
          const patientResult = await fhirContext.searchResources('Patient', { 
            _count: 20,
            _sort: '-_lastUpdated'
          });
          
          
          // If we got patients, load some resources for the first patient
          if (patientResult?.resources?.length > 0) {
            const firstPatient = patientResult.resources[0];
            
            // Load some common resource types for the first patient
            const resourceTypes = ['Condition', 'Observation', 'MedicationRequest', 'Encounter'];
            
            await Promise.all(resourceTypes.map(async (resourceType) => {
              try {
                const result = await fhirContext.searchResources(resourceType, {
                  patient: firstPatient.id,
                  _count: 10
                });
              } catch (err) {
              }
            }));
          }
        }
      } catch (error) {
      }
    };

    loadInitialData();
  }, []); // Only run once on mount

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
    
    // Log data for debugging
    const resourceCounts = Object.keys(resources).reduce((acc, key) => {
      acc[key] = resources[key].length;
      return acc;
    }, {});

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
          // Use FHIRResourceContext's searchResources method
          const result = await fhirContext.searchResources(resourceType, params);
          // Return consistent structure
          return {
            resources: result.resources || [],
            total: result.total || 0,
            bundle: result.bundle || { resourceType: 'Bundle', entry: [] }
          };
        } catch (error) {
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
          
          const result = await fhirContext.searchResources(resourceType, params);
          return {
            data: result.bundle || { resourceType: 'Bundle', entry: result.resources?.map(r => ({ resource: r })) || [] },
            total: result.total || (result.resources ? result.resources.length : 0)
          };
        } catch (error) {
          throw error;
        }
      }
    };
  }, [fhirContext]);

  // Create a stable callback for useFHIRData
  const useFHIRDataCallback = useCallback(() => fhirData, [fhirData]);

  // Navigation handlers
  const handleModeChange = useCallback((mode, view = '') => {
    setLoading(true);
    setCurrentMode(mode);
    setCurrentView(view);
    setTimeout(() => setLoading(false), 300);
  }, []);

  // Theme toggle is now handled by MedicalThemeContext

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
            return (
              <RelationshipMapperErrorBoundary>
                <RelationshipMapper onNavigate={handleModeChange} useFHIRData={useFHIRDataCallback} />
              </RelationshipMapperErrorBoundary>
            );
          default:
            return <ResourceCatalog onNavigate={handleModeChange} useFHIRData={() => fhirData} />;
        }
        
      case APP_MODES.QUERY_BUILDING:
        switch (currentView) {
          case QUERY_VIEWS.STUDIO:
            return <QueryStudioEnhanced onNavigate={handleModeChange} useFHIRData={() => fhirData} useQueryHistory={() => queryHistoryHook} />;
          case QUERY_VIEWS.NATURAL_LANGUAGE:
            return <NaturalLanguageInterface onNavigate={handleModeChange} useFHIRData={() => fhirData} useQueryHistory={() => queryHistoryHook} />;
          case QUERY_VIEWS.WORKSPACE:
            return <QueryWorkspace 
              onNavigate={handleModeChange} 
              onLoadQuery={(query) => {
                // Set the loaded query in the appropriate component
                setLoadedQuery(query);
                handleModeChange(APP_MODES.QUERY_BUILDING, QUERY_VIEWS.STUDIO);
              }}
            />;
          default:
            return <QueryStudioEnhanced onNavigate={handleModeChange} useFHIRData={() => fhirData} useQueryHistory={() => queryHistoryHook} />;
        }
        
      case APP_MODES.VISUALIZATION:
        switch (currentView) {
          case VISUALIZATION_VIEWS.CHARTS:
            return <DataCharts onNavigate={handleModeChange} fhirData={fhirData} />;
          case VISUALIZATION_VIEWS.TIMELINE:
            return <PatientTimeline fhirData={fhirData} onNavigate={handleModeChange} />;
          case VISUALIZATION_VIEWS.NETWORK:
            return <NetworkDiagram onNavigate={handleModeChange} fhirData={fhirData} />;
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
        
        
      default:
        return <DashboardHome onNavigate={handleModeChange} fhirData={fhirData} queryHistory={queryHistoryHook.queryHistory} />;
    }
  };

  return (
    <>
      <GlobalStyles
        styles={{
          body: {
            margin: 0,
            fontFamily: theme?.typography?.fontFamily || '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
          },
          '*': {
            boxSizing: 'border-box'
          }
        }}
      />
      
      <FHIRExplorerErrorBoundary>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <UnifiedLayout
            currentMode={currentMode}
            currentView={currentView}
            onModeChange={handleModeChange}
            isMobile={isMobile}
            fhirData={fhirData}
            dataLoading={fhirData.loading}
            autoCollapse={false}
          >
            <Fade in={!loading} timeout={300}>
              <Box>
                {renderCurrentView()}
              </Box>
            </Fade>
          </UnifiedLayout>
        </Box>
      </FHIRExplorerErrorBoundary>
    </>
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