/**
 * CDSBuildModeWrapper - Bridge component to adapt CDSHookBuilder for CDS Studio
 * 
 * This wrapper provides compatibility between the CDS Studio context
 * and the CDSHookBuilder component from the clinical workspace.
 * 
 * Updated to use enhanced build mode for better UX
 * 
 * @since 2025-01-26
 * @updated 2025-01-27
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Alert } from '@mui/material';
import CDSHookBuilder from '../../clinical/workspace/cds/CDSHookBuilder';
import CDSBuildModeEnhanced from './CDSBuildModeEnhanced';
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
      setLocalHook(context.currentHook);
    }
  }, [context?.currentHook]);

  const handleSave = useCallback(async (hookData) => {
    if (!context) return;
    
    // Update the current hook in context first
    context.actions.updateHook(hookData);
    
    // Then save it using the saveHook action
    const success = await context.actions.saveHook();
    
    if (success) {
      // Switch back to manage mode on successful save
      setTimeout(() => {
        context.actions.switchMode('manage');
      }, 1000);
    }
    
    return success;
  }, [context]);

  const handleCancel = useCallback(() => {
    if (!context) return;
    // Switch back to manage mode
    context.actions.switchMode('manage');
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
        editingHook={localHook?.id && localHook?.title ? localHook : null}
      />
    </Box>
  );
};

/**
 * Wrapper for improved build mode
 * Uses the new enhanced build mode for better UX
 */
export const CDSBuildModeImproved = () => {
  // Simply use the enhanced build mode which has all the improvements
  return <CDSBuildModeEnhanced />;
};

// Default export for backward compatibility
export default CDSBuildMode;