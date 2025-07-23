/**
 * ObservationCardTemplate Component
 * Standardized template for displaying FHIR Observation resources
 * Supports lab results, vital signs, and other clinical observations
 */
import React from 'react';
import { Chip, Stack, Typography, Box } from '@mui/material';
import { 
  Science as LabIcon,
  MonitorHeart as VitalIcon,
  TrendingUp as HighIcon,
  TrendingDown as LowIcon,
  Warning as AbnormalIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import ClinicalResourceCard from '../ClinicalResourceCard';

/**
 * Template for displaying observation information
 * @param {Object} props
 * @param {Object} props.observation - FHIR Observation resource
 * @param {Function} props.onEdit - Edit handler
 * @param {Function} props.onMore - More menu handler
 * @param {boolean} props.isAlternate - Alternate row styling
 * @param {boolean} props.showTrend - Show trending indicators
 */
const ObservationCardTemplate = ({ 
  observation, 
  onEdit, 
  onMore, 
  isAlternate = false,
  showTrend = false 
}) => {
  if (!observation) return null;
  
  // Determine observation type
  const isVitalSign = observation.category?.some(cat => 
    cat.coding?.[0]?.code === 'vital-signs'
  );
  const isLab = observation.category?.some(cat => 
    cat.coding?.[0]?.code === 'laboratory'
  );
  
  // Extract value and interpretation
  const getValue = () => {
    if (observation.valueQuantity) {
      return `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}`;
    }
    if (observation.valueCodeableConcept) {
      return observation.valueCodeableConcept.text || 
             observation.valueCodeableConcept.coding?.[0]?.display;
    }
    if (observation.valueString) {
      return observation.valueString;
    }
    return 'No value';
  };
  
  const interpretation = observation.interpretation?.[0]?.coding?.[0]?.code;
  const isAbnormal = ['H', 'L', 'HH', 'LL', 'A', 'AA'].includes(interpretation);
  const isCritical = ['HH', 'LL', 'AA'].includes(interpretation);
  
  // Determine severity based on interpretation
  const getSeverityLevel = () => {
    if (isCritical) return 'critical';
    if (isAbnormal) return 'moderate';
    return 'normal';
  };
  
  // Get interpretation display
  const getInterpretationDisplay = () => {
    const interpretationMap = {
      'H': 'High',
      'L': 'Low',
      'HH': 'Critical High',
      'LL': 'Critical Low',
      'N': 'Normal',
      'A': 'Abnormal',
      'AA': 'Critical'
    };
    return interpretationMap[interpretation] || interpretation;
  };
  
  // Build details array
  const details = [];
  
  // Reference range
  if (observation.referenceRange?.[0]) {
    const range = observation.referenceRange[0];
    let rangeText = '';
    if (range.low?.value && range.high?.value) {
      rangeText = `${range.low.value} - ${range.high.value} ${range.low.unit || ''}`;
    } else if (range.text) {
      rangeText = range.text;
    }
    if (rangeText) {
      details.push({ label: 'Reference', value: rangeText });
    }
  }
  
  // Date/Time
  const effectiveDate = observation.effectiveDateTime || observation.issued;
  if (effectiveDate) {
    details.push({ 
      label: 'Date', 
      value: format(new Date(effectiveDate), 'MMM d, yyyy h:mm a') 
    });
  }
  
  // Performer
  if (observation.performer?.[0]?.display) {
    details.push({ label: 'Performed by', value: observation.performer[0].display });
  }
  
  // Notes
  if (observation.note?.[0]?.text) {
    details.push({ value: observation.note[0].text });
  }
  
  // Build title with value and interpretation
  const title = (
    <Stack spacing={0.5}>
      <Typography variant="body1" fontWeight={600}>
        {observation.code?.text || observation.code?.coding?.[0]?.display || 'Unknown observation'}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="h6" fontWeight="bold" color={isCritical ? 'error' : 'text.primary'}>
          {getValue()}
        </Typography>
        {interpretation && (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {interpretation === 'H' || interpretation === 'HH' ? 
              <HighIcon fontSize="small" color="error" /> :
              interpretation === 'L' || interpretation === 'LL' ?
              <LowIcon fontSize="small" color="error" /> :
              isAbnormal ? <AbnormalIcon fontSize="small" color="warning" /> : null
            }
            <Chip 
              label={getInterpretationDisplay()} 
              size="small" 
              color={isCritical ? 'error' : isAbnormal ? 'warning' : 'success'}
            />
          </Stack>
        )}
      </Stack>
    </Stack>
  );
  
  // Select appropriate icon
  const icon = isVitalSign ? <VitalIcon /> : isLab ? <LabIcon /> : null;
  
  return (
    <ClinicalResourceCard
      title={title}
      icon={icon}
      severity={getSeverityLevel()}
      status={observation.status}
      statusColor={observation.status === 'final' ? 'success' : 'default'}
      details={details}
      onEdit={onEdit}
      onMore={onMore}
      isAlternate={isAlternate}
    />
  );
};

export default ObservationCardTemplate;