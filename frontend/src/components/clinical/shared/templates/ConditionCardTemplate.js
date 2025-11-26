/**
 * ConditionCardTemplate Component
 * Standardized template for displaying FHIR Condition resources
 * Based on Chart Review Tab's EnhancedConditionCard
 */
import React from 'react';
import { Chip, Stack, Typography } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import ClinicalResourceCard from '../cards/ClinicalResourceCard';
import { formatClinicalDate } from '../../../../core/fhir/utils/dateFormatUtils';
import { getStatusColor, getStatusLabel } from '../../../../core/fhir/utils/statusDisplayUtils';
import { getConditionDisplay } from '../../../../core/fhir/utils/fhirFieldUtils';

/**
 * Template for displaying condition/diagnosis information
 * @param {Object} props
 * @param {Object} props.condition - FHIR Condition resource
 * @param {Function} props.onEdit - Edit handler
 * @param {Function} props.onMore - More menu handler
 * @param {boolean} props.isAlternate - Alternate row styling
 */
const ConditionCardTemplate = ({ condition, onEdit, onMore, isAlternate = false }) => {
  if (!condition) return null;
  
  // Extract FHIR data
  const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code;
  const verificationStatus = condition.verificationStatus?.coding?.[0]?.code;
  const severity = condition.severity?.coding?.[0]?.display || condition.severity?.text;
  const stage = condition.stage?.[0]?.summary?.coding?.[0]?.display || condition.stage?.[0]?.summary?.text;
  const isActive = clinicalStatus === 'active';
  
  // Determine severity level for styling
  const getSeverityLevel = () => {
    if (severity?.toLowerCase().includes('severe')) return 'high';
    if (severity?.toLowerCase().includes('moderate')) return 'moderate';
    if (severity?.toLowerCase().includes('mild')) return 'low';
    return isActive ? 'moderate' : 'low';
  };
  
  const severityLevel = getSeverityLevel();
  
  // Format onset date using standardized date formatting
  const getOnsetDisplay = () => {
    if (condition.onsetDateTime) {
      return formatClinicalDate(condition.onsetDateTime);
    }
    if (condition.onsetAge?.value) {
      return `Age ${condition.onsetAge.value}`;
    }
    if (condition.onsetPeriod?.start) {
      return formatClinicalDate(condition.onsetPeriod.start);
    }
    return 'Unknown';
  };
  
  // Build details array
  const details = [
    { label: 'Onset', value: getOnsetDisplay() }
  ];
  
  if (severity) {
    details.push({ label: 'Severity', value: severity });
  }
  
  if (stage) {
    details.push({ label: 'Stage', value: stage });
  }
  
  if (condition.note?.[0]?.text) {
    details.push({ value: condition.note[0].text });
  }
  
  // Build title with verification chip using standardized display
  const conditionName = getConditionDisplay(condition);
  const title = (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="body1" fontWeight={600}>
        {conditionName}
      </Typography>
      {verificationStatus === 'confirmed' && (
        <Chip label="Confirmed" size="small" color="success" />
      )}
    </Stack>
  );

  // Use standardized status color mapping
  const statusColor = getStatusColor(clinicalStatus, 'Condition');

  return (
    <ClinicalResourceCard
      title={title}
      icon={severityLevel === 'high' ? <WarningIcon /> : null}
      severity={severityLevel}
      status={getStatusLabel(clinicalStatus)}
      statusColor={statusColor}
      details={details}
      onEdit={onEdit}
      onMore={onMore}
      isAlternate={isAlternate}
    />
  );
};

export default ConditionCardTemplate;