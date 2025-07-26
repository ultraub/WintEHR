/**
 * ClinicalTextField Component
 * Enhanced text field with clinical context awareness and validation
 */
import React from 'react';
import {
  TextField,
  InputAdornment,
  Box,
  Typography,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { 
  getClinicalContext, 
  getClinicalAnimation,
  getClinicalSpacing 
} from '../../../themes/clinicalThemeUtils';

const ClinicalTextField = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  clinicalContext,
  department,
  severity,
  urgency = 'normal',
  showValidation = true,
  validationStatus,
  clinicalHint,
  unit,
  maxNormalValue,
  minNormalValue,
  variant = 'outlined',
  fullWidth = true,
  ...props
}) => {
  const theme = useTheme();
  
  // Get clinical context
  const context = clinicalContext || getClinicalContext(
    window.location.pathname,
    new Date().getHours(),
    department
  );
  
  // Enhanced context
  const enhancedContext = {
    ...context,
    urgency
  };
  
  // Get clinical styling
  const spacing = getClinicalSpacing(theme, enhancedContext, 'compact');
  const animation = getClinicalAnimation(theme, 'hover', enhancedContext);
  
  // Determine field status
  const getFieldStatus = () => {
    if (error) return 'error';
    if (validationStatus) return validationStatus;
    
    // Check if value is within normal range
    if (maxNormalValue !== undefined || minNormalValue !== undefined) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        if (maxNormalValue !== undefined && numValue > maxNormalValue) return 'warning';
        if (minNormalValue !== undefined && numValue < minNormalValue) return 'warning';
        if (value) return 'success';
      }
    }
    
    return value && !error ? 'success' : 'default';
  };
  
  const fieldStatus = getFieldStatus();
  
  // Get status color
  const getStatusColor = () => {
    const statusColors = {
      error: theme.palette.error?.main || '#f44336',
      warning: theme.palette.warning?.main || '#ff9800',
      success: theme.palette.success?.main || '#4caf50',
      default: theme.palette.text.secondary
    };
    return statusColors[fieldStatus] || statusColors.default;
  };
  
  const statusColor = getStatusColor();
  
  // Get status icon
  const getStatusIcon = () => {
    if (!showValidation || fieldStatus === 'default') return null;
    
    const icons = {
      error: <ErrorIcon fontSize="small" />,
      warning: <WarningIcon fontSize="small" />,
      success: <CheckCircleIcon fontSize="small" />
    };
    
    return icons[fieldStatus];
  };
  
  const statusIcon = getStatusIcon();
  
  // Build helper text
  const buildHelperText = () => {
    if (error) return helperText || error;
    
    const parts = [];
    if (helperText) parts.push(helperText);
    
    // Add range information
    if (minNormalValue !== undefined || maxNormalValue !== undefined) {
      if (minNormalValue !== undefined && maxNormalValue !== undefined) {
        parts.push(`Normal range: ${minNormalValue}-${maxNormalValue}${unit ? ` ${unit}` : ''}`);
      } else if (minNormalValue !== undefined) {
        parts.push(`Normal: ≥ ${minNormalValue}${unit ? ` ${unit}` : ''}`);
      } else if (maxNormalValue !== undefined) {
        parts.push(`Normal: ≤ ${maxNormalValue}${unit ? ` ${unit}` : ''}`);
      }
    }
    
    return parts.join(' • ');
  };
  
  const finalHelperText = buildHelperText();
  
  // Enhanced field styles
  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      transition: `all ${animation.duration}ms ${animation.easing}`,
      '&:hover': {
        transform: animation.transform,
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: statusColor,
          borderWidth: 2
        }
      },
      '&.Mui-focused': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: statusColor,
          borderWidth: 2
        }
      },
      ...(fieldStatus !== 'default' && {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: alpha(statusColor, 0.5)
        }
      })
    },
    '& .MuiInputLabel-root': {
      ...(fieldStatus !== 'default' && {
        color: statusColor
      })
    },
    '& .MuiFormHelperText-root': {
      color: fieldStatus === 'error' ? statusColor : 'text.secondary'
    },
    ...(urgency === 'urgent' && {
      '& .MuiOutlinedInput-root': {
        animation: 'urgentPulse 3s infinite',
        '@keyframes urgentPulse': {
          '0%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.error?.main || '#f44336', 0)}` },
          '50%': { boxShadow: `0 0 0 4px ${alpha(theme.palette.error?.main || '#f44336', 0.1)}` },
          '100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.error?.main || '#f44336', 0)}` }
        }
      }
    }),
    ...props.sx
  };
  
  return (
    <Box sx={{ mb: spacing }}>
      {/* Clinical hint */}
      {clinicalHint && (
        <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <InfoIcon fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary">
            {clinicalHint}
          </Typography>
        </Box>
      )}
      
      <TextField
        label={label}
        value={value}
        onChange={onChange}
        error={fieldStatus === 'error'}
        helperText={finalHelperText}
        required={required}
        variant={variant}
        fullWidth={fullWidth}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {statusIcon && (
                <Box sx={{ color: statusColor, display: 'flex', alignItems: 'center' }}>
                  {statusIcon}
                </Box>
              )}
              {unit && value && (
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  {unit}
                </Typography>
              )}
            </InputAdornment>
          ),
          ...props.InputProps
        }}
        sx={fieldSx}
        {...props}
      />
      
      {/* Severity indicator */}
      {severity && (
        <Box sx={{ mt: 1 }}>
          <Chip
            size="small"
            label={`${severity.toUpperCase()} SEVERITY`}
            sx={{
              backgroundColor: alpha(theme.palette.error?.main || '#f44336', 0.1),
              color: theme.palette.error?.main || '#f44336',
              border: `1px solid ${alpha(theme.palette.error?.main || '#f44336', 0.3)}`,
              fontWeight: 600,
              height: 20
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default ClinicalTextField;