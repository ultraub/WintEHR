/**
 * AllergyCardTemplate Component
 * Standardized template for displaying FHIR AllergyIntolerance resources
 * Based on Chart Review Tab's EnhancedAllergyCard
 */
import React from 'react';
import { Chip, Stack, Typography, Box, useTheme } from '@mui/material';
import { Warning as WarningIcon, BugReport as BugIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import ClinicalResourceCard from '../ClinicalResourceCard';

/**
 * Template for displaying allergy/intolerance information
 * @param {Object} props
 * @param {Object} props.allergy - FHIR AllergyIntolerance resource
 * @param {Function} props.onEdit - Edit handler
 * @param {Function} props.onMore - More menu handler
 * @param {boolean} props.isAlternate - Alternate row styling
 */
const AllergyCardTemplate = ({ allergy, onEdit, onMore, isAlternate = false }) => {
  const theme = useTheme();
  
  if (!allergy) return null;
  
  // Extract FHIR data
  const criticality = allergy.criticality || 'low';
  const manifestations = allergy.reaction?.[0]?.manifestation || [];
  const severity = allergy.reaction?.[0]?.severity;
  
  // Map criticality to severity level and color
  const getSeverityLevel = () => {
    if (criticality === 'high') return 'critical';
    if (criticality === 'unable-to-assess') return 'moderate';
    return 'low';
  };
  
  const criticalityColor = {
    high: 'error',
    low: 'success',
    'unable-to-assess': 'warning'
  }[criticality] || 'default';
  
  const severityLevel = getSeverityLevel();
  
  // Build details array
  const details = [];
  
  // Type and category
  const typeCategory = [];
  if (allergy.type) typeCategory.push(allergy.type);
  if (allergy.category?.[0]) typeCategory.push(allergy.category[0]);
  if (typeCategory.length > 0) {
    details.push({ 
      label: 'Type', 
      value: typeCategory.join(' | ') 
    });
  }
  
  // Reactions
  if (manifestations.length > 0) {
    details.push({ 
      label: 'Reactions', 
      value: manifestations.map(m => 
        m.text || m.coding?.[0]?.display
      ).filter(Boolean).join(', ')
    });
  }
  
  // Recorded date
  if (allergy.recordedDate) {
    details.push({ 
      label: 'Recorded', 
      value: format(new Date(allergy.recordedDate), 'MMM d, yyyy') 
    });
  }
  
  // Onset
  if (allergy.onsetDateTime) {
    details.push({ 
      label: 'Onset', 
      value: format(new Date(allergy.onsetDateTime), 'MMM d, yyyy') 
    });
  }
  
  // Build title with severity chip
  const title = (
    <Stack direction="row" alignItems="center" spacing={1}>
      {criticality === 'high' && <WarningIcon color="error" />}
      <Typography variant="body1" fontWeight={600}>
        {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown allergen'}
      </Typography>
      {severity && (
        <Chip 
          label={severity} 
          size="small" 
          variant="outlined"
          color={severity === 'severe' ? 'error' : 'default'}
        />
      )}
    </Stack>
  );
  
  // Add pulsing animation for critical allergies
  const additionalProps = criticality === 'high' ? {
    sx: {
      animation: 'pulse 3s ease-in-out infinite',
      '@keyframes pulse': {
        '0%': { opacity: 1 },
        '50%': { opacity: 0.8 },
        '100%': { opacity: 1 }
      }
    }
  } : {};
  
  return (
    <ClinicalResourceCard
      title={title}
      icon={<BugIcon />}
      severity={severityLevel}
      status={criticality}
      statusColor={criticalityColor}
      details={details}
      onEdit={onEdit}
      onMore={onMore}
      isAlternate={isAlternate}
      {...additionalProps}
    />
  );
};

export default AllergyCardTemplate;