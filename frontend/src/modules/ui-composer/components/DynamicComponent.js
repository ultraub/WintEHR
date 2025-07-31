/**
 * Dynamic Component Renderer
 * Renders dynamically generated components safely
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Alert,
  Typography,
  Paper,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import componentRegistry from '../utils/componentRegistry';
import { COMPONENT_TYPES } from '../utils/uiSpecSchema';

const DynamicComponent = ({ 
  componentSpec, 
  onError, 
  debugMode = false,
  fallback = null 
}) => {
  const [component, setComponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const componentId = componentSpec?.props?.id;
  const componentType = componentSpec?.type;
  
  // Load component from registry
  useEffect(() => {
    if (!componentId) {
      setError('Component ID is required');
      setLoading(false);
      return;
    }
    
    const loadComponent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check if component is already compiled
        const registeredComponent = componentRegistry.get(componentId);
        if (registeredComponent && registeredComponent.compiled) {
          setComponent(registeredComponent);
          setLoading(false);
          return;
        }
        
        // Wait for component to be compiled
        const maxWaitTime = 30000; // 30 seconds
        const startTime = Date.now();
        
        const checkForComponent = () => {
          const comp = componentRegistry.get(componentId);
          
          if (comp && comp.compiled) {
            setComponent(comp);
            setLoading(false);
            return;
          }
          
          const componentError = componentRegistry.getError(componentId);
          if (componentError) {
            setError(componentError);
            setLoading(false);
            onError?.(componentError);
            return;
          }
          
          if (Date.now() - startTime > maxWaitTime) {
            const timeoutError = 'Component compilation timeout';
            setError(timeoutError);
            setLoading(false);
            onError?.(timeoutError);
            return;
          }
          
          // Check again in 500ms
          setTimeout(checkForComponent, 500);
        };
        
        checkForComponent();
        
      } catch (err) {
        setError(err.message);
        setLoading(false);
        onError?.(err.message);
      }
    };
    
    loadComponent();
  }, [componentId, onError, retryCount]);
  
  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
  }, []);
  
  // Render component
  const renderComponent = useMemo(() => {
    if (!component || !component.factory) {
      return null;
    }
    
    try {
      // Create component instance
      const ComponentInstance = component.factory;
      
      // Render based on component type
      switch (componentType) {
        case COMPONENT_TYPES.CHART:
          return (
            <ChartRenderer 
              component={ComponentInstance} 
              props={componentSpec.props} 
              dataBinding={componentSpec.dataBinding}
            />
          );
        case COMPONENT_TYPES.GRID:
          return (
            <GridRenderer 
              component={ComponentInstance} 
              props={componentSpec.props} 
              dataBinding={componentSpec.dataBinding}
            />
          );
        case COMPONENT_TYPES.SUMMARY:
          return (
            <SummaryRenderer 
              component={ComponentInstance} 
              props={componentSpec.props} 
              dataBinding={componentSpec.dataBinding}
            />
          );
        case COMPONENT_TYPES.TIMELINE:
          return (
            <TimelineRenderer 
              component={ComponentInstance} 
              props={componentSpec.props} 
              dataBinding={componentSpec.dataBinding}
            />
          );
        case COMPONENT_TYPES.FORM:
          return (
            <FormRenderer 
              component={ComponentInstance} 
              props={componentSpec.props} 
              dataBinding={componentSpec.dataBinding}
            />
          );
        case COMPONENT_TYPES.CONTAINER:
          return (
            <ContainerRenderer 
              component={ComponentInstance} 
              props={componentSpec.props} 
              children={componentSpec.children}
            />
          );
        case COMPONENT_TYPES.TEXT:
          return (
            <TextRenderer 
              component={ComponentInstance} 
              props={componentSpec.props} 
            />
          );
        default:
          return (
            <DefaultRenderer 
              component={ComponentInstance} 
              props={componentSpec.props} 
            />
          );
      }
    } catch (renderError) {
      return (
        <Alert severity="error">
          Render Error: {renderError.message}
        </Alert>
      );
    }
  }, [component, componentType, componentSpec]);
  
  // Loading state
  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Loading component...
        </Typography>
      </Box>
    );
  }
  
  // Error state
  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button 
            size="small" 
            onClick={handleRetry}
            startIcon={<RefreshIcon />}
          >
            Retry
          </Button>
        }
      >
        <Typography variant="subtitle2">
          Component Error
        </Typography>
        <Typography variant="body2">
          {error}
        </Typography>
        
        {debugMode && (
          <Box sx={{ mt: 1 }}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="caption">Debug Info</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  <Chip label={`ID: ${componentId}`} size="small" />
                  <Chip label={`Type: ${componentType}`} size="small" />
                  <Chip label={`Retry Count: ${retryCount}`} size="small" />
                  
                  {component?.code && (
                    <Box>
                      <Typography variant="caption" gutterBottom>
                        Generated Code:
                      </Typography>
                      <Paper 
                        sx={{ 
                          p: 1, 
                          bgcolor: 'grey.100', 
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          maxHeight: 200,
                          overflow: 'auto'
                        }}
                      >
                        <pre>{component.code}</pre>
                      </Paper>
                    </Box>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
      </Alert>
    );
  }
  
  // Fallback if no component
  if (!component && fallback) {
    return fallback;
  }
  
  // Render component
  return (
    <Box sx={{ position: 'relative' }}>
      {debugMode && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            zIndex: 1,
            p: 0.5
          }}
        >
          <Chip 
            label={componentType} 
            size="small" 
            color="primary" 
            variant="outlined"
            icon={<CodeIcon />}
          />
        </Box>
      )}
      
      {renderComponent}
    </Box>
  );
};

// Component-specific renderers
const ChartRenderer = ({ component, props, dataBinding }) => {
  // For now, render placeholder since we need actual component compilation
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {props?.title || 'Chart Component'}
      </Typography>
      <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Chart will render here when component is compiled
        </Typography>
      </Box>
    </Paper>
  );
};

const GridRenderer = ({ component, props, dataBinding }) => {
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {props?.title || 'Data Grid'}
      </Typography>
      <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Grid will render here when component is compiled
        </Typography>
      </Box>
    </Paper>
  );
};

const SummaryRenderer = ({ component, props, dataBinding }) => {
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {props?.title || 'Summary'}
      </Typography>
      <Typography variant="h4" color="primary">
        --
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Loading...
      </Typography>
    </Paper>
  );
};

const TimelineRenderer = ({ component, props, dataBinding }) => {
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {props?.title || 'Timeline'}
      </Typography>
      <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Timeline will render here when component is compiled
        </Typography>
      </Box>
    </Paper>
  );
};

const FormRenderer = ({ component, props, dataBinding }) => {
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {props?.title || 'Form'}
      </Typography>
      <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Form will render here when component is compiled
        </Typography>
      </Box>
    </Paper>
  );
};

const ContainerRenderer = ({ component, props, children }) => {
  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Container Component
      </Typography>
      <Stack spacing={2}>
        {children && children.map((child, index) => (
          <DynamicComponent key={index} componentSpec={child} />
        ))}
      </Stack>
    </Box>
  );
};

const TextRenderer = ({ component, props }) => {
  return (
    <Typography variant={props?.variant || 'body1'}>
      {props?.text || 'Text content'}
    </Typography>
  );
};

const DefaultRenderer = ({ component, props }) => {
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Alert severity="info">
        Default renderer for component type: {props?.type || 'unknown'}
      </Alert>
    </Paper>
  );
};

export default DynamicComponent;