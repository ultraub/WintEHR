/**
 * DateTimeField Component
 * Standardized FHIR date/time input with timezone support
 */
import React from 'react';
import {
  TextField,
  FormControl,
  FormLabel,
  FormHelperText,
  Box
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

const DateTimeField = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  precision = 'minute', // 'date', 'minute', 'second'
  format,
  minDate,
  maxDate,
  placeholder,
  fullWidth = true,
  ...props
}) => {
  // Convert string value to Date object if needed
  const dateValue = value ? (typeof value === 'string' ? new Date(value) : value) : null;

  // Handle date change and convert to FHIR format
  const handleDateChange = (newDate) => {
    if (!newDate || isNaN(newDate.getTime())) {
      onChange('');
      return;
    }

    let fhirDateString;
    switch (precision) {
      case 'date':
        fhirDateString = newDate.toISOString().split('T')[0]; // YYYY-MM-DD
        break;
      case 'second':
        fhirDateString = newDate.toISOString(); // Full ISO string
        break;
      case 'minute':
      default:
        // Remove seconds and milliseconds for minute precision
        fhirDateString = newDate.toISOString().slice(0, 16) + ':00Z';
        break;
    }

    onChange(fhirDateString);
  };

  // Determine display format based on precision
  const getDisplayFormat = () => {
    if (format) return format;
    
    switch (precision) {
      case 'date':
        return 'MM/dd/yyyy';
      case 'second':
        return 'MM/dd/yyyy hh:mm:ss a';
      case 'minute':
      default:
        return 'MM/dd/yyyy hh:mm a';
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <FormControl fullWidth={fullWidth} error={!!error}>
        {label && (
          <FormLabel 
            required={required}
            sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 500 }}
          >
            {label}
          </FormLabel>
        )}
        
        <DateTimePicker
          value={dateValue}
          onChange={handleDateChange}
          disabled={disabled}
          format={getDisplayFormat()}
          minDate={minDate}
          maxDate={maxDate}
          views={precision === 'date' ? ['year', 'month', 'day'] : ['year', 'month', 'day', 'hours', 'minutes']}
          slotProps={{
            textField: {
              fullWidth: fullWidth,
              placeholder: placeholder,
              error: !!error,
              variant: 'outlined',
              size: 'small',
              ...props
            }
          }}
        />
        
        {(error || helperText) && (
          <FormHelperText>
            {error || helperText}
          </FormHelperText>
        )}
      </FormControl>
    </LocalizationProvider>
  );
};

export default DateTimeField;