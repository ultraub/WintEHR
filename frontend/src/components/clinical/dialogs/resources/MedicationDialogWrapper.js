/**
 * MedicationDialogWrapper Component
 * Wrapper that provides both standard and wizard modes for medication prescribing
 * 
 * @since 2025-01-21
 */
import React from 'react';
import MedicationDialog from './MedicationDialog';
import MedicationDialogWizard from './MedicationDialogWizard';

const MedicationDialogWrapper = ({
  wizardMode = true, // Default to wizard mode for better UX
  ...props
}) => {
  if (wizardMode) {
    return <MedicationDialogWizard {...props} />;
  }
  
  return <MedicationDialog {...props} />;
};

export default MedicationDialogWrapper;