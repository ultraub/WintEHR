/**
 * ProcedureCardTemplate Component
 * Standardized template for displaying FHIR Procedure resources
 * Based on Chart Review Tab's EnhancedProcedureCard
 */
import React from 'react';
import { Chip, Stack, Typography } from '@mui/material';
import { Healing as HealingIcon, MedicalServices as ProcedureIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import ClinicalResourceCard from '../cards/ClinicalResourceCard';

/**
 * Template for displaying procedure information
 * @param {Object} props
 * @param {Object} props.procedure - FHIR Procedure resource
 * @param {Function} props.onEdit - Edit handler
 * @param {Function} props.onMore - More menu handler
 * @param {boolean} props.isAlternate - Alternate row styling
 */
const ProcedureCardTemplate = ({ procedure, onEdit, onMore, isAlternate = false }) => {
  if (!procedure) return null;
  
  // Extract FHIR data
  const procedureDisplay = procedure.code?.text || 
                          procedure.code?.coding?.[0]?.display || 
                          'Unknown procedure';
  const status = procedure.status;
  const isCompleted = status === 'completed';
  
  // Get procedure date
  const getProcedureDate = () => {
    if (procedure.performedDateTime) {
      return format(new Date(procedure.performedDateTime), 'MMM d, yyyy');
    }
    if (procedure.performedPeriod?.start) {
      const start = format(new Date(procedure.performedPeriod.start), 'MMM d, yyyy');
      if (procedure.performedPeriod.end) {
        const end = format(new Date(procedure.performedPeriod.end), 'MMM d, yyyy');
        return `${start} - ${end}`;
      }
      return start;
    }
    return 'Unknown';
  };
  
  // Build details array
  const details = [];
  
  // Date
  details.push({ label: 'Date', value: getProcedureDate() });
  
  // Performer
  if (procedure.performer?.[0]) {
    const performer = procedure.performer[0].actor?.display || 
                     procedure.performer[0].actor?.reference || 
                     'Unknown';
    details.push({ label: 'Performer', value: performer });
    
    // Performer role
    if (procedure.performer[0].function?.text) {
      details.push({ label: 'Role', value: procedure.performer[0].function.text });
    }
  }
  
  // Body site
  if (procedure.bodySite?.[0]) {
    const bodySite = procedure.bodySite[0].text || 
                    procedure.bodySite[0].coding?.[0]?.display;
    details.push({ label: 'Body Site', value: bodySite });
  }
  
  // Outcome
  if (procedure.outcome) {
    const outcome = procedure.outcome.text || 
                   procedure.outcome.coding?.[0]?.display;
    details.push({ label: 'Outcome', value: outcome });
  }
  
  // Reason
  if (procedure.reasonCode?.[0]) {
    const reason = procedure.reasonCode[0].text || 
                  procedure.reasonCode[0].coding?.[0]?.display;
    details.push({ label: 'Reason', value: reason });
  }
  
  // Complications
  if (procedure.complication?.[0]) {
    const complication = procedure.complication[0].text || 
                        procedure.complication[0].coding?.[0]?.display;
    details.push({ label: 'Complications', value: complication });
  }
  
  // Notes
  if (procedure.note?.[0]?.text) {
    details.push({ value: procedure.note[0].text });
  }
  
  // Determine severity based on status and complications
  const getSeverityLevel = () => {
    if (procedure.complication?.length > 0) return 'moderate';
    if (!isCompleted) return 'info';
    return 'normal';
  };
  
  return (
    <ClinicalResourceCard
      title={procedureDisplay}
      icon={<ProcedureIcon />}
      severity={getSeverityLevel()}
      status={status}
      statusColor={isCompleted ? 'secondary' : 'info'}
      details={details}
      onEdit={onEdit}
      onMore={onMore}
      isAlternate={isAlternate}
    />
  );
};

export default ProcedureCardTemplate;