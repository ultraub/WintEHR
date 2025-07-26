/**
 * MedicationCardTemplate Component
 * Standardized template for displaying FHIR MedicationRequest resources
 * Based on Chart Review Tab's EnhancedMedicationCard
 */
import React from 'react';
import { Chip, Stack, Typography } from '@mui/material';
import { Medication as MedicationIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import ClinicalResourceCard from '../cards/ClinicalResourceCard';
import { getMedicationName, getMedicationDosageDisplay } from '../../../../core/fhir/utils/medicationDisplayUtils';

/**
 * Template for displaying medication information
 * @param {Object} props
 * @param {Object} props.medication - FHIR MedicationRequest resource
 * @param {Function} props.onEdit - Edit handler
 * @param {Function} props.onMore - More menu handler
 * @param {boolean} props.isAlternate - Alternate row styling
 */
const MedicationCardTemplate = ({ medication, onEdit, onMore, isAlternate = false }) => {
  if (!medication) return null;
  
  // Extract FHIR data
  const medicationDisplay = getMedicationName(medication);
  const dosageDisplay = getMedicationDosageDisplay(medication);
  const dosage = medication.dosageInstruction?.[0];
  const isActive = ['active', 'on-hold'].includes(medication.status);
  
  // Build details array
  const details = [];
  
  // Dosage information
  if (dosageDisplay) {
    details.push({ label: 'Dosage', value: dosageDisplay });
  } else if (dosage?.text) {
    details.push({ label: 'Dosage', value: dosage.text });
  }
  
  // Route
  if (dosage?.route) {
    details.push({ 
      label: 'Route', 
      value: dosage.route.text || dosage.route.coding?.[0]?.display 
    });
  }
  
  // Start date
  if (medication.authoredOn) {
    details.push({ 
      label: 'Started', 
      value: format(new Date(medication.authoredOn), 'MMM d, yyyy') 
    });
  }
  
  // Reason
  if (medication.reasonCode?.[0]) {
    details.push({ 
      label: 'Reason', 
      value: medication.reasonCode[0].text || medication.reasonCode[0].coding?.[0]?.display 
    });
  }
  
  // Refills
  if (medication.dispenseRequest?.numberOfRepeatsAllowed !== undefined) {
    details.push({ 
      label: 'Refills', 
      value: `${medication.dispenseRequest.numberOfRepeatsAllowed} remaining` 
    });
  }
  
  // Build title with intent chip
  const title = (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="body1" fontWeight={600}>
        {medicationDisplay}
      </Typography>
      {medication.intent && (
        <Chip 
          label={medication.intent} 
          size="small" 
          variant="outlined"
        />
      )}
    </Stack>
  );
  
  return (
    <ClinicalResourceCard
      title={title}
      icon={<MedicationIcon />}
      severity="normal"
      status={medication.status}
      statusColor={isActive ? 'primary' : 'default'}
      details={details}
      onEdit={onEdit}
      onMore={onMore}
      isAlternate={isAlternate}
    />
  );
};

export default MedicationCardTemplate;