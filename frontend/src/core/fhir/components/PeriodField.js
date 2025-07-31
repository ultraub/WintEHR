/**
 * PeriodField Component
 * Standardized FHIR Period input with start/end date handling
 */
import React from 'react';
import {
  Grid,
  FormControl,
  FormLabel,
  FormHelperText,
  Box,
  Typography
} from '@mui/material';
import DateTimeField from './DateTimeField';

const PeriodField = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  precision = 'minute', // 'date', 'minute', 'second'
  startLabel = 'Start',
  endLabel = 'End',
  allowOpenEnded = true, // Allow periods with only start or only end
  fullWidth = true,
  ...props
}) => {
  // Parse FHIR Period value
  const periodValue = value || {};
  const startValue = periodValue.start || '';
  const endValue = periodValue.end || '';

  // Handle start date change
  const handleStartChange = (newStart) => {
    const updatedPeriod = {
      ...periodValue,
      start: newStart
    };
    
    // Remove empty fields
    if (!updatedPeriod.start) delete updatedPeriod.start;
    if (!updatedPeriod.end) delete updatedPeriod.end;
    
    // Validate that start is before end if both are present
    if (updatedPeriod.start && updatedPeriod.end) {
      const startDate = new Date(updatedPeriod.start);
      const endDate = new Date(updatedPeriod.end);
      
      if (startDate >= endDate) {
        // Auto-adjust end date to be after start date
        const adjustedEndDate = new Date(startDate);
        adjustedEndDate.setHours(startDate.getHours() + 1); // Add 1 hour
        updatedPeriod.end = adjustedEndDate.toISOString();
      }
    }
    
    onChange(Object.keys(updatedPeriod).length > 0 ? updatedPeriod : null);
  };

  // Handle end date change
  const handleEndChange = (newEnd) => {
    const updatedPeriod = {
      ...periodValue,
      end: newEnd
    };
    
    // Remove empty fields
    if (!updatedPeriod.start) delete updatedPeriod.start;
    if (!updatedPeriod.end) delete updatedPeriod.end;
    
    // Validate that end is after start if both are present
    if (updatedPeriod.start && updatedPeriod.end) {
      const startDate = new Date(updatedPeriod.start);
      const endDate = new Date(updatedPeriod.end);
      
      if (endDate <= startDate) {
        // Auto-adjust start date to be before end date
        const adjustedStartDate = new Date(endDate);
        adjustedStartDate.setHours(endDate.getHours() - 1); // Subtract 1 hour
        updatedPeriod.start = adjustedStartDate.toISOString();
      }
    }
    
    onChange(Object.keys(updatedPeriod).length > 0 ? updatedPeriod : null);
  };

  // Validation
  const validatePeriod = () => {
    if (!allowOpenEnded && (!startValue || !endValue)) {
      return 'Both start and end dates are required';
    }
    
    if (startValue && endValue) {
      const startDate = new Date(startValue);
      const endDate = new Date(endValue);
      
      if (startDate >= endDate) {
        return 'Start date must be before end date';
      }
    }
    
    if (required && !startValue && !endValue) {
      return 'At least one date is required';
    }
    
    return null;
  };

  const validationError = validatePeriod();

  // Calculate duration if both dates are present
  const getDuration = () => {
    if (!startValue || !endValue) return null;
    
    const startDate = new Date(startValue);
    const endDate = new Date(endValue);
    const diffMs = endDate - startDate;
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  };

  const duration = getDuration();

  return (
    <FormControl fullWidth={fullWidth} error={!!(error || validationError)}>
      {label && (
        <FormLabel 
          required={required}
          sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 500 }}
        >
          {label}
        </FormLabel>
      )}
      
      <Grid container spacing={2}>
        {/* Start Date */}
        <Grid item xs={6}>
          <DateTimeField
            label={startLabel}
            value={startValue}
            onChange={handleStartChange}
            disabled={disabled}
            precision={precision}
            fullWidth
            maxDate={endValue ? new Date(endValue) : undefined}
            {...props}
          />
        </Grid>
        
        {/* End Date */}
        <Grid item xs={6}>
          <DateTimeField
            label={endLabel}
            value={endValue}
            onChange={handleEndChange}
            disabled={disabled}
            precision={precision}
            fullWidth
            minDate={startValue ? new Date(startValue) : undefined}
            {...props}
          />
        </Grid>
      </Grid>
      
      {/* Duration Display */}
      {duration && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Duration: {duration}
          </Typography>
        </Box>
      )}
      
      {/* Display current FHIR value for debugging (only in development) */}
      {process.env.NODE_ENV === 'development' && value && (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
          <code style={{ fontSize: '0.75rem' }}>
            {JSON.stringify(value, null, 2)}
          </code>
        </Box>
      )}
      
      {(error || validationError || helperText) && (
        <FormHelperText>
          {error || validationError || helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default PeriodField;