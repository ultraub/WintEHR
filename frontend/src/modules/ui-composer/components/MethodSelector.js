/**
 * Method Selector Component
 * Allows users to choose between different Claude authentication methods
 */

import React from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Collapse,
  IconButton,
  Select,
  MenuItem,
  InputLabel
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

const METHOD_INFO = {
  hooks: {
    name: 'Claude Code (Hooks)',
    description: 'Uses your active Claude Code session via hooks',
    requirements: 'Requires Claude Code to be running and authenticated',
    setup: 'No additional setup needed if Claude Code is running'
  },
  sdk: {
    name: 'Claude API (SDK)',
    description: 'Uses official Claude API with authentication key',
    requirements: 'Requires ANTHROPIC_API_KEY environment variable',
    setup: 'Set ANTHROPIC_API_KEY in backend .env file'
  },
  cli: {
    name: 'Claude CLI (Claude Max)',
    description: 'Uses Claude Max subscription via Claude Code CLI',
    requirements: 'Requires Claude Max subscription and authentication',
    setup: 'Run "claude auth login" in terminal'
  },
  development: {
    name: 'Development Mode',
    description: 'Template-based UI generation with REAL FHIR data',
    requirements: 'No authentication required - completely free',
    setup: 'Uses real patient data but generates simple templates'
  }
};

const MODEL_OPTIONS = [
  {
    value: 'claude-sonnet-4-20250514',
    name: 'Claude 4 Sonnet',
    description: 'Latest Sonnet model, excellent balance of speed and quality',
    speed: 'Fast',
    quality: 'Excellent'
  },
  {
    value: 'claude-opus-4-20250514',
    name: 'Claude 4 Opus',
    description: 'Latest Opus model, highest quality for complex UIs',
    speed: 'Slower',
    quality: 'Best'
  },
  {
    value: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Previous generation, fast and reliable',
    speed: 'Fast',
    quality: 'Good'
  },
  {
    value: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Previous generation Opus, high quality',
    speed: 'Slower',
    quality: 'Very Good'
  }
];

const MethodSelector = ({ 
  selectedMethod, 
  onMethodChange, 
  methodStatus,
  disabled = false,
  selectedModel,
  onModelChange
}) => {
  const [expandedInfo, setExpandedInfo] = React.useState(null);

  const handleMethodChange = (event) => {
    onMethodChange(event.target.value);
  };

  const toggleInfo = (method) => {
    setExpandedInfo(expandedInfo === method ? null : method);
  };

  const getStatusIcon = (status) => {
    if (!status) return <CircularProgress size={16} />;
    
    if (status.available) {
      return <CheckCircleIcon color="success" fontSize="small" />;
    } else {
      return <CancelIcon color="error" fontSize="small" />;
    }
  };

  const getStatusChip = (method, status) => {
    if (!status) {
      return <Chip size="small" label="Checking..." />;
    }

    if (status.available) {
      return (
        <Chip 
          size="small" 
          label="Available" 
          color="success" 
          icon={<CheckCircleIcon />}
        />
      );
    } else {
      return (
        <Chip 
          size="small" 
          label="Not Available" 
          color="error" 
          icon={<CancelIcon />}
        />
      );
    }
  };

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <FormControl component="fieldset" disabled={disabled} fullWidth>
        <FormLabel component="legend">
          <Typography variant="h6" gutterBottom>
            Authentication Method
          </Typography>
        </FormLabel>
        
        <RadioGroup
          value={selectedMethod}
          onChange={handleMethodChange}
          sx={{ mt: 1 }}
        >
          {Object.entries(METHOD_INFO).map(([method, info]) => {
            const status = methodStatus?.[method];
            const isAvailable = status?.available;
            
            return (
              <Box key={method} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <FormControlLabel
                    value={method}
                    control={<Radio />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">{info.name}</Typography>
                        {getStatusChip(method, status)}
                      </Box>
                    }
                    disabled={!isAvailable && method !== 'development'}
                  />
                  <IconButton
                    size="small"
                    onClick={() => toggleInfo(method)}
                    sx={{ ml: 'auto' }}
                  >
                    {expandedInfo === method ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                
                <Collapse in={expandedInfo === method}>
                  <Box sx={{ ml: 4, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {info.description}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Requirements:</strong> {info.requirements}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Setup:</strong> {info.setup}
                    </Typography>
                    
                    {status?.error && (
                      <Alert severity="error" sx={{ mt: 1 }} icon={<CancelIcon />}>
                        {status.error}
                      </Alert>
                    )}
                    
                    {status?.message && (
                      <Alert severity="info" sx={{ mt: 1 }} icon={<InfoIcon />}>
                        {status.message}
                      </Alert>
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </RadioGroup>
        
        {selectedMethod && (
          <Alert 
            severity={methodStatus?.[selectedMethod]?.available ? "success" : "warning"} 
            sx={{ mt: 2 }}
          >
            {methodStatus?.[selectedMethod]?.available ? (
              <>
                <strong>{METHOD_INFO[selectedMethod].name}</strong> is ready to use.
              </>
            ) : (
              <>
                <strong>{METHOD_INFO[selectedMethod].name}</strong> requires setup.
                {' '}{METHOD_INFO[selectedMethod].setup}
              </>
            )}
          </Alert>
        )}
      </FormControl>
      
      {/* Model Selection - Only show for SDK and CLI methods */}
      {(selectedMethod === 'sdk' || selectedMethod === 'cli') && onModelChange && (
        <FormControl fullWidth sx={{ mt: 3 }}>
          <InputLabel id="model-select-label">AI Model</InputLabel>
          <Select
            labelId="model-select-label"
            id="model-select"
            value={selectedModel || 'claude-3-5-sonnet-20241022'}
            label="AI Model"
            onChange={(e) => onModelChange(e.target.value)}
            disabled={disabled}
          >
            {MODEL_OPTIONS.map((model) => (
              <MenuItem key={model.value} value={model.value}>
                <Box>
                  <Typography variant="body1">{model.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {model.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    <Chip label={`Speed: ${model.speed}`} size="small" variant="outlined" />
                    <Chip label={`Quality: ${model.quality}`} size="small" variant="outlined" />
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </Select>
          
          {selectedModel && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {MODEL_OPTIONS.find(m => m.value === selectedModel)?.description}
            </Typography>
          )}
        </FormControl>
      )}
    </Paper>
  );
};

export default MethodSelector;