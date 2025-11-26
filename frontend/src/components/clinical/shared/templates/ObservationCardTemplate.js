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
import ClinicalResourceCard from '../cards/ClinicalResourceCard';
import { formatClinicalDate } from '../../../../core/fhir/utils/dateFormatUtils';
import {
  getInterpretationDisplay,
  isCriticalInterpretation,
  isAbnormalInterpretation
} from '../../../../core/fhir/utils/statusDisplayUtils';
import { getObservationValueDisplay } from '../../../../core/fhir/utils/fhirFieldUtils';

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
  
  // Extract value using standardized utility
  const valueDisplay = getObservationValueDisplay(observation);

  // Get interpretation using standardized utility
  const interpretation = observation.interpretation?.[0];
  const interpretationCode = interpretation?.coding?.[0]?.code;
  const interpretationInfo = getInterpretationDisplay(interpretation);
  const isAbnormal = isAbnormalInterpretation(interpretationCode);
  const isCritical = isCriticalInterpretation(interpretationCode);

  // Determine severity based on interpretation
  const getSeverityLevel = () => {
    if (isCritical) return 'critical';
    if (isAbnormal) return 'moderate';
    return 'normal';
  };
  
  // Build details array with enhanced FHIR fields
  const details = [];
  
  // Clinical codes and identifiers
  const observationCode = observation.code?.coding?.[0]?.code;
  const codeSystem = observation.code?.coding?.[0]?.system;
  if (observationCode) {
    let codeDisplay = observationCode;
    if (codeSystem?.includes('loinc')) codeDisplay += ' (LOINC)';
    if (codeSystem?.includes('snomed')) codeDisplay += ' (SNOMED)';
    details.push({ label: 'Code', value: codeDisplay });
  }
  
  // Identifiers
  const identifiers = observation.identifier?.map(id => `${id.type?.text || 'ID'}: ${id.value}`).join(', ');
  if (identifiers) {
    details.push({ label: 'Identifiers', value: identifiers });
  }
  
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
  
  // Method (how the observation was made)
  if (observation.method?.text || observation.method?.coding?.[0]?.display) {
    details.push({
      label: 'Method',
      value: observation.method?.text || observation.method?.coding?.[0]?.display || 'Unknown'
    });
  }
  
  // Device used
  if (observation.device?.display) {
    details.push({ label: 'Device', value: observation.device.display });
  }
  
  // Date/Time - using standardized date formatting
  const effectiveDate = observation.effectiveDateTime || observation.issued;
  if (effectiveDate) {
    details.push({
      label: 'Date',
      value: formatClinicalDate(effectiveDate, 'withTime')
    });
  }
  
  // Performer (enhanced with multiple performers)
  if (observation.performer?.length > 0) {
    const performers = observation.performer.map(p => p.display).filter(Boolean);
    if (performers.length > 0) {
      details.push({ 
        label: performers.length > 1 ? 'Performed by' : 'Performed by', 
        value: performers.join(', ') 
      });
    }
  }
  
  // Specimen information
  if (observation.specimen?.display) {
    details.push({ label: 'Specimen', value: observation.specimen.display });
  }
  
  // Body site
  if (observation.bodySite?.text || observation.bodySite?.coding?.[0]?.display) {
    details.push({
      label: 'Body site',
      value: observation.bodySite?.text || observation.bodySite?.coding?.[0]?.display || 'Unknown'
    });
  }
  
  // Component values (for complex observations)
  if (observation.component?.length > 0) {
    const components = observation.component.map(comp => {
      const compValue = comp.valueQuantity ? 
        `${comp.valueQuantity.value} ${comp.valueQuantity.unit || ''}` :
        comp.valueString || comp.valueCodeableConcept?.text;
      const compName = comp.code?.text || comp.code?.coding?.[0]?.display;
      return compName && compValue ? `${compName}: ${compValue}` : null;
    }).filter(Boolean);
    
    if (components.length > 0) {
      details.push({ 
        label: 'Components', 
        value: components.join('; ') 
      });
    }
  }
  
  // Enhanced interpretation details
  if (observation.interpretation?.length > 0) {
    const interpretations = observation.interpretation.map(interp => 
      interp.text || interp.coding?.[0]?.display
    ).filter(Boolean);
    if (interpretations.length > 0 && interpretations.join(', ') !== getInterpretationDisplay()) {
      details.push({ 
        label: 'Interpretation details', 
        value: interpretations.join(', ') 
      });
    }
  }
  
  // Category details
  if (observation.category?.length > 0) {
    const categories = observation.category.map(cat => 
      cat.text || cat.coding?.[0]?.display
    ).filter(Boolean);
    if (categories.length > 0) {
      details.push({ 
        label: 'Category', 
        value: categories.join(', ') 
      });
    }
  }
  
  // Related observations or derived from
  if (observation.derivedFrom?.length > 0) {
    const derivedFrom = observation.derivedFrom.map(ref => ref.display).filter(Boolean);
    if (derivedFrom.length > 0) {
      details.push({ 
        label: 'Derived from', 
        value: derivedFrom.join(', ') 
      });
    }
  }
  
  // Focus (what the observation is about, if not the patient)
  if (observation.focus?.length > 0) {
    const focus = observation.focus.map(f => f.display).filter(Boolean);
    if (focus.length > 0) {
      details.push({ 
        label: 'Focus', 
        value: focus.join(', ') 
      });
    }
  }
  
  // Notes
  if (observation.note?.[0]?.text) {
    details.push({ label: 'Notes', value: observation.note[0].text });
  }
  
  // Build title with value and interpretation using standardized utilities
  const title = (
    <Stack spacing={0.5}>
      <Typography variant="body1" fontWeight={600}>
        {observation.code?.text || observation.code?.coding?.[0]?.display || 'Unknown observation'}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="h6" fontWeight="bold" color={isCritical ? 'error' : 'text.primary'}>
          {valueDisplay}
        </Typography>
        {interpretationCode && (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {interpretationCode === 'H' || interpretationCode === 'HH' ?
              <HighIcon fontSize="small" color="error" /> :
              interpretationCode === 'L' || interpretationCode === 'LL' ?
              <LowIcon fontSize="small" color="error" /> :
              isAbnormal ? <AbnormalIcon fontSize="small" color="warning" /> : null
            }
            <Chip
              label={interpretationInfo.label}
              size="small"
              color={interpretationInfo.color === 'error' ? 'error' : interpretationInfo.color === 'warning' ? 'warning' : 'success'}
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