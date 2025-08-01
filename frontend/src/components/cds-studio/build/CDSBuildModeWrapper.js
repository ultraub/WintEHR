/**
 * CDSBuildModeWrapper - Bridge component to adapt CDSHookBuilder for CDS Studio
 * 
 * This wrapper provides compatibility between the CDS Studio context
 * and the CDSHookBuilder component from the clinical workspace.
 * 
 * @since 2025-01-26
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Alert } from '@mui/material';
import CDSHookBuilder from '../../clinical/workspace/cds/CDSHookBuilder';
import { useCDSStudio } from '../../../pages/CDSHooksStudio';

/**
 * Wrapper for standard build mode
 */
export const CDSBuildMode = () => {
  const context = useCDSStudio();
  const [localHook, setLocalHook] = useState(null);
  
  // Initialize local hook from context
  useEffect(() => {
    if (context?.currentHook) {
      console.log('[CDSBuildMode] Received hook from context:', context.currentHook);
      setLocalHook(context.currentHook);
    }
  }, [context?.currentHook]);

  const handleSave = useCallback((hookData) => {
    if (!context) return;
    
    // Update the CDS Studio state
    context.actions.updateCurrentHook(hookData);
    
    // Save to the hooks list
    if (hookData.id) {
      // Update existing hook
      context.actions.updateHook(hookData.id, hookData);
    } else {
      // Create new hook
      const newHook = {
        ...hookData,
        id: `hook-${Date.now()}`,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: 1,
        author: 'Current User'
      };
      context.actions.addHook(newHook);
    }
  }, [context]);

  const handleCancel = useCallback(() => {
    if (!context) return;
    // Reset the current hook
    context.actions.updateCurrentHook(null);
  }, [context]);
  
  // Safety check in case context is not available
  if (!context) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          CDS Studio context not available. Please ensure this component is rendered within CDSStudioProvider.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CDSHookBuilder
        onSave={handleSave}
        onCancel={handleCancel}
        editingHook={localHook}
      />
    </Box>
  );
};

/**
 * Wrapper for improved build mode
 * Since CDSBuildModeImproved doesn't exist, we'll use the same CDSHookBuilder
 * but with enhanced features enabled
 */
export const CDSBuildModeImproved = () => {
  const context = useCDSStudio();
  const [localHook, setLocalHook] = useState(null);
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState(true);
  
  // Initialize local hook from context
  useEffect(() => {
    if (context?.currentHook) {
      console.log('[CDSBuildMode] Received hook from context:', context.currentHook);
      setLocalHook(context.currentHook);
    }
  }, [context?.currentHook]);

  const handleSave = useCallback((hookData) => {
    if (!context) return;
    
    // Enhanced save with additional metadata
    const enhancedHookData = {
      ...hookData,
      metadata: {
        ...hookData.metadata,
        isImproved: true,
        features: ['advanced-conditions', 'visual-builder', 'realtime-preview']
      }
    };

    // Update the CDS Studio state
    context.actions.updateCurrentHook(enhancedHookData);
    
    // Save to the hooks list
    if (hookData.id) {
      context.actions.updateHook(hookData.id, enhancedHookData);
    } else {
      const newHook = {
        ...enhancedHookData,
        id: `hook-${Date.now()}`,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: 1,
        author: 'Current User'
      };
      context.actions.addHook(newHook);
    }
  }, [context]);

  const handleCancel = useCallback(() => {
    if (!context) return;
    context.actions.updateCurrentHook(null);
  }, [context]);
  
  // Safety check in case context is not available
  if (!context) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          CDS Studio context not available. Please ensure this component is rendered within CDSStudioProvider.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        Using enhanced CDS Hook Builder with advanced features
      </Alert>
      <CDSHookBuilder
        onSave={handleSave}
        onCancel={handleCancel}
        editingHook={localHook}
        // Additional props to enhance the builder
        showAdvancedFeatures={showAdvancedFeatures}
        enableRealTimePreview={true}
        enableVisualConditions={true}
      />
    </Box>
  );
};

// Default export for backward compatibility
export default CDSBuildMode;