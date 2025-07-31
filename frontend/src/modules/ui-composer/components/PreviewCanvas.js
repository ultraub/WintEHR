/**
 * Preview Canvas Component
 * Live preview of generated UI with progressive loading
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Skeleton,
  Fab,
  Zoom,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Code as CodeIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  BugReport as BugReportIcon
} from '@mui/icons-material';
import { useUIComposer } from '../contexts/UIComposerContext';
import componentRegistry from '../utils/componentRegistry';
import ProgressiveContainer from './ProgressiveContainer';
import DynamicComponent from './DynamicComponent';
import GeneratedComponentDisplay from './GeneratedComponentDisplay';

const PreviewCanvas = () => {
  const {
    currentSpec,
    previewMode,
    setPreviewMode,
    generationStatus,
    componentStatus,
    isLoading,
    hasErrors,
    errors
  } = useUIComposer();
  
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [showSkeletons, setShowSkeletons] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
  const [componentErrors, setComponentErrors] = useState({});
  
  // Listen to component registry changes
  useEffect(() => {
    const unsubscribe = componentRegistry.addListener((event, componentId, data) => {
      if (event === 'error') {
        setComponentErrors(prev => ({
          ...prev,
          [componentId]: data
        }));
      } else if (event === 'compiled') {
        setComponentErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[componentId];
          return newErrors;
        });
      }
    });
    
    return unsubscribe;
  }, []);
  
  // Handle component selection
  const handleComponentSelect = useCallback((componentId) => {
    setSelectedComponent(componentId);
  }, []);
  
  // Handle preview mode toggle
  const handlePreviewModeToggle = useCallback(() => {
    if (previewMode === 'fullscreen') {
      setPreviewMode('preview');
    } else if (previewMode === 'preview') {
      setPreviewMode('edit');
    } else {
      setPreviewMode('preview');
    }
  }, [previewMode, setPreviewMode]);
  
  // Handle fullscreen toggle
  const handleFullscreenToggle = useCallback(() => {
    if (previewMode === 'fullscreen') {
      setPreviewMode('preview');
    } else {
      setPreviewMode('fullscreen');
    }
  }, [previewMode, setPreviewMode]);
  
  // Handle refresh
  const handleRefresh = useCallback(() => {
    // Trigger re-compilation of all components
    if (currentSpec) {
      const components = componentRegistry.getAll();
      components.forEach(component => {
        componentRegistry.setLoading(component.id, true);
      });
    }
  }, [currentSpec]);
  
  // Handle export
  const handleExport = useCallback(() => {
    if (currentSpec) {
      const exportData = {
        specification: currentSpec,
        components: componentRegistry.getAll(),
        timestamp: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ui-spec-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [currentSpec]);
  
  // Render component tree recursively
  const renderComponent = useCallback((componentSpec, depth = 0) => {
    if (!componentSpec) return null;
    
    const componentId = componentSpec.props?.id;
    const isSelected = selectedComponent === componentId;
    const hasError = componentErrors[componentId];
    const status = componentStatus[componentId] || {};
    
    return (
      <Box
        key={componentId}
        sx={{
          position: 'relative',
          border: isSelected ? '2px solid #1976d2' : '1px solid transparent',
          borderRadius: 1,
          '&:hover': {
            border: previewMode === 'edit' ? '1px solid #1976d2' : 'none',
            cursor: previewMode === 'edit' ? 'pointer' : 'default'
          }
        }}
        onClick={(e) => {
          if (previewMode === 'edit') {
            e.stopPropagation();
            handleComponentSelect(componentId);
          }
        }}
      >
        {previewMode === 'edit' && isSelected && (
          <Box
            sx={{
              position: 'absolute',
              top: -1,
              left: -1,
              right: -1,
              bottom: -1,
              border: '2px solid #1976d2',
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 1
            }}
          />
        )}
        
        {hasError && (
          <Alert 
            severity="error" 
            sx={{ mb: 1 }}
            action={
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setDebugMode(true);
                }}
              >
                <BugReportIcon fontSize="small" />
              </IconButton>
            }
          >
            Component Error: {hasError}
          </Alert>
        )}
        
        {status.loading && showSkeletons ? (
          <ProgressiveContainer
            componentType={componentSpec.type}
            props={componentSpec.props}
          />
        ) : (
          <DynamicComponent
            componentSpec={componentSpec}
            onError={(error) => setComponentErrors(prev => ({
              ...prev,
              [componentId]: error
            }))}
            debugMode={debugMode}
          />
        )}
        
        {componentSpec.children && Array.isArray(componentSpec.children) && (
          <Box sx={{ mt: 1 }}>
            {componentSpec.children.map(child => renderComponent(child, depth + 1))}
          </Box>
        )}
      </Box>
    );
  }, [
    selectedComponent,
    componentErrors,
    componentStatus,
    previewMode,
    handleComponentSelect,
    showSkeletons,
    debugMode
  ]);
  
  // Render loading state
  if (isLoading && !currentSpec) {
    return (
      <Paper elevation={1} sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {generationStatus.message || 'Generating UI...'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Phase: {generationStatus.phase}
        </Typography>
      </Paper>
    );
  }
  
  // Render error state
  if (hasErrors && !currentSpec) {
    return (
      <Paper elevation={1} sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Generation Failed
          </Typography>
          {Object.entries(errors).map(([type, error]) => (
            error && (
              <Typography key={type} variant="body2">
                {type}: {error}
              </Typography>
            )
          ))}
        </Alert>
      </Paper>
    );
  }
  
  // Render empty state
  if (!currentSpec) {
    return (
      <Paper 
        elevation={1} 
        sx={{ 
          p: 4, 
          textAlign: 'center',
          bgcolor: 'grey.50',
          minHeight: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Box
            sx={{
              width: 80,
              height: 80,
              bgcolor: 'grey.200',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CodeIcon sx={{ fontSize: 40, color: 'grey.400' }} />
          </Box>
          <Typography variant="h6" color="text.secondary">
            No UI Generated Yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Describe what you want to create in the input above
          </Typography>
        </Stack>
      </Paper>
    );
  }
  
  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      <Paper 
        elevation={1} 
        sx={{ 
          p: 2, 
          minHeight: 400,
          height: previewMode === 'fullscreen' ? '100vh' : 'auto',
          position: previewMode === 'fullscreen' ? 'fixed' : 'relative',
          top: previewMode === 'fullscreen' ? 0 : 'auto',
          left: previewMode === 'fullscreen' ? 0 : 'auto',
          right: previewMode === 'fullscreen' ? 0 : 'auto',
          bottom: previewMode === 'fullscreen' ? 0 : 'auto',
          zIndex: previewMode === 'fullscreen' ? 1300 : 'auto',
          overflow: 'auto'
        }}
      >
        {/* Header */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 2,
            pb: 1,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box>
            <Typography variant="h6">
              {currentSpec.metadata?.name || 'Generated UI'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {currentSpec.metadata?.description}
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={1}>
            <Tooltip title={previewMode === 'edit' ? 'Preview mode' : 'Edit mode'}>
              <IconButton
                onClick={handlePreviewModeToggle}
                color={previewMode === 'edit' ? 'default' : 'primary'}
              >
                {previewMode === 'edit' ? <VisibilityIcon /> : <EditIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Actions">
              <IconButton
                onClick={(e) => setActionsMenuAnchor(e.currentTarget)}
              >
                <ShareIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title={previewMode === 'fullscreen' ? 'Exit fullscreen' : 'Fullscreen'}>
              <IconButton onClick={handleFullscreenToggle}>
                {previewMode === 'fullscreen' ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
        
        {/* Content */}
        <Box sx={{ minHeight: 300 }}>
          {/* Render components from specification */}
          {currentSpec.components && currentSpec.components.length > 0 ? (
            <Stack spacing={2}>
              {currentSpec.components.map((componentSpec, index) => {
                // Get any generated code from the component registry
                const registryEntry = componentRegistry.get(componentSpec.id);
                const componentCode = registryEntry?.code || null;
                
                return (
                  <GeneratedComponentDisplay
                    key={componentSpec.id || index}
                    componentSpec={componentSpec}
                    componentCode={componentCode}
                  />
                );
              })}
            </Stack>
          ) : currentSpec.layout?.structure ? (
            renderComponent(currentSpec.layout.structure)
          ) : (
            <Alert severity="info">
              No components to display
            </Alert>
          )}
        </Box>
      </Paper>
      
      {/* Actions Menu */}
      <Menu
        anchorEl={actionsMenuAnchor}
        open={Boolean(actionsMenuAnchor)}
        onClose={() => setActionsMenuAnchor(null)}
      >
        <MenuItem onClick={handleExport}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export Specification</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => setShowSkeletons(!showSkeletons)}>
          <ListItemIcon>
            {showSkeletons ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{showSkeletons ? 'Hide' : 'Show'} Loading States</ListItemText>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={() => setDebugMode(!debugMode)}>
          <ListItemIcon>
            <BugReportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Debug Mode</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Generation Status */}
      {generationStatus.phase !== 'idle' && generationStatus.phase !== 'complete' && (
        <Zoom in={true}>
          <Box
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: 1200
            }}
          >
            <Paper elevation={3} sx={{ p: 2, minWidth: 200 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CircularProgress size={20} />
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    {generationStatus.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Phase: {generationStatus.phase}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>
        </Zoom>
      )}
    </Box>
  );
};

export default PreviewCanvas;