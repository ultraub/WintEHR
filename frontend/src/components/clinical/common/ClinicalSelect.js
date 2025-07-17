/**
 * ClinicalSelect Component
 * Enhanced select field with clinical context awareness and smart categorization
 */
import React, { useState } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  Box,
  Typography,
  ListSubheader,
  InputAdornment,
  IconButton,
  TextField,
  useTheme,
  alpha,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { 
  getClinicalContext,
  getSeverityColor,
  getClinicalAnimation 
} from '../../../themes/clinicalThemeUtils';

const ClinicalSelect = ({
  label,
  value,
  onChange,
  options = [],
  error,
  helperText,
  required = false,
  multiple = false,
  
  // Clinical props
  clinicalContext,
  department,
  urgency = 'normal',
  showCategories = true,
  showFrequent = true,
  frequentOptions = [],
  categorizeOptions = true,
  
  // Display props
  fullWidth = true,
  variant = 'outlined',
  size = 'medium',
  placeholder = 'Select an option',
  showSearch = true,
  
  // Enhanced features
  showSeverityIndicators = false,
  showClinicalCodes = false,
  optionRenderer,
  
  ...props
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
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
  
  // Get animation
  const animation = getClinicalAnimation(theme, 'hover', enhancedContext);
  
  // Filter options based on search
  const filteredOptions = options.filter(option => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      option.label?.toLowerCase().includes(searchLower) ||
      option.value?.toLowerCase().includes(searchLower) ||
      option.code?.toLowerCase().includes(searchLower)
    );
  });
  
  // Categorize options
  const categorizedOptions = () => {
    if (!categorizeOptions || !showCategories) return { uncategorized: filteredOptions };
    
    const categories = {};
    filteredOptions.forEach(option => {
      const category = option.category || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(option);
    });
    
    return categories;
  };
  
  const optionCategories = categorizedOptions();
  
  // Get field status
  const getFieldStatus = () => {
    if (error) return 'error';
    if (value && !error) return 'success';
    return 'default';
  };
  
  const fieldStatus = getFieldStatus();
  
  // Get status color
  const getStatusColor = () => {
    const statusColors = {
      error: theme.palette.error?.main || '#f44336',
      success: theme.palette.success?.main || '#4caf50',
      default: theme.palette.text.secondary
    };
    return statusColors[fieldStatus] || statusColors.default;
  };
  
  const statusColor = getStatusColor();
  
  // Render option with clinical enhancements
  const renderOption = (option) => {
    if (optionRenderer) {
      return optionRenderer(option);
    }
    
    const isFrequent = frequentOptions.includes(option.value);
    const severityColor = showSeverityIndicators && option.severity 
      ? getSeverityColor(theme, option.severity, enhancedContext)
      : null;
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', py: 0.5 }}>
        {/* Severity indicator */}
        {severityColor && (
          <Box
            sx={{
              width: 4,
              height: 24,
              backgroundColor: severityColor,
              borderRadius: 1,
              mr: 1.5
            }}
          />
        )}
        
        {/* Option content */}
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body2">
            {option.label}
          </Typography>
          {showClinicalCodes && option.code && (
            <Typography variant="caption" color="text.secondary">
              {option.code}
            </Typography>
          )}
        </Box>
        
        {/* Indicators */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isFrequent && (
            <StarIcon fontSize="small" sx={{ color: theme.palette.warning?.main || '#ff9800' }} />
          )}
          {option.warning && (
            <WarningIcon fontSize="small" sx={{ color: theme.palette.warning?.main || '#ff9800' }} />
          )}
        </Box>
      </Box>
    );
  };
  
  // Enhanced select styles
  const selectSx = {
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
    ...(urgency === 'urgent' && {
      '& .MuiOutlinedInput-root': {
        borderLeft: `4px solid ${theme.palette.error?.main || '#f44336'}`,
        paddingLeft: theme.spacing(1.5)
      }
    })
  };
  
  // Clear selection
  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ target: { value: multiple ? [] : '' } });
  };
  
  return (
    <FormControl 
      fullWidth={fullWidth} 
      error={fieldStatus === 'error'}
      variant={variant}
      size={size}
      sx={selectSx}
    >
      <InputLabel required={required}>{label}</InputLabel>
      <Select
        value={value}
        onChange={onChange}
        multiple={multiple}
        open={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => {
          setIsOpen(false);
          setSearchTerm('');
        }}
        label={label}
        placeholder={placeholder}
        endAdornment={
          value && (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={handleClear}
                sx={{ mr: 1 }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          )
        }
        MenuProps={{
          PaperProps: {
            sx: {
              maxHeight: 400,
              '& .MuiList-root': {
                pt: 0
              }
            }
          }
        }}
        {...props}
      >
        {/* Search field */}
        {showSearch && isOpen && (
          <Box sx={{ p: 2, position: 'sticky', top: 0, backgroundColor: 'background.paper', zIndex: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
          </Box>
        )}
        
        {/* Frequent options */}
        {showFrequent && frequentOptions.length > 0 && !searchTerm && (
          <>
            <ListSubheader sx={{ backgroundColor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StarIcon fontSize="small" color="action" />
                <Typography variant="caption" fontWeight={600}>
                  FREQUENTLY USED
                </Typography>
              </Box>
            </ListSubheader>
            {options
              .filter(opt => frequentOptions.includes(opt.value))
              .map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {renderOption(option)}
                </MenuItem>
              ))}
            <Divider />
          </>
        )}
        
        {/* Categorized options */}
        {Object.entries(optionCategories).map(([category, categoryOptions]) => (
          <React.Fragment key={category}>
            {showCategories && category !== 'uncategorized' && (
              <ListSubheader sx={{ backgroundColor: 'background.paper' }}>
                <Typography variant="caption" fontWeight={600}>
                  {category.toUpperCase()}
                </Typography>
              </ListSubheader>
            )}
            {categoryOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {renderOption(option)}
              </MenuItem>
            ))}
          </React.Fragment>
        ))}
        
        {/* No results */}
        {filteredOptions.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No options found
            </Typography>
          </Box>
        )}
      </Select>
      
      {/* Helper text */}
      {(helperText || error) && (
        <FormHelperText sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {fieldStatus === 'error' && <WarningIcon fontSize="small" />}
          {fieldStatus === 'success' && <CheckCircleIcon fontSize="small" />}
          {helperText || error}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default ClinicalSelect;