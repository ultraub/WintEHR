/**
 * ClinicalTextField Component
 * Enhanced text field with clinical validation, search, and context-aware features
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Box,
  Typography,
  CircularProgress,
  Tooltip,
  Alert,
  useTheme,
  alpha,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as ClearIcon,
  Warning as WarningIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  TrendingUp as FrequentIcon,
  Article as TemplateIcon
} from '@mui/icons-material';
import { useClinicalValidation } from '../../../../hooks/useClinicalValidation';
import { useSpeechRecognition } from '../../../../hooks/useSpeechRecognition';
import { searchClinicalTerms } from '../../../../services/clinicalSearchService';

const ClinicalTextField = ({
  // Base props
  value,
  onChange,
  onBlur,
  error,
  helperText,
  
  // Clinical props
  resource,
  field,
  required = false,
  searchable = false,
  clinicalContext,
  
  // Features
  enableVoiceInput = false,
  showSuggestions = true,
  showValidation = true,
  showHistory = false,
  showTemplates = false,
  
  // Search config
  searchType, // 'diagnosis', 'medication', 'procedure', etc.
  searchOptions = {},
  
  // Validation
  validateOnBlur = true,
  validateOnChange = false,
  customValidation,
  
  // UI props
  label,
  placeholder,
  fullWidth = true,
  multiline = false,
  rows = 1,
  maxRows = 4,
  disabled = false,
  InputProps = {},
  ...textFieldProps
}) => {
  const theme = useTheme();
  const inputRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [validationState, setValidationState] = useState(null);
  const [validationMessage, setValidationMessage] = useState('');
  
  // Hooks
  const { validateField } = useClinicalValidation();
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    isSupported: voiceSupported 
  } = useSpeechRecognition();

  // Voice input effect
  useEffect(() => {
    if (transcript && isListening) {
      onChange({
        target: {
          value: value + ' ' + transcript
        }
      });
    }
  }, [transcript]);

  // Search handler
  const handleSearch = useCallback(async (searchTerm) => {
    if (!searchable || !searchTerm || searchTerm.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const results = await searchClinicalTerms({
        term: searchTerm,
        type: searchType,
        context: clinicalContext,
        ...searchOptions
      });

      // Format results based on type
      const formatted = results.map(result => ({
        ...result,
        primary: result.display || result.text,
        secondary: result.code ? `${result.system} | ${result.code}` : result.description,
        icon: getIconForType(result.type || searchType),
        frequent: result.useCount > 100,
        fromTemplate: result.isTemplate
      }));

      setSuggestions(formatted);
      if (formatted.length > 0) {
        setAnchorEl(inputRef.current);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, [searchable, searchType, clinicalContext, searchOptions]);

  // Validation handler
  const handleValidation = useCallback(async (fieldValue) => {
    if (!showValidation) return;

    const result = customValidation 
      ? await customValidation(fieldValue, clinicalContext)
      : await validateField(resource, field, fieldValue, clinicalContext);

    if (result.valid) {
      setValidationState('valid');
      setValidationMessage(result.message || '');
    } else if (result.warning) {
      setValidationState('warning');
      setValidationMessage(result.message);
    } else {
      setValidationState('error');
      setValidationMessage(result.message);
    }
  }, [showValidation, customValidation, resource, field, clinicalContext, validateField]);

  // Handlers
  const handleChange = (event) => {
    const newValue = event.target.value;
    onChange(event);

    // Search as user types
    if (searchable) {
      handleSearch(newValue);
    }

    // Validate on change if enabled
    if (validateOnChange) {
      handleValidation(newValue);
    }
  };

  const handleBlur = (event) => {
    onBlur?.(event);
    
    // Close suggestions
    setAnchorEl(null);
    
    // Validate on blur if enabled
    if (validateOnBlur) {
      handleValidation(event.target.value);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    // Update value with suggestion
    onChange({
      target: {
        value: suggestion.primary,
        suggestion: suggestion // Pass full suggestion data
      }
    });
    
    setAnchorEl(null);
    setSuggestions([]);
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Get validation icon
  const getValidationIcon = () => {
    switch (validationState) {
      case 'valid':
        return <ValidIcon color="success" fontSize="small" />;
      case 'warning':
        return <WarningIcon color="warning" fontSize="small" />;
      case 'error':
        return <ErrorIcon color="error" fontSize="small" />;
      default:
        return null;
    }
  };

  // Get icon for search result type
  const getIconForType = (type) => {
    switch (type) {
      case 'diagnosis':
        return '🩺';
      case 'medication':
        return '💊';
      case 'procedure':
        return '⚕️';
      case 'lab':
        return '🧪';
      default:
        return '📋';
    }
  };

  // Build input adornments
  const startAdornment = InputProps.startAdornment || (
    searchable && <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
  );

  const endAdornment = (
    <InputAdornment position="end">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {loading && <CircularProgress size={16} />}
        
        {showValidation && validationState && getValidationIcon()}
        
        {enableVoiceInput && voiceSupported && (
          <Tooltip title={isListening ? "Stop recording" : "Start voice input"}>
            <IconButton
              size="small"
              onClick={handleVoiceToggle}
              disabled={disabled}
              sx={{
                color: isListening ? 'error.main' : 'text.secondary',
                animation: isListening ? 'pulse 1.5s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                  '100%': { opacity: 1 }
                }
              }}
            >
              {isListening ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
          </Tooltip>
        )}
        
        {value && (
          <IconButton
            size="small"
            onClick={() => onChange({ target: { value: '' } })}
            disabled={disabled}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
        
        {InputProps.endAdornment}
      </Box>
    </InputAdornment>
  );

  return (
    <>
      <TextField
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        error={error || validationState === 'error'}
        helperText={
          validationMessage || helperText || (
            required && !value ? `${label || field} is required` : ''
          )
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {label}
            {required && <span style={{ color: theme.palette.error.main }}>*</span>}
            {searchable && <SearchIcon fontSize="small" sx={{ opacity: 0.5 }} />}
          </Box>
        }
        placeholder={placeholder || (searchable ? `Search ${searchType || 'terms'}...` : '')}
        fullWidth={fullWidth}
        multiline={multiline}
        rows={rows}
        maxRows={maxRows}
        disabled={disabled}
        InputProps={{
          ...InputProps,
          startAdornment,
          endAdornment
        }}
        {...textFieldProps}
      />

      {/* Suggestions popover */}
      <Popover
        open={Boolean(anchorEl) && suggestions.length > 0}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
        disableAutoFocus
        disableEnforceFocus
        PaperProps={{
          sx: {
            mt: 1,
            width: anchorEl?.offsetWidth,
            maxHeight: 300,
            overflow: 'auto'
          }
        }}
      >
        <List dense>
          {/* Group suggestions by type */}
          {showTemplates && suggestions.some(s => s.fromTemplate) && (
            <>
              <ListItem>
                <Typography variant="caption" color="text.secondary">
                  Templates
                </Typography>
              </ListItem>
              {suggestions.filter(s => s.fromTemplate).map((suggestion, index) => (
                <ListItem
                  key={`template-${index}`}
                  button
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <ListItemIcon>
                    <TemplateIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={suggestion.primary}
                    secondary={suggestion.secondary}
                  />
                </ListItem>
              ))}
              <Divider />
            </>
          )}

          {/* Frequent items */}
          {suggestions.some(s => s.frequent) && (
            <>
              <ListItem>
                <Typography variant="caption" color="text.secondary">
                  Frequently Used
                </Typography>
              </ListItem>
              {suggestions.filter(s => s.frequent && !s.fromTemplate).map((suggestion, index) => (
                <ListItem
                  key={`frequent-${index}`}
                  button
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <ListItemIcon>
                    <Box sx={{ fontSize: '1.2rem' }}>{suggestion.icon}</Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={suggestion.primary}
                    secondary={suggestion.secondary}
                  />
                  <FrequentIcon fontSize="small" color="action" />
                </ListItem>
              ))}
              <Divider />
            </>
          )}

          {/* Other suggestions */}
          <ListItem>
            <Typography variant="caption" color="text.secondary">
              Search Results
            </Typography>
          </ListItem>
          {suggestions.filter(s => !s.frequent && !s.fromTemplate).map((suggestion, index) => (
            <ListItem
              key={`result-${index}`}
              button
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <ListItemIcon>
                <Box sx={{ fontSize: '1.2rem' }}>{suggestion.icon}</Box>
              </ListItemIcon>
              <ListItemText
                primary={suggestion.primary}
                secondary={suggestion.secondary}
              />
            </ListItem>
          ))}
        </List>
      </Popover>

      {/* Voice input indicator */}
      {isListening && (
        <Alert
          severity="info"
          sx={{
            mt: 1,
            backgroundColor: alpha(theme.palette.info.main, 0.1)
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2">
              Listening... Speak clearly
            </Typography>
          </Box>
        </Alert>
      )}
    </>
  );
};

export default ClinicalTextField;