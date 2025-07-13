/**
 * EncounterCreationDialog Component (BaseResourceDialog Migration)
 * Streamlined encounter creation using BaseResourceDialog architecture
 * 
 * MIGRATION NOTES:
 * - Reduced from 750+ lines to ~120 lines (84% reduction)
 * - Uses BaseResourceDialog for standardized behavior
 * - Configuration-driven form fields and validation
 * - Maintains all original functionality with better error handling
 */
import React from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import BaseResourceDialog from '../../../base/BaseResourceDialog';
import EncounterFormFields from './forms/EncounterFormFields';
import EncounterPreview from './forms/EncounterPreview';
import {
  parseResource,
  updateResource,
  createEncounterResource,
  validationRules,
  formSteps,
  initialValues
} from './config/encounterDialogConfig';
import api from '../../../../services/api';

const EncounterCreationDialog = ({ 
  open, 
  onClose, 
  patientId, 
  encounter = null, // For edit mode
  mode = 'add', // 'add' | 'edit' | 'view'
  onEncounterCreated 
}) => {
  const { currentUser } = useAuth();
  const { currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();

  // Parse encounter for edit mode or use defaults
  const parsedInitialValues = React.useMemo(() => {
    if (mode === 'edit' && encounter) {
      return parseResource(encounter);
    }
    // Set default provider to current user
    return {
      ...initialValues,
      provider: currentUser?.name || initialValues.provider
    };
  }, [encounter, mode, currentUser]);

  // Custom validation combining form rules with business logic
  const validateEncounter = (formData) => {
    const errors = {};

    // Custom business validation
    if (formData.duration < 5 || formData.duration > 480) {
      errors.duration = 'Duration must be between 5 and 480 minutes';
    }

    const scheduledDateTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);
    if (scheduledDateTime < new Date() && mode === 'add') {
      errors.scheduledDate = 'Cannot schedule encounters in the past';
    }

    return errors;
  };

  // Save handler
  const handleSave = async (formData, saveMode) => {
    console.log('EncounterCreationDialog: handleSave called');
    console.log('EncounterCreationDialog: formData:', formData);
    console.log('EncounterCreationDialog: saveMode:', saveMode);
    console.log('EncounterCreationDialog: patientId:', patientId);
    
    try {
      let savedEncounter;

      if (saveMode === 'edit') {
        // Update existing encounter
        console.log('EncounterCreationDialog: updating existing encounter');
        const updatedEncounter = updateResource(encounter, formData, patientId);
        console.log('EncounterCreationDialog: updatedEncounter:', updatedEncounter);
        const response = await api.put(`/fhir/R4/Encounter/${encounter.id}`, updatedEncounter);
        savedEncounter = response.data;
      } else {
        // Create new encounter
        console.log('EncounterCreationDialog: creating new encounter');
        const newEncounter = createEncounterResource(formData, patientId);
        console.log('EncounterCreationDialog: newEncounter:', newEncounter);
        const response = await api.post('/fhir/R4/Encounter', newEncounter);
        console.log('EncounterCreationDialog: API response:', response);
        savedEncounter = response.data;
      }

      // Publish clinical workflow event
      await publish(CLINICAL_EVENTS.ENCOUNTER_CREATED, {
        encounterId: savedEncounter.id,
        patientId,
        type: formData.type,
        provider: formData.provider,
        reasonForVisit: formData.reasonForVisit,
        chiefComplaint: formData.chiefComplaint,
        template: formData.selectedTemplate,
        expectedOrders: formData.expectedOrders,
        checklist: formData.checklist,
        timestamp: new Date().toISOString(),
        mode: saveMode
      });

      // Refresh patient resources
      window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
        detail: { patientId } 
      }));

      // Notify parent component
      if (onEncounterCreated) {
        onEncounterCreated(savedEncounter);
      }

    } catch (error) {
      throw new Error(`Failed to ${saveMode === 'edit' ? 'update' : 'create'} encounter: ${error.message}`);
    }
  };

  // Custom preview renderer
  const renderPreview = (formData) => {
    return <EncounterPreview formData={formData} />;
  };

  const getDialogTitle = () => {
    if (mode === 'edit') return 'Edit Encounter';
    if (mode === 'view') return 'View Encounter';
    return 'Create New Encounter';
  };

  if (!currentPatient) {
    return null;
  }

  return (
    <BaseResourceDialog
      open={open}
      onClose={onClose}
      title={getDialogTitle()}
      resourceType="Encounter"
      resource={encounter}
      mode={mode}
      maxWidth="md"
      fullWidth
      
      // Form configuration
      initialValues={parsedInitialValues}
      validationRules={validationRules}
      onValidate={validateEncounter}
      
      // Stepper configuration
      showStepper={true}
      steps={formSteps}
      
      // Preview configuration
      showPreview={true}
      renderPreview={renderPreview}
      
      // Callbacks
      onSave={handleSave}
    >
      <EncounterFormFields />
    </BaseResourceDialog>
  );
};

export default EncounterCreationDialog;