/**
 * Chart Review Tab Component (Refactored)
 * Comprehensive view of patient's problems, medications, and allergies
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Alert,
  CircularProgress,
  Snackbar,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useMedicationResolver } from '../../../../hooks/useMedicationResolver';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { usePatientCDSAlerts } from '../../../../contexts/CDSContext';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { medicationDiscontinuationService } from '../../../../services/medicationDiscontinuationService';
import { medicationEffectivenessService } from '../../../../services/medicationEffectivenessService';
import { intelligentCache } from '../../../../core/fhir/utils/intelligentCache';

// Section Components
import ProblemsSection from '../sections/ProblemsSection';
import MedicationsSection from '../sections/MedicationsSection';
import AllergiesSection from '../sections/AllergiesSection';

// Dialogs
import AddProblemDialog from '../dialogs/AddProblemDialog';
import EditProblemDialog from '../dialogs/EditProblemDialog';
import PrescribeMedicationDialog from '../dialogs/PrescribeMedicationDialog';
import EditMedicationDialog from '../dialogs/EditMedicationDialog';
import AddAllergyDialog from '../dialogs/AddAllergyDialog';
import EditAllergyDialog from '../dialogs/EditAllergyDialog';
import MedicationReconciliationDialog from '../dialogs/MedicationReconciliationDialog';
import RefillManagement from '../../medications/RefillManagement';
import MedicationDiscontinuationDialog from '../../medications/MedicationDiscontinuationDialog';
import EffectivenessMonitoringPanel from '../../medications/EffectivenessMonitoringPanel';
import ClinicalSafetyPanel from '../../medications/ClinicalSafetyPanel';

const ChartReviewTab = ({ patientId, patient, department = 'medical' }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // FHIR Resources
  const { resources: conditions = [], loading: conditionsLoading, error: conditionsError, refetch: refetchConditions } = 
    useFHIRResource('Condition', { patient: patientId, _include: 'Condition:asserter' });
  
  const { resources: medicationRequests = [], loading: medicationsLoading, error: medicationsError, refetch: refetchMedications } = 
    useFHIRResource('MedicationRequest', { patient: patientId, _include: 'MedicationRequest:medication' });
  
  const { resources: allergies = [], loading: allergiesLoading, error: allergiesError, refetch: refetchAllergies } = 
    useFHIRResource('AllergyIntolerance', { patient: patientId });
  
  const { resolveMedications } = useMedicationResolver();
  const { publish, subscribe } = useClinicalWorkflow();
  const { alerts } = usePatientCDSAlerts(patientId);
  
  // Dialog states
  const [dialogStates, setDialogStates] = useState({
    addProblem: false,
    editProblem: false,
    addMedication: false,
    editMedication: false,
    addAllergy: false,
    editAllergy: false,
    reconciliation: false,
    refill: false,
    discontinue: false,
    effectiveness: false,
    safety: false
  });
  
  const [selectedItems, setSelectedItems] = useState({
    condition: null,
    medication: null,
    allergy: null
  });
  
  // Notification state
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  
  // Resolve medications with full details
  const [resolvedMedications, setResolvedMedications] = useState([]);
  useEffect(() => {
    const resolveMeds = async () => {
      if (medicationRequests.length > 0) {
        const resolved = await resolveMedications(medicationRequests);
        setResolvedMedications(resolved);
      }
    };
    resolveMeds();
  }, [medicationRequests, resolveMedications]);
  
  // Dialog handlers
  const openDialog = (dialogName, item = null) => {
    setDialogStates(prev => ({ ...prev, [dialogName]: true }));
    if (item) {
      const itemType = dialogName.includes('problem') || dialogName.includes('Problem') ? 'condition' :
                      dialogName.includes('medication') || dialogName.includes('Medication') ? 'medication' :
                      'allergy';
      setSelectedItems(prev => ({ ...prev, [itemType]: item }));
    }
  };
  
  const closeDialog = (dialogName) => {
    setDialogStates(prev => ({ ...prev, [dialogName]: false }));
    // Clear selected item after a delay to prevent flicker
    setTimeout(() => {
      const itemType = dialogName.includes('problem') || dialogName.includes('Problem') ? 'condition' :
                      dialogName.includes('medication') || dialogName.includes('Medication') ? 'medication' :
                      'allergy';
      setSelectedItems(prev => ({ ...prev, [itemType]: null }));
    }, 300);
  };
  
  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };
  
  // Problem handlers
  const handleAddProblem = async (problem) => {
    try {
      await fhirClient.create(problem);
      await publish(CLINICAL_EVENTS.CONDITION_ADDED, { condition: problem, patientId });
      showNotification('Problem added successfully');
      closeDialog('addProblem');
      refetchConditions();
      intelligentCache.invalidate(`Condition-${patientId}`);
    } catch (error) {
      showNotification('Failed to add problem', 'error');
      throw error;
    }
  };
  
  const handleEditProblem = async (problem) => {
    try {
      await fhirClient.update(problem);
      await publish(CLINICAL_EVENTS.CONDITION_UPDATED, { condition: problem, patientId });
      showNotification('Problem updated successfully');
      closeDialog('editProblem');
      refetchConditions();
      intelligentCache.invalidate(`Condition-${patientId}`);
    } catch (error) {
      showNotification('Failed to update problem', 'error');
      throw error;
    }
  };
  
  const handleDeleteProblem = async (conditionId) => {
    try {
      await fhirClient.delete('Condition', conditionId);
      await publish(CLINICAL_EVENTS.CONDITION_DELETED, { conditionId, patientId });
      showNotification('Problem deleted successfully');
      closeDialog('editProblem');
      refetchConditions();
      intelligentCache.invalidate(`Condition-${patientId}`);
    } catch (error) {
      showNotification('Failed to delete problem', 'error');
      throw error;
    }
  };
  
  // Medication handlers
  const handlePrescribeMedication = async (medicationRequest) => {
    try {
      const result = await fhirClient.create(medicationRequest);
      await publish(CLINICAL_EVENTS.MEDICATION_PRESCRIBED, { 
        medicationRequest: result, 
        patientId 
      });
      showNotification('Medication prescribed successfully');
      closeDialog('addMedication');
      refetchMedications();
      intelligentCache.invalidate(`MedicationRequest-${patientId}`);
    } catch (error) {
      showNotification('Failed to prescribe medication', 'error');
      throw error;
    }
  };
  
  const handleEditMedication = async (medicationRequest) => {
    try {
      await fhirClient.update(medicationRequest);
      await publish(CLINICAL_EVENTS.MEDICATION_UPDATED, { 
        medicationRequest, 
        patientId 
      });
      showNotification('Medication updated successfully');
      closeDialog('editMedication');
      refetchMedications();
      intelligentCache.invalidate(`MedicationRequest-${patientId}`);
    } catch (error) {
      showNotification('Failed to update medication', 'error');
      throw error;
    }
  };
  
  const handleDiscontinueMedication = async (medicationId, reason, notes) => {
    try {
      await medicationDiscontinuationService.discontinueMedication(
        medicationId,
        patientId,
        reason,
        notes
      );
      await publish(CLINICAL_EVENTS.MEDICATION_DISCONTINUED, { 
        medicationId, 
        patientId,
        reason 
      });
      showNotification('Medication discontinued successfully');
      closeDialog('discontinue');
      refetchMedications();
      intelligentCache.invalidate(`MedicationRequest-${patientId}`);
    } catch (error) {
      showNotification('Failed to discontinue medication', 'error');
      throw error;
    }
  };
  
  // Allergy handlers
  const handleAddAllergy = async (allergy) => {
    try {
      await fhirClient.create(allergy);
      await publish(CLINICAL_EVENTS.ALLERGY_ADDED, { allergy, patientId });
      showNotification('Allergy added successfully');
      closeDialog('addAllergy');
      refetchAllergies();
      intelligentCache.invalidate(`AllergyIntolerance-${patientId}`);
    } catch (error) {
      showNotification('Failed to add allergy', 'error');
      throw error;
    }
  };
  
  const handleEditAllergy = async (allergy) => {
    try {
      await fhirClient.update(allergy);
      await publish(CLINICAL_EVENTS.ALLERGY_UPDATED, { allergy, patientId });
      showNotification('Allergy updated successfully');
      closeDialog('editAllergy');
      refetchAllergies();
      intelligentCache.invalidate(`AllergyIntolerance-${patientId}`);
    } catch (error) {
      showNotification('Failed to update allergy', 'error');
      throw error;
    }
  };
  
  const handleDeleteAllergy = async (allergyId) => {
    try {
      await fhirClient.delete('AllergyIntolerance', allergyId);
      await publish(CLINICAL_EVENTS.ALLERGY_DELETED, { allergyId, patientId });
      showNotification('Allergy deleted successfully');
      closeDialog('editAllergy');
      refetchAllergies();
      intelligentCache.invalidate(`AllergyIntolerance-${patientId}`);
    } catch (error) {
      showNotification('Failed to delete allergy', 'error');
      throw error;
    }
  };
  
  // Event subscriptions
  useEffect(() => {
    const unsubscribers = [
      subscribe(CLINICAL_EVENTS.ORDER_PLACED, (event) => {
        if (event.patientId === patientId && event.orderType === 'medication') {
          refetchMedications();
        }
      }),
      subscribe(CLINICAL_EVENTS.PROBLEM_RESOLVED, (event) => {
        if (event.patientId === patientId) {
          refetchConditions();
        }
      })
    ];
    
    return () => unsubscribers.forEach(unsub => unsub());
  }, [patientId, subscribe, refetchMedications, refetchConditions]);
  
  // Loading state
  if (conditionsLoading && medicationsLoading && allergiesLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box>
      {/* CDS Alerts */}
      {alerts.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {alerts.length} clinical decision support {alerts.length === 1 ? 'alert' : 'alerts'} active
        </Alert>
      )}
      
      <Grid container spacing={2}>
        {/* Problems Section */}
        <Grid item xs={12} lg={isMobile ? 12 : 4}>
          <ProblemsSection
            conditions={conditions}
            loading={conditionsLoading}
            error={conditionsError?.message}
            onAdd={() => openDialog('addProblem')}
            onEdit={(condition) => openDialog('editProblem', condition)}
            onHistory={(condition) => {/* TODO: Implement history view */}}
            department={department}
          />
        </Grid>
        
        {/* Medications Section */}
        <Grid item xs={12} lg={isMobile ? 12 : 4}>
          <MedicationsSection
            medications={resolvedMedications}
            loading={medicationsLoading}
            error={medicationsError?.message}
            patient={patient}
            onAdd={() => openDialog('addMedication')}
            onEdit={(medication) => openDialog('editMedication', medication)}
            onHistory={(medication) => {/* TODO: Implement history view */}}
            onReconcile={() => openDialog('reconciliation')}
            onDiscontinue={(medication) => openDialog('discontinue', medication)}
            onRefill={(medication) => openDialog('refill', medication)}
            onEffectiveness={(medication) => openDialog('effectiveness', medication)}
            onSafety={(medication) => openDialog('safety', medication)}
            department={department}
          />
        </Grid>
        
        {/* Allergies Section */}
        <Grid item xs={12} lg={isMobile ? 12 : 4}>
          <AllergiesSection
            allergies={allergies}
            loading={allergiesLoading}
            error={allergiesError?.message}
            onAdd={() => openDialog('addAllergy')}
            onEdit={(allergy) => openDialog('editAllergy', allergy)}
            onHistory={(allergy) => {/* TODO: Implement history view */}}
            department={department}
          />
        </Grid>
      </Grid>
      
      {/* Dialogs */}
      <AddProblemDialog
        open={dialogStates.addProblem}
        onClose={() => closeDialog('addProblem')}
        onSubmit={handleAddProblem}
        patientId={patientId}
      />
      
      {selectedItems.condition && (
        <EditProblemDialog
          open={dialogStates.editProblem}
          onClose={() => closeDialog('editProblem')}
          onSave={handleEditProblem}
          onDelete={handleDeleteProblem}
          condition={selectedItems.condition}
          patientId={patientId}
        />
      )}
      
      <PrescribeMedicationDialog
        open={dialogStates.addMedication}
        onClose={() => closeDialog('addMedication')}
        onPrescribe={handlePrescribeMedication}
        patientId={patientId}
        patient={patient}
      />
      
      {selectedItems.medication && (
        <EditMedicationDialog
          open={dialogStates.editMedication}
          onClose={() => closeDialog('editMedication')}
          onSave={handleEditMedication}
          medication={selectedItems.medication}
          patientId={patientId}
        />
      )}
      
      <AddAllergyDialog
        open={dialogStates.addAllergy}
        onClose={() => closeDialog('addAllergy')}
        onSubmit={handleAddAllergy}
        patientId={patientId}
      />
      
      {selectedItems.allergy && (
        <EditAllergyDialog
          open={dialogStates.editAllergy}
          onClose={() => closeDialog('editAllergy')}
          onSave={handleEditAllergy}
          onDelete={handleDeleteAllergy}
          allergy={selectedItems.allergy}
          patientId={patientId}
        />
      )}
      
      <MedicationReconciliationDialog
        open={dialogStates.reconciliation}
        onClose={() => closeDialog('reconciliation')}
        patientId={patientId}
      />
      
      {selectedItems.medication && (
        <>
          <RefillManagement
            open={dialogStates.refill}
            onClose={() => closeDialog('refill')}
            medication={selectedItems.medication}
            patientId={patientId}
          />
          
          <MedicationDiscontinuationDialog
            open={dialogStates.discontinue}
            onClose={() => closeDialog('discontinue')}
            onDiscontinue={handleDiscontinueMedication}
            medication={selectedItems.medication}
          />
          
          <EffectivenessMonitoringPanel
            open={dialogStates.effectiveness}
            onClose={() => closeDialog('effectiveness')}
            medication={selectedItems.medication}
            patientId={patientId}
          />
          
          <ClinicalSafetyPanel
            open={dialogStates.safety}
            onClose={() => closeDialog('safety')}
            medication={selectedItems.medication}
            patientId={patientId}
          />
        </>
      )}
      
      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        message={notification.message}
      />
    </Box>
  );
};

export default ChartReviewTab;