/**
 * ConditionCardTemplate Component
 * Standardized template for displaying FHIR Condition resources
 * Based on Chart Review Tab's EnhancedConditionCard
 */
import React from 'react';
import { Chip, Stack, Typography } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import ClinicalResourceCard from '../cards/ClinicalResourceCard';

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
  
  // Format onset date
  const getOnsetDisplay = () => {
    if (condition.onsetDateTime) {
      return format(new Date(condition.onsetDateTime), 'MMM d, yyyy');
    }
    if (condition.onsetAge?.value) {
      return `Age ${condition.onsetAge.value}`;
    }
    if (condition.onsetPeriod?.start) {
      return format(new Date(condition.onsetPeriod.start), 'MMM d, yyyy');
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
  
  // Build title with verification chip
  const title = (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="body1" fontWeight={600}>
        {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}
      </Typography>
      {verificationStatus === 'confirmed' && (
        <Chip label="Confirmed" size="small" color="success" />
      )}
    </Stack>
  );
  
  return (
    <ClinicalResourceCard
      title={title}
      icon={severityLevel === 'high' ? <WarningIcon /> : null}
      severity={severityLevel}
      status={clinicalStatus}
      statusColor={isActive ? 'error' : 'default'}
      details={details}
      onEdit={onEdit}
      onMore={onMore}
      isAlternate={isAlternate}
    />
  );
};

export default ConditionCardTemplate;