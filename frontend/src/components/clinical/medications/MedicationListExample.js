/**
 * Example integration of MedicationListManager
 * Shows how to integrate the medication list manager into existing UI
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import MedicationListManager from './MedicationListManager';
import MedicationDialogEnhanced from '../workspace/dialogs/MedicationDialogEnhanced';

const MedicationListExample = ({ patientId }) => {
  const [medicationDialogOpen, setMedicationDialogOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [targetListType, setTargetListType] = useState('current');

  // Handle medication click - show details
  const handleMedicationClick = (medication) => {
    setSelectedMedication(medication);
    setMedicationDialogOpen(true);
  };

  // Handle add medication - open dialog for new prescription
  const handleAddMedication = (listType) => {
    setTargetListType(listType);
    setSelectedMedication(null);
    setMedicationDialogOpen(true);
  };

  // Handle medication saved
  const handleMedicationSaved = async (medication) => {
    // The medication will be automatically added to the appropriate list
    // through the workflow service when it's prescribed
    setMedicationDialogOpen(false);
    
    // You could also manually add it to a specific list here if needed:
    // await medicationCRUDService.addMedicationToList(
    //   patientId,
    //   targetListType,
    //   medication,
    //   'Prescribed'
    // );
  };

  return (
    <Box>
      <Paper sx={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* Optional header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h5">
            Patient Medication Management
          </Typography>
        </Box>

        {/* Medication List Manager */}
        <MedicationListManager
          patientId={patientId}
          onMedicationClick={handleMedicationClick}
          onAddMedication={handleAddMedication}
          height="calc(100% - 64px)"
        />
      </Paper>

      {/* Medication Dialog for viewing/editing */}
      {medicationDialogOpen && (
        <MedicationDialogEnhanced
          open={medicationDialogOpen}
          onClose={() => setMedicationDialogOpen(false)}
          medication={selectedMedication}
          patientId={patientId}
          mode={selectedMedication ? 'view' : 'create'}
          onSave={handleMedicationSaved}
        />
      )}
    </Box>
  );
};

export default MedicationListExample;

/**
 * Integration Notes:
 * 
 * 1. Basic Integration:
 *    <MedicationListManager patientId={patientId} />
 * 
 * 2. With Callbacks:
 *    <MedicationListManager
 *      patientId={patientId}
 *      onMedicationClick={(med) => showDetails(med)}
 *      onAddMedication={(listType) => openPrescribeDialog(listType)}
 *    />
 * 
 * 3. Custom Height:
 *    <MedicationListManager
 *      patientId={patientId}
 *      height="400px"
 *    />
 * 
 * 4. Inside a Tab:
 *    <TabPanel value={activeTab} index={2}>
 *      <MedicationListManager patientId={patientId} />
 *    </TabPanel>
 * 
 * 5. With Workflow Integration:
 *    When medications are prescribed through the normal workflow,
 *    they should automatically be added to the appropriate lists
 *    if the backend sends the correct events.
 */