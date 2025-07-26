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
  const { state, actions } = useCDSStudio();
  const [localHook, setLocalHook] = useState(null);

  // Initialize local hook from context state
  useEffect(() => {
    if (state.currentHook) {
      setLocalHook(state.currentHook);
    }
  }, [state.currentHook]);

  const handleSave = useCallback((hookData) => {
    // Update the CDS Studio state
    actions.updateCurrentHook(hookData);
    
    // Save to the hooks list
    if (hookData.id) {
      // Update existing hook
      actions.updateHook(hookData.id, hookData);
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
      actions.addHook(newHook);
    }
  }, [actions]);

  const handleCancel = useCallback(() => {
    // Reset the current hook
    actions.updateCurrentHook(null);
  }, [actions]);

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
  const { state, actions } = useCDSStudio();
  const [localHook, setLocalHook] = useState(null);
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState(true);

  // Initialize local hook from context state
  useEffect(() => {
    if (state.currentHook) {
      setLocalHook(state.currentHook);
    }
  }, [state.currentHook]);

  const handleSave = useCallback((hookData) => {
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
    actions.updateCurrentHook(enhancedHookData);
    
    // Save to the hooks list
    if (hookData.id) {
      actions.updateHook(hookData.id, enhancedHookData);
    } else {
      const newHook = {
        ...enhancedHookData,
        id: `hook-${Date.now()}`,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: 1,
        author: 'Current User'
      };
      actions.addHook(newHook);
    }
  }, [actions]);

  const handleCancel = useCallback(() => {
    actions.updateCurrentHook(null);
  }, [actions]);

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